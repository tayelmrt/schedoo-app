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

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
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

          {/* Google */}
          <button onClick={handleGoogleLogin} className="btn btn-ghost w-full mb-4">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t('auth.google')}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">{t('auth.orEmail')}</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
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
