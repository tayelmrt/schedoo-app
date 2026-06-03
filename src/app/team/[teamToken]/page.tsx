'use client'

import { useEffect, useState } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { CheckCircle2, AlertCircle, Loader2, Users, ArrowRight } from 'lucide-react'
import type { Shift, Week } from '@/lib/types'
import { DAYS }             from '@/lib/types'

interface AgentLite { id: string; name: string }
type DaySelection = Record<number, string | null>

export default function TeamSchedulePage({ params }: { params: { teamToken: string } }) {
  const [teamName, setTeamName] = useState('')
  const [agents, setAgents]     = useState<AgentLite[]>([])
  const [shifts, setShifts]     = useState<Shift[]>([])
  const [openWeeks, setOpenWeeks] = useState<Week[]>([])
  const [allEntries, setAllEntries] = useState<any[]>([])
  const [requirements, setRequirements] = useState<any[]>([])

  const [selectedAgent, setSelectedAgent] = useState<AgentLite | null>(null)
  const [activeWeekIdx, setActiveWeekIdx]  = useState(0)
  const [selection, setSelection] = useState<DaySelection>({})

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')

  // ── Load team data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const res  = await fetch(`/api/team/${params.teamToken}`)
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setTeamName(data.team?.name ?? '')
      setAgents(data.agents ?? [])
      setShifts(data.shifts ?? [])
      setOpenWeeks(data.openWeeks ?? [])
      setAllEntries(data.entries ?? [])
      setRequirements(data.requirements ?? [])
      setLoading(false)
    }
    load()
  }, [params.teamToken])

  const activeWeek = openWeeks[activeWeekIdx]

  // ── When agent or week changes, load their existing selection ────────────────
  useEffect(() => {
    if (!selectedAgent || !activeWeek) return
    const days: DaySelection = {}
    for (let d = 1; d <= 7; d++) days[d] = null
    allEntries
      .filter(e => e.agent_id === selectedAgent.id && e.week_id === activeWeek.id)
      .forEach(e => { days[e.day_of_week] = e.shift_id })
    setSelection(days)
    setSubmitted(false)
  }, [selectedAgent, activeWeekIdx, activeWeek?.id])

  // Capacity check: returns { full, count, max } for a (day, shift) on the active week,
  // excluding the current agent's own slot.
  function capacity(day: number, shiftId: string) {
    const req = requirements.find(r => r.day_of_week === day && r.shift_id === shiftId)
    const max = req?.max_agents ?? null
    if (max == null || !activeWeek) return { full: false, count: 0, max: null as number | null }
    const count = allEntries.filter(
      e => e.week_id === activeWeek.id &&
           e.day_of_week === day &&
           e.shift_id === shiftId &&
           e.agent_id !== selectedAgent?.id
    ).length
    return { full: count >= max, count, max }
  }

  function weekLabel(weekStart: string) {
    const m = parseISO(weekStart)
    return `${format(m, 'MMM d')} – ${format(addDays(m, 6), 'MMM d')}`
  }
  function isCurrentWeek(weekStart: string) {
    const today = new Date(), m = parseISO(weekStart)
    return today >= m && today <= addDays(m, 6)
  }

  async function submit() {
    if (!selectedAgent || !activeWeek) return
    setSubmitting(true)
    const res = await fetch(`/api/team/${params.teamToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: selectedAgent.id, weekId: activeWeek.id, selection }),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setSubmitting(false); return }
    // Update local cache so re-selecting shows saved data
    setAllEntries(prev => {
      const others = prev.filter(e => !(e.agent_id === selectedAgent.id && e.week_id === activeWeek.id))
      const mine = Object.entries(selection).map(([d, sid]) => ({
        week_id: activeWeek.id, agent_id: selectedAgent.id, day_of_week: parseInt(d), shift_id: sid,
      }))
      return [...others, ...mine]
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (loading)
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  if (error && !selectedAgent)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div><AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" /><p className="text-slate-600">{error}</p></div>
      </div>
    )

  if (openWeeks.length === 0)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div>
          <div className="text-5xl mb-4">📅</div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">لا يوجد جدول مفتوح</h1>
          <p className="text-slate-500">المسؤول لم يفتح أسبوعاً للتسجيل بعد.</p>
        </div>
      </div>
    )

  // ── Name selection screen ───────────────────────────────────────────────────
  if (!selectedAgent) {
    const filtered = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="bg-white border-b border-slate-200 px-4 py-5 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-lg mb-2">S</div>
          <h1 className="text-xl font-bold text-slate-900">جدول {teamName}</h1>
          <p className="text-slate-500 text-sm mt-1">اختر اسمك للبدء</p>
        </div>

        <div className="max-w-md mx-auto p-4 pt-6">
          <div className="flex items-center gap-2 mb-3 bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-sm">
            <Users className="w-4 h-4 text-slate-400" />
            <input
              className="flex-1 outline-none text-sm bg-transparent"
              placeholder="ابحث عن اسمك…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {filtered.map(a => (
              <button key={a.id}
                onClick={() => setSelectedAgent(a)}
                className="w-full flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3.5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {a.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-800">{a.name}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-8">لا يوجد اسم مطابق</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">تم الحفظ! 🎉</h1>
          <p className="text-slate-500">
            تم حفظ جدول <strong>{selectedAgent.name}</strong> لأسبوع {weekLabel(activeWeek!.week_start_date)}
          </p>
          <div className="flex gap-3 justify-center mt-5">
            {openWeeks.length > 1 && (
              <button onClick={() => { setActiveWeekIdx(i => i === 0 ? 1 : 0) }} className="btn btn-ghost">
                أسبوع آخر
              </button>
            )}
            <button onClick={() => { setSelectedAgent(null); setSearch('') }} className="btn btn-primary">
              تسجيل اسم آخر
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Schedule form ───────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(parseISO(activeWeek!.week_start_date), i))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              {selectedAgent.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">{selectedAgent.name}</div>
              <button onClick={() => { setSelectedAgent(null); setSearch('') }}
                className="text-xs text-blue-500 hover:underline">مش أنا؟ تغيير</button>
            </div>
          </div>

          {/* Week tabs */}
          {openWeeks.length > 1 ? (
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {openWeeks.map((w, idx) => (
                <button key={w.id} onClick={() => setActiveWeekIdx(idx)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeWeekIdx === idx ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}>
                  {isCurrentWeek(w.week_start_date) ? 'هذا الأسبوع' : 'القادم'}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-400">{weekLabel(activeWeek!.week_start_date)}</span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pt-5 space-y-3">
        {weekDays.map((day, idx) => {
          const dayNum = idx + 1
          const selected = selection[dayNum]
          const selShift = shifts.find(s => s.id === selected)
          return (
            <div key={dayNum} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{DAYS[dayNum]}</span>
                  <span className="text-slate-400 text-sm ml-2">{format(day, 'MMM d')}</span>
                </div>
                {selShift && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: selShift.color_code }} />
                    <span className="text-xs font-semibold text-slate-600">{selShift.name}</span>
                  </div>
                )}
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {shifts.map(s => {
                  const isSel = selected === s.id
                  const cap   = capacity(dayNum, s.id)
                  const locked = cap.full && !isSel   // can't pick a full shift unless already on it
                  return (
                    <button key={s.id}
                      disabled={locked}
                      onClick={() => !locked && setSelection(prev => ({ ...prev, [dayNum]: s.id }))}
                      className={`relative rounded-xl p-3 text-center text-sm font-semibold border-2 transition-all ${
                        isSel ? 'shadow-md scale-105'
                        : locked ? 'border-transparent bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                      style={isSel ? { background: s.color_code + '22', borderColor: s.color_code, color: s.color_code } : {}}>
                      <div>{s.name}</div>
                      {locked ? (
                        <div className="text-[10px] font-bold text-red-400 mt-0.5">🔒 ممتلئ {cap.count}/{cap.max}</div>
                      ) : cap.max != null ? (
                        <div className="text-[10px] opacity-60 font-normal mt-0.5">{cap.count}/{cap.max}</div>
                      ) : (!s.is_off && s.start_time) ? (
                        <div className="text-[10px] opacity-70 font-normal mt-0.5">
                          {s.start_time.slice(0,5)} – {s.end_time?.slice(0,5)}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button onClick={submit} disabled={submitting}
          className="btn btn-primary w-full py-3 text-base rounded-2xl mt-2">
          {submitting
            ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ…</>
            : <><CheckCircle2 className="w-5 h-5" /> حفظ جدولي</>}
        </button>
        <p className="text-xs text-slate-400 text-center pb-6">
          تقدر ترجع تعدّل في أي وقت قبل تأكيد الجدول.
        </p>
      </div>
    </div>
  )
}
