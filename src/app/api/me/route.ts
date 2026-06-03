import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextResponse }              from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

// GET /api/me — resolves the logged-in user's role and links agent records
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ role: 'none', authenticated: false })

  const email = (user.email ?? '').toLowerCase()
  const svc   = createServiceClient()

  // 1. Admin? (owns a team OR is a co-admin by email)
  const { data: adminTeams } = await svc
    .from('teams')
    .select('id, name')
    .or(`admin_id.eq.${user.id},admin_emails.cs.{${email}}`)

  if (adminTeams && adminTeams.length > 0) {
    return NextResponse.json({ role: 'admin', email, teams: adminTeams })
  }

  // 2. Agent? Link by email if a matching agent row exists and isn't linked yet
  const { data: agentByEmail } = await svc
    .from('agents')
    .select('*')
    .ilike('email', email)
    .maybeSingle()

  if (agentByEmail) {
    // Link the auth user to this agent record on first login
    if (!agentByEmail.auth_user_id) {
      await svc.from('agents').update({ auth_user_id: user.id }).eq('id', agentByEmail.id)
      agentByEmail.auth_user_id = user.id
    }
    const { data: team } = await svc
      .from('teams').select('id, name').eq('id', agentByEmail.team_id).single()

    return NextResponse.json({
      role:   'agent',
      email,
      status: agentByEmail.status,          // 'pending' | 'approved'
      agent:  { id: agentByEmail.id, name: agentByEmail.name, team_id: agentByEmail.team_id },
      team,
    })
  }

  // 3. Already linked agent (email changed?) — fallback by auth_user_id
  const { data: agentByUser } = await svc
    .from('agents').select('*').eq('auth_user_id', user.id).maybeSingle()

  if (agentByUser) {
    const { data: team } = await svc
      .from('teams').select('id, name').eq('id', agentByUser.team_id).single()
    return NextResponse.json({
      role: 'agent', email, status: agentByUser.status,
      agent: { id: agentByUser.id, name: agentByUser.name, team_id: agentByUser.team_id },
      team,
    })
  }

  // 4. No role — signed up but not added by any admin
  return NextResponse.json({ role: 'none', authenticated: true, email })
}
