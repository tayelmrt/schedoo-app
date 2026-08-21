'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { createClient }        from '@/lib/supabase/client'
import { useApp }              from '@/lib/providers'
import { Loader2, Clock, CheckCircle2, AlertCircle, Mail } from 'lucide-react'

const NAME_KEY = 'schedoo-join-name'

type View = 'loading' | 'invalid' | 'signin' | 'joining' | 'name' | 'pending' | 'approved'

export default function JoinPage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const router   = useRouter()
  const { t, theme, toggleTheme, lang, toggleLang } = useApp()

  const [view, setView]   = useState<View>('loading')
  const [teamName, setTeamName] = useState('')
  const [orgName, setOrgName]   = useState('')
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  const [magicSent, setMagicSent] = useState(false)

  async function joinNow(joinName: string) {
    setView('joining')
    const res = await fetch('/api/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, name: joinName }),
    })
    const d = await res.json()
    if (d.error === 'need-name') { setView('name'); return }
    if (d.error) { setView('invalid'); return }
    localStorage.removeItem(NAME_KEY)
    setView(d.status === 'approved' ? 'approved' : 'pending')
  }

  useEffect(() => {
    (async () => {
      const info = await fetch(`/api/join?token=${params.token}`).then(r => r.json()).catch(() => null)
      if (!info || info.error) { setView('invalid'); return }
      setTeamName(info.teamName); setOrgName(info.orgName)

      const { data } = await supabase.auth.getUser()
      if (data.user) {
        const stored = localStorage.getItem(NAME_KEY) || ''
        await joinNow(stored)   // idempotent; asks for name if needed
      } else {
        setView('signin')
      }
    })()
  }, [])

  // Email + password: sign in if the account already exists, otherwise create it, then join.
  // Name is optional here — returning users don't need it; new joiners are asked for it next.
  async function emailJoin() {
    if (!email.includes('@') || password.length < 6) return
    setBusy(true); setErr('')
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim())
    // Existing account → sign in.
    const si = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (!si.error && si.data.session) { setBusy(false); await joinNow(name.trim()); return }
    // Otherwise try to create the account.
    const up = await supabase.auth.signUp({ email: email.trim(), password })
    setBusy(false)
    if (up.error) {
      setErr(/registered|exists|already/i.test(up.error.message) ? t('join.emailExists') : up.error.message)
      return
    }
    if (up.data.session) { await joinNow(name.trim()) }
    else { setMagicSent(true) }   // email confirmation still required in Supabase
  }

  const authedNeedsName = view === 'name'

  let content: React.ReactNode
  if (view === 'loading' || view === 'joining') {
    content = <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-7 h-7 animate-spin" /></div>
  } else if (view === 'invalid') {
    content = (
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-300">{t('join.invalid')}</p>
      </div>
    )
  } else if (view === 'pending') {
    content = (
      <div className="text-center">
        <Clock className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{teamName}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('join.pending')}</p>
      </div>
    )
  } else if (view === 'approved') {
    content = (
      <div className="text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">{t('join.approved')}</h1>
        <button onClick={() => router.replace('/me')} className="btn btn-primary w-full">{t('join.goSchedule')}</button>
      </div>
    )
  } else {
    // signin OR name (authed but no name yet)
    content = (
      <>
        <div className="text-center mb-5">
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('join.invited')}</p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{teamName}</h1>
          {orgName && <p className="text-xs text-slate-400 mt-0.5">{t('join.at')} {orgName}</p>}
        </div>

        <label className="label">{t('join.yourName')}</label>
        <input className="input mb-4" placeholder={t('join.namePlaceholder')}
          value={name} onChange={e => setName(e.target.value)} />

        {authedNeedsName ? (
          <button onClick={() => joinNow(name)} disabled={!name.trim()} className="btn btn-primary w-full">
            {t('join.join')}
          </button>
        ) : magicSent ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3 text-center">
            {t('join.magicSent')}
          </div>
        ) : (
          <>
            {err && <div className="mb-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{err}</div>}
            <input className="input mb-2" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
            <input className="input mb-2" type="password" placeholder={t('join.password')}
              value={password} onChange={e => setPassword(e.target.value)} />
            <button onClick={emailJoin} disabled={!email.includes('@') || password.length < 6 || busy} className="btn btn-primary w-full">
              <Mail className="w-4 h-4" /> {busy ? t('join.joining') : t('join.continueEmail')}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">{t('join.haveAccount')}</p>
          </>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="card w-full max-w-md relative">
        <div className="absolute top-3 end-3 flex gap-1">
          <button onClick={toggleTheme} className="text-xs px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{theme === 'dark' ? '☀︎' : '☾'}</button>
          <button onClick={toggleLang} className="text-xs px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{lang === 'ar' ? 'EN' : 'ع'}</button>
        </div>
        <div className="card-body">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl font-black mb-3">S</div>
          </div>
          {content}
        </div>
      </div>
    </div>
  )
}
