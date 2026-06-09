'use client'

import Link from 'next/link'
import { Settings2, Users, Calendar, BarChart2, ChevronRight, Settings, Umbrella, LineChart, Plane } from 'lucide-react'

const sections = [
  { href: 'shifts',       icon: Settings2, label: 'Shifts',         desc: 'Define shift types, times, and colors' },
  { href: 'requirements', icon: BarChart2, label: 'Requirements',    desc: 'Min & Max agents per shift per day' },
  { href: 'agents',       icon: Users,     label: 'Agents',          desc: 'Add agents and approve accounts' },
  { href: 'schedule',     icon: Calendar,  label: 'Schedule',        desc: 'View matrix, validate, and export' },
  { href: 'reports',      icon: LineChart, label: 'التقارير',          desc: 'إحصائيات وعبء الشيفتات الشهري' },
  { href: 'leaves',       icon: Plane,     label: 'الإجازات والأرصدة',  desc: 'أرصدة الموظفين وطلبات الإجازة' },
  { href: 'holidays',     icon: Umbrella,  label: 'الإجازات الرسمية',   desc: 'إجازات رسمية وتتبّع أيام التعويض' },
  { href: 'settings',     icon: Settings,  label: 'Settings',        desc: 'Admins, managers, and team config' },
]

export default function TeamPage({ params }: { params: { teamId: string } }) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-blue-600 transition-colors">
          ← Teams
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Team Management</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your team and manage weekly schedules</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={`/dashboard/teams/${params.teamId}/${href}`}
            className="card hover:shadow-md transition-shadow group">
            <div className="card-body flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{label}</div>
                <div className="text-sm text-slate-500">{desc}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
