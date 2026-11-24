import { NextRequest, NextResponse } from 'next/server'
import { exportWeek }                 from '@/lib/exportWeek'

// POST /api/export/[weekId] — build Excel+PDF, upload, and email managers.
export async function POST(
  _req: NextRequest,
  { params }: { params: { weekId: string } }
) {
  const result = await exportWeek(params.weekId)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json(result)
}
