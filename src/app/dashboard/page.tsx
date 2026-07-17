'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import { useApp }              from '@/lib/providers'
import Link                    from 'next/link'
import { Plus, Building2, FolderKanban, Clock, ChevronLeft, Users } from 'lucide-react'
import type { Account, Team, Organization } from '@/lib/types'

export default function DashboardPage() {
  const supabase = createClient()
  const { t } = useApp()

  const [org, setOrg]           = useState<Organization | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [teams, setTeams]       = useState<Team[]>([])
  const [loading, setLoading]   = useState(true)

  const [showAccount, setShowAccount] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [accName, setAccName]           = useState('')
  const [accCoverage, setAccCoverage]   = useState('custom')
  const [accWeekStart, setAccWeekStart] = useState(0)

  async function load() {
    const me = await fetch('/api/me').then(r => r.json()).catch(() => null)
    if (me) {
      setOrg(me.org ?? null)
      setAccounts(me.accounts ?? [])
      setTeams(me.teams ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setSaving(true); setFormError('')
    const { error } = await supabase.from('accounts').insert({
      org_id:         org.id,
      name:           accName.trim(),
      coverage_type:  accCoverage,
      week_start_day: accWeekStart,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setAccName(''); setAccCoverage('custom'); setAccWeekStart(0)
    setShowAccount(false); setSaving(false)
    load()
  }

  const teamCount = (accountId: string) => teams.filter(t => t.account_id === accountId).length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{org?.name ?? 'Schedoo'}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('dash.subtitle')}</p>
          </div>
        </div>
        <button onClick={() => { setShowAccount(true); setFormError('') }} className="btn btn-primary shrink-0">
          <Plus className="w-4 h-4" /> {t('dash.newAccount')}
        </button>
      </div>

      {/* New account form */}
      {showAccount && (
        <div className="card mb-6">
          <div className="card-body">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">{t('dash.createAccount')}</h2>
            <form onSubmit={createAccount} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{formError}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">{t('dash.accountName')} *</label>
                  <input className="input" required value={accName} onChange={e => setAccName(e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('dash.coverage')}</label>
                  <select className="input" value={accCoverage} onChange={e => setAccCoverage(e.target.value)}>
                    <option value="custom">{t('coverage.custom')}</option>
                    <option value="24_7">{t('coverage.24_7')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('dash.weekStart')}</label>
                  <select className="input" value={accWeekStart} onChange={e => setAccWeekStart(Number(e.target.value))}>
                    {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{t(`day.${n}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowAccount(false); setFormError('') }} className="btn btn-ghost">{t('dash.cancel')}</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? t('dash.saving') : t('dash.saveAccount')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account cards */}
      {loading ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm">{t('dash.loading')}</div>
      ) : accounts.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <FolderKanban className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-300 font-medium">{t('dash.noAccounts')}</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">{t('dash.noAccountsHint')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map(account => (
            <Link key={account.id} href={`/dashboard/accounts/${account.id}`}
              className="card hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all group">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 rtl:rotate-180" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-3 text-lg">{account.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500 mt-2">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t(`coverage.${account.coverage_type}`)}</span>
                  <span>{t('dash.weekStart')}: {t(`day.${account.week_start_day}`)}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <Users className="w-4 h-4" /> {teamCount(account.id)} {t('dash.teamsCount')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
