'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Plus, Trash2, Clock, Pencil, Check, X } from 'lucide-react'
import { formatTime }          from '@/lib/utils'
import type { Shift }          from '@/lib/types'
import { useApp }              from '@/lib/providers'

export default function ShiftsPage({ params }: { params: { teamId: string } }) {
  const supabase = createClient()
  const { t } = useApp()
  const [shifts, setShifts]   = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ name:'', start_time:'', end_time:'', color_code:'#3b82f6', is_off: false })
  const [saving, setSaving]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState({ name:'', start_time:'', end_time:'', color_code:'#3b82f6', is_off: false })
  const [savingEdit, setSavingEdit] = useState(false)

  async function fetchShifts() {
    const { data } = await supabase.from('shifts')
      .select('*').eq('team_id', params.teamId).order('sort_order')
    setShifts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchShifts() }, [])

  async function addShift(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('shifts').insert({
      team_id:    params.teamId,
      name:       form.name.trim(),
      start_time: form.is_off ? null : (form.start_time || null),
      end_time:   form.is_off ? null : (form.end_time   || null),
      color_code: form.color_code,
      is_off:     form.is_off,
      sort_order: shifts.length,
    })
    setForm({ name:'', start_time:'', end_time:'', color_code:'#3b82f6', is_off: false })
    setSaving(false)
    fetchShifts()
  }

  async function deleteShift(id: string) {
    if (!confirm(t('shifts.confirmDelete'))) return
    await supabase.from('shifts').delete().eq('id', id)
    fetchShifts()
  }

  function startEdit(s: Shift) {
    setEditingId(s.id)
    setEditForm({
      name:       s.name,
      start_time: (s.start_time ?? '').slice(0, 5),
      end_time:   (s.end_time   ?? '').slice(0, 5),
      color_code: s.color_code,
      is_off:     s.is_off,
    })
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) return
    setSavingEdit(true)
    await supabase.from('shifts').update({
      name:       editForm.name.trim(),
      start_time: editForm.is_off ? null : (editForm.start_time || null),
      end_time:   editForm.is_off ? null : (editForm.end_time   || null),
      color_code: editForm.color_code,
      is_off:     editForm.is_off,
    }).eq('id', id)
    setSavingEdit(false)
    setEditingId(null)
    fetchShifts()
  }

  return (
    <div className="p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        {t('common.backToTeam')}
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('shifts.title')}</h1>

      {/* Add shift form */}
      <div className="card mb-6">
        <div className="card-body">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('shifts.addType')}
          </h2>
          <form onSubmit={addShift}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">{t('shifts.name')} *</label>
                <input className="input" placeholder={t('shifts.namePlaceholder')} required
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('shifts.start')}</label>
                <input className="input" type="time" disabled={form.is_off}
                  value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('shifts.end')}</label>
                <input className="input" type="time" disabled={form.is_off}
                  value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('shifts.color')}</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-14 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5"
                    value={form.color_code} onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))} />
                  <input className="input flex-1" value={form.color_code}
                    onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" className="rounded"
                  checked={form.is_off} onChange={e => setForm(f => ({ ...f, is_off: e.target.checked }))} />
                {t('shifts.isOff')}
              </label>
              <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                {saving ? t('shifts.adding') : t('shifts.add')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Shifts list */}
      {loading ? <p className="text-slate-400 text-sm">{t('common.loading')}</p> : (
        <div className="card">
          <div className="card-body p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-start p-4 text-slate-500 font-medium">{t('shifts.colShift')}</th>
                  <th className="text-start p-4 text-slate-500 font-medium">{t('shifts.colHours')}</th>
                  <th className="text-start p-4 text-slate-500 font-medium">{t('shifts.colType')}</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => editingId === s.id ? (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-900/10">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input type="color" className="h-9 w-11 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5 flex-shrink-0"
                          value={editForm.color_code} onChange={e => setEditForm(f => ({ ...f, color_code: e.target.value }))} />
                        <input className="input py-1.5" placeholder={t('shifts.namePlaceholder')}
                          value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <input className="input py-1.5 w-28" type="time" disabled={editForm.is_off}
                          value={editForm.start_time} onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))} />
                        <span className="text-slate-400">–</span>
                        <input className="input py-1.5 w-28" type="time" disabled={editForm.is_off}
                          value={editForm.end_time} onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))} />
                      </div>
                    </td>
                    <td className="p-4">
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" className="rounded"
                          checked={editForm.is_off} onChange={e => setEditForm(f => ({ ...f, is_off: e.target.checked }))} />
                        {t('shifts.isOff')}
                      </label>
                    </td>
                    <td className="p-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => saveEdit(s.id)} disabled={savingEdit || !editForm.name.trim()}
                          className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors" title={t('shifts.save')}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title={t('shifts.cancel')}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: s.color_code }} />
                        <span className="font-medium text-slate-800 dark:text-slate-100">{s.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {s.is_off ? '—' : `${formatTime(s.start_time)} – ${formatTime(s.end_time)}`}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.is_off ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>
                        {s.is_off ? t('shifts.dayOff') : t('shifts.shift')}
                      </span>
                    </td>
                    <td className="p-4 text-end">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => startEdit(s)}
                          className="text-slate-300 hover:text-blue-600 transition-colors" title={t('shifts.edit')}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteShift(s.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors" title={t('shifts.deleteTitle')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">{t('shifts.none')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
