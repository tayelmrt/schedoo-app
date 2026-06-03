import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

// GET /api/team/[teamToken]
// Returns team info, all agents (names), shifts, and open weeks with all entries
export async function GET(
  _req: NextRequest,
  { params }: { params: { teamToken: string } }
) {
  const supabase = createServiceClient()

  // 1. Find team by token
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, share_token')
    .eq('share_token', params.teamToken)
    .single()

  if (!team)
    return NextResponse.json({ error: 'الرابط غير صحيح. تواصل مع المسؤول.' }, { status: 404 })

  // 2. Agents (active only)
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name')
    .eq('team_id', team.id)
    .eq('is_active', true)
    .order('name')

  // 3. Shifts
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('team_id', team.id)
    .order('sort_order')

  // 4. Open weeks
  const { data: openWeeks } = await supabase
    .from('weeks')
    .select('*')
    .eq('team_id', team.id)
    .eq('status', 'open')
    .order('week_start_date', { ascending: true })

  if (!openWeeks || openWeeks.length === 0) {
    return NextResponse.json({ team, agents: agents ?? [], shifts: shifts ?? [], openWeeks: [] })
  }

  // 5. All entries for those weeks (so each agent sees their own pre-filled)
  const weekIds = openWeeks.map(w => w.id)
  const { data: entries } = await supabase
    .from('schedule_entries')
    .select('week_id, agent_id, day_of_week, shift_id')
    .in('week_id', weekIds)

  return NextResponse.json({
    team,
    agents:    agents ?? [],
    shifts:    shifts ?? [],
    openWeeks,
    entries:   entries ?? [],
  })
}

// POST /api/team/[teamToken] — an agent submits their schedule
export async function POST(
  req: NextRequest,
  { params }: { params: { teamToken: string } }
) {
  const supabase = createServiceClient()
  const { agentId, weekId, selection } = await req.json()

  // Verify team by token
  const { data: team } = await supabase
    .from('teams').select('id').eq('share_token', params.teamToken).single()
  if (!team)
    return NextResponse.json({ error: 'رابط غير صحيح' }, { status: 401 })

  // Verify agent belongs to this team
  const { data: agent } = await supabase
    .from('agents').select('id, team_id').eq('id', agentId).single()
  if (!agent || agent.team_id !== team.id)
    return NextResponse.json({ error: 'أجينت غير صحيح' }, { status: 400 })

  // Verify week belongs to team and is open
  const { data: week } = await supabase
    .from('weeks').select('*').eq('id', weekId).single()
  if (!week || week.team_id !== team.id)
    return NextResponse.json({ error: 'أسبوع غير صحيح' }, { status: 400 })
  if (week.status === 'confirmed')
    return NextResponse.json({ error: 'تم تأكيد الجدول ولا يمكن التعديل' }, { status: 400 })

  // Upsert all 7 days
  const upserts = Object.entries(selection).map(([day, shiftId]) => ({
    week_id:      weekId,
    agent_id:     agentId,
    day_of_week:  parseInt(day),
    shift_id:     shiftId || null,
    status:       'submitted',
    submitted_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('schedule_entries')
    .upsert(upserts, { onConflict: 'week_id,agent_id,day_of_week' })

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
