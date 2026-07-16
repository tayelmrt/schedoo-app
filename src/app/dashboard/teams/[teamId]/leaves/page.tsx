'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link             from 'next/link'
import { format, parseISO } from 'date-fns'
import { Check, X, Clock, Save } from 'lucide-react'
import { useApp }       from '@/lib/providers'

interface Agent { id: string; name: string; annual_entitlement: number; sick_entitlement: number }
interface LeaveReq {
  id: string; agent_id: string; type: string; start_date: string; end_date: string
  days: number; reason: string | null; status: string; created_at: string
}

export default function AdminLeavesPage({ params }: { params: { teamId: string } }) {
  const supabase = createClient()
  const { t } = useApp()
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

  if (loading) return <div className="p-8 text-slate-400 text-sm">{t('common.loading')}</div>

  return (
    <div className="p-4 md:p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">{t('common.backToTeam')}</Link>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t('team.leaves')}</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t('leaves.subtitle')}</p>

      {/* Pending requests */}
      <div className="card mb-6">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> {t('leaves.pending')} ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="text-slate-400 text-sm">{t('leaves.noPending')}</p>
          ) : (
            <div className="space-y-2">
              {pending.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-xl px-4 py-3 gap-3">
                  <div>
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{agentName(r.agent_id)} — {t(`leaveType.${r.type}`)} · {r.days} {t('leaves.days')}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{format(parseISO(r.start_date),'d MMM')} → {format(parseISO(r.end_date),'d MMM')}{r.reason ? ` · ${r.reason}` : ''}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => review(r.id, 'approved')} className="btn btn-success btn-sm"><Check className="w-4 h-4" /> {t('leaves.approve')}</button>
                    <button onClick={() => review(r.id, 'rejected')} className="btn btn-ghost btn-sm text-red-600 border-red-200"><X className="w-4 h-4" /> {t('leaves.reject')}</button>
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
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-start p-3 px-5 font-medium text-slate-500">{t('leaves.colEmployee')}</th>
              <th className="p-3 font-medium text-center text-slate-500">{t('leaves.annualBalance')}</th>
              <th className="p-3 font-medium text-center text-slate-500">{t('leaves.usedRemaining')}</th>
              <th className="p-3 font-medium text-center text-slate-500">{t('leaves.sickBalance')}</th>
              <th className="p-3 font-medium text-center text-slate-500">{t('leaves.usedRemaining')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {agents.map(a => {
              const e = edits[a.id] ?? { annual: 21, sick: 6 }
              const au = usedFor(a.id, 'annual'), su = usedFor(a.id, 'sick')
              return (
                <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="p-3 px-5 font-medium text-slate-800 dark:text-slate-100">{a.name}</td>
                  <td className="p-3 text-center">
                    <input type="number" min={0} className="w-16 text-center input py-1.5"
                      value={e.annual} onChange={ev => setEdits(p => ({ ...p, [a.id]: { ...p[a.id], annual: parseInt(ev.target.value) || 0 } }))} />
                  </td>
                  <td className="p-3 text-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{au}</span> / <span className="font-bold text-blue-600 dark:text-blue-400">{e.annual - au}</span>
                  </td>
                  <td className="p-3 text-center">
                    <input type="number" min={0} className="w-16 text-center input py-1.5"
                      value={e.sick} onChange={ev => setEdits(p => ({ ...p, [a.id]: { ...p[a.id], sick: parseInt(ev.target.value) || 0 } }))} />
                  </td>
                  <td className="p-3 text-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{su}</span> / <span className="font-bold text-emerald-600 dark:text-emerald-400">{e.sick - su}</span>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => saveEntitlement(a.id)} disabled={savingId === a.id} className="btn btn-ghost btn-sm">
                      <Save className="w-3.5 h-3.5" /> {savingId === a.id ? '…' : t('leaves.save')}
                    </button>
                  </td>
                </tr>
              )
            })}
            {agents.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('leaves.noEmployees')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
