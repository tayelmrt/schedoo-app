'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import Link                    from 'next/link'
import { createClient }        from '@/lib/supabase/client'
import { getMe, clearMe }      from '@/lib/me'
import { useApp }              from '@/lib/providers'
import { Save, FolderKanban, Trash2, AlertTriangle } from 'lucide-react'
import type { Account } from '@/lib/types'

export default function AccountSettingsPage({ params }: { params: { accountId: string } }) {
  const supabase = createClient()
  const router   = useRouter()
  const { t } = useApp()

  const [account, setAccount] = useState<Account | null>(null)
  const [role, setRole]       = useState('')
  const [name, setName]       = useState('')
  const [coverage, setCoverage] = useState('custom')
  const [weekStart, setWeekStart] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  async function load() {
    const me = await getMe().catch(() => null)
    const acc = (me?.accounts ?? []).find((a: Account) => a.id === params.accountId) ?? null
    setRole(me?.role ?? '')
    if (acc) {
      setAccount(acc)
      setName(acc.name)
      setCoverage(acc.coverage_type ?? 'custom')
      setWeekStart(acc.week_start_day ?? 0)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    await supabase.from('accounts').update({
      name: name.trim(), coverage_type: coverage, week_start_day: weekStart,
    }).eq('id', params.accountId)
    clearMe()
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function deleteAccount() {
    setDeleting(true)
    const { error } = await supabase.from('accounts').delete().eq('id', params.accountId)
    if (error) { setDeleting(false); alert(error.message); return }
    clearMe()
    router.replace('/dashboard')
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">{t('dash.loading')}</div>

  return (
    <div className="p-8 max-w-2xl">
      <Link href={`/dashboard/accounts/${params.accountId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        ← {account?.name ?? t('nav.account')}
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
          <FolderKanban className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('aset.title')}</h1>
      </div>

      <div className="card mb-6">
        <div className="card-body space-y-4">
          <div>
            <label className="label">{t('dash.accountName')}</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('dash.coverage')}</label>
              <select className="input" value={coverage} onChange={e => setCoverage(e.target.value)}>
                <option value="custom">{t('coverage.custom')}</option>
                <option value="24_7">{t('coverage.24_7')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('dash.weekStart')}</label>
              <select className="input" value={weekStart} onChange={e => setWeekStart(Number(e.target.value))}>
                {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{t(`day.${n}`)}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-primary w-full">
        <Save className="w-4 h-4" />
        {saving ? t('req.saving') : saved ? t('common.saved') : t('set.saveChanges')}
      </button>

      {/* Danger zone */}
      {(role === 'owner' || role === 'admin') && (
        <div className="mt-8 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-4">
          <h2 className="font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {t('danger.zone')}
          </h2>
          <p className="text-xs text-red-500/80 dark:text-red-400/70 mb-3">{t('danger.deleteAccountHint')}</p>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} className="btn btn-danger btn-sm">
              <Trash2 className="w-4 h-4" /> {t('danger.deleteAccount')}
            </button>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button onClick={deleteAccount} disabled={deleting} className="btn btn-danger btn-sm">
                {deleting ? t('danger.deleting') : t('danger.confirm')}
              </button>
              <button onClick={() => setConfirmDel(false)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
