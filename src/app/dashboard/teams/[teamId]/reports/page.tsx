'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link             from 'next/link'
import {
  format, addDays, parseISO, startOfMonth, endOfMonth,
  isWithinInterval, eachDayOfInterval,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Users, CalendarDays, Briefcase, Umbrella, Gift, RefreshCw, Download,
} from 'lucide-react'
import { hexToAlpha } from '@/lib/utils'
import type { Shift, Agent } from '@/lib/types'
import { useApp }        from '@/lib/providers'

interface Week { id: string; week_start_date: string; status: string }
interface Entry { week_id: string; agent_id: string; day_of_week: number; shift_id: string | null }
interface Holiday { id: string; date: string; name: string }
interface Comp {
  id: string; agent_id: string; holiday_name: string; holiday_date: string
  granted: boolean; used: boolean; used_date: string | null
}

export default function ReportsPage({ params }: { params: { teamId: string } }) {
  const supabase = createClient()
  const { t } = useApp()

  const [month, setMonth]       = useState(startOfMonth(new Date()))
  const [agents, setAgents]     = useState<Agent[]>([])
  const [shifts, setShifts]     = useState<Shift[]>([])
  const [weeks, setWeeks]       = useState<Week[]>([])
  const [entries, setEntries]   = useState<Entry[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [comps, setComps]       = useState<Comp[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const monthStart = startOfMonth(month)
  const monthEnd   = endOfMonth(month)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: ag }, { data: sh }, { data: wk }, { data: hol }, { data: cmp }] = await Promise.all([
      supabase.from('agents').select('*').eq('team_id', params.teamId).eq('is_active', true).order('name'),
      supabase.from('shifts').select('*').eq('team_id', params.teamId).order('sort_order'),
      supabase.from('weeks').select('id, week_start_date, status').eq('team_id', params.teamId),
      supabase.from('holidays').select('id, date, name').eq('team_id', params.teamId),
      supabase.from('compensation_days').select('id, agent_id, holiday_name, holiday_date, granted, used, used_date').eq('team_id', params.teamId),
    ])
    setAgents(ag ?? []); setShifts(sh ?? []); setHolidays(hol ?? []); setComps(cmp ?? [])

    const weeksData = wk ?? []
    setWeeks(weeksData)

    if (weeksData.length > 0) {
      const { data: ent } = await supabase
        .from('schedule_entries')
        .select('week_id, agent_id, day_of_week, shift_id')
        .in('week_id', weeksData.map(w => w.id))
      setEntries(ent ?? [])
    } else {
      setEntries([])
    }
    setLoading(false)
  }, [params.teamId])

  useEffect(() => { load() }, [load])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const weekById = (id: string) => weeks.find(w => w.id === id)
  const shiftById = (id: string | null) => shifts.find(s => s.id === id)

  /** actual calendar date of an entry */
  function entryDate(e: Entry): Date | null {
    const w = weekById(e.week_id)
    if (!w) return null
    return addDays(parseISO(w.week_start_date), e.day_of_week - 1)
  }

  /** entries that fall within the selected month */
  const monthEntries = entries.filter(e => {
    const d = entryDate(e)
    return d && isWithinInterval(d, { start: monthStart, end: monthEnd })
  })

  const holidayDates = new Set(holidays
    .filter(h => isWithinInterval(parseISO(h.date), { start: monthStart, end: monthEnd }))
    .map(h => h.date))

  const workShifts = shifts.filter(s => !s.is_off)
  const offShifts  = shifts.filter(s => s.is_off)

  /** per-agent aggregation */
  // A shift counts as "night" if its name hints night (Night / ليل / نايت)
  const isNightShift = (s: Shift | undefined) => !!s && /night|ليل|نايت/i.test(s.name)

  function agentStats(agentId: string) {
    const mine = monthEntries.filter(e => e.agent_id === agentId)
    const perShift: Record<string, number> = {}
    shifts.forEach(s => perShift[s.id] = 0)
    let off = 0, work = 0, holidayWorked = 0, weekendWorked = 0, nightWorked = 0

    mine.forEach(e => {
      if (!e.shift_id) return
      perShift[e.shift_id] = (perShift[e.shift_id] ?? 0) + 1
      const sh = shiftById(e.shift_id)
      if (sh?.is_off) { off++ }
      else {
        work++
        const d = entryDate(e)
        if (d && holidayDates.has(format(d, 'yyyy-MM-dd'))) holidayWorked++
        // weekend = Friday (6) or Saturday (7) under Sunday-first numbering
        if (e.day_of_week === 6 || e.day_of_week === 7) weekendWorked++
        if (isNightShift(sh)) nightWorked++
      }
    })

    const myComps = comps.filter(c => c.agent_id === agentId)
    return {
      perShift, off, work, holidayWorked, weekendWorked, nightWorked,
      compGranted: myComps.filter(c => c.granted).length,
      compUsed:    myComps.filter(c => c.used).length,
      comps:       myComps,
    }
  }

  // Fairness: the maximum load values across the team (to highlight the most-burdened)
  const loadMax = (() => {
    let night = 0, weekend = 0, holiday = 0
    agents.forEach(a => { const s = agentStats(a.id); night = Math.max(night, s.nightWorked); weekend = Math.max(weekend, s.weekendWorked); holiday = Math.max(holiday, s.holidayWorked) })
    return { night, weekend, holiday }
  })()

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalShiftsMonth = monthEntries.filter(e => { const s = shiftById(e.shift_id); return s && !s.is_off }).length
  const totalOffMonth    = monthEntries.filter(e => { const s = shiftById(e.shift_id); return s && s.is_off }).length

  function shiftColTotal(shiftId: string) {
    return monthEntries.filter(e => e.shift_id === shiftId).length
  }

  function prevMonth() { setMonth(m => startOfMonth(addDays(m, -1))) }
  function nextMonth() { setMonth(m => startOfMonth(addDays(endOfMonth(m), 1))) }

  // ── Per-agent month calendar (expanded) ─────────────────────────────────────
  function AgentCalendar({ agentId }: { agentId: string }) {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const myComps = comps.filter(c => c.agent_id === agentId)

    function shiftOnDate(d: Date): Shift | undefined {
      const ds = format(d, 'yyyy-MM-dd')
      const e = monthEntries.find(en => {
        const ed = entryDate(en)
        return en.agent_id === agentId && ed && format(ed, 'yyyy-MM-dd') === ds
      })
      return e ? shiftById(e.shift_id) : undefined
    }

    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 p-4">
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {[0,1,2,3,4,5,6].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase">{t(`dayShort.${d}`)}</div>
          ))}
          {/* leading blanks (Sunday-first) */}
          {Array.from({ length: parseISO(format(monthStart,'yyyy-MM-dd')).getDay() }).map((_, i) => (
            <div key={'b'+i} />
          ))}
          {days.map(d => {
            const sh = shiftOnDate(d)
            const ds = format(d, 'yyyy-MM-dd')
            const isHoliday = holidayDates.has(ds)
            return (
              <div key={ds}
                className={`rounded-lg p-1.5 text-center border ${isHoliday ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'}`}
                style={sh ? { background: hexToAlpha(sh.color_code, 0.18) } : {}}>
                <div className="text-[10px] text-slate-400">{format(d, 'd')}{isHoliday && ' 🎌'}</div>
                <div className="text-[10px] font-semibold leading-tight mt-0.5"
                  style={sh ? { color: sh.color_code } : { color: '#cbd5e1' }}>
                  {sh ? sh.name : '—'}
                </div>
              </div>
            )
          })}
        </div>

        {/* Compensation details */}
        {myComps.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-blue-500" /> {t('rep.compDays')}
            </div>
            <div className="space-y-1.5">
              {myComps.map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    {c.holiday_name} <span className="text-slate-400">({format(parseISO(c.holiday_date), 'd MMM')})</span>
                  </span>
                  {c.used ? (
                    <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                      {t('rep.compUsedOn')} {c.used_date ? format(parseISO(c.used_date), 'd MMM') : ''}
                    </span>
                  ) : c.granted ? (
                    <span className="bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">{t('rep.compNotUsed')}</span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full font-semibold">{t('rep.compNotGranted')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-slate-400">
      <RefreshCw className="w-4 h-4 animate-spin" /> {t('rep.loading')}
    </div>
  )

  return (
    <div className="p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        {t('common.backToTeam')}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('rep.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('rep.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-sm">
          <button onClick={prevMonth} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rtl:rotate-180"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">{format(month, 'MMMM yyyy')}</span>
          <button onClick={nextMonth} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rtl:rotate-180"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300"><Users className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-400">{t('rep.agents')}</p><h3 className="text-2xl font-bold text-slate-900 dark:text-white">{agents.length}</h3></div>
        </div>
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300"><Briefcase className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-400">{t('rep.workShifts')}</p><h3 className="text-2xl font-bold text-slate-900 dark:text-white">{totalShiftsMonth}</h3></div>
        </div>
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400"><CalendarDays className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-400">{t('rep.offDays')}</p><h3 className="text-2xl font-bold text-slate-900 dark:text-white">{totalOffMonth}</h3></div>
        </div>
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-300"><Umbrella className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-400">{t('rep.monthHolidays')}</p><h3 className="text-2xl font-bold text-slate-900 dark:text-white">{holidayDates.size}</h3></div>
        </div>
      </div>

      {/* Main table */}
      {agents.length === 0 ? (
        <div className="card card-body text-center text-slate-400 py-12">{t('rep.noAgents')}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-start p-3 px-5 font-semibold text-slate-600 dark:text-slate-300">{t('rep.colAgent')}</th>
                {workShifts.map(s => (
                  <th key={s.id} className="p-3 font-semibold text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color_code }} />
                      <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                    </div>
                  </th>
                ))}
                {offShifts.map(s => (
                  <th key={s.id} className="p-3 font-semibold text-center text-slate-400">{s.name}</th>
                ))}
                <th className="p-3 font-semibold text-center text-slate-700 dark:text-slate-200">{t('rep.total')}</th>
                <th className="p-3 font-semibold text-center text-purple-600 dark:text-purple-400">{t('rep.nights')}</th>
                <th className="p-3 font-semibold text-center text-orange-600 dark:text-orange-400">{t('rep.weekends')}</th>
                <th className="p-3 font-semibold text-center text-red-500 dark:text-red-400">{t('rep.holidaysWorked')}</th>
                <th className="p-3 font-semibold text-center text-blue-600 dark:text-blue-400">{t('rep.comp')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {agents.map(a => {
                const st = agentStats(a.id)
                const isOpen = expanded === a.id
                return (
                  <Fragment key={a.id}>
                    <tr
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : a.id)}>
                      <td className="p-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                            {a.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-100">{a.name}</span>
                        </div>
                      </td>
                      {workShifts.map(s => (
                        <td key={s.id} className="p-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                          {st.perShift[s.id] || <span className="text-slate-300 dark:text-slate-600">0</span>}
                        </td>
                      ))}
                      {offShifts.map(s => (
                        <td key={s.id} className="p-3 text-center text-slate-400">{st.perShift[s.id] || 0}</td>
                      ))}
                      <td className="p-3 text-center">
                        <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-0.5">{st.work}</span>
                      </td>
                      {/* Night load — highlight the most-burdened */}
                      <td className="p-3 text-center">
                        {st.nightWorked > 0
                          ? <span className={`font-bold rounded-full px-2.5 py-0.5 ${st.nightWorked === loadMax.night && loadMax.night > 0 ? 'bg-purple-600 text-white' : 'text-purple-700 bg-purple-50'}`}>{st.nightWorked}</span>
                          : <span className="text-slate-300">0</span>}
                      </td>
                      {/* Weekend load */}
                      <td className="p-3 text-center">
                        {st.weekendWorked > 0
                          ? <span className={`font-bold rounded-full px-2.5 py-0.5 ${st.weekendWorked === loadMax.weekend && loadMax.weekend > 0 ? 'bg-orange-500 text-white' : 'text-orange-700 bg-orange-50'}`}>{st.weekendWorked}</span>
                          : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="p-3 text-center">
                        {st.holidayWorked > 0
                          ? <span className={`font-bold rounded-full px-2.5 py-0.5 ${st.holidayWorked === loadMax.holiday && loadMax.holiday > 0 ? 'bg-red-500 text-white' : 'text-red-600 bg-red-50'}`}>{st.holidayWorked}</span>
                          : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="p-3 text-center text-xs">
                        {st.compGranted > 0
                          ? <span className="text-blue-700 dark:text-blue-400 font-semibold">{st.compUsed}/{st.compGranted} {t('rep.used')}</span>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="p-3 text-center">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={workShifts.length + offShifts.length + 6} className="p-0">
                          <AgentCalendar agentId={a.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-bold">
                <td className="p-3 px-5 text-slate-600 dark:text-slate-300">{t('rep.grandTotal')}</td>
                {workShifts.map(s => (
                  <td key={s.id} className="p-3 text-center text-slate-700 dark:text-slate-200">{shiftColTotal(s.id)}</td>
                ))}
                {offShifts.map(s => (
                  <td key={s.id} className="p-3 text-center text-slate-400">{shiftColTotal(s.id)}</td>
                ))}
                <td className="p-3 text-center text-slate-900 dark:text-white">{totalShiftsMonth}</td>
                <td className="p-3" colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        {t('rep.hint')}
      </p>
    </div>
  )
}
