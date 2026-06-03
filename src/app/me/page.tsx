'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import Link                    from 'next/link'
import { createClient }        from '@/lib/supabase/client'
import { format, addDays, parseISO } from 'date-fns'
import {
  CheckCircle2, Loader2, Clock, AlertCircle, LogOut, CalendarDays,
} from 'lucide-react'
import type { Shift, Week } from '@/lib/types'
import { DAYS } from '@/lib/types'

type DaySelection = Record<number, string | null>

export default function AgentHome() {
  const supabase = createClient()
  const router   = useRouter()

  const [state, setState]   = useState<'loading'|'pending'|'no-agent'|'ready'>('loading')
  const [agentName, setAgentName] = useState('')
  const [teamName, setTeamName]   = useState('')
  const [shifts, setShifts]       = useState<Shift[]>([])
  const [requirements, setReqs]   = useState<any[]>([])
  const [openWeeks, setOpenWeeks] = useState<Week[]>([])
  const [entries, setEntries]     = useState<any[]>([])
  const [agentId, setAgentId]     = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [selection, setSelection] = useState<DaySelection>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]         = useState('')

  async function loadData() {
    const res = await fetch('/api/me/schedule')
    if (res.status === 401) { router.replace('/auth/login'); return }
    const data = await res.json()
    if (data.error === 'pending') { setAgentName(data.agent?.name ?? ''); setState('pending'); return }
    if (data.error === 'no-agent') { setState('no-agent'); return }

    setAgentName(data.agent?.name ?? '')
    setAgentId(data.agent?.id ?? '')
    setTeamName(data.team?.name ?? '')
    setShifts(data.shifts ?? [])
    setReqs(data.requirements ?? [])
    setOpenWeeks(data.openWeeks ?? [])
    setEntries(data.entries ?? [])
    setState('ready')
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

  function capacity(day: number, shiftId: string) {
    const req = requirements.find(r => r.day_of_week === day && r.shift_id === shiftId)
    const max = req?.max_agents ?? null
    if (max == null || !activeWeek) return { full: false, count: 0, max: null as number | null }
    const count = entries.filter(e =>
      e.week_id === activeWeek.id && e.day_of_week === day && e.shift_id === shiftId && e.agent_id !== agentId
    ).length
    return { full: count >= max, count, max }
  }

  function weekLabel(s: string) {
    const m = parseISO(s); return `${format(m,'MMM d')} – ${format(addDays(m,6),'MMM d')}`
  }
  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3000) }

  async function submit() {
    if (!activeWeek) return
    setSubmitting(true)
    const res = await fetch('/api/me/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekId: activeWeek.id, selection }),
    })
    const data = await res.json()
    if (data.error) { showToast(data.error); setSubmitting(false); if (res.status === 409) loadData(); return }
    // refresh local entries
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
  if (state === 'loading')
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  if (state === 'pending')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <Clock className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">في انتظار موافقة الأدمين</h1>
          <p className="text-slate-500 text-sm">
            أهلاً {agentName || ''} — حسابك اتسجّل بنجاح. لسه محتاج الأدمين يوافق على دخولك.
            هتقدر تسجّل جدولك أول ما يوافق.
          </p>
          <button onClick={signOut} className="btn btn-ghost mt-6 mx-auto"><LogOut className="w-4 h-4" /> خروج</button>
        </div>
      </div>
    )

  if (state === 'no-agent')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <AlertCircle className="w-14 h-14 text-red-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">مفيش صلاحية دخول</h1>
          <p className="text-slate-500 text-sm">
            الإيميل ده لسه مش مضاف لأي فريق. تواصل مع الأدمين عشان يضيف إيميلك.
          </p>
          <button onClick={signOut} className="btn btn-ghost mt-6 mx-auto"><LogOut className="w-4 h-4" /> خروج</button>
        </div>
      </div>
    )

  // ── Ready (matrix) ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg">{toast}</div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              {agentName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">{agentName}</div>
              <div className="text-xs text-slate-400">{teamName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/me/month" className="btn btn-ghost btn-sm"><CalendarDays className="w-4 h-4" /> جدولي الشهري</Link>
            <button onClick={signOut} className="text-slate-400 hover:text-red-500"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pt-5">
        {openWeeks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-slate-500">مفيش أسبوع مفتوح للتسجيل دلوقتي.</p>
          </div>
        ) : (
          <>
            {/* Week tabs */}
            {openWeeks.length > 1 && (
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-4">
                {openWeeks.map((w, idx) => (
                  <button key={w.id} onClick={() => setActiveIdx(idx)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeIdx === idx ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                    }`}>
                    {weekLabel(w.week_start_date)}
                  </button>
                ))}
              </div>
            )}

            {Array.from({ length: 7 }, (_, i) => addDays(parseISO(activeWeek!.week_start_date), i)).map((day, idx) => {
              const dayNum = idx + 1
              const selected = selection[dayNum]
              const selShift = shifts.find(s => s.id === selected)
              return (
                <div key={dayNum} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-3">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div><span className="font-bold text-slate-800">{DAYS[dayNum]}</span>
                      <span className="text-slate-400 text-sm ml-2">{format(day, 'MMM d')}</span></div>
                    {selShift && <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: selShift.color_code }} />
                      <span className="text-xs font-semibold text-slate-600">{selShift.name}</span></div>}
                  </div>
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {shifts.map(s => {
                      const isSel = selected === s.id
                      const cap = capacity(dayNum, s.id)
                      const locked = cap.full && !isSel
                      return (
                        <button key={s.id} disabled={locked}
                          onClick={() => !locked && setSelection(p => ({ ...p, [dayNum]: s.id }))}
                          className={`rounded-xl p-3 text-center text-sm font-semibold border-2 transition-all ${
                            isSel ? 'shadow-md scale-105'
                            : locked ? 'border-transparent bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                          style={isSel ? { background: s.color_code+'22', borderColor: s.color_code, color: s.color_code } : {}}>
                          <div>{s.name}</div>
                          {locked ? <div className="text-[10px] font-bold text-red-400 mt-0.5">🔒 مكتمل {cap.count}/{cap.max}</div>
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
          </>
        )}
      </div>
    </div>
  )
}
