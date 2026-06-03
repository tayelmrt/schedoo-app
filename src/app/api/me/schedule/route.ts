import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

/** Resolve the approved agent record for the current session, or null */
async function resolveAgent() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not-authenticated' as const }

  const svc = createServiceClient()
  const { data: agent } = await svc
    .from('agents').select('*').eq('auth_user_id', user.id).maybeSingle()

  if (!agent) {
    // try linking by email
    const email = (user.email ?? '').toLowerCase()
    const { data: byEmail } = await svc.from('agents').select('*').ilike('email', email).maybeSingle()
    if (!byEmail) return { error: 'no-agent' as const }
    if (!byEmail.auth_user_id) await svc.from('agents').update({ auth_user_id: user.id }).eq('id', byEmail.id)
    return { svc, agent: byEmail }
  }
  return { svc, agent }
}

// GET /api/me/schedule
export async function GET() {
  const r = await resolveAgent()
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 401 })
  const { svc, agent } = r
  if (agent.status !== 'approved')
    return NextResponse.json({ error: 'pending', agent: { name: agent.name } }, { status: 403 })

  const [{ data: shifts }, { data: requirements }, { data: openWeeks }] = await Promise.all([
    svc.from('shifts').select('*').eq('team_id', agent.team_id).order('sort_order'),
    svc.from('requirements').select('day_of_week, shift_id, min_agents_required, max_agents').eq('team_id', agent.team_id),
    svc.from('weeks').select('*').eq('team_id', agent.team_id).eq('status', 'open').order('week_start_date'),
  ])

  let entries: any[] = []
  if (openWeeks && openWeeks.length > 0) {
    const { data } = await svc
      .from('schedule_entries')
      .select('week_id, agent_id, day_of_week, shift_id')
      .in('week_id', openWeeks.map(w => w.id))
    entries = data ?? []
  }

  const { data: team } = await svc.from('teams').select('id, name').eq('id', agent.team_id).single()

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name },
    team,
    shifts: shifts ?? [],
    requirements: requirements ?? [],
    openWeeks: openWeeks ?? [],
    entries,
  })
}

// POST /api/me/schedule — submit own schedule for a week
export async function POST(req: NextRequest) {
  const r = await resolveAgent()
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 401 })
  const { svc, agent } = r
  if (agent.status !== 'approved')
    return NextResponse.json({ error: 'pending' }, { status: 403 })

  const { weekId, selection } = await req.json()

  const { data: week } = await svc.from('weeks').select('*').eq('id', weekId).single()
  if (!week || week.team_id !== agent.team_id)
    return NextResponse.json({ error: 'أسبوع غير صحيح' }, { status: 400 })
  if (week.status === 'confirmed')
    return NextResponse.json({ error: 'تم تأكيد الجدول ولا يمكن التعديل' }, { status: 400 })

  // Enforce max capacity
  const { data: reqs } = await svc
    .from('requirements').select('day_of_week, shift_id, max_agents')
    .eq('team_id', agent.team_id).not('max_agents', 'is', null)

  if (reqs && reqs.length > 0) {
    const { data: others } = await svc
      .from('schedule_entries').select('day_of_week, shift_id, agent_id')
      .eq('week_id', weekId).neq('agent_id', agent.id)
    const full: string[] = []
    for (const [day, shiftId] of Object.entries(selection)) {
      if (!shiftId) continue
      const req = reqs.find(x => x.day_of_week === parseInt(day) && x.shift_id === shiftId)
      if (!req || req.max_agents == null) continue
      const taken = (others ?? []).filter(e => e.day_of_week === parseInt(day) && e.shift_id === shiftId).length
      if (taken >= req.max_agents) full.push(day)
    }
    if (full.length > 0)
      return NextResponse.json({ error: 'بعض الشيفتات امتلأت. حدّث الصفحة واختر غيرها.' }, { status: 409 })
  }

  const upserts = Object.entries(selection).map(([day, shiftId]) => ({
    week_id: weekId, agent_id: agent.id, day_of_week: parseInt(day),
    shift_id: shiftId || null, status: 'submitted', submitted_at: new Date().toISOString(),
  }))
  const { error } = await svc.from('schedule_entries').upsert(upserts, { onConflict: 'week_id,agent_id,day_of_week' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
