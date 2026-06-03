'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Plus, Users, ChevronRight, Calendar } from 'lucide-react'
import type { Team }           from '@/lib/types'

export default function DashboardPage() {
  const supabase = createClient()
  const [teams, setTeams]   = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [name, setName]           = useState('')
  const [managerEmails, setManagerEmails] = useState('')
  const [adminEmails, setAdminEmails]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [createError, setCreateError] = useState('')

  async function fetchTeams() {
    const { data } = await supabase
      .from('teams').select('*').order('created_at', { ascending: false })
    setTeams(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchTeams() }, [])

  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setCreateError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreateError('يرجى تسجيل الدخول أولاً'); setSaving(false); return }

    const { error } = await supabase.from('teams').insert({
      name:           name.trim(),
      manager_emails: managerEmails.split(',').map(s => s.trim()).filter(Boolean),
      admin_emails:   adminEmails.split(',').map(s => s.trim()).filter(Boolean),
      admin_id:       user.id,
    })

    if (error) { setCreateError(error.message); setSaving(false); return }
    setName(''); setManagerEmails(''); setAdminEmails('')
    setShowNew(false); setSaving(false)
    fetchTeams()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your call center teams and schedules</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" /> New Team
        </button>
      </div>

      {/* New team form */}
      {showNew && (
        <div className="card mb-6">
          <div className="card-body">
            <h2 className="font-semibold text-slate-800 mb-4">Create New Team</h2>
            <form onSubmit={createTeam} className="space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {createError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">اسم التيم *</label>
                  <input className="input" placeholder="مثال: Customer Support" required
                    value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="label">
                    إيميلات الأدمين المشاركين
                    <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
                  </label>
                  <input className="input" placeholder="admin2@co.com, admin3@co.com"
                    value={adminEmails} onChange={e => setAdminEmails(e.target.value)} />
                  <p className="text-xs text-slate-400 mt-1">مفصولة بفاصلة — يقدروا يديروا التيم بإيميلاتهم</p>
                </div>
                <div>
                  <label className="label">
                    إيميلات المانجرز
                    <span className="text-slate-400 font-normal mr-1">(اختياري)</span>
                  </label>
                  <input className="input" placeholder="manager@co.com, lead@co.com"
                    value={managerEmails} onChange={e => setManagerEmails(e.target.value)} />
                  <p className="text-xs text-slate-400 mt-1">هيستلموا الجدول النهائي على إيميلاتهم</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowNew(false); setCreateError('') }} className="btn btn-ghost">إلغاء</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'جاري الإنشاء…' : '+ إنشاء التيم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teams list */}
      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : teams.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No teams yet</p>
            <p className="text-slate-400 text-sm">Create your first team to get started</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map(team => (
            <Link key={team.id} href={`/dashboard/teams/${team.id}`}
              className="card hover:shadow-md transition-shadow group">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    {team.name[0]}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-900 mt-3">{team.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {team.manager_emails.length} manager{team.manager_emails.length !== 1 ? 's' : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
