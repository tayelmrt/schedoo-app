import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

// GET /api/schedule/[token]
// Returns agent info, shifts, and ALL open weeks with their existing entries
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient()

  // 1. Find agent by token
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('share_token', params.token)
    .single()

  if (!agent)
    return NextResponse.json({ error: 'الرابط غير صحيح. تواصل مع المسؤول.' }, { status: 404 })

  if (!agent.is_active)
    return NextResponse.json({ error: 'هذا الحساب غير نشط.' }, { status: 403 })

  // 2. Get shifts for team
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('team_id', agent.team_id)
    .order('sort_order')

  // 3. Get all OPEN weeks for this team
  const { data: openWeeks } = await supabase
    .from('weeks')
    .select('*')
    .eq('team_id', agent.team_id)
    .eq('status', 'open')
    .order('week_start_date', { ascending: true })

  if (!openWeeks || openWeeks.length === 0) {
    return NextResponse.json({
      agent,
      shifts: shifts ?? [],
      openWeeks: [],
    })
  }

  // 4. For each open week, get agent's existing entries
  const weeksWithEntries = await Promise.all(
    openWeeks.map(async (week) => {
      const { data: entries } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('week_id', week.id)
        .eq('agent_id', agent.id)

      return { week, entries: entries ?? [] }
    })
  )

  return NextResponse.json({
    agent,
    shifts:    shifts ?? [],
    openWeeks: weeksWithEntries,
  })
}

// POST /api/schedule/[token] — agent submits schedule for a specific week
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient()
  const body     = await req.json()
  const { weekId, selection } = body // selection: { [day: string]: shiftId | null }

  // Verify agent
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('share_token', params.token)
    .single()

  if (!agent)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Verify week belongs to agent's team and is open
  const { data: week } = await supabase
    .from('weeks')
    .select('*')
    .eq('id', weekId)
    .single()

  if (!week || week.team_id !== agent.team_id)
    return NextResponse.json({ error: 'أسبوع غير صحيح' }, { status: 400 })

  if (week.status === 'confirmed')
    return NextResponse.json({ error: 'تم تأكيد الجدول ولا يمكن التعديل' }, { status: 400 })

  // Upsert entries for all 7 days
  const upserts = Object.entries(selection).map(([day, shiftId]) => ({
    week_id:      weekId,
    agent_id:     agent.id,
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
