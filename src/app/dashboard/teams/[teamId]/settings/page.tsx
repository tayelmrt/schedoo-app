'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Save, Plus, X, Users, Mail, ShieldCheck } from 'lucide-react'
import { useApp }              from '@/lib/providers'

export default function TeamSettingsPage({ params }: { params: { teamId: string } }) {
  const supabase = createClient()
  const { t } = useApp()

  const [team, setTeam]           = useState<any>(null)
  const [teamName, setTeamName]   = useState('')
  const [adminEmails, setAdminEmails] = useState<string[]>([])
  const [managerEmails, setManagerEmails] = useState<string[]>([])
  const [newAdmin, setNewAdmin]   = useState('')
  const [newManager, setNewManager] = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('teams').select('*').eq('id', params.teamId).single()
      if (data) {
        setTeam(data)
        setTeamName(data.name)
        setAdminEmails(data.admin_emails ?? [])
        setManagerEmails(data.manager_emails ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    await supabase.from('teams').update({
      name:           teamName.trim(),
      admin_emails:   adminEmails,
      manager_emails: managerEmails,
    }).eq('id', params.teamId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function addEmail(list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) {
    const email = value.trim().toLowerCase()
    if (!email || !email.includes('@') || list.includes(email)) return
    setList([...list, email])
    setValue('')
  }

  function removeEmail(list: string[], setList: (v: string[]) => void, email: string) {
    setList(list.filter(e => e !== email))
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">{t('common.loading')}</div>

  return (
    <div className="p-8 max-w-2xl">
      <Link href={`/dashboard/teams/${params.teamId}`}
        className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        {t('common.backToTeam')}
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('set.title')}</h1>

      {/* Team name */}
      <div className="card mb-5">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> {t('set.teamName')}
          </h2>
          <input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} />
        </div>
      </div>

      {/* Co-Admins */}
      <div className="card mb-5">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" /> {t('set.coAdmins')}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {t('set.coAdminsHint')}
          </p>

          {/* Existing */}
          <div className="flex flex-wrap gap-2 mb-3">
            {adminEmails.map(email => (
              <span key={email}
                className="flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full">
                {email}
                <button onClick={() => removeEmail(adminEmails, setAdminEmails, email)}
                  className="text-blue-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {adminEmails.length === 0 && (
              <span className="text-xs text-slate-400">{t('set.noCoAdmins')}</span>
            )}
          </div>

          {/* Add */}
          <div className="flex gap-2">
            <input className="input flex-1" type="email" placeholder="admin@company.com"
              value={newAdmin} onChange={e => setNewAdmin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail(adminEmails, setAdminEmails, newAdmin, setNewAdmin)} />
            <button onClick={() => addEmail(adminEmails, setAdminEmails, newAdmin, setNewAdmin)}
              className="btn btn-ghost btn-sm">
              <Plus className="w-4 h-4" /> {t('common.add')}
            </button>
          </div>
        </div>
      </div>

      {/* Managers */}
      <div className="card mb-6">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-500" /> {t('set.managerEmails')}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {t('set.managerHint')}
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            {managerEmails.map(email => (
              <span key={email}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-full">
                {email}
                <button onClick={() => removeEmail(managerEmails, setManagerEmails, email)}
                  className="text-emerald-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {managerEmails.length === 0 && (
              <span className="text-xs text-slate-400">{t('set.noManagers')}</span>
            )}
          </div>

          <div className="flex gap-2">
            <input className="input flex-1" type="email" placeholder="manager@company.com"
              value={newManager} onChange={e => setNewManager(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail(managerEmails, setManagerEmails, newManager, setNewManager)} />
            <button onClick={() => addEmail(managerEmails, setManagerEmails, newManager, setNewManager)}
              className="btn btn-ghost btn-sm">
              <Plus className="w-4 h-4" /> {t('common.add')}
            </button>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-primary w-full">
        <Save className="w-4 h-4" />
        {saving ? t('req.saving') : saved ? t('common.saved') : t('set.saveChanges')}
      </button>
    </div>
  )
}
