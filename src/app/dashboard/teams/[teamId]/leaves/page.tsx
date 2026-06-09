'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link             from 'next/link'
import { format, parseISO } from 'date-fns'
import { Check, X, Clock, Save } from 'lucide-react'

interface Agent { id: string; name: string; annual_entitlement: number; sick_entitlement: number }
interface LeaveReq {
  id: string; agent_id: string; type: string; start_date: string; end_date: string
  days: number; reason: string | null; status: string; created_at: string
}

const TYPE_AR: Record<string,string> = { annual: 'سنوية', sick: 'مرضية', unpaid: 'بدون أجر' }

export default function AdminLeavesPage({ params }: { params: { teamId: string } }) {
  const supabase = createClient()
  const [agents, setAgents]     = useState<Agent[]>([])
  const [requests, setRequests] = useState<LeaveReq[]>([])
  const [loading, setLoading]   = useState(true)
  const [edits, setEdits]       = useState<Record<string, { annual: number; sick: number }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: ag }, { data: req }] = await Promise.all([
      supabase.from('agents').select('id, name, annual_entitlement, sick_entitlement').eq('team_id', params.teamId).eq('is_active', true).order('name'),
      supabase.from('leave_requests').select('*').eq('team_id', params.teamId).order('created_at', { ascending: false }),
    ])
    setAgents(ag ?? [])
    setRequests(req ?? [])
    const e: Record<string, { annual: number; sick: number }> = {}
    ;(ag ?? []).forEach(a => e[a.id] = { annual: a.annual_entitlement ?? 21, sick: a.sick_entitlement ?? 6 })
    setEdits(e)
    setLoading(false)
  }, [params.teamId])

  useEffect(() => { load() }, [load])

  function usedFor(agentId: string, type: string) {
    return requests.filter(r => r.agent_id === agentId && r.type === type && r.status === 'approved').reduce((s, r) => s + r.days, 0)
  }

  async function saveEntitlement(agentId: string) {
    setSavingId(agentId)
    const e = edits[agentId]
    await supabase.from('agents').update({ annual_entitlement: e.annual, sick_entitlement: e.sick }).eq('id', agentId)
    setSavingId(null)
    load()
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    await supabase.from('leave_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const pending = requests.filter(r => r.status === 'pending')
  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? '—'

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading…</div>

  return (
    <div className="p-4 md:p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">← Team</Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">الإجازات والأرصدة</h1>
      <p className="text-slate-500 text-sm mb-6">حدّد رصيد كل موظف وراجع طلبات الإجازة</p>

      {/* Pending requests */}
      <div className="card mb-6">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> طلبات بانتظار المراجعة ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="text-slate-400 text-sm">مفيش طلبات معلّقة</p>
          ) : (
            <div className="space-y-2">
              {pending.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div>
                    <div className="font-semibold text-sm text-slate-800">{agentName(r.agent_id)} — {TYPE_AR[r.type]} · {r.days} يوم</div>
                    <div className="text-xs text-slate-500">{format(parseISO(r.start_date),'d MMM')} → {format(parseISO(r.end_date),'d MMM')}{r.reason ? ` · ${r.reason}` : ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => review(r.id, 'approved')} className="btn btn-success btn-sm"><Check className="w-4 h-4" /> قبول</button>
                    <button onClick={() => review(r.id, 'rejected')} className="btn btn-ghost btn-sm text-red-600 border-red-200"><X className="w-4 h-4" /> رفض</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Balances table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-right p-3 pr-5 font-medium text-slate-500">الموظف</th>
              <th className="p-3 font-medium text-center text-slate-500">رصيد سنوي</th>
              <th className="p-3 font-medium text-center text-slate-500">مستخدم / متبقّي</th>
              <th className="p-3 font-medium text-center text-slate-500">رصيد مرضي</th>
              <th className="p-3 font-medium text-center text-slate-500">مستخدم / متبقّي</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {agents.map(a => {
              const e = edits[a.id] ?? { annual: 21, sick: 6 }
              const au = usedFor(a.id, 'annual'), su = usedFor(a.id, 'sick')
              return (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="p-3 pr-5 font-medium text-slate-800">{a.name}</td>
                  <td className="p-3 text-center">
                    <input type="number" min={0} className="w-16 text-center input py-1.5"
                      value={e.annual} onChange={ev => setEdits(p => ({ ...p, [a.id]: { ...p[a.id], annual: parseInt(ev.target.value) || 0 } }))} />
                  </td>
                  <td className="p-3 text-center text-xs">
                    <span className="text-slate-500">{au}</span> / <span className="font-bold text-blue-600">{e.annual - au}</span>
                  </td>
                  <td className="p-3 text-center">
                    <input type="number" min={0} className="w-16 text-center input py-1.5"
                      value={e.sick} onChange={ev => setEdits(p => ({ ...p, [a.id]: { ...p[a.id], sick: parseInt(ev.target.value) || 0 } }))} />
                  </td>
                  <td className="p-3 text-center text-xs">
                    <span className="text-slate-500">{su}</span> / <span className="font-bold text-emerald-600">{e.sick - su}</span>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => saveEntitlement(a.id)} disabled={savingId === a.id} className="btn btn-ghost btn-sm">
                      <Save className="w-3.5 h-3.5" /> {savingId === a.id ? '…' : 'حفظ'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {agents.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا يوجد موظفين</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
