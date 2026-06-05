'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import Link                    from 'next/link'
import { createClient }        from '@/lib/supabase/client'
import { format, addDays, parseISO } from 'date-fns'
import {
  CheckCircle2, Loader2, Clock, AlertCircle, LogOut, CalendarDays, AlertTriangle,
} from 'lucide-react'
import { hexToAlpha } from '@/lib/utils'
import type { Shift, Week } from '@/lib/types'
import { DAYS, DAY_SHORTS } from '@/lib/types'

interface AgentLite { id: string; name: string }
type DaySelection = Record<number, string | null>

export default function AgentHome() {
  const supabase = createClient()
  const router   = useRouter()

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
        if (c.status === 'short') shortageHints.push(`${DAYS[d]} · ${s.name} (${c.count}/${c.min})`)
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
    showToast('تم حفظ جدولك ✅')
    setSubmitting(false)
  }

  async function signOut() { await supabase.auth.signOut(); router.replace('/auth/login') }

  // ── States ──────────────────────────────────────────────────────────────────
  if (stateView === 'loading')
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  if (stateView === 'pending')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <Clock className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">في انتظار موافقة الأدمين</h1>
          <p className="text-slate-500 text-sm">أهلاً {agentName || ''} — حسابك اتسجّل بنجاح. لسه محتاج الأدمين يوافق على دخولك.</p>
          <button onClick={signOut} className="btn btn-ghost mt-6 mx-auto"><LogOut className="w-4 h-4" /> خروج</button>
        </div>
      </div>
    )

  if (stateView === 'no-agent')
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

  // ── Ready ─────────────────────────────────────────────────────────────────
  const weekDays = activeWeek ? Array.from({ length: 7 }, (_, i) => addDays(parseISO(activeWeek.week_start_date), i)) : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 pb-10">
      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg">{toast}</div>}

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              {agentName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div><div className="font-bold text-slate-800 text-sm">{agentName}</div>
              <div className="text-xs text-slate-400">{teamName}</div></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/me/month" className="btn btn-ghost btn-sm"><CalendarDays className="w-4 h-4" /> جدولي الشهري</Link>
            <button onClick={signOut} className="text-slate-400 hover:text-red-500"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 pt-5">
        {openWeeks.length === 0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-3">📅</div><p className="text-slate-500">مفيش أسبوع مفتوح للتسجيل دلوقتي.</p></div>
        ) : (
          <>
            {/* Week tabs */}
            {openWeeks.length > 1 && (
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-4 max-w-md">
                {openWeeks.map((w, idx) => (
                  <button key={w.id} onClick={() => setActiveIdx(idx)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeIdx === idx ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                    {weekLabel(w.week_start_date)}
                  </button>
                ))}
              </div>
            )}

            {/* Shortage banner */}
            {shortageHints.length > 0 && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-red-700">فيه شيفتات فيها عجز — سجّل فيها وتساعد الفريق 🙌</div>
                  <div className="text-xs text-red-600 mt-1">{shortageHints.slice(0, 6).join('  •  ')}{shortageHints.length > 6 ? ' …' : ''}</div>
                </div>
              </div>
            )}

            {/* ── Team matrix (live, with names) ── */}
            <div className="card mb-5 overflow-x-auto">
              <div className="card-body p-0">
                <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">📋 جدول الفريق — {weekLabel(activeWeek!.week_start_date)}</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-right p-2 pr-4 font-semibold text-slate-500 sticky right-0 bg-slate-50 min-w-[110px]">الموظف</th>
                      {weekDays.map((d, i) => (
                        <th key={i} className="p-2 text-center font-semibold text-slate-500 min-w-[64px]">
                          {DAY_SHORTS[i+1]}<div className="text-[9px] text-slate-400 font-normal">{format(d,'d/M')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamAgents.map(a => {
                      const isMe = a.id === agentId
                      return (
                        <tr key={a.id} className={`border-b border-slate-50 ${isMe ? 'bg-blue-50/50' : ''}`}>
                          <td className={`p-2 pr-4 font-medium sticky right-0 ${isMe ? 'bg-blue-50/50 text-blue-800' : 'bg-white text-slate-700'}`}>
                            {a.name}{isMe && ' (أنا)'}
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
                      <tr key={'cov'+s.id} className="border-t border-slate-200 bg-slate-50/70">
                        <td className="p-2 pr-4 sticky right-0 bg-slate-50/70">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <span className="w-2 h-2 rounded-full" style={{ background: s.color_code }} /> تغطية {s.name}
                          </span>
                        </td>
                        {[1,2,3,4,5,6,7].map(day => {
                          const c = coverage(day, s.id)
                          if (c.min === 0 && c.max == null && c.count === 0) return <td key={day} className="p-1 text-center text-slate-200">—</td>
                          const cls = c.status === 'short' ? 'bg-red-100 text-red-700'
                            : c.status === 'full' ? 'bg-amber-100 text-amber-700'
                            : c.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          const label = c.status === 'short' ? `عجز ${c.count}/${c.min}`
                            : c.status === 'full' ? `مكتمل ${c.count}/${c.max}`
                            : `${c.count}${c.max != null ? '/'+c.max : c.min ? '/'+c.min : ''}`
                          return <td key={day} className="p-1 text-center"><span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{label}</span></td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 flex flex-wrap gap-3 text-[10px] text-slate-500 border-t border-slate-100">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-300" /> عجز</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300" /> تمام</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" /> مكتمل</span>
                  <span className="flex items-center gap-1"><span className="text-slate-300">—</span> لسه مسجّلش</span>
                </div>
              </div>
            </div>

            {/* ── My registration ── */}
            <div className="font-bold text-slate-700 mb-2 px-1">✍️ سجّل جدولي</div>
            {weekDays.map((day, idx) => {
              const dayNum = idx + 1
              const selected = selection[dayNum]
              const selShift = shifts.find(s => s.id === selected)
              return (
                <div key={dayNum} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-3">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div><span className="font-bold text-slate-800">{DAYS[dayNum]}</span>
                      <span className="text-slate-400 text-sm ml-2">{format(day,'MMM d')}</span></div>
                    {selShift && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: selShift.color_code }} />
                      <span className="text-xs font-semibold text-slate-600">{selShift.name}</span></div>}
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
                            : locked ? 'border-transparent bg-slate-100 text-slate-300 cursor-not-allowed'
                            : cap.short ? 'border-red-300 bg-red-50 text-red-600'
                            : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                          style={isSel ? { background: s.color_code+'22', borderColor: s.color_code, color: s.color_code } : {}}>
                          <div>{s.name}</div>
                          {locked ? <div className="text-[10px] font-bold text-red-400 mt-0.5">🔒 مكتمل {cap.count}/{cap.max}</div>
                            : cap.short && !s.is_off ? <div className="text-[10px] font-bold mt-0.5">🔴 محتاج {cap.count}/{cap.min}</div>
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
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ…</> : <><CheckCircle2 className="w-5 h-5" /> حفظ جدولي</>}
            </button>
            <p className="text-xs text-slate-400 text-center mt-2">الجدول بيتحدّث لحظياً — كل ما حد يسجّل، التغطية تتغيّر. اعمل تحديث للصفحة لأحدث حالة.</p>
          </>
        )}
      </div>
    </div>
  )
}
