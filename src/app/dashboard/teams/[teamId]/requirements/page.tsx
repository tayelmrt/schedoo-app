'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase/client'
import Link                    from 'next/link'
import { Save }                from 'lucide-react'
import type { Shift }          from '@/lib/types'
import { DAYS }                from '@/lib/types'

type MatrixCell = { min: number; max: number | null; reqId?: string }
// matrix[shiftId][day] = MatrixCell
type Matrix = Record<string, Record<number, MatrixCell>>

export default function RequirementsPage({ params }: { params: { teamId: string } }) {
  const supabase  = createClient()
  const [shifts, setShifts]   = useState<Shift[]>([])
  const [matrix, setMatrix]   = useState<Matrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: sh }, { data: req }] = await Promise.all([
        supabase.from('shifts').select('*').eq('team_id', params.teamId).order('sort_order'),
        supabase.from('requirements').select('*').eq('team_id', params.teamId),
      ])
      const shiftsData = sh ?? []
      setShifts(shiftsData)

      const m: Matrix = {}
      shiftsData.forEach(s => {
        m[s.id] = {}
        for (let d = 1; d <= 7; d++) {
          const existing = (req ?? []).find(r => r.shift_id === s.id && r.day_of_week === d)
          m[s.id][d] = {
            min: existing?.min_agents_required ?? 0,
            max: existing?.max_agents ?? null,
            reqId: existing?.id,
          }
        }
      })
      setMatrix(m)
      setLoading(false)
    }
    load()
  }, [])

  function updateMin(shiftId: string, day: number, min: number) {
    setMatrix(prev => ({
      ...prev,
      [shiftId]: { ...prev[shiftId], [day]: { ...prev[shiftId][day], min } }
    }))
    setSaved(false)
  }
  function updateMax(shiftId: string, day: number, raw: string) {
    const max = raw === '' ? null : (parseInt(raw) || 0)
    setMatrix(prev => ({
      ...prev,
      [shiftId]: { ...prev[shiftId], [day]: { ...prev[shiftId][day], max } }
    }))
    setSaved(false)
  }

  async function saveAll() {
    setSaving(true)
    const upserts: object[] = []
    shifts.forEach(s => {
      for (let d = 1; d <= 7; d++) {
        const cell = matrix[s.id]?.[d]
        if (cell === undefined) continue
        upserts.push({
          team_id: params.teamId,
          shift_id: s.id,
          day_of_week: d,
          min_agents_required: cell.min,
          max_agents: cell.max,
          ...(cell.reqId ? { id: cell.reqId } : {}),
        })
      }
    })
    await supabase.from('requirements').upsert(upserts, { onConflict: 'team_id,day_of_week,shift_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <Link href={`/dashboard/teams/${params.teamId}`} className="text-sm text-slate-400 hover:text-blue-600 mb-2 inline-block">
        ← Team
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requirements Matrix</h1>
          <p className="text-slate-500 text-sm mt-1">
            الحد الأدنى (Min) والحد الأقصى (Max) لكل شيفت في كل يوم — اترك Max فاضي لو بدون حد
          </p>
        </div>
        <button onClick={saveAll} disabled={saving} className="btn btn-primary">
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save All'}
        </button>
      </div>

      {shifts.length === 0 ? (
        <div className="card card-body text-center text-slate-400 py-12">
          No shifts defined yet. <Link href={`/dashboard/teams/${params.teamId}/shifts`} className="text-blue-600 underline">Add shifts first</Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left p-4 text-slate-500 font-medium w-40">Shift</th>
                {Object.entries(DAYS).map(([d, name]) => (
                  <th key={d} className="p-3 text-slate-500 font-medium text-center">
                    {name.slice(0,3)}
                    <div className="text-[10px] text-slate-300 font-normal">Min / Max</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: s.color_code }} />
                      <span className="font-medium text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  {[1,2,3,4,5,6,7].map(d => (
                    <td key={d} className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min={0} max={99}
                          title="الحد الأدنى"
                          className="w-12 text-center input py-1.5"
                          value={matrix[s.id]?.[d]?.min ?? 0}
                          onChange={e => updateMin(s.id, d, parseInt(e.target.value) || 0)}
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="number" min={0} max={99}
                          title="الحد الأقصى (فاضي = بدون حد)"
                          placeholder="∞"
                          className="w-12 text-center input py-1.5"
                          value={matrix[s.id]?.[d]?.max ?? ''}
                          onChange={e => updateMax(s.id, d, e.target.value)}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
