import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextResponse }              from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

// GET /api/me/month — agent's own data needed to render their monthly view
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not-authenticated' }, { status: 401 })

  const svc = createServiceClient()
  const { data: agent } = await svc
    .from('agents').select('*').eq('auth_user_id', user.id).maybeSingle()
  if (!agent) return NextResponse.json({ error: 'no-agent' }, { status: 403 })
  if (agent.status !== 'approved') return NextResponse.json({ error: 'pending' }, { status: 403 })

  const [{ data: shifts }, { data: weeks }, { data: holidays }, { data: comps }] = await Promise.all([
    svc.from('shifts').select('*').eq('team_id', agent.team_id).order('sort_order'),
    svc.from('weeks').select('id, week_start_date').eq('team_id', agent.team_id),
    svc.from('holidays').select('id, date, name').eq('team_id', agent.team_id),
    svc.from('compensation_days')
       .select('id, holiday_name, holiday_date, granted, used, used_date')
       .eq('agent_id', agent.id),
  ])

  let entries: any[] = []
  if (weeks && weeks.length > 0) {
    const { data } = await svc
      .from('schedule_entries')
      .select('week_id, day_of_week, shift_id')
      .eq('agent_id', agent.id)
      .in('week_id', weeks.map(w => w.id))
    entries = data ?? []
  }

  return NextResponse.json({
    agent:    { id: agent.id, name: agent.name },
    shifts:   shifts ?? [],
    weeks:    weeks ?? [],
    holidays: holidays ?? [],
    comps:    comps ?? [],
    entries,
  })
}
