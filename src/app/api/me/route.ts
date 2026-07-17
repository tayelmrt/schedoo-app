import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                   from 'next/headers'
import { NextResponse }              from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'

const MANAGER_ROLES = ['owner', 'admin', 'account_manager', 'team_manager']

// GET /api/me — resolves the logged-in user's role in the multi-tenant model.
// Returns: { authenticated, role, isManager, email, org, accounts, teams, agent, status }
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ authenticated: false, role: 'none' })

  const email = (user.email ?? '').toLowerCase()
  const svc   = createServiceClient()

  // ── Gather the user's org-level position ──────────────────────────────
  const [{ data: ownedOrgs }, { data: memberships }, { data: legacyTeams }] = await Promise.all([
    svc.from('organizations').select('id, name').eq('owner_id', user.id),
    svc.from('memberships').select('*').eq('user_id', user.id),
    // legacy owner/co-admin (pre-multitenant) — kept for backward compatibility
    svc.from('teams').select('id, name, org_id, account_id, manager_emails')
       .or(`admin_id.eq.${user.id},admin_emails.cs.{${email}}`),
  ])

  const owned  = ownedOrgs   ?? []
  const mems   = memberships ?? []
  const legacy = legacyTeams ?? []

  // Link any memberships that were invited by email before this user signed up
  const { data: emailMems } = await svc.from('memberships').select('*').ilike('email', email).is('user_id', null)
  if (emailMems && emailMems.length) {
    await svc.from('memberships').update({ user_id: user.id }).ilike('email', email).is('user_id', null)
    for (const m of emailMems) { m.user_id = user.id; if (!mems.some(x => x.id === m.id)) mems.push(m) }
  }

  // ── Determine the highest role ────────────────────────────────────────
  let role: string = 'none'
  if      (owned.length || mems.some(m => m.role === 'owner')) role = 'owner'
  else if (mems.some(m => m.role === 'admin'))                 role = 'admin'
  else if (mems.some(m => m.role === 'account_manager'))       role = 'account_manager'
  else if (mems.some(m => m.role === 'team_manager'))          role = 'team_manager'
  else if (legacy.length)                                      role = 'admin' // legacy admin

  // ── Resolve the primary organization ──────────────────────────────────
  const orgId: string | null =
    owned[0]?.id ?? mems[0]?.org_id ?? legacy[0]?.org_id ?? null

  let org: { id: string; name: string } | null = null
  if (orgId) {
    const { data } = await svc.from('organizations').select('id, name').eq('id', orgId).maybeSingle()
    org = data
  }

  // ── Manageable accounts + teams (managers only) ───────────────────────
  let accounts: any[] = []
  let teams: any[]    = []

  if (MANAGER_ROLES.includes(role) && orgId) {
    if (role === 'owner' || role === 'admin') {
      const [{ data: accs }, { data: tms }] = await Promise.all([
        svc.from('accounts').select('id, name, org_id, coverage_type, week_start_day').eq('org_id', orgId).order('created_at'),
        svc.from('teams').select('id, name, org_id, account_id, manager_emails').eq('org_id', orgId).order('created_at'),
      ])
      accounts = accs ?? []; teams = tms ?? []
    } else if (role === 'account_manager') {
      const accIds = mems.filter(m => m.role === 'account_manager' && m.account_id).map(m => m.account_id)
      if (accIds.length) {
        const [{ data: accs }, { data: tms }] = await Promise.all([
          svc.from('accounts').select('id, name, org_id, coverage_type, week_start_day').in('id', accIds),
          svc.from('teams').select('id, name, org_id, account_id, manager_emails').in('account_id', accIds),
        ])
        accounts = accs ?? []; teams = tms ?? []
      }
    } else if (role === 'team_manager') {
      const teamIds = mems.filter(m => m.role === 'team_manager' && m.team_id).map(m => m.team_id)
      if (teamIds.length) {
        const { data: tms } = await svc.from('teams').select('id, name, org_id, account_id, manager_emails').in('id', teamIds)
        teams = tms ?? []
      }
    }

    // Merge in any legacy teams not already present
    const have = new Set(teams.map(t => t.id))
    for (const t of legacy) if (!have.has(t.id)) { teams.push(t); have.add(t.id) }
  }

  // ── Agent resolution (link auth_user_id on first login) ───────────────
  let agent: any = null
  let status: string | null = null
  let team: any = null

  const { data: agentByEmail } = await svc.from('agents').select('*').ilike('email', email).maybeSingle()
  let agentRow = agentByEmail
  if (!agentRow) {
    const { data: agentByUser } = await svc.from('agents').select('*').eq('auth_user_id', user.id).maybeSingle()
    agentRow = agentByUser
  }

  if (agentRow) {
    if (!agentRow.auth_user_id) {
      await svc.from('agents').update({ auth_user_id: user.id }).eq('id', agentRow.id)
      agentRow.auth_user_id = user.id
    }
    agent  = { id: agentRow.id, name: agentRow.name, team_id: agentRow.team_id }
    status = agentRow.status
    const { data: t } = await svc.from('teams').select('id, name').eq('id', agentRow.team_id).maybeSingle()
    team = t
    if (role === 'none') role = 'agent'
  }

  const isManager = MANAGER_ROLES.includes(role)

  return NextResponse.json({
    authenticated: true,
    role,          // owner | admin | account_manager | team_manager | agent | none
    isManager,     // true → dashboard access
    email,
    org,
    accounts,
    teams,
    agent,
    status,        // agent approval status: 'pending' | 'approved'
    team,          // agent's team
  })
}
