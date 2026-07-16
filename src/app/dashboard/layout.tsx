'use client'

import { useEffect, useState }   from 'react'
import Link                       from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient }           from '@/lib/supabase/client'
import { useApp }                 from '@/lib/providers'
import {
  Building2, Settings2, BarChart2, Users, Calendar, LineChart, Plane, Umbrella,
  Settings, Sun, Moon, Languages, LogOut, Menu, X,
} from 'lucide-react'

const TEAM_SECTIONS = [
  { seg: 'shifts',       icon: Settings2, key: 'team.shifts' },
  { seg: 'requirements', icon: BarChart2, key: 'team.requirements' },
  { seg: 'agents',       icon: Users,     key: 'team.agents' },
  { seg: 'schedule',     icon: Calendar,  key: 'team.schedule' },
  { seg: 'reports',      icon: LineChart, key: 'team.reports' },
  { seg: 'leaves',       icon: Plane,     key: 'team.leaves' },
  { seg: 'holidays',     icon: Umbrella,  key: 'team.holidays' },
  { seg: 'settings',     icon: Settings,  key: 'team.settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router   = useRouter()
  const pathname = usePathname()
  const { t, theme, toggleTheme, lang, toggleLang } = useApp()

  const [email, setEmail] = useState('')
  const [open, setOpen]   = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/auth/login'); return }
      const me = await fetch('/api/me').then(r => r.json()).catch(() => null)
      if (!me || !me.isManager) { router.replace('/me'); return }
      setEmail(data.user.email ?? '')
    })()
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Detect team context: /dashboard/teams/<id>/<section?>
  const teamMatch = pathname.match(/^\/dashboard\/teams\/([^/]+)(?:\/([^/]+))?/)
  const teamId    = teamMatch?.[1]
  const activeSeg = teamMatch?.[2] ?? ''

  const navItemClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`

  const sidebar = (
    <aside className="w-60 bg-slate-900 text-white flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-lg">S</div>
          <span className="font-bold text-lg">Schedoo</span>
        </Link>
        <button onClick={() => setOpen(false)} className="md:hidden text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <Link href="/dashboard" className={navItemClass(pathname === '/dashboard')}>
          <Building2 className="w-4 h-4" /> {t('nav.company')}
        </Link>

        {teamId && (
          <div className="pt-3 mt-2 border-t border-slate-700 space-y-1">
            {TEAM_SECTIONS.map(({ seg, icon: Icon, key }) => (
              <Link key={seg} href={`/dashboard/teams/${teamId}/${seg}`}
                className={navItemClass(activeSeg === seg)}>
                <Icon className="w-4 h-4" /> {t(key)}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Controls */}
      <div className="px-3 py-3 border-t border-slate-700 space-y-1">
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? t('theme.light') : t('theme.dark')}
        </button>
        <button onClick={toggleLang}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
          <Languages className="w-4 h-4" />
          {lang === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 truncate mb-2">{email}</div>
        <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
          <LogOut className="w-4 h-4" /> {t('nav.signOut')}
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen">
      {/* Desktop fixed sidebar (flips side automatically via logical props) */}
      <div className="hidden md:block fixed inset-y-0 start-0 z-20">{sidebar}</div>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-900 text-white px-4 h-14 shadow">
        <button onClick={() => setOpen(true)} className="text-white"><Menu className="w-6 h-6" /></button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm">S</div>
          <span className="font-bold">Schedoo</span>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-60 h-full shadow-xl">{sidebar}</div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* Main */}
      <main className="md:ms-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
