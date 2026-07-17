'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useApp }       from '@/lib/providers'
import { getWeekMonday, toDateStr } from '@/lib/utils'
import {
  Users, Settings2, Calendar, LineChart, Plane, Umbrella, BarChart2,
  Clock, AlertTriangle, CheckCircle2, UserCheck, CalendarClock, ChevronLeft,
} from 'lucide-react'

interface Stats {
  teamName: string
  accountName: string
  coverage: string
  schedMode: string
  activeAgents: number
  pendingApprovals: number
  shiftsDefined: number
  weekStatus: 'open' | 'confirmed' | 'none'
  submitted: number
  gaps: number
  pendingLeaves: number
  pendingComp: number
}

export default function TeamPage({ params }: { params: { teamId: string } }) {
  const supabase = createClient()
  const { t } = useApp()
  const [s, setS] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const teamId = params.teamId
      const [{ data: team }, { data: agents }, { data: shifts }, { data: reqs },
              { data: leaves }, { data: comps }] = await Promise.all([
        supabase.from('teams').select('id,name,account_id,coverage_type,scheduling_mode').eq('id', teamId).single(),
        supabase.from('agents').select('id,status,auth_user_id,is_active').eq('team_id', teamId),
        supabase.from('shifts').select('id,is_off').eq('team_id', teamId),
        supabase.from('requirements').select('day_of_week,shift_id,min_agents_required').eq('team_id', teamId),
        supabase.from('leave_requests').select('id').eq('team_id', teamId).eq('status', 'pending'),
        supabase.from('compensation_days').select('id').eq('team_id', teamId).eq('granted', true).eq('used', false),
      ])

      const account = team?.account_id
        ? (await supabase.from('accounts').select('name').eq('id', team.account_id).maybeSingle()).data
        : null

      // Current calendar week
      const weekStr = toDateStr(getWeekMonday(new Date()))
      const { data: week } = await supabase.from('weeks')
        .select('id,status').eq('team_id', teamId).eq('week_start_date', weekStr).maybeSingle()

      let submitted = 0, gaps = 0
      if (week) {
        const { data: entries } = await supabase.from('schedule_entries')
          .select('agent_id,day_of_week,shift_id').eq('week_id', week.id)
        const ents = entries ?? []
        submitted = new Set(ents.map(e => e.agent_id)).size
        const workShiftIds = new Set((shifts ?? []).filter(x => !x.is_off).map(x => x.id))
        for (const r of (reqs ?? [])) {
          if (!workShiftIds.has(r.shift_id) || (r.min_agents_required ?? 0) === 0) continue
          const count = ents.filter(e => e.day_of_week === r.day_of_week && e.shift_id === r.shift_id).length
          if (count < r.min_agents_required) gaps++
        }
      }

      const agentsList = agents ?? []
      setS({
        teamName: team?.name ?? '',
        accountName: account?.name ?? '',
        coverage: team?.coverage_type ?? 'custom',
        schedMode: team?.scheduling_mode ?? 'hybrid',
        activeAgents: agentsList.filter(a => a.is_active).length,
        pendingApprovals: agentsList.filter(a => a.status !== 'approved' && a.auth_user_id).length,
        shiftsDefined: (shifts ?? []).filter(x => !x.is_off).length,
        weekStatus: week ? (week.status as 'open' | 'confirmed') : 'none',
        submitted,
        gaps,
        pendingLeaves: (leaves ?? []).length,
        pendingComp: (comps ?? []).length,
      })
      setLoading(false)
    })()
  }, [])

  const base = `/dashboard/teams/${params.teamId}`

  if (loading || !s) return <div className="p-8 text-slate-400 text-sm">{t('common.loading')}</div>

  // Build alerts
  const alerts: { icon: any; text: string; href: string; tone: string }[] = []
  if (s.pendingApprovals > 0)
    alerts.push({ icon: UserCheck, text: `${s.pendingApprovals} ${t('tov.alertApprovals')}`, href: `${base}/agents`, tone: 'amber' })
  if (s.weekStatus === 'open')
    alerts.push({ icon: CalendarClock, text: t('tov.alertUnconfirmed'), href: `${base}/schedule`, tone: 'blue' })
  if (s.gaps > 0)
    alerts.push({ icon: AlertTriangle, text: `${s.gaps} ${t('tov.alertGaps')}`, href: `${base}/schedule`, tone: 'red' })
  if (s.pendingLeaves > 0)
    alerts.push({ icon: Plane, text: `${s.pendingLeaves} ${t('tov.alertLeaves')}`, href: `${base}/leaves`, tone: 'indigo' })

  const toneCls: Record<string, string> = {
    amber:  'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200',
    blue:   'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
    red:    'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-200',
  }

  const kpis = [
    { label: t('tov.agents'),        value: s.activeAgents,  icon: Users,      color: 'blue' },
    { label: t('tov.shifts'),        value: s.shiftsDefined, icon: Settings2,  color: 'indigo' },
    { label: t('tov.submissions'),   value: s.weekStatus === 'none' ? '—' : `${s.submitted}/${s.activeAgents}`, icon: Calendar, color: 'emerald' },
    { label: t('tov.gaps'),          value: s.weekStatus === 'none' ? '—' : s.gaps, icon: BarChart2, color: s.gaps > 0 ? 'red' : 'slate' },
    { label: t('tov.pendingLeaves'), value: s.pendingLeaves, icon: Plane,      color: 'amber' },
    { label: t('tov.pendingComp'),   value: s.pendingComp,   icon: Umbrella,   color: 'rose' },
  ]
  const kColor: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  }

  return (
    <div className="p-8">
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        {t('nav.backToTeams')}
      </Link>

      {/* Team header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shrink-0">
          {s.teamName[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{s.teamName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {s.accountName && <span className="flex items-center gap-1"><ChevronLeft className="w-3 h-3 rtl:rotate-180" />{t('tov.account')}: {s.accountName}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t(`coverage.${s.coverage}`)}</span>
            <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" />{t(`schedMode.${s.schedMode}`)}</span>
          </div>
        </div>
      </div>

      {/* Week status pill */}
      <div className="mb-6 mt-3">
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
          s.weekStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : s.weekStatus === 'open' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {t('tov.weekStatus')}: {s.weekStatus === 'confirmed' ? t('tov.confirmed') : s.weekStatus === 'open' ? t('tov.open') : t('tov.noOpenWeek')}
        </span>
      </div>

      {/* Alerts */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">{t('tov.attention')}</h2>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4" /> {t('tov.allGood')}
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <Link key={i} href={a.href}
                className={`flex items-center gap-3 border rounded-xl px-4 py-3 text-sm font-medium transition-shadow hover:shadow-sm ${toneCls[a.tone]}`}>
                <a.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{a.text}</span>
                <span className="text-xs font-bold opacity-70">{t('tov.go')} ←</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="card">
            <div className="card-body flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${kColor[k.color]}`}>
                <k.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{k.value}</div>
                <div className="text-xs text-slate-400 mt-1">{k.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
