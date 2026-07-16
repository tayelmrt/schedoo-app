'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { createClient }        from '@/lib/supabase/client'
import { format, addDays, parseISO } from 'date-fns'
import {
  CheckCircle2, Loader2, AlertTriangle,
} from 'lucide-react'
import { hexToAlpha } from '@/lib/utils'
import type { Shift, Week } from '@/lib/types'
import { useApp }      from '@/lib/providers'

interface AgentLite { id: string; name: string }
type DaySelection = Record<number, string | null>

export default function AgentHome() {
  const supabase = createClient()
  const router   = useRouter()
  const { t } = useApp()

  const [stateView, setStateView] = useState<'loading'|'pending'|'no-agent'|'ready'>('loading')
  const [agentName, setAgentName] = useState('')
  const [agentId, setAgentId]     = useState('')
  const [teamName, setTeamName]   = useState('')
  const [teamAgents, setTeamAgents] = useState<AgentLite[]>([])
  const [shifts, setShifts]       = useState<Shift[]>([])
  const [requirements, setReqs]   = useState<any[]>([])
  const [openWeeks, setOpenWeeks] = useState<Week[]>([])
  const [entries, setEntries]     = useState<any[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [selection, setSelection] = useState<DaySelection>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]         = useState('')

  async function loadData() {
    const res = await fetch('/api/me/schedule')
    if (res.status === 401) { router.replace('/auth/login'); return }
    const data = await res.json()
    if (data.error === 'pending') { setAgentName(data.agent?.name ?? ''); setStateView('pending'); return }
    if (data.error === 'no-agent') { setStateView('no-agent'); return }

    setAgentName(data.agent?.name ?? '')
    setAgentId(data.agent?.id ?? '')
    setTeamName(data.team?.name ?? '')
    setTeamAgents(data.teamAgents ?? [])
    setShifts(data.shifts ?? [])
    setReqs(data.requirements ?? [])
    setOpenWeeks(data.openWeeks ?? [])
    setEntries(data.entries ?? [])
    setStateView('ready')
  }

  useEffect(() => { loadData() }, [])

  const activeWeek = openWeeks[activeIdx]

  useEffect(() => {
    if (!activeWeek || !agentId) return
    const days: DaySelection = {}
    for (let d = 1; d <= 7; d++) days[d] = null
    entries.filter(e => e.agent_id === agentId && e.week_id === activeWeek.id)
      .forEach(e => { days[e.day_of_week] = e.shift_id })
    setSelection(days)
  }, [activeIdx, agentId, activeWeek?.id, entries])

  // ── Coverage helpers ──────────────────────────────────────────────────────
  function shiftOf(aId: string, day: number): Shift | undefined {
    if (!activeWeek) return undefined
    const e = entries.find(x => x.agent_id === aId && x.week_id === activeWeek.id && x.day_of_week === day)
    return e ? shifts.find(s => s.id === e.shift_id) : undefined
  }

  function coverage(day: number, shiftId: string) {
    const req = requirements.find(r => r.day_of_week === day && r.shift_id === shiftId)
    const min = req?.min_agents_required ?? 0
    const max = req?.max_agents ?? null
    const count = activeWeek
      ? entries.filter(e => e.week_id === activeWeek.id && e.day_of_week === day && e.shift_id === shiftId).length
      : 0
    let status: 'short'|'ok'|'full'|'none' = 'none'
    if (max != null && count >= max) status = 'full'
    else if (count < min) status = 'short'
    else if (min > 0) status = 'ok'
    return { count, min, max, status }
  }

  // capacity for MY picker (exclude myself so my own pick doesn't block me)
  function myCapacity(day: number, shiftId: string) {
    const req = requirements.find(r => r.day_of_week === day && r.shift_id === shiftId)
    const max = req?.max_agents ?? null
    const min = req?.min_agents_required ?? 0
    if (!activeWeek) return { full: false, short: false, count: 0, max, min }
    const count = entries.filter(e =>
      e.week_id === activeWeek.id && e.day_of_week === day && e.shift_id === shiftId && e.agent_id !== agentId
    ).length
    return { full: max != null && count >= max, short: count < min && min > 0, count, max, min }
  }

  // Shortage list across the active week (for the smart banner)
  const shortageHints: string[] = []
  if (activeWeek) {
    for (let d = 1; d <= 7; d++) {
      shifts.filter(s => !s.is_off).forEach(s => {
        const c = coverage(d, s.id)
        if (c.status === 'short') shortageHints.push(`${t(`day.${d - 1}`)} · ${s.name} (${c.count}/${c.min})`)
      })
    }
  }

  function weekLabel(s: string) {
    const m = parseISO(s); return `${format(m,'MMM d')} – ${format(addDays(m,6),'MMM d')}`
  }
  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function submit() {
    if (!activeWeek) return
    setSubmitting(true)
    const res = await fetch('/api/me/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekId: activeWeek.id, selection }),
    })
    const data = await res.json()
    if (data.error) { showToast(data.error); setSubmitting(false); if (res.status === 409) loadData(); return }
    setEntries(prev => {
      const others = prev.filter(e => !(e.agent_id === agentId && e.week_id === activeWeek.id))
      const mine = Object.entries(selection).map(([d, sid]) => ({
        week_id: activeWeek.id, agent_id: agentId, day_of_week: parseInt(d), shift_id: sid,
      }))
      return [...others, ...mine]
    })
    showToast(t('me.savedToast'))
    setSubmitting(false)
  }

  // ── States (pending / no-agent are handled by the agent layout) ────────────
  if (stateView !== 'ready')
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  // ── Ready ─────────────────────────────────────────────────────────────────
  const weekDays = activeWeek ? Array.from({ length: 7 }, (_, i) => addDays(parseISO(activeWeek.week_start_date), i)) : []

  return (
    <div className="pb-10">
      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg">{toast}</div>}

      <div className="max-w-5xl mx-auto p-4 pt-5">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{t('me.nav.register')}</h1>
        {openWeeks.length === 0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-3">📅</div><p className="text-slate-500 dark:text-slate-400">{t('me.noOpenWeek')}</p></div>
        ) : (
          <>
            {/* Week tabs */}
            {openWeeks.length > 1 && (
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 mb-4 max-w-md">
                {openWeeks.map((w, idx) => (
                  <button key={w.id} onClick={() => setActiveIdx(idx)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeIdx === idx ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                    {weekLabel(w.week_start_date)}
                  </button>
                ))}
              </div>
            )}

            {/* Shortage banner */}
            {shortageHints.length > 0 && (
              <div className="mb-4 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-red-700 dark:text-red-300">{t('me.shortageTitle')}</div>
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">{shortageHints.slice(0, 6).join('  •  ')}{shortageHints.length > 6 ? ' …' : ''}</div>
                </div>
              </div>
            )}

            {/* ── Team matrix (live, with names) ── */}
            <div className="card mb-5 overflow-x-auto">
              <div className="card-body p-0">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200 text-sm">📋 {t('me.teamSchedule')} — {weekLabel(activeWeek!.week_start_date)}</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-start p-2 px-4 font-semibold text-slate-500 sticky start-0 bg-slate-50 dark:bg-slate-800 min-w-[110px]">{t('me.colEmployee')}</th>
                      {weekDays.map((d, i) => (
                        <th key={i} className="p-2 text-center font-semibold text-slate-500 min-w-[64px]">
                          {t(`dayShort.${i}`)}<div className="text-[9px] text-slate-400 font-normal">{format(d,'d/M')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamAgents.map(a => {
                      const isMe = a.id === agentId
                      return (
                        <tr key={a.id} className={`border-b border-slate-50 dark:border-slate-800 ${isMe ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                          <td className={`p-2 px-4 font-medium sticky start-0 ${isMe ? 'bg-blue-50/50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}>
                            {a.name}{isMe && t('me.meSuffix')}
                          </td>
                          {[1,2,3,4,5,6,7].map(day => {
                            const sh = shiftOf(a.id, day)
                            return (
                              <td key={day} className="p-1 text-center">
                                {sh ? (
                                  <span className="inline-block rounded px-1.5 py-1 text-[10px] font-semibold leading-none"
                                    style={{ background: hexToAlpha(sh.color_code,0.2), color: sh.color_code }}>{sh.name}</span>
                                ) : (
                                  <span className="text-slate-200">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    {/* Coverage row per work shift */}
                    {shifts.filter(s => !s.is_off).map(s => (
                      <tr key={'cov'+s.id} className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40">
                        <td className="p-2 px-4 sticky start-0 bg-slate-50/70 dark:bg-slate-800">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full" style={{ background: s.color_code }} /> {t('me.coverage')} {s.name}
                          </span>
                        </td>
                        {[1,2,3,4,5,6,7].map(day => {
                          const c = coverage(day, s.id)
                          if (c.min === 0 && c.max == null && c.count === 0) return <td key={day} className="p-1 text-center text-slate-200 dark:text-slate-700">—</td>
                          const cls = c.status === 'short' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : c.status === 'full' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : c.status === 'ok' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          const label = c.status === 'short' ? `${t('me.short')} ${c.count}/${c.min}`
                            : c.status === 'full' ? `${t('me.full')} ${c.count}/${c.max}`
                            : `${c.count}${c.max != null ? '/'+c.max : c.min ? '/'+c.min : ''}`
                          return <td key={day} className="p-1 text-center"><span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{label}</span></td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 flex flex-wrap gap-3 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-300" /> {t('me.legShort')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300" /> {t('me.legOk')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" /> {t('me.legFull')}</span>
                  <span className="flex items-center gap-1"><span className="text-slate-300">—</span> {t('me.legNone')}</span>
                </div>
              </div>
            </div>

            {/* ── My registration ── */}
            <div className="font-bold text-slate-700 dark:text-slate-200 mb-2 px-1">{t('me.registerMine')}</div>
            {weekDays.map((day, idx) => {
              const dayNum = idx + 1
              const selected = selection[dayNum]
              const selShift = shifts.find(s => s.id === selected)
              return (
                <div key={dayNum} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-3">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div><span className="font-bold text-slate-800 dark:text-slate-100">{t(`day.${dayNum - 1}`)}</span>
                      <span className="text-slate-400 text-sm mx-2">{format(day,'MMM d')}</span></div>
                    {selShift && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: selShift.color_code }} />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{selShift.name}</span></div>}
                  </div>
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {shifts.map(s => {
                      const isSel = selected === s.id
                      const cap = myCapacity(dayNum, s.id)
                      const locked = cap.full && !isSel
                      return (
                        <button key={s.id} disabled={locked}
                          onClick={() => !locked && setSelection(p => ({ ...p, [dayNum]: s.id }))}
                          className={`relative rounded-xl p-3 text-center text-sm font-semibold border-2 transition-all ${
                            isSel ? 'shadow-md scale-105'
                            : locked ? 'border-transparent bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                            : cap.short ? 'border-red-300 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
                            : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                          style={isSel ? { background: s.color_code+'22', borderColor: s.color_code, color: s.color_code } : {}}>
                          <div>{s.name}</div>
                          {locked ? <div className="text-[10px] font-bold text-red-400 mt-0.5">🔒 {t('me.full')} {cap.count}/{cap.max}</div>
                            : cap.short && !s.is_off ? <div className="text-[10px] font-bold mt-0.5">🔴 {t('me.need')} {cap.count}/{cap.min}</div>
                            : cap.max != null ? <div className="text-[10px] opacity-60 mt-0.5">{cap.count}/{cap.max}</div>
                            : (!s.is_off && s.start_time) ? <div className="text-[10px] opacity-70 mt-0.5">{s.start_time.slice(0,5)}</div> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <button onClick={submit} disabled={submitting} className="btn btn-primary w-full py-3 text-base rounded-2xl mt-2">
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('me.saving')}</> : <><CheckCircle2 className="w-5 h-5" /> {t('me.saveMine')}</>}
            </button>
            <p className="text-xs text-slate-400 text-center mt-2">{t('me.liveHint')}</p>
          </>
        )}
      </div>
    </div>
  )
}
