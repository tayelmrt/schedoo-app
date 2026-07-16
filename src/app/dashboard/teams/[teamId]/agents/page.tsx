'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Plus, Trash2, ArrowRightLeft, X } from 'lucide-react'
import type { Agent }          from '@/lib/types'
import { useApp }              from '@/lib/providers'

interface TeamLite { id: string; name: string }

export default function AgentsPage({ params }: { params: { teamId: string } }) {
  const supabase  = createClient()
  const { t } = useApp()
  const [agents, setAgents]   = useState<Agent[]>([])
  const [otherTeams, setOtherTeams] = useState<TeamLite[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName]       = useState('')
  const [agentEmail, setAgentEmail] = useState('')
  const [saving, setSaving]   = useState(false)
  const [moveAgent, setMoveAgent] = useState<Agent | null>(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [moving, setMoving]   = useState(false)

  async function fetchAgents() {
    const { data } = await supabase.from('agents')
      .select('*').eq('team_id', params.teamId).order('created_at')
    setAgents(data ?? [])
    setLoading(false)
  }

  async function fetchOtherTeams() {
    const { data } = await supabase.from('teams')
      .select('id, name').neq('id', params.teamId).order('name')
    setOtherTeams(data ?? [])
  }

  useEffect(() => { fetchAgents(); fetchOtherTeams() }, [])

  async function addAgent(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('agents').insert({
      team_id: params.teamId,
      name: name.trim(),
      email: agentEmail.trim() ? agentEmail.trim().toLowerCase() : null,
      status: 'pending',
    })
    setName(''); setAgentEmail('')
    setSaving(false)
    fetchAgents()
  }

  async function approveAgent(id: string) {
    await supabase.from('agents').update({ status: 'approved' }).eq('id', id)
    fetchAgents()
  }
  async function revokeAgent(id: string) {
    await supabase.from('agents').update({ status: 'pending' }).eq('id', id)
    fetchAgents()
  }

  async function deleteAgent(id: string) {
    if (!confirm(t('agents.confirmDelete'))) return
    await supabase.from('agents').delete().eq('id', id)
    fetchAgents()
  }

  async function doMove() {
    if (!moveAgent || !moveTarget) return
    setMoving(true)
    await supabase.from('agents').update({ team_id: moveTarget }).eq('id', moveAgent.id)
    setMoving(false)
    setMoveAgent(null)
    setMoveTarget('')
    fetchAgents()
  }

  return (
    <div className="p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        {t('common.backToTeam')}
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{t('agents.title')}</h1>

      {/* Add form */}
      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={addAgent} className="flex gap-3 flex-wrap">
            <input className="input flex-1 min-w-[160px]" placeholder={t('agents.namePlaceholder')} required
              value={name} onChange={e => setName(e.target.value)} />
            <input className="input flex-1 min-w-[200px]" type="email" placeholder={t('agents.emailPlaceholder')}
              value={agentEmail} onChange={e => setAgentEmail(e.target.value)} />
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {saving ? t('agents.adding') : t('agents.add')}
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2">
            {t('agents.hint')}
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? <p className="text-slate-400 text-sm">{t('common.loading')}</p> : (
        <div className="card">
          <div className="card-body p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-start p-4 text-slate-500 font-medium">{t('agents.colAgent')}</th>
                  <th className="text-start p-4 text-slate-500 font-medium">{t('agents.colEmail')}</th>
                  <th className="text-center p-4 text-slate-500 font-medium">{t('agents.colStatus')}</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-semibold text-xs">
                          {a.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{a.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                      {a.email || <span className="text-slate-300 dark:text-slate-600">{t('agents.noEmail')}</span>}
                    </td>
                    <td className="p-4 text-center">
                      {a.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-1 rounded-full">{t('agents.active')}</span>
                      ) : a.auth_user_id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-full">{t('agents.pending')}</span>
                      ) : a.email ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-full">{t('agents.notSignedUp')}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 px-2.5 py-1 rounded-full">{t('agents.noAccount')}</span>
                      )}
                    </td>
                    <td className="p-4 text-end">
                      {a.status !== 'approved' && a.auth_user_id && (
                        <button onClick={() => approveAgent(a.id)}
                          className="btn btn-success btn-sm mx-2">{t('agents.approve')}</button>
                      )}
                      {a.status === 'approved' && (
                        <button onClick={() => revokeAgent(a.id)}
                          className="text-xs text-slate-400 hover:text-amber-600 underline mx-2">{t('agents.revoke')}</button>
                      )}
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => { setMoveAgent(a); setMoveTarget('') }}
                          title={t('agents.moveTo')}
                          className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs font-medium">
                          <ArrowRightLeft className="w-4 h-4" /> {t('agents.move')}
                        </button>
                        <button onClick={() => deleteAgent(a.id)}
                          title={t('common.cancel')}
                          className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">{t('agents.none')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Move agent modal */}
      {moveAgent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setMoveAgent(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" /> {t('agents.moveHeading')}
              </h3>
              <button onClick={() => setMoveAgent(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t('agents.moveDescPre')} <strong className="text-slate-800 dark:text-slate-100">{moveAgent.name}</strong> {t('agents.moveDescPost')}
            </p>

            {otherTeams.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300 text-sm rounded-lg px-4 py-3">
                {t('agents.noOtherTeams')}
              </div>
            ) : (
              <>
                <label className="label">{t('agents.chooseTeam')}</label>
                <select className="input mb-5" value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
                  <option value="">{t('agents.choose')}</option>
                  {otherTeams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setMoveAgent(null)} className="btn btn-ghost">{t('common.cancel')}</button>
                  <button onClick={doMove} disabled={!moveTarget || moving} className="btn btn-primary">
                    {moving ? t('agents.moving') : t('agents.moveBtn')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
