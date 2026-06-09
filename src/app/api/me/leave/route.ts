import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

async function resolveAgent() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not-authenticated' as const }
  const svc = createServiceClient()
  const { data: agent } = await svc.from('agents').select('*').eq('auth_user_id', user.id).maybeSingle()
  if (!agent) return { error: 'no-agent' as const }
  return { svc, agent }
}

function dayCount(start: string, end: string): number {
  const s = new Date(start), e = new Date(end)
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
}

// GET — balances + my requests
export async function GET() {
  const r = await resolveAgent()
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 401 })
  const { svc, agent } = r
  if (agent.status !== 'approved') return NextResponse.json({ error: 'pending' }, { status: 403 })

  const { data: requests } = await svc
    .from('leave_requests').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false })

  const approved = (requests ?? []).filter(x => x.status === 'approved')
  const annualUsed = approved.filter(x => x.type === 'annual').reduce((s, x) => s + x.days, 0)
  const sickUsed   = approved.filter(x => x.type === 'sick').reduce((s, x) => s + x.days, 0)

  return NextResponse.json({
    agent: { name: agent.name },
    balance: {
      annual_entitlement: agent.annual_entitlement ?? 21,
      sick_entitlement:   agent.sick_entitlement ?? 6,
      annual_used: annualUsed,
      sick_used:   sickUsed,
      annual_remaining: (agent.annual_entitlement ?? 21) - annualUsed,
      sick_remaining:   (agent.sick_entitlement ?? 6) - sickUsed,
    },
    requests: requests ?? [],
  })
}

// POST — create a leave request
export async function POST(req: NextRequest) {
  const r = await resolveAgent()
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 401 })
  const { svc, agent } = r
  if (agent.status !== 'approved') return NextResponse.json({ error: 'pending' }, { status: 403 })

  const { type, start_date, end_date, reason } = await req.json()
  if (!['annual','sick','unpaid'].includes(type) || !start_date || !end_date)
    return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
  if (new Date(end_date) < new Date(start_date))
    return NextResponse.json({ error: 'تاريخ النهاية قبل البداية' }, { status: 400 })

  const days = dayCount(start_date, end_date)

  const { error } = await svc.from('leave_requests').insert({
    team_id: agent.team_id, agent_id: agent.id, type, start_date, end_date, days,
    reason: reason || null, status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
