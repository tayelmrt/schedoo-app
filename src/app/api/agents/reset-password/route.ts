import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

// POST /api/agents/reset-password { agentId, password }
// A manager sets a new password for one of their team's agents (no email needed).
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not-authenticated' }, { status: 401 })

  const { agentId, password } = await req.json()
  if (!password || String(password).length < 6)
    return NextResponse.json({ error: 'weak-password' }, { status: 400 })

  // Authorization via RLS: the manager can only read agents of teams they manage.
  const { data: agent } = await supabase
    .from('agents').select('id, auth_user_id').eq('id', agentId).maybeSingle()
  if (!agent) return NextResponse.json({ error: 'not-authorized' }, { status: 403 })
  if (!agent.auth_user_id) return NextResponse.json({ error: 'no-account' }, { status: 400 })

  // Reset the password with the service role admin API
  const svc = createServiceClient()
  const { error } = await svc.auth.admin.updateUserById(agent.auth_user_id, { password: String(password) })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
