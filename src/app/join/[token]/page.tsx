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
  const [busy, setBusy]   = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const redirectTo = typeof window !== 'undefined'
    ? `${location.origin}/auth/callback?next=/join/${params.token}` : ''

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

  async function google() {
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim())
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  }

  async function magicLink() {
    if (!name.trim()) return
    if (!email.includes('@')) return
    setBusy(true)
    localStorage.setItem(NAME_KEY, name.trim())
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } })
    setBusy(false)
    if (!error) setMagicSent(true)
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
            <button onClick={google} disabled={!name.trim()} className="btn btn-ghost w-full mb-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {t('join.google')}
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs text-slate-400">{t('join.or')}</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <input className="input mb-2" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
            <button onClick={magicLink} disabled={!name.trim() || !email.includes('@') || busy} className="btn btn-primary w-full">
              <Mail className="w-4 h-4" /> {busy ? t('join.sending') : t('join.magic')}
            </button>
            {!name.trim() && <p className="text-xs text-slate-400 text-center mt-2">{t('join.needName')}</p>}
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
