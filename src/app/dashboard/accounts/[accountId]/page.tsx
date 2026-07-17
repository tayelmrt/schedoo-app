'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import { useApp }              from '@/lib/providers'
import Link                    from 'next/link'
import { Plus, Users, ChevronLeft, FolderKanban, Clock } from 'lucide-react'
import type { Account, Team, Organization } from '@/lib/types'

export default function AccountPage({ params }: { params: { accountId: string } }) {
  const supabase = createClient()
  const { t } = useApp()

  const [org, setOrg]         = useState<Organization | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [teams, setTeams]     = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const [showTeam, setShowTeam] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')
  const [teamName, setTeamName]           = useState('')
  const [managerEmails, setManagerEmails] = useState('')
  const [adminEmails, setAdminEmails]     = useState('')

  async function load() {
    const me = await fetch('/api/me').then(r => r.json()).catch(() => null)
    if (me) {
      setOrg(me.org ?? null)
      setAccount((me.accounts ?? []).find((a: Account) => a.id === params.accountId) ?? null)
      setTeams((me.teams ?? []).filter((tm: Team) => tm.account_id === params.accountId))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setSaving(true); setFormError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFormError('Please sign in first'); setSaving(false); return }

    const { error } = await supabase.from('teams').insert({
      name:           teamName.trim(),
      manager_emails: managerEmails.split(',').map(s => s.trim()).filter(Boolean),
      admin_emails:   adminEmails.split(',').map(s => s.trim()).filter(Boolean),
      admin_id:       user.id,
      org_id:         org.id,
      account_id:     params.accountId,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setTeamName(''); setManagerEmails(''); setAdminEmails('')
    setShowTeam(false); setSaving(false)
    load()
  }

  return (
    <div className="p-8">
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        {t('dash.backToCompany')}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{account?.name ?? '…'}</h1>
            {account && (
              <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t(`coverage.${account.coverage_type}`)}</span>
                <span>{t('dash.weekStart')}: {t(`day.${account.week_start_day}`)}</span>
                <span>{teams.length} {t('dash.teamsCount')}</span>
              </div>
            )}
          </div>
        </div>
        <button onClick={() => { setShowTeam(true); setFormError('') }} className="btn btn-primary shrink-0">
          <Plus className="w-4 h-4" /> {t('dash.addTeam')}
        </button>
      </div>

      {/* New team form */}
      {showTeam && (
        <form onSubmit={createTeam} className="card mb-6">
          <div className="card-body space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{formError}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">{t('dash.teamName')} *</label>
                <input className="input" required value={teamName} onChange={e => setTeamName(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('dash.coAdmins')} <span className="text-slate-400 font-normal">{t('dash.optional')}</span></label>
                <input className="input" placeholder="admin2@co.com" value={adminEmails} onChange={e => setAdminEmails(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('dash.managers')} <span className="text-slate-400 font-normal">{t('dash.optional')}</span></label>
                <input className="input" placeholder="manager@co.com" value={managerEmails} onChange={e => setManagerEmails(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowTeam(false); setFormError('') }} className="btn btn-ghost">{t('dash.cancel')}</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? t('dash.saving') : t('dash.saveTeam')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Team cards */}
      {loading ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm">{t('dash.loading')}</div>
      ) : teams.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500 text-sm">{t('dash.emptyAccountTeams')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map(team => (
            <Link key={team.id} href={`/dashboard/teams/${team.id}`}
              className="card hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all group">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-lg">
                    {team.name[0]}
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 rtl:rotate-180" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-3 text-lg">{team.name}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {(team.manager_emails?.length ?? 0)} {t('dash.managersCount')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
