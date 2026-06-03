import { NextRequest, NextResponse }  from 'next/server'
import { createServerClient }          from '@/lib/supabase/server'

// POST /api/weeks — open a new week
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId, weekStartDate } = await req.json()

  // Verify team belongs to user
  const { data: team } = await supabase.from('teams')
    .select('id').eq('id', teamId).eq('admin_id', user.id).single()
  if (!team) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.from('weeks')
    .upsert({ team_id: teamId, week_start_date: weekStartDate, status: 'open' },
      { onConflict: 'team_id,week_start_date' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
