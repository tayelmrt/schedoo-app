import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/server'
import ExcelJS                       from 'exceljs'
import jsPDF                         from 'jspdf'
import autoTable                     from 'jspdf-autotable'
import { Resend }                    from 'resend'
import { format, addDays, parseISO } from 'date-fns'
import type { Agent, Shift, ScheduleEntry, Week } from '@/lib/types'
import { DAYS }                      from '@/lib/types'

const resend = new Resend(process.env.RESEND_API_KEY)

function hexToArgb(hex: string): string {
  return 'FF' + hex.replace('#', '').toUpperCase()
}

// POST /api/export/[weekId]
export async function POST(
  _req: NextRequest,
  { params }: { params: { weekId: string } }
) {
  const supabase = createServiceClient()

  // ── 1. Fetch all data ────────────────────────────────────────────────────
  const { data: week } = await supabase
    .from('weeks').select('*, teams(*)').eq('id', params.weekId).single()

  if (!week) return NextResponse.json({ error: 'Week not found' }, { status: 404 })

  const [
    { data: agents },
    { data: shifts },
    { data: entries },
  ] = await Promise.all([
    supabase.from('agents').select('*').eq('team_id', week.team_id).eq('is_active', true).order('created_at'),
    supabase.from('shifts').select('*').eq('team_id', week.team_id).order('sort_order'),
    supabase.from('schedule_entries').select('*, shift:shifts(*)').eq('week_id', week.id),
  ])

  const weekMonday = parseISO(week.week_start_date)
  const weekLabel  = `${format(weekMonday, 'MMM d')} – ${format(addDays(weekMonday, 6), 'MMM d, yyyy')}`
  const dayHeaders = Array.from({ length: 7 }, (_, i) => ({
    label: `${DAYS[i+1].slice(0,3)} ${format(addDays(weekMonday, i), 'd/M')}`,
    day:   i + 1,
  }))

  function getEntry(agentId: string, day: number) {
    return (entries ?? []).find(e => e.agent_id === agentId && e.day_of_week === day)
  }
  function getShift(shiftId: string | null) {
    return (shifts ?? []).find(s => s.id === shiftId)
  }

  // ── 2. Build Excel ──────────────────────────────────────────────────────
  const wb  = new ExcelJS.Workbook()
  const ws  = wb.addWorksheet(`Week ${format(weekMonday, 'w')}`)

  // Title row
  ws.mergeCells(1, 1, 1, 9)
  const titleCell = ws.getCell('A1')
  titleCell.value = `${week.teams?.name ?? 'Team'} — Schedule ${weekLabel}`
  titleCell.font  = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center' }
  ws.getRow(1).height = 28

  // Header row
  const headerRow = ws.getRow(2)
  headerRow.values = ['Agent', ...dayHeaders.map(d => d.label)]
  headerRow.font   = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.eachCell((cell, col) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws.getRow(2).height = 22

  // Set column widths
  ws.getColumn(1).width = 22
  for (let i = 2; i <= 8; i++) ws.getColumn(i).width = 14

  // Data rows
  ;(agents ?? []).forEach((agent, rowIdx) => {
    const row = ws.getRow(rowIdx + 3)
    row.getCell(1).value = agent.name
    row.getCell(1).font  = { bold: true }

    dayHeaders.forEach(({ day }, colIdx) => {
      const entry = getEntry(agent.id, day)
      const shift = getShift(entry?.shift_id ?? null)
      const cell  = row.getCell(colIdx + 2)
      cell.value  = shift?.name ?? '—'
      cell.alignment = { horizontal: 'center', vertical: 'middle' }

      if (shift) {
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: hexToArgb(shift.color_code) + '40' }, // transparent
        }
        cell.font = { color: { argb: hexToArgb(shift.color_code) }, bold: !!shift }
      }
    })
    row.height = 20
  })

  // Apply borders
  const lastRow = (agents ?? []).length + 2
  for (let r = 2; r <= lastRow; r++) {
    for (let c = 1; c <= 8; c++) {
      ws.getCell(r, c).border = {
        top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    }
  }

  const excelBuffer = await wb.xlsx.writeBuffer() as Buffer

  // ── 3. Build PDF ────────────────────────────────────────────────────────
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const team = week.teams?.name ?? 'Team'

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`${team} — Weekly Schedule`, 40, 40)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(weekLabel, 40, 58)

  const tableBody = (agents ?? []).map(agent =>
    [agent.name, ...dayHeaders.map(({ day }) => {
      const shift = getShift(getEntry(agent.id, day)?.shift_id ?? null)
      return shift?.name ?? '—'
    })]
  )

  autoTable(doc, {
    startY: 72,
    head:   [['Agent', ...dayHeaders.map(d => d.label)]],
    body:   tableBody,
    styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 } },
    didParseCell: ({ cell, row, column }) => {
      if (row.section !== 'body' || column.index === 0) return
      const dayIdx = column.index
      const agentIndex = row.index
      const agent = agents?.[agentIndex]
      if (!agent) return
      const entry = getEntry(agent.id, dayIdx)
      const shift = getShift(entry?.shift_id ?? null)
      if (shift) {
        const r = parseInt(shift.color_code.slice(1,3), 16)
        const g = parseInt(shift.color_code.slice(3,5), 16)
        const b = parseInt(shift.color_code.slice(5,7), 16)
        cell.styles.fillColor = [r + Math.floor((255-r)*0.85), g + Math.floor((255-g)*0.85), b + Math.floor((255-b)*0.85)]
        cell.styles.textColor = [r, g, b]
        cell.styles.fontStyle = 'bold'
      }
    },
  })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  // ── 4. Upload to Supabase Storage ────────────────────────────────────────
  const bucket     = process.env.STORAGE_BUCKET ?? 'schedules'
  const filePrefix = `${week.team_id}/${params.weekId}`
  const excelPath  = `${filePrefix}/schedule.xlsx`
  const pdfPath    = `${filePrefix}/schedule.pdf`

  await Promise.all([
    supabase.storage.from(bucket).upload(excelPath, excelBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    }),
    supabase.storage.from(bucket).upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    }),
  ])

  const { data: excelSigned } = await supabase.storage.from(bucket).createSignedUrl(excelPath, 60 * 60 * 24 * 7) // 7 days
  const { data: pdfSigned }   = await supabase.storage.from(bucket).createSignedUrl(pdfPath,   60 * 60 * 24 * 7)

  // ── 5. Save URLs to week ─────────────────────────────────────────────────
  await supabase.from('weeks').update({
    export_url_excel: excelSigned?.signedUrl ?? null,
    export_url_pdf:   pdfSigned?.signedUrl   ?? null,
  }).eq('id', params.weekId)

  // ── 6. Email managers ───────────────────────────────────────────────────
  const managerEmails: string[] = week.teams?.manager_emails ?? []
  if (managerEmails.length > 0 && process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from:    'Schedoo <noreply@yourdomain.com>',
      to:      managerEmails,
      subject: `📅 Schedule Ready: ${team} — ${weekLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#1e3a5f;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="margin:0;font-size:20px">Weekly Schedule Ready</h1>
            <p style="margin:8px 0 0;opacity:.75;font-size:14px">${team} · ${weekLabel}</p>
          </div>
          <div style="background:#fff;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p style="color:#475569">The schedule for this week has been exported and is ready for review.</p>
            <div style="margin:24px 0;display:flex;gap:12px">
              ${excelSigned?.signedUrl ? `
              <a href="${excelSigned.signedUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                ⬇ Download Excel
              </a>` : ''}
              ${pdfSigned?.signedUrl ? `
              <a href="${pdfSigned.signedUrl}" style="display:inline-block;background:#f1f5f9;color:#1e293b;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                ⬇ Download PDF
              </a>` : ''}
            </div>
            <p style="color:#94a3b8;font-size:12px">Links expire in 7 days.</p>
          </div>
        </div>
      `,
    })
  }

  return NextResponse.json({
    success: true,
    excel_url: excelSigned?.signedUrl,
    pdf_url:   pdfSigned?.signedUrl,
    emailed:   managerEmails.length > 0,
  })
}
