'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { createClient }        from '@/lib/supabase/client'
import { useApp }              from '@/lib/providers'
import { getMe, clearMe }      from '@/lib/me'
import { Loader2, Building2, LogOut } from 'lucide-react'

export default function OnboardingPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { t, theme, toggleTheme, lang, toggleLang } = useApp()

  const [ready, setReady]     = useState(false)
  const [name, setName]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.replace('/auth/login'); return }
      // Already a manager/owner or an agent? send them to their home
      const me = await getMe().catch(() => null)
      if (me?.isManager) { router.replace('/dashboard'); return }
      if (me?.role === 'agent') { router.replace('/me'); return }
      setReady(true)
    })()
  }, [])

  async function createCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }

    const { data: org, error: orgErr } = await supabase.from('organizations')
      .insert({ name: name.trim(), owner_id: user.id }).select().single()
    if (orgErr || !org) { setError(orgErr?.message ?? 'error'); setSaving(false); return }

    // A default account to start with
    await supabase.from('accounts').insert({
      org_id: org.id, name: 'Default', coverage_type: 'custom', week_start_day: 0,
    })
    // Owner membership (keeps members list consistent)
    await supabase.from('memberships').insert({ org_id: org.id, user_id: user.id, role: 'owner' })

    clearMe()
    router.replace('/dashboard')
  }

  async function signOut() { await supabase.auth.signOut(); router.replace('/auth/login') }

  if (!ready)
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="card w-full max-w-md relative">
        <div className="absolute top-3 end-3 flex gap-1">
          <button onClick={toggleTheme} className="text-xs px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{theme === 'dark' ? '☀︎' : '☾'}</button>
          <button onClick={toggleLang} className="text-xs px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{lang === 'ar' ? 'EN' : 'ع'}</button>
        </div>
        <div className="card-body">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-3"><Building2 className="w-7 h-7" /></div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('onb.welcome')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('onb.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{error}</div>
          )}

          <form onSubmit={createCompany} className="space-y-4">
            <div>
              <label className="label">{t('onb.companyName')}</label>
              <input className="input" required autoFocus placeholder={t('onb.companyPlaceholder')}
                value={name} onChange={e => setName(e.target.value)} />
              <p className="text-xs text-slate-400 mt-2">{t('onb.hint')}</p>
            </div>
            <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary w-full">
              {saving ? t('onb.creating') : t('onb.create')}
            </button>
          </form>

          <button onClick={signOut} className="mt-5 mx-auto flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm">
            <LogOut className="w-4 h-4" /> {t('nav.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
