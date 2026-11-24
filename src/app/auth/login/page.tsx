'use client'

import { useState }          from 'react'
import { createClient }      from '@/lib/supabase/client'
import { useRouter }         from 'next/navigation'
import { useApp }            from '@/lib/providers'

export default function LoginPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { t, theme, toggleTheme, lang, toggleLang } = useApp()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/')
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setError(t('auth.checkEmail'))
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="card w-full max-w-md relative">
        {/* Top controls */}
        <div className="absolute top-3 end-3 flex gap-1">
          <button onClick={toggleTheme} aria-label="Toggle theme"
            className="text-xs px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
          <button onClick={toggleLang} aria-label="Toggle language"
            className="text-xs px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>
        </div>
        <div className="card-body">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl font-black mb-3">S</div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Schedoo</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('auth.tagline')}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          <form className="space-y-4">
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input className="input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleEmailLogin} disabled={loading} className="btn btn-primary flex-1">
                {loading ? t('auth.signingIn') : t('auth.signIn')}
              </button>
              <button onClick={handleSignUp} disabled={loading} className="btn btn-ghost flex-1">
                {t('auth.signUp')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
