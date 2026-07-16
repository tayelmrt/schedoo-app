'use client'

import { useEffect, useState }  from 'react'
import Link                      from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient }           from '@/lib/supabase/client'
import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase  = createClient()
  const router    = useRouter()
  const pathname  = usePathname()
  const [email, setEmail] = useState('')
  const [open, setOpen]   = useState(false)   // mobile drawer

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/auth/login'); return }
      const me = await fetch('/api/me').then(r => r.json()).catch(() => null)
      if (!me || !me.isManager) { router.replace('/me'); return }
      setEmail(data.user.email ?? '')
    })()
  }, [])

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const nav = [{ href: '/dashboard', label: 'Teams', icon: LayoutDashboard }]

  const sidebar = (
    <aside className="w-60 bg-slate-900 text-white flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-lg">S</div>
          <span className="font-bold text-lg">Schedoo</span>
        </div>
        {/* Close button (mobile only) */}
        <button onClick={() => setOpen(false)} className="md:hidden text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === href ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 truncate mb-2">{email}</div>
        <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen">
      {/* Desktop fixed sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-20">{sidebar}</div>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-900 text-white px-4 h-14 shadow">
        <button onClick={() => setOpen(true)} className="text-white"><Menu className="w-6 h-6" /></button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm">S</div>
          <span className="font-bold">Schedoo</span>
        </div>
      </header>

      {/* Mobile drawer + overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-60 h-full shadow-xl">{sidebar}</div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* Main */}
      <main className="md:ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
