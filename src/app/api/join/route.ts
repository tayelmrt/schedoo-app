import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

// GET /api/join?token=... — public lookup of the invited team (name + org)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'no-token' }, { status: 400 })

  const svc = createServiceClient()
  const { data: team } = await svc.from('teams')
    .select('id, name, org_id').eq('share_token', token).maybeSingle()
  if (!team) return NextResponse.json({ error: 'invalid' }, { status: 404 })

  const { data: org } = await svc.from('organizations')
    .select('name').eq('id', team.org_id).maybeSingle()

  return NextResponse.json({ teamName: team.name, orgName: org?.name ?? '' })
}

// POST /api/join { token, name } — authenticated user joins the team as a pending agent
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not-authenticated' }, { status: 401 })

  const { token, name } = await req.json()
  const svc = createServiceClient()

  const { data: team } = await svc.from('teams')
    .select('id').eq('share_token', token).maybeSingle()
  if (!team) return NextResponse.json({ error: 'invalid' }, { status: 404 })

  const email = (user.email ?? '').toLowerCase()

  // Already an agent of this team? (by auth id or email) → idempotent
  const { data: byUser } = await svc.from('agents')
    .select('id, status').eq('team_id', team.id).eq('auth_user_id', user.id).maybeSingle()
  let agent = byUser
  if (!agent && email) {
    const { data: byEmail } = await svc.from('agents')
      .select('id, status, auth_user_id').eq('team_id', team.id).ilike('email', email).maybeSingle()
    if (byEmail) {
      if (!byEmail.auth_user_id) await svc.from('agents').update({ auth_user_id: user.id }).eq('id', byEmail.id)
      agent = byEmail
    }
  }

  if (agent) return NextResponse.json({ status: agent.status })

  if (!name || !String(name).trim())
    return NextResponse.json({ error: 'need-name' }, { status: 400 })

  const { error } = await svc.from('agents').insert({
    team_id:       team.id,
    name:          String(name).trim(),
    email:         email || null,
    auth_user_id:  user.id,
    status:        'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'pending' })
}
