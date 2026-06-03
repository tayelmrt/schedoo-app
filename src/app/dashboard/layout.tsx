'use client'

import { useEffect, useState }  from 'react'
import Link                      from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient }           from '@/lib/supabase/client'
import { LayoutDashboard, Users, LogOut, Calendar } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase  = createClient()
  const router    = useRouter()
  const pathname  = usePathname()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setEmail(data.user.email ?? '')
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const nav = [
    { href: '/dashboard', label: 'Teams', icon: LayoutDashboard },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-lg">S</div>
          <span className="font-bold text-lg">Schedoo</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 truncate mb-2">{email}</div>
          <button onClick={signOut}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
