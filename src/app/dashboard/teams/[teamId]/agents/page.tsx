'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Plus, Copy, Trash2, Check, UserCheck } from 'lucide-react'
import type { Agent }          from '@/lib/types'

export default function AgentsPage({ params }: { params: { teamId: string } }) {
  const supabase  = createClient()
  const [agents, setAgents]   = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [copied, setCopied]   = useState<string | null>(null)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function fetchAgents() {
    const { data } = await supabase.from('agents')
      .select('*').eq('team_id', params.teamId).order('created_at')
    setAgents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAgents() }, [])

  async function addAgent(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('agents').insert({ team_id: params.teamId, name: name.trim() })
    setName('')
    setSaving(false)
    fetchAgents()
  }

  async function deleteAgent(id: string) {
    if (!confirm('Delete this agent? Their schedule data will also be removed.')) return
    await supabase.from('agents').delete().eq('id', id)
    fetchAgents()
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appUrl}/schedule/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        ← Team
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Agents</h1>

      {/* Add form */}
      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={addAgent} className="flex gap-3">
            <input className="input flex-1" placeholder="Agent name" required
              value={name} onChange={e => setName(e.target.value)} />
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {saving ? 'Adding…' : 'Add Agent'}
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      {loading ? <p className="text-slate-400 text-sm">Loading…</p> : (
        <div className="card">
          <div className="card-body p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-4 text-slate-500 font-medium">Agent</th>
                  <th className="text-left p-4 text-slate-500 font-medium">Share Link</th>
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
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-slate-400 bg-slate-50 rounded px-2 py-1 truncate max-w-xs">
                          {appUrl}/schedule/{a.share_token}
                        </code>
                        <button onClick={() => copyLink(a.share_token)}
                          className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0">
                          {copied === a.share_token
                            ? <Check className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => deleteAgent(a.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-slate-400">No agents yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
