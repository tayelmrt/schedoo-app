'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Plus, Users, ChevronRight, Building2, FolderKanban, Clock } from 'lucide-react'
import type { Account, Team, Organization } from '@/lib/types'
import { COVERAGE_LABELS, WEEK_START_LABELS } from '@/lib/types'

export default function DashboardPage() {
  const supabase = createClient()

  const [org, setOrg]           = useState<Organization | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [teams, setTeams]       = useState<Team[]>([])
  const [loading, setLoading]   = useState(true)

  // ── forms ──
  const [showAccount, setShowAccount] = useState(false)
  const [teamForAccount, setTeamForAccount] = useState<string | null>(null) // account id the new-team form targets
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // account form fields
  const [accName, setAccName]           = useState('')
  const [accCoverage, setAccCoverage]   = useState('custom')
  const [accWeekStart, setAccWeekStart] = useState(0)

  // team form fields
  const [teamName, setTeamName]           = useState('')
  const [managerEmails, setManagerEmails] = useState('')
  const [adminEmails, setAdminEmails]     = useState('')

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

  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!org || !teamForAccount) return
    setSaving(true); setFormError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFormError('يرجى تسجيل الدخول أولاً'); setSaving(false); return }

    const { error } = await supabase.from('teams').insert({
      name:           teamName.trim(),
      manager_emails: managerEmails.split(',').map(s => s.trim()).filter(Boolean),
      admin_emails:   adminEmails.split(',').map(s => s.trim()).filter(Boolean),
      admin_id:       user.id,
      org_id:         org.id,
      account_id:     teamForAccount,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setTeamName(''); setManagerEmails(''); setAdminEmails('')
    setTeamForAccount(null); setSaving(false)
    load()
  }

  const teamsOf = (accountId: string) => teams.filter(t => t.account_id === accountId)

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{org?.name ?? 'شركتي'}</h1>
            <p className="text-slate-500 text-sm">الأكونتات والفرق وجداول الشيفتات</p>
          </div>
        </div>
        <button onClick={() => { setShowAccount(true); setFormError('') }} className="btn btn-primary">
          <Plus className="w-4 h-4" /> أكونت جديد
        </button>
      </div>

      {/* New account form */}
      {showAccount && (
        <div className="card mb-6">
          <div className="card-body">
            <h2 className="font-semibold text-slate-800 mb-4">إنشاء أكونت جديد</h2>
            <form onSubmit={createAccount} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{formError}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">اسم الأكونت *</label>
                  <input className="input" placeholder="مثال: خدمة العملاء" required
                    value={accName} onChange={e => setAccName(e.target.value)} />
                </div>
                <div>
                  <label className="label">نوع التغطية</label>
                  <select className="input" value={accCoverage} onChange={e => setAccCoverage(e.target.value)}>
                    <option value="custom">مخصّص</option>
                    <option value="24_7">تغطية 24/7</option>
                    <option value="daytime">دوام نهاري</option>
                  </select>
                </div>
                <div>
                  <label className="label">بداية الأسبوع</label>
                  <select className="input" value={accWeekStart} onChange={e => setAccWeekStart(Number(e.target.value))}>
                    {Object.entries(WEEK_START_LABELS).map(([v, lbl]) => (
                      <option key={v} value={v}>{lbl}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowAccount(false); setFormError('') }} className="btn btn-ghost">إلغاء</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'جاري الإنشاء…' : '+ إنشاء الأكونت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="text-slate-500 text-sm">جاري التحميل…</div>
      ) : accounts.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">لسه مفيش أكونتات</p>
            <p className="text-slate-400 text-sm">ابدأ بإنشاء أول أكونت (وحدة عمل) عشان توزّع عليه فرقك</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {accounts.map(account => (
            <div key={account.id} className="card">
              <div className="card-body">
                {/* Account header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{account.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{COVERAGE_LABELS[account.coverage_type] ?? account.coverage_type}</span>
                        <span>بداية الأسبوع: {WEEK_START_LABELS[account.week_start_day]}</span>
                        <span>{teamsOf(account.id).length} فريق</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setTeamForAccount(account.id); setFormError('') }}
                    className="btn btn-ghost text-sm">
                    <Plus className="w-4 h-4" /> أضف فريق
                  </button>
                </div>

                {/* New team form (scoped to this account) */}
                {teamForAccount === account.id && (
                  <form onSubmit={createTeam} className="space-y-4 bg-slate-50 rounded-lg p-4 mb-4">
                    {formError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{formError}</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="label">اسم الفريق *</label>
                        <input className="input" placeholder="مثال: فريق الصباح" required
                          value={teamName} onChange={e => setTeamName(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">إيميلات أدمن مشاركين <span className="text-slate-400 font-normal">(اختياري)</span></label>
                        <input className="input" placeholder="admin2@co.com"
                          value={adminEmails} onChange={e => setAdminEmails(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">إيميلات المانجرز <span className="text-slate-400 font-normal">(اختياري)</span></label>
                        <input className="input" placeholder="manager@co.com"
                          value={managerEmails} onChange={e => setManagerEmails(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button type="button" onClick={() => { setTeamForAccount(null); setFormError('') }} className="btn btn-ghost">إلغاء</button>
                      <button type="submit" disabled={saving} className="btn btn-primary">
                        {saving ? 'جاري الإنشاء…' : '+ إنشاء الفريق'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Teams grid */}
                {teamsOf(account.id).length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">مفيش فرق في الأكونت ده لسه</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {teamsOf(account.id).map(team => (
                      <Link key={team.id} href={`/dashboard/teams/${team.id}`}
                        className="border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition-all group">
                        <div className="flex items-center justify-between">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                            {team.name[0]}
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 rotate-180" />
                        </div>
                        <h4 className="font-semibold text-slate-900 mt-3">{team.name}</h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {team.manager_emails.length} مدير
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
