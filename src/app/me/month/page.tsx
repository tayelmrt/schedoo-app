'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import Link                    from 'next/link'
import {
  format, addDays, parseISO, startOfMonth, endOfMonth,
  isWithinInterval, eachDayOfInterval,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Loader2, ArrowRight, Gift, Briefcase, Umbrella,
} from 'lucide-react'
import { hexToAlpha } from '@/lib/utils'
import type { Shift } from '@/lib/types'

interface Week { id: string; week_start_date: string }
interface Entry { week_id: string; day_of_week: number; shift_id: string | null }
interface Holiday { id: string; date: string; name: string }
interface Comp { id: string; holiday_name: string; holiday_date: string; granted: boolean; used: boolean; used_date: string | null }

export default function AgentMonth() {
  const router = useRouter()
  const [month, setMonth]   = useState(startOfMonth(new Date()))
  const [name, setName]     = useState('')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [weeks, setWeeks]   = useState<Week[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [comps, setComps]   = useState<Comp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/me/month')
      if (res.status === 401) { router.replace('/auth/login'); return }
      if (res.status === 403) { router.replace('/me'); return }
      const d = await res.json()
      setName(d.agent?.name ?? ''); setShifts(d.shifts ?? []); setWeeks(d.weeks ?? [])
      setEntries(d.entries ?? []); setHolidays(d.holidays ?? []); setComps(d.comps ?? [])
      setLoading(false)
    })()
  }, [])

  const monthStart = startOfMonth(month)
  const monthEnd   = endOfMonth(month)
  const weekById   = (id: string) => weeks.find(w => w.id === id)
  const shiftById  = (id: string | null) => shifts.find(s => s.id === id)

  function entryDate(e: Entry): Date | null {
    const w = weekById(e.week_id); if (!w) return null
    return addDays(parseISO(w.week_start_date), e.day_of_week - 1)
  }
  const monthEntries = entries.filter(e => {
    const d = entryDate(e); return d && isWithinInterval(d, { start: monthStart, end: monthEnd })
  })
  const holidayDates = new Set(holidays
    .filter(h => isWithinInterval(parseISO(h.date), { start: monthStart, end: monthEnd }))
    .map(h => h.date))

  function shiftOnDate(d: Date): Shift | undefined {
    const ds = format(d, 'yyyy-MM-dd')
    const e = monthEntries.find(en => { const ed = entryDate(en); return ed && format(ed, 'yyyy-MM-dd') === ds })
    return e ? shiftById(e.shift_id) : undefined
  }

  // Stats
  let work = 0, off = 0, holidayWorked = 0
  monthEntries.forEach(e => {
    const s = shiftById(e.shift_id); if (!s) return
    if (s.is_off) off++
    else { work++; const d = entryDate(e); if (d && holidayDates.has(format(d,'yyyy-MM-dd'))) holidayWorked++ }
  })

  if (loading)
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadBlanks = parseISO(format(monthStart,'yyyy-MM-dd')).getDay() // Sunday-first

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/me" className="text-sm text-blue-600 flex items-center gap-1"><ArrowRight className="w-4 h-4" /> رجوع</Link>
          <div className="font-bold text-slate-800 text-sm">جدولي الشهري — {name}</div>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Month nav */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button onClick={() => setMonth(m => startOfMonth(addDays(m,-1)))} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-bold text-slate-700 min-w-[130px] text-center">{format(month,'MMMM yyyy')}</span>
          <button onClick={() => setMonth(m => startOfMonth(addDays(endOfMonth(m),1)))} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <Briefcase className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <div className="text-xl font-bold">{work}</div><div className="text-[10px] text-slate-400">شيفتات شغل</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <Umbrella className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-xl font-bold">{off}</div><div className="text-[10px] text-slate-400">أيام OFF</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <Gift className="w-4 h-4 text-red-500 mx-auto mb-1" />
            <div className="text-xl font-bold">{holidayWorked}</div><div className="text-[10px] text-slate-400">إجازات اشتغلتها</div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4">
          <div className="grid grid-cols-7 gap-1.5">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d =>
              <div key={d} className="text-center text-[10px] font-bold text-slate-400">{d}</div>)}
            {Array.from({ length: leadBlanks }).map((_, i) => <div key={'b'+i} />)}
            {days.map(d => {
              const sh = shiftOnDate(d); const ds = format(d,'yyyy-MM-dd'); const hol = holidayDates.has(ds)
              return (
                <div key={ds} className={`rounded-lg p-1.5 text-center border ${hol ? 'border-red-300' : 'border-slate-100'}`}
                  style={sh ? { background: hexToAlpha(sh.color_code, 0.18) } : { background:'#fff' }}>
                  <div className="text-[10px] text-slate-400">{format(d,'d')}{hol && ' 🎌'}</div>
                  <div className="text-[10px] font-semibold leading-tight mt-0.5" style={sh ? { color: sh.color_code } : { color:'#cbd5e1' }}>
                    {sh ? sh.name : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Compensation */}
        {comps.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5"><Gift className="w-4 h-4 text-blue-500" /> أيام التعويض بتاعتي</div>
            <div className="space-y-2">
              {comps.map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-slate-600">{c.holiday_name} <span className="text-slate-400">({format(parseISO(c.holiday_date),'d MMM')})</span></span>
                  {c.used ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ اتعوّض يوم {c.used_date ? format(parseISO(c.used_date),'d MMM') : ''}</span>
                    : c.granted ? <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">⏳ تعويض لسه</span>
                    : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">قيد المراجعة</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
