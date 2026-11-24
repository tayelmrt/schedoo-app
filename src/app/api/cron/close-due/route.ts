import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import { exportWeek }                from '@/lib/exportWeek'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/cron/close-due
// Called on a schedule (Supabase pg_cron) to auto-close any week whose
// `auto_close_at` has passed: locks registration and emails the schedule.
// Protected by a shared secret so only the scheduler can trigger it.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 503 })

  const auth = req.headers.get('authorization') ?? ''
  const hdr  = req.headers.get('x-cron-secret') ?? ''
  const ok = hdr === secret || auth === `Bearer ${secret}`
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: due, error } = await svc
    .from('weeks')
    .select('id')
    .not('auto_close_at', 'is', null)
    .lte('auto_close_at', nowIso)
    .eq('registration_locked', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { weekId: string; emailed: boolean; error: string | null }[] = []
  for (const w of due ?? []) {
    // Lock first so a slow export can't let the same week be picked up twice.
    await svc.from('weeks')
      .update({ registration_locked: true, auto_closed_at: nowIso })
      .eq('id', w.id)
    try {
      const r = await exportWeek(w.id)
      results.push({ weekId: w.id, emailed: r.emailed, error: r.email_error })
    } catch (e: any) {
      results.push({ weekId: w.id, emailed: false, error: e?.message ?? 'export failed' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}

export const POST = handle
export const GET  = handle   // allow GET so Vercel Cron / simple pings also work
