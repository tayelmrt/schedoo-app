'use client'

import Link from 'next/link'
import { useApp } from '@/lib/providers'
import { Settings2, Users, Calendar, BarChart2, ChevronRight, Settings, Umbrella, LineChart, Plane } from 'lucide-react'

const sections = [
  { href: 'shifts',       icon: Settings2, key: 'team.shifts' },
  { href: 'requirements', icon: BarChart2, key: 'team.requirements' },
  { href: 'agents',       icon: Users,     key: 'team.agents' },
  { href: 'schedule',     icon: Calendar,  key: 'team.schedule' },
  { href: 'reports',      icon: LineChart, key: 'team.reports' },
  { href: 'leaves',       icon: Plane,     key: 'team.leaves' },
  { href: 'holidays',     icon: Umbrella,  key: 'team.holidays' },
  { href: 'settings',     icon: Settings,  key: 'team.settings' },
]

export default function TeamPage({ params }: { params: { teamId: string } }) {
  const { t } = useApp()

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-blue-600 transition-colors">
          {t('nav.backToTeams')}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{t('team.management')}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('team.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(({ href, icon: Icon, key }) => (
          <Link key={href} href={`/dashboard/teams/${params.teamId}/${href}`}
            className="card hover:shadow-md transition-shadow group">
            <div className="card-body flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300 group-hover:bg-blue-100 transition-colors shrink-0">
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{t(key)}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{t(`${key}.desc`)}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors rtl:rotate-180" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
