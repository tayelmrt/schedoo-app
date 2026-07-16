'use client'

import { useEffect, useState } from 'react'
import Link                    from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient }        from '@/lib/supabase/client'
import {
  CalendarCheck, CalendarDays, Plane, LogOut, Menu, X, Loader2, Clock, AlertCircle,
} from 'lucide-react'

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router   = useRouter()
  const pathname = usePathname()

  const [view, setView]   = useState<'loading'|'pending'|'no-agent'|'ok'>('loading')
  const [name, setName]   = useState('')
  const [team, setTeam]   = useState('')
  const [open, setOpen]   = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.replace('/auth/login'); return }
      const me = await fetch('/api/me').then(r => r.json()).catch(() => null)
      if (!me) { setView('no-agent'); return }
      if (me.isManager) { router.replace('/dashboard'); return }
      if (me.role !== 'agent') { setView('no-agent'); return }
      setName(me.agent?.name ?? '')
      setTeam(me.team?.name ?? '')
      setView(me.status === 'approved' ? 'ok' : 'pending')
    })()
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  async function signOut() { await supabase.auth.signOut(); router.replace('/auth/login') }

  const nav = [
    { href: '/me',       label: 'تسجيل الجدول', icon: CalendarCheck },
    { href: '/me/month', label: 'جدولي الشهري',  icon: CalendarDays },
    { href: '/me/leave', label: 'إجازاتي',       icon: Plane },
  ]

  if (view === 'loading')
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  if (view === 'pending')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <Clock className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">في انتظار موافقة الأدمين</h1>
          <p className="text-slate-500 text-sm">أهلاً {name || ''} — حسابك اتسجّل بنجاح. لسه محتاج الأدمين يوافق على دخولك.</p>
          <button onClick={signOut} className="btn btn-ghost mt-6 mx-auto"><LogOut className="w-4 h-4" /> خروج</button>
        </div>
      </div>
    )

  if (view === 'no-agent')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <AlertCircle className="w-14 h-14 text-red-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">مفيش صلاحية دخول</h1>
          <p className="text-slate-500 text-sm">الإيميل ده لسه مش مضاف لأي فريق. تواصل مع الأدمين.</p>
          <button onClick={signOut} className="btn btn-ghost mt-6 mx-auto"><LogOut className="w-4 h-4" /> خروج</button>
        </div>
      </div>
    )

  const ini = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  const sidebar = (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-lg">S</div>
          <span className="font-bold text-lg">Schedoo</span>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>

      {/* Agent identity */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60">
        <div className="w-10 h-10 rounded-full bg-blue-600/30 text-blue-200 flex items-center justify-center font-bold text-sm">{ini}</div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{name}</div>
          <div className="text-xs text-slate-400 truncate">{team}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700">
        <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
          <LogOut className="w-4 h-4" /> تسجيل الخروج
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-20">{sidebar}</div>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-900 text-white px-4 h-14 shadow">
        <button onClick={() => setOpen(true)}><Menu className="w-6 h-6" /></button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm">S</div>
          <span className="font-bold">Schedoo</span>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 h-full shadow-xl">{sidebar}</div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      <main className="md:ml-64 min-h-screen">{children}</main>
    </div>
  )
}
