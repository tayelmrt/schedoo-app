'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient }   from '@/lib/supabase/client'
import Link               from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  Plus, Trash2, Gift, CheckCircle2, Clock, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Holiday {
  id: string; team_id: string; date: string; name: string; created_at: string
}
interface Agent { id: string; name: string }
interface CompDay {
  id: string; agent_id: string; holiday_id: string
  holiday_date: string; holiday_name: string
  granted: boolean; granted_at: string | null
  used: boolean; used_date: string | null; notes: string | null
  agent?: Agent
}
interface HolidayWorker {
  agent_id: string; agent_name: string; shift_name: string; shift_color: string
  comp?: CompDay
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HolidaysPage({ params }: { params: { teamId: string } }) {
  const supabase = createClient()

  const [holidays, setHolidays]     = useState<Holiday[]>([])
  const [agents, setAgents]         = useState<Agent[]>([])
  const [compDays, setCompDays]     = useState<CompDay[]>([])
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [workers, setWorkers]       = useState<Record<string, HolidayWorker[]>>({})
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  // New holiday form
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [{ data: hols }, { data: ags }, { data: comp }] = await Promise.all([
      supabase.from('holidays').select('*').eq('team_id', params.teamId).order('date', { ascending: false }),
      supabase.from('agents').select('id,name').eq('team_id', params.teamId).eq('is_active', true),
      supabase.from('compensation_days').select('*').eq('team_id', params.teamId),
    ])
    setHolidays(hols ?? [])
    setAgents(ags ?? [])
    setCompDays(comp ?? [])
    setLoading(false)
  }, [params.teamId])

  useEffect(() => { load() }, [load])

  // ── Load workers for a holiday ──────────────────────────────────────────────
  async function loadWorkers(holiday: Holiday) {
    if (workers[holiday.id]) return // already loaded

    // Find all schedule_entries on this date that are NOT off
    // date → day_of_week + week_start_date
    const d     = parseISO(holiday.date)
    const day   = d.getDay() === 0 ? 7 : d.getDay() // 1=Mon…7=Sun
    const monday = new Date(d)
    monday.setDate(d.getDate() - (day - 1))
    const weekStr = format(monday, 'yyyy-MM-dd')

    // Get week for this team
    const { data: week } = await supabase.from('weeks')
      .select('id').eq('team_id', params.teamId).eq('week_start_date', weekStr).maybeSingle()

    if (!week) { setWorkers(prev => ({ ...prev, [holiday.id]: [] })); return }

    // Get entries for this day (non-null shift = worked)
    const { data: entries } = await supabase.from('schedule_entries')
      .select('agent_id, shift:shifts(name, color_code, is_off)')
      .eq('week_id', week.id)
      .eq('day_of_week', day)
      .not('shift_id', 'is', null)

    const worked: HolidayWorker[] = (entries ?? [])
      .filter((e: any) => e.shift && !e.shift.is_off)
      .map((e: any) => ({
        agent_id:    e.agent_id,
        agent_name:  agents.find(a => a.id === e.agent_id)?.name ?? 'Unknown',
        shift_name:  e.shift.name,
        shift_color: e.shift.color_code,
        comp:        compDays.find(c => c.agent_id === e.agent_id && c.holiday_id === holiday.id),
      }))

    setWorkers(prev => ({ ...prev, [holiday.id]: worked }))
  }

  // ── Toggle expand ───────────────────────────────────────────────────────────
  async function toggleExpand(holiday: Holiday) {
    if (expanded === holiday.id) { setExpanded(null); return }
    setExpanded(holiday.id)
    await loadWorkers(holiday)
  }

  // ── Add holiday ─────────────────────────────────────────────────────────────
  async function addHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate || !newName.trim()) return
    setSaving(true)
    await supabase.from('holidays').insert({
      team_id: params.teamId, date: newDate, name: newName.trim()
    })
    setNewDate(''); setNewName('')
    setSaving(false)
    load()
  }

  // ── Delete holiday ──────────────────────────────────────────────────────────
  async function deleteHoliday(id: string) {
    if (!confirm('حذف هذه الإجازة؟ سيتم حذف سجلات التعويض المرتبطة بها.')) return
    await supabase.from('holidays').delete().eq('id', id)
    load()
  }

  // ── Grant compensation to one agent ────────────────────────────────────────
  async function grantComp(holiday: Holiday, agentId: string, agentName: string) {
    await supabase.from('compensation_days').upsert({
      team_id:      params.teamId,
      agent_id:     agentId,
      holiday_id:   holiday.id,
      holiday_date: holiday.date,
      holiday_name: holiday.name,
      granted:      true,
      granted_at:   new Date().toISOString(),
      used:         false,
    }, { onConflict: 'agent_id,holiday_id' })

    await load()
    // Reload workers for this holiday
    setWorkers(prev => { const n = { ...prev }; delete n[holiday.id]; return n })
    await loadWorkers(holiday)
  }

  // ── Grant to ALL workers ────────────────────────────────────────────────────
  async function grantAll(holiday: Holiday) {
    const list = workers[holiday.id] ?? []
    if (list.length === 0) return
    await Promise.all(list.map(w => grantComp(holiday, w.agent_id, w.agent_name)))
  }

  // ── Mark comp day as used ───────────────────────────────────────────────────
  async function markUsed(compId: string, usedDate: string) {
    await supabase.from('compensation_days').update({
      used: true, used_date: usedDate
    }).eq('id', compId)
    load()
    // Refresh workers
    setWorkers({})
  }

  // ── Mark comp day as NOT used (undo) ────────────────────────────────────────
  async function markUnused(compId: string) {
    await supabase.from('compensation_days').update({
      used: false, used_date: null
    }).eq('id', compId)
    load()
    setWorkers({})
  }

  // ── Summary stats ───────────────────────────────────────────────────────────
  const totalGranted  = compDays.filter(c => c.granted).length
  const totalUsed     = compDays.filter(c => c.used).length
  const totalPending  = compDays.filter(c => c.granted && !c.used).length

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <Link href={`/dashboard/teams/${params.teamId}`}
        className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        ← Team
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">الإجازات الرسمية والتعويضات</h1>
      <p className="text-slate-500 text-sm mb-6">تتبّع من اشتغل في الإجازات الرسمية ومن أخذ تعويضه</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Gift className="w-5 h-5" />
          </div>
          <div><p className="text-xs text-slate-400">تعويضات ممنوحة</p><h3 className="text-2xl font-bold">{totalGranted}</h3></div>
        </div>
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
          <div><p className="text-xs text-slate-400">في الانتظار</p><h3 className="text-2xl font-bold">{totalPending}</h3></div>
        </div>
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div><p className="text-xs text-slate-400">تعويضات مستخدمة</p><h3 className="text-2xl font-bold">{totalUsed}</h3></div>
        </div>
      </div>

      {/* Add holiday form */}
      <div className="card mb-6">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-500" /> إضافة إجازة رسمية
          </h2>
          <form onSubmit={addHoliday} className="flex gap-3 flex-wrap">
            <div className="fg flex-1 min-w-[160px]">
              <label className="label">التاريخ *</label>
              <input type="date" className="input" required
                value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="fg flex-1 min-w-[200px]">
              <label className="label">اسم الإجازة *</label>
              <input className="input" placeholder="مثال: عيد الأضحى" required
                value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'جاري الإضافة…' : '+ إضافة'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Holidays list */}
      {holidays.length === 0 ? (
        <div className="card card-body text-center py-16 text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p>لا توجد إجازات رسمية مضافة بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {holidays.map(holiday => {
            const isOpen      = expanded === holiday.id
            const dayWorkers  = workers[holiday.id]
            const holidayComp = compDays.filter(c => c.holiday_id === holiday.id)
            const grantedCount = holidayComp.filter(c => c.granted).length
            const usedCount    = holidayComp.filter(c => c.used).length

            return (
              <div key={holiday.id} className="card overflow-hidden">
                {/* Holiday header */}
                <div
                  className="card-body flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(holiday)}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex flex-col items-center justify-center text-red-600">
                      <div className="text-xs font-bold leading-none">
                        {format(parseISO(holiday.date), 'MMM').toUpperCase()}
                      </div>
                      <div className="text-lg font-black leading-tight">
                        {format(parseISO(holiday.date), 'd')}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{holiday.name}</div>
                      <div className="text-xs text-slate-400">
                        {format(parseISO(holiday.date), 'EEEE, d MMMM yyyy')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Quick stats */}
                    {grantedCount > 0 && (
                      <div className="flex gap-2 text-xs">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-semibold">
                          {grantedCount} تعويض
                        </span>
                        {usedCount > 0 && (
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                            {usedCount} استخدم
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteHoliday(holiday.id) }}
                      className="text-slate-300 hover:text-red-400 transition-colors mr-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen
                      ? <ChevronUp className="w-5 h-5 text-slate-400" />
                      : <ChevronDown className="w-5 h-5 text-slate-400" />
                    }
                  </div>
                </div>

                {/* Expanded: workers */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-6 pb-5 pt-4">
                    {!dayWorkers ? (
                      <p className="text-slate-400 text-sm text-center py-4">جاري البحث…</p>
                    ) : dayWorkers.length === 0 ? (
                      <p className="text-slate-400 text-sm text-center py-4">
                        لا يوجد أجينتس مسجّلين بشيفت في هذا اليوم
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-700">
                            اشتغلوا في هذا اليوم ({dayWorkers.length})
                          </h3>
                          <button onClick={() => grantAll(holiday)}
                            className="btn btn-primary btn-sm">
                            <Gift className="w-3.5 h-3.5" />
                            منح تعويض للكل
                          </button>
                        </div>

                        <div className="space-y-2">
                          {dayWorkers.map(w => {
                            const comp = compDays.find(
                              c => c.agent_id === w.agent_id && c.holiday_id === holiday.id
                            )
                            return (
                              <WorkerRow
                                key={w.agent_id}
                                worker={w}
                                comp={comp}
                                onGrant={() => grantComp(holiday, w.agent_id, w.agent_name)}
                                onMarkUsed={(date) => comp && markUsed(comp.id, date)}
                                onMarkUnused={() => comp && markUnused(comp.id)}
                              />
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pending compensation summary */}
      {totalPending > 0 && (
        <div className="mt-8 card">
          <div className="card-body">
            <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              تعويضات لم تُستخدم بعد ({totalPending})
            </h2>
            <div className="space-y-2">
              {compDays.filter(c => c.granted && !c.used).map(c => {
                const agent = agents.find(a => a.id === c.agent_id)
                return (
                  <div key={c.id}
                    className="flex items-center justify-between py-2.5 px-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div>
                      <span className="font-semibold text-slate-800 text-sm">{agent?.name ?? '—'}</span>
                      <span className="text-slate-400 text-xs mx-2">←</span>
                      <span className="text-xs text-amber-700 font-medium">{c.holiday_name}</span>
                      <span className="text-xs text-slate-400 mx-1">
                        ({format(parseISO(c.holiday_date), 'd MMM')})
                      </span>
                    </div>
                    <UsedDatePicker compId={c.id} onSave={(date) => markUsed(c.id, date)} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Worker row component ─────────────────────────────────────────────────────
function WorkerRow({
  worker, comp, onGrant, onMarkUsed, onMarkUnused
}: {
  worker: HolidayWorker
  comp?: CompDay
  onGrant: () => void
  onMarkUsed: (date: string) => void
  onMarkUnused: () => void
}) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [usedDate, setUsedDate]             = useState('')

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
          {worker.agent_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-slate-800 text-sm">{worker.agent_name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-2 h-2 rounded-full" style={{ background: worker.shift_color }} />
            <span className="text-xs text-slate-400">{worker.shift_name}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!comp?.granted ? (
          // Not granted yet
          <button onClick={onGrant}
            className="btn btn-ghost btn-sm text-blue-600 border-blue-200 hover:bg-blue-50">
            <Gift className="w-3.5 h-3.5" /> منح تعويض
          </button>
        ) : comp.used ? (
          // Used ✓
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              استخدم {comp.used_date ? format(parseISO(comp.used_date), 'd MMM') : ''}
            </span>
            <button onClick={onMarkUnused}
              className="text-xs text-slate-400 hover:text-red-400 underline transition-colors">
              تراجع
            </button>
          </div>
        ) : (
          // Granted but not used yet
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" /> تعويض ممنوح
            </span>
            {!showDatePicker ? (
              <button onClick={() => setShowDatePicker(true)}
                className="btn btn-success btn-sm">
                ✓ سجّل استخدام
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input type="date" className="input py-1 text-xs w-32"
                  value={usedDate} onChange={e => setUsedDate(e.target.value)} />
                <button
                  onClick={() => { if (usedDate) { onMarkUsed(usedDate); setShowDatePicker(false) } }}
                  className="btn btn-success btn-sm">✓</button>
                <button onClick={() => setShowDatePicker(false)}
                  className="btn btn-ghost btn-sm text-xs">✕</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Used Date Picker (for pending summary) ───────────────────────────────────
function UsedDatePicker({ compId, onSave }: { compId: string; onSave: (date: string) => void }) {
  const [show, setShow]     = useState(false)
  const [date, setDate]     = useState('')

  return show ? (
    <div className="flex items-center gap-1">
      <input type="date" className="input py-1 text-xs w-32"
        value={date} onChange={e => setDate(e.target.value)} />
      <button onClick={() => { if (date) { onSave(date); setShow(false) } }}
        className="btn btn-success btn-sm">✓</button>
      <button onClick={() => setShow(false)} className="btn btn-ghost btn-sm text-xs">✕</button>
    </div>
  ) : (
    <button onClick={() => setShow(true)} className="btn btn-success btn-sm">
      <CheckCircle2 className="w-3.5 h-3.5" /> سجّل استخدام
    </button>
  )
}
