'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import { useApp }              from '@/lib/providers'
import { Save, Building2, Users, Plus, X, ShieldCheck } from 'lucide-react'
import type { Account, Team, Organization } from '@/lib/types'

interface Membership {
  id: string; org_id: string; user_id: string | null; email: string | null
  role: string; account_id: string | null; team_id: string | null
}

const ROLES = ['admin', 'account_manager', 'team_manager'] as const

export default function CompanySettingsPage() {
  const supabase = createClient()
  const { t } = useApp()

  const [org, setOrg]           = useState<Organization | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [teams, setTeams]       = useState<Team[]>([])
  const [members, setMembers]   = useState<Membership[]>([])
  const [orgName, setOrgName]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [savedName, setSavedName]   = useState(false)

  // add-member form
  const [mEmail, setMEmail] = useState('')
  const [mRole, setMRole]   = useState<string>('admin')
  const [mAccount, setMAccount] = useState('')
  const [mTeam, setMTeam]   = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  async function load() {
    const me = await fetch('/api/me').then(r => r.json()).catch(() => null)
    if (me?.org) {
      setOrg(me.org); setOrgName(me.org.name)
      setAccounts(me.accounts ?? []); setTeams(me.teams ?? [])
      const { data } = await supabase.from('memberships').select('*').eq('org_id', me.org.id).order('created_at')
      setMembers(data ?? [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveName() {
    if (!org) return
    setSavingName(true)
    await supabase.from('organizations').update({ name: orgName.trim() }).eq('id', org.id)
    setSavingName(false); setSavedName(true); setTimeout(() => setSavedName(false), 2000)
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    const email = mEmail.trim().toLowerCase()
    if (!email.includes('@')) { setAddError('—'); return }
    setAdding(true); setAddError('')
    const { error } = await supabase.from('memberships').insert({
      org_id:     org.id,
      email,
      role:       mRole,
      account_id: mRole === 'account_manager' ? (mAccount || null) : null,
      team_id:    mRole === 'team_manager'    ? (mTeam || null)    : null,
    })
    if (error) { setAddError(error.message); setAdding(false); return }
    setMEmail(''); setMAccount(''); setMTeam(''); setMRole('admin')
    setAdding(false); load()
  }

  async function removeMember(id: string) {
    await supabase.from('memberships').delete().eq('id', id)
    load()
  }

  const scopeLabel = (m: Membership) => {
    if (m.role === 'account_manager') return accounts.find(a => a.id === m.account_id)?.name ?? '—'
    if (m.role === 'team_manager')    return teams.find(tm => tm.id === m.team_id)?.name ?? '—'
    return ''
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">{t('dash.loading')}</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('cset.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('cset.subtitle')}</p>
        </div>
      </div>

      {/* Company name */}
      <div className="card mb-6">
        <div className="card-body">
          <label className="label">{t('cset.companyName')}</label>
          <div className="flex gap-2">
            <input className="input flex-1" value={orgName} onChange={e => setOrgName(e.target.value)} />
            <button onClick={saveName} disabled={savingName} className="btn btn-primary">
              <Save className="w-4 h-4" /> {savedName ? t('cset.saved') : t('set.saveChanges')}
            </button>
          </div>
        </div>
      </div>

      {/* Members & roles */}
      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> {t('cset.members')}
          </h2>
          <p className="text-xs text-slate-400 mb-4">{t('cset.membersHint')}</p>

          {/* Owner row */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-slate-800 dark:text-slate-100">{org?.name}</span>
            </div>
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-full">{t('cset.owner')}</span>
          </div>

          {/* Member list */}
          <div className="space-y-2 mb-4">
            {members.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-3">{t('cset.noMembers')}</p>
            ) : members.map(m => (
              <div key={m.id} className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {m.email}
                    {!m.user_id && <span className="text-[10px] text-amber-600 dark:text-amber-400 ms-2">({t('cset.pending')})</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t(`cset.${m.role}`)}{scopeLabel(m) ? ` · ${scopeLabel(m)}` : ''}
                  </div>
                </div>
                <button onClick={() => removeMember(m.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 shrink-0" title={t('cset.remove')}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add member */}
          <form onSubmit={addMember} className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            {addError && addError !== '—' && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{addError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">{t('cset.memberEmail')}</label>
                <input className="input" type="email" placeholder="person@company.com" required
                  value={mEmail} onChange={e => setMEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('cset.role')}</label>
                <select className="input" value={mRole} onChange={e => setMRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{t(`cset.${r}`)}</option>)}
                </select>
              </div>
              <div>
                {mRole === 'account_manager' ? (
                  <>
                    <label className="label">{t('cset.scope')}</label>
                    <select className="input" value={mAccount} onChange={e => setMAccount(e.target.value)}>
                      <option value="">—</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </>
                ) : mRole === 'team_manager' ? (
                  <>
                    <label className="label">{t('cset.scope')}</label>
                    <select className="input" value={mTeam} onChange={e => setMTeam(e.target.value)}>
                      <option value="">—</option>
                      {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                    </select>
                  </>
                ) : <div className="hidden sm:block" />}
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={adding} className="btn btn-primary">
                <Plus className="w-4 h-4" /> {t('cset.addMember')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
