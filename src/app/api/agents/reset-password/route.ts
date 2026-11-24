import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

// POST /api/agents/reset-password { agentId, password }
// A manager sets a new password for one of their team's agents (no email needed).
// Works whether or not the agent is already linked to its auth account — if it
// isn't, we find the account by email and link it on the way.
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not-authenticated' }, { status: 401 })

  const { agentId, password } = await req.json()
  if (!password || String(password).length < 6)
    return NextResponse.json({ error: 'weak-password' }, { status: 400 })

  // Authorization via RLS: the manager can only read agents of teams they manage.
  const { data: agent } = await supabase
    .from('agents').select('id, email, auth_user_id').eq('id', agentId).maybeSingle()
  if (!agent) return NextResponse.json({ error: 'not-authorized' }, { status: 403 })

  const svc = createServiceClient()

  // Resolve the auth user: prefer the linked id, else look it up by email.
  let authUserId = agent.auth_user_id as string | null
  if (!authUserId) {
    const email = (agent.email ?? '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'no-account' }, { status: 400 })
    const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = list?.users.find(u => (u.email ?? '').toLowerCase() === email)
    if (!found) return NextResponse.json({ error: 'no-account' }, { status: 400 })
    authUserId = found.id
    // Link the agent so future actions (and /me) resolve it directly.
    await svc.from('agents').update({ auth_user_id: authUserId }).eq('id', agent.id)
  }

  const { error } = await svc.auth.admin.updateUserById(authUserId, { password: String(password) })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
