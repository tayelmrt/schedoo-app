'use client'

import { useEffect, useState } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { CheckCircle2, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Shift, Week, ScheduleEntry } from '@/lib/types'
import { DAYS }                            from '@/lib/types'

type DaySelection = Record<number, string | null>
type WeekWithEntries = { week: Week; entries: ScheduleEntry[] }

export default function AgentSchedulePage({ params }: { params: { token: string } }) {
  const [agentName, setAgentName] = useState('')
  const [shifts, setShifts]       = useState<Shift[]>([])
  const [openWeeks, setOpenWeeks] = useState<WeekWithEntries[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  // Per-week selections map: weekId → DaySelection
  const [selections, setSelections] = useState<Record<string, DaySelection>>({})

  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittedWeekId, setSubmittedWeekId] = useState<string | null>(null)
  const [error, setError]         = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const res  = await fetch(`/api/schedule/${params.token}`)
      const data = await res.json()

      if (data.error) { setError(data.error); setLoading(false); return }

      setAgentName(data.agent?.name ?? '')
      setShifts(data.shifts ?? [])
      setOpenWeeks(data.openWeeks ?? [])

      // Pre-fill existing selections for each week
      const sel: Record<string, DaySelection> = {}
      ;(data.openWeeks ?? []).forEach(({ week, entries }: WeekWithEntries) => {
        const days: DaySelection = {}
        for (let d = 1; d <= 7; d++) days[d] = null
        entries.forEach((e: ScheduleEntry) => { days[e.day_of_week] = e.shift_id })
        sel[week.id] = days
      })
      setSelections(sel)
      setLoading(false)
    }
    load()
  }, [params.token])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const activeWeekData = openWeeks[activeIdx]
  const activeWeek     = activeWeekData?.week
  const activeSelection = activeWeek ? (selections[activeWeek.id] ?? {}) : {}

  function setDay(weekId: string, day: number, shiftId: string) {
    setSelections(prev => ({
      ...prev,
      [weekId]: { ...prev[weekId], [day]: shiftId },
    }))
  }

  function weekLabel(weekStart: string) {
    const monday = parseISO(weekStart)
    return `${format(monday, 'MMM d')} – ${format(addDays(monday, 6), 'MMM d')}`
  }

  function isCurrentWeek(weekStart: string) {
    const today  = new Date()
    const monday = parseISO(weekStart)
    const sunday = addDays(monday, 6)
    return today >= monday && today <= sunday
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submit() {
    if (!activeWeek) return
    setSubmitting(true)

    const res = await fetch(`/api/schedule/${params.token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ weekId: activeWeek.id, selection: activeSelection }),
    })
    const data = await res.json()

    if (data.error) { setError(data.error); setSubmitting(false); return }
    setSubmittedWeekId(activeWeek.id)
    setSubmitting(false)
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-700 mb-2">خطأ</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  if (openWeeks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">📅</div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">لا يوجد جدول مفتوح</h1>
          <p className="text-slate-500">لم يقم الأدمين بفتح أسبوع للتسجيل بعد.</p>
          <p className="text-slate-400 text-sm mt-1">تحقق لاحقاً أو تواصل مع مسؤولك.</p>
        </div>
      </div>
    )
  }

  // Success state for active week
  if (submittedWeekId === activeWeek?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="bg-white border-b border-slate-200 px-4 py-5 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-lg mb-2">S</div>
          <h1 className="text-xl font-bold text-slate-900">Schedoo</h1>
        </div>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">تم الحفظ! 🎉</h1>
            <p className="text-slate-500">تم حفظ جدولك لأسبوع <strong>{weekLabel(activeWeek!.week_start_date)}</strong></p>
            {openWeeks.length > 1 && (
              <button onClick={() => {
                setSubmittedWeekId(null)
                setActiveIdx(activeIdx === 0 ? 1 : 0)
              }} className="btn btn-ghost mt-4">
                تسجيل أسبوع آخر →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(parseISO(activeWeek!.week_start_date), i))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-5 shadow-sm">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-lg mb-2">S</div>
          <h1 className="text-xl font-bold text-slate-900">الجدول الأسبوعي</h1>
          <p className="text-slate-500 text-sm mt-1">
            مرحباً <span className="font-semibold text-slate-700">{agentName}</span> — اختر شيفتك لكل يوم
          </p>
        </div>

        {/* Week selector — only if multiple open weeks */}
        {openWeeks.length > 1 && (
          <div className="flex justify-center mt-4">
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {openWeeks.map(({ week }, idx) => (
                <button key={week.id} onClick={() => { setActiveIdx(idx); setSubmittedWeekId(null) }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeIdx === idx
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {isCurrentWeek(week.week_start_date) ? '📍 هذا الأسبوع' : '📅 الأسبوع القادم'}
                  <div className="text-[10px] font-normal opacity-70">{weekLabel(week.week_start_date)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Single week label */}
        {openWeeks.length === 1 && (
          <div className="text-center mt-3">
            <span className="text-xs text-slate-400 bg-slate-50 rounded-full inline-block px-3 py-1">
              {isCurrentWeek(activeWeek!.week_start_date) ? '📍 هذا الأسبوع — ' : '📅 الأسبوع القادم — '}
              {weekLabel(activeWeek!.week_start_date)}
            </span>
          </div>
        )}
      </div>

      {/* Days */}
      <div className="max-w-2xl mx-auto p-4 pt-6 space-y-3">
        {weekDays.map((day, idx) => {
          const dayNum   = idx + 1
          const selected = activeSelection[dayNum]
          const selShift = shifts.find(s => s.id === selected)

          return (
            <div key={dayNum} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Day header */}
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

              {/* Shift cards */}
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {shifts.map(s => {
                  const isSelected = selected === s.id
                  return (
                    <button key={s.id}
                      onClick={() => setDay(activeWeek!.id, dayNum, s.id)}
                      className={`rounded-xl p-3 text-center text-sm font-semibold border-2 transition-all ${
                        isSelected
                          ? 'shadow-md scale-105'
                          : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                      style={isSelected ? {
                        background:   s.color_code + '22',
                        borderColor:  s.color_code,
                        color:        s.color_code,
                      } : {}}>
                      <div>{s.name}</div>
                      {!s.is_off && s.start_time && (
                        <div className="text-[10px] opacity-70 font-normal mt-0.5">
                          {s.start_time.slice(0,5)} – {s.end_time?.slice(0,5)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Submit */}
        <button onClick={submit} disabled={submitting}
          className="btn btn-primary w-full py-3 text-base rounded-2xl mt-2">
          {submitting
            ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ…</>
            : <><CheckCircle2 className="w-5 h-5" /> حفظ جدولي</>
          }
        </button>
        <p className="text-xs text-slate-400 text-center pb-6">
          تقدر تعدّل اختياراتك في أي وقت قبل تأكيد الجدول.
        </p>
      </div>
    </div>
  )
}
