'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Loader2, Plus, CalendarRange } from 'lucide-react'

interface Balance {
  annual_entitlement: number; sick_entitlement: number
  annual_used: number; sick_used: number
  annual_remaining: number; sick_remaining: number
}
interface LeaveReq {
  id: string; type: string; start_date: string; end_date: string
  days: number; reason: string | null; status: string; created_at: string
}

const TYPE_AR: Record<string,string> = { annual: 'سنوية', sick: 'مرضية', unpaid: 'بدون أجر' }
const STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'مقبولة ✓',     cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'مرفوضة',       cls: 'bg-red-50 text-red-700' },
}

export default function MyLeavePage() {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [requests, setRequests] = useState<LeaveReq[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'annual', start_date: '', end_date: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/me/leave')
    const d = await res.json()
    if (d.error) { setLoading(false); return }
    setBalance(d.balance); setRequests(d.requests ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const res = await fetch('/api/me/leave', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const d = await res.json()
    if (d.error) { setError(d.error); setSaving(false); return }
    setForm({ type: 'annual', start_date: '', end_date: '', reason: '' })
    setShowForm(false); setSaving(false); load()
  }

  if (loading)
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  return (
    <div className="max-w-2xl mx-auto p-4 pt-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">إجازاتي</h1>
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" /> طلب إجازة</button>
      </div>

      {/* Balance cards */}
      {balance && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-400 mb-1">إجازة سنوية</div>
            <div className="text-3xl font-bold text-blue-600">{balance.annual_remaining}</div>
            <div className="text-xs text-slate-400 mt-1">متبقّي من {balance.annual_entitlement} · استخدمت {balance.annual_used}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-400 mb-1">إجازة مرضية</div>
            <div className="text-3xl font-bold text-emerald-600">{balance.sick_remaining}</div>
            <div className="text-xs text-slate-400 mt-1">متبقّي من {balance.sick_entitlement} · استخدمت {balance.sick_used}</div>
          </div>
        </div>
      )}

      {/* Request form */}
      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="label">نوع الإجازة</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="annual">سنوية</option>
              <option value="sick">مرضية</option>
              <option value="unpaid">بدون أجر</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">من</label>
              <input type="date" className="input" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div><label className="label">إلى</label>
              <input type="date" className="input" required value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          </div>
          <div><label className="label">السبب (اختياري)</label>
            <input className="input" placeholder="..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'جاري الإرسال…' : 'إرسال الطلب'}</button>
          </div>
        </form>
      )}

      {/* Requests list */}
      <h2 className="font-semibold text-slate-700 mb-2 flex items-center gap-2"><CalendarRange className="w-4 h-4 text-slate-400" /> طلباتي</h2>
      {requests.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-10 bg-white rounded-2xl border border-slate-200">مفيش طلبات إجازة بعد</div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-800">
                  {TYPE_AR[r.type]} · {r.days} يوم
                </div>
                <div className="text-xs text-slate-400">
                  {format(parseISO(r.start_date),'d MMM')} → {format(parseISO(r.end_date),'d MMM')}
                  {r.reason ? ` · ${r.reason}` : ''}
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
