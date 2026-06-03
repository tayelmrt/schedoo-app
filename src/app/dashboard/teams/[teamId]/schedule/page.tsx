'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient }     from '@/lib/supabase/client'
import Link                 from 'next/link'
import { addDays, format }  from 'date-fns'
import {
  ChevronLeft, ChevronRight, Lock, Download, RefreshCw, AlertTriangle, CalendarPlus,
} from 'lucide-react'
import {
  getWeekMonday, getWeekDays, toDateStr, hexToAlpha, isDark
} from '@/lib/utils'
import type {
  Agent, Shift, Week, ScheduleEntry, Requirement, DayShiftSummary
} from '@/lib/types'
import { DAY_SHORTS } from '@/lib/types'

// ─── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ count, required }: { count: number; required: number }) {
  if (required === 0) return <span className="badge-none">—</span>
  if (count === required) return <span className="badge-ok">✓ OK {count}/{required}</span>
  if (count < required)  return <span className="badge-less">▼ LESS {count}/{required}</span>
  return                        <span className="badge-more">▲ MORE {count}/{required}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulePage({ params }: { params: { teamId: string } }) {
  const supabase  = createClient()

  const [weekDate, setWeekDate]   = useState<Date>(getWeekMonday(new Date()))
  const [week, setWeek]           = useState<Week | null>(null)
  const [agents, setAgents]       = useState<Agent[]>([])
  const [shifts, setShifts]       = useState<Shift[]>([])
  const [requirements, setReqs]   = useState<Requirement[]>([])
  const [entries, setEntries]     = useState<ScheduleEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [openingNext, setOpeningNext] = useState(false)
  const [toast, setToast]           = useState('')

  const weekDays  = getWeekDays(weekDate)
  const weekStart = toDateStr(weekDate)

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: agentsData },
      { data: shiftsData },
      { data: reqsData },
    ] = await Promise.all([
      supabase.from('agents').select('*').eq('team_id', params.teamId).eq('is_active', true).order('created_at'),
      supabase.from('shifts').select('*').eq('team_id', params.teamId).order('sort_order'),
      supabase.from('requirements').select('*').eq('team_id', params.teamId),
    ])

    setAgents(agentsData ?? [])
    setShifts(shiftsData ?? [])
    setReqs(reqsData ?? [])

    // Fetch or create week
    let { data: weekData } = await supabase.from('weeks')
      .select('*').eq('team_id', params.teamId).eq('week_start_date', weekStart).maybeSingle()

    if (!weekData) {
      const { data: newWeek } = await supabase.from('weeks')
        .insert({ team_id: params.teamId, week_start_date: weekStart, status: 'open' })
        .select().single()
      weekData = newWeek
    }
    setWeek(weekData)

    if (weekData) {
      const { data: entriesData } = await supabase.from('schedule_entries')
        .select('*, shift:shifts(*), agent:agents(*)')
        .eq('week_id', weekData.id)
      setEntries(entriesData ?? [])
    }

    setLoading(false)
  }, [weekStart, params.teamId])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getEntry(agentId: string, day: number): ScheduleEntry | undefined {
    return entries.find(e => e.agent_id === agentId && e.day_of_week === day)
  }

  function getShift(shiftId: string | null): Shift | undefined {
    return shifts.find(s => s.id === shiftId)
  }

  /** Summary per shift per day for the validation row */
  function getDaySummaries(day: number): DayShiftSummary[] {
    return shifts.map(s => {
      const count = entries.filter(e => e.day_of_week === day && e.shift_id === s.id).length
      const req   = requirements.find(r => r.shift_id === s.id && r.day_of_week === day)
      const required = req?.min_agents_required ?? 0
      let status: DayShiftSummary['status'] = 'none'
      if (required > 0) {
        status = count === required ? 'ok' : count < required ? 'less' : 'more'
      }
      return { shift_id: s.id, shift_name: s.name, shift_color: s.color_code, count, required, status }
    })
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Confirm week ──────────────────────────────────────────────────────────
  async function confirmWeek() {
    if (!week) return
    if (!confirm('Lock this schedule? Agents will no longer be able to edit their submissions.')) return
    setConfirming(true)
    await supabase.from('weeks').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', week.id)
    showToast('Schedule confirmed ✓')
    loadAll()
    setConfirming(false)
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function exportSchedule() {
    if (!week) return
    setExporting(true)
    try {
      const res = await fetch(`/api/export/${week.id}`, { method: 'POST' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      showToast('Export sent to managers ✉️')
      loadAll()
    } catch (err: any) {
      showToast('Export failed: ' + err.message)
    }
    setExporting(false)
  }

  // ── Open next week for agent submissions ──────────────────────────────────
  async function openNextWeek() {
    setOpeningNext(true)
    const nextMonday = addDays(getWeekMonday(new Date()), 7)
    const nextStart  = toDateStr(nextMonday)

    // Create week if it doesn't exist
    const { data: existing } = await supabase.from('weeks')
      .select('id').eq('team_id', params.teamId).eq('week_start_date', nextStart).maybeSingle()

    if (!existing) {
      await supabase.from('weeks').insert({
        team_id: params.teamId,
        week_start_date: nextStart,
        status: 'open',
      })
    } else {
      // Re-open if it was somehow closed
      await supabase.from('weeks').update({ status: 'open' })
        .eq('team_id', params.teamId).eq('week_start_date', nextStart)
    }

    setOpeningNext(false)
    showToast('تم فتح الأسبوع القادم للتسجيل ✅')
    setWeekDate(nextMonday)
    setTimeout(() => loadAll(), 500)
  }

  // ── Navigate weeks ────────────────────────────────────────────────────────
  function prevWeek() { setWeekDate(d => addDays(d, -7)) }
  function nextWeek() { setWeekDate(d => addDays(d, 7)) }

  // Friday warning: if today is Friday (Egypt time) and week not confirmed
  const todayEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
  const isFriday   = todayEgypt.getDay() === 5
  const fridayHour = todayEgypt.getHours()
  const showFridayWarning = isFriday && fridayHour >= 12 && week?.status !== 'confirmed'

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading schedule…
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      {/* Friday Warning Banner */}
      {showFridayWarning && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <div className="font-bold text-sm">⚠️ تحذير — اليوم الجمعة والجدول لم يُأكَّد بعد!</div>
            <div className="text-xs text-red-600 mt-0.5">
              يُنصح بتأكيد الجدول وإرساله للمانجر قبل نهاية اليوم.
            </div>
          </div>
          <button onClick={confirmWeek} disabled={confirming}
            className="mr-auto btn btn-danger btn-sm">
            {confirming ? 'جاري التأكيد…' : '🔒 أكد الآن'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-1 inline-block">
            ← Team
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Schedule Matrix</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Week navigator */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <button onClick={prevWeek} className="text-slate-400 hover:text-slate-700">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
              {format(weekDate, 'MMM d')} – {format(addDays(weekDate, 6), 'MMM d, yyyy')}
            </span>
            <button onClick={nextWeek} className="text-slate-400 hover:text-slate-700">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Status badge */}
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            week?.status === 'confirmed'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {week?.status === 'confirmed' ? '🔒 Confirmed' : '🟡 Open'}
          </span>

          {week?.status !== 'confirmed' && (
            <button onClick={confirmWeek} disabled={confirming} className="btn btn-success btn-sm">
              <Lock className="w-3.5 h-3.5" />
              {confirming ? 'جاري التأكيد…' : 'تأكيد الجدول'}
            </button>
          )}

          <button onClick={openNextWeek} disabled={openingNext} className="btn btn-ghost btn-sm">
            <CalendarPlus className="w-3.5 h-3.5" />
            {openingNext ? 'جاري الفتح…' : 'فتح الأسبوع القادم'}
          </button>

          <button onClick={exportSchedule} disabled={exporting} className="btn btn-primary btn-sm">
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Export & Email'}
          </button>

          {week?.export_url_excel && (
            <a href={week.export_url_excel} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost btn-sm">
              ⬇ Excel
            </a>
          )}
          {week?.export_url_pdf && (
            <a href={week.export_url_pdf} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost btn-sm">
              ⬇ PDF
            </a>
          )}
        </div>
      </div>

      {/* Matrix */}
      {agents.length === 0 ? (
        <div className="card card-body text-center text-slate-400 py-16">
          No agents yet. <Link href={`/dashboard/teams/${params.teamId}/agents`} className="text-blue-600 underline">Add agents first</Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left p-3 pl-5 font-semibold text-slate-600 w-40 bg-slate-50">Agent</th>
                {weekDays.map((d, i) => (
                  <th key={i} className="p-3 text-center font-semibold text-slate-600 bg-slate-50 min-w-[110px]">
                    <div>{DAY_SHORTS[i + 1]}</div>
                    <div className="text-xs text-slate-400 font-normal">{format(d, 'MMM d')}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Agent rows */}
              {agents.map(agent => (
                <tr key={agent.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 pl-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {agent.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800 text-sm">{agent.name}</span>
                    </div>
                  </td>
                  {[1,2,3,4,5,6,7].map(day => {
                    const entry = getEntry(agent.id, day)
                    const shift = getShift(entry?.shift_id ?? null)
                    return (
                      <td key={day} className="p-1.5 text-center">
                        {shift ? (
                          <div
                            className="rounded-lg px-2 py-1.5 text-xs font-semibold leading-tight"
                            style={{
                              background:  hexToAlpha(shift.color_code, 0.2),
                              color:       shift.color_code,
                              border:      `1px solid ${hexToAlpha(shift.color_code, 0.4)}`,
                            }}>
                            {shift.name}
                            {!shift.is_off && shift.start_time && (
                              <div className="text-[10px] opacity-70 font-normal">
                                {shift.start_time.slice(0,5)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg px-2 py-1.5 text-xs text-slate-300 bg-slate-50 border border-slate-100">
                            {entry?.status === 'submitted' ? '—' : 'Not submitted'}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Validation rows per shift */}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="p-3 pl-5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Validation</div>
                </td>
                {[1,2,3,4,5,6,7].map(day => {
                  const summaries = getDaySummaries(day)
                  return (
                    <td key={day} className="p-2 align-top">
                      <div className="space-y-1">
                        {summaries
                          .filter(s => s.required > 0 || s.count > 0)
                          .map(s => (
                            <div key={s.shift_id} className="text-center">
                              <div className="text-[10px] text-slate-400 mb-0.5">{s.shift_name}</div>
                              <StatusBadge count={s.count} required={s.required} />
                            </div>
                          ))
                        }
                      </div>
                    </td>
                  )
                })}
              </tr>

              {/* Submission count row */}
              <tr className="bg-slate-50 border-t border-slate-100">
                <td className="p-3 pl-5 text-xs font-medium text-slate-400">Submissions</td>
                {[1,2,3,4,5,6,7].map(day => {
                  const submitted = entries.filter(e => e.day_of_week === day && e.status === 'submitted').length
                  const total     = agents.length
                  return (
                    <td key={day} className="p-2 text-center">
                      <span className={`text-xs font-semibold ${
                        submitted === total ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        {submitted}/{total}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Shift legend */}
      {shifts.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4">
          {shifts.map(s => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded-full" style={{ background: s.color_code }} />
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
