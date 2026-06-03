'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Plus, Trash2, ArrowRightLeft, X } from 'lucide-react'
import type { Agent }          from '@/lib/types'

interface TeamLite { id: string; name: string }

export default function AgentsPage({ params }: { params: { teamId: string } }) {
  const supabase  = createClient()
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

  async function deleteAgent(id: string, agentName: string) {
    if (!confirm(`حذف الأجينت "${agentName}"؟ سيتم حذف كل جداوله نهائياً. لو عايز تنقله بدل الحذف استخدم زر النقل.`)) return
    await supabase.from('agents').delete().eq('id', id)
    fetchAgents()
  }

  async function doMove() {
    if (!moveAgent || !moveTarget) return
    setMoving(true)
    // Move agent to the new team. Old schedule entries stay tied to old team's weeks (historical).
    await supabase.from('agents').update({ team_id: moveTarget }).eq('id', moveAgent.id)
    setMoving(false)
    setMoveAgent(null)
    setMoveTarget('')
    fetchAgents()
  }

  return (
    <div className="p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        ← Team
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Agents</h1>

      {/* Add form */}
      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={addAgent} className="flex gap-3 flex-wrap">
            <input className="input flex-1 min-w-[160px]" placeholder="اسم الأجينت" required
              value={name} onChange={e => setName(e.target.value)} />
            <input className="input flex-1 min-w-[200px]" type="email" placeholder="إيميل الشركة (للدخول)"
              value={agentEmail} onChange={e => setAgentEmail(e.target.value)} />
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {saving ? 'جاري الإضافة…' : 'إضافة'}
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2">
            الأجينت هيسجّل بنفس الإيميل ده على التول، وبعدها توافق على دخوله من الجدول تحت.
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? <p className="text-slate-400 text-sm">Loading…</p> : (
        <div className="card">
          <div className="card-body p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-right p-4 text-slate-500 font-medium">الأجينت</th>
                  <th className="text-right p-4 text-slate-500 font-medium">الإيميل</th>
                  <th className="text-center p-4 text-slate-500 font-medium">الحالة</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs">
                          {a.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{a.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 text-xs">
                      {a.email || <span className="text-slate-300">— مفيش إيميل —</span>}
                    </td>
                    <td className="p-4 text-center">
                      {a.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">✓ مفعّل</span>
                      ) : a.auth_user_id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">⏳ بانتظار الموافقة</span>
                      ) : a.email ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">لم يسجّل بعد</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-400 px-2.5 py-1 rounded-full">بدون حساب</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {a.status !== 'approved' && a.auth_user_id && (
                        <button onClick={() => approveAgent(a.id)}
                          className="btn btn-success btn-sm ml-2">✓ موافقة</button>
                      )}
                      {a.status === 'approved' && (
                        <button onClick={() => revokeAgent(a.id)}
                          className="text-xs text-slate-400 hover:text-amber-600 underline ml-2">إلغاء التفعيل</button>
                      )}
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => { setMoveAgent(a); setMoveTarget('') }}
                          title="نقل لتيم آخر"
                          className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs font-medium">
                          <ArrowRightLeft className="w-4 h-4" /> نقل
                        </button>
                        <button onClick={() => deleteAgent(a.id, a.name)}
                          title="حذف"
                          className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">لا يوجد أجينتس بعد</td></tr>
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" /> نقل الأجينت
              </h3>
              <button onClick={() => setMoveAgent(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              نقل <strong className="text-slate-800">{moveAgent.name}</strong> لتيم آخر.
              تسجيله الجديد هيكون على التيم الجديد. الجداول القديمة تفضل محفوظة على التيم الحالي.
            </p>

            {otherTeams.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
                لا يوجد تيم آخر للنقل إليه. أنشئ تيم جديد أولاً.
              </div>
            ) : (
              <>
                <label className="label">اختر التيم الجديد</label>
                <select className="input mb-5" value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
                  <option value="">— اختر —</option>
                  {otherTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setMoveAgent(null)} className="btn btn-ghost">إلغاء</button>
                  <button onClick={doMove} disabled={!moveTarget || moving} className="btn btn-primary">
                    {moving ? 'جاري النقل…' : 'نقل الأجينت'}
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
