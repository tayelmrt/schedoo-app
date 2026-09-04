// Parse a schedule grid copied from Google Sheets / Excel (tab-separated) into
// dated columns + employee rows, so a manager's final sheet can be pushed into
// Schedoo in one paste. Pure functions — no network, easy to reason about.
import { parse, isValid } from 'date-fns'

export interface ParsedRow { name: string; cells: string[] }
export interface ParsedSheet {
  headerFound: boolean
  colDates: (Date | null)[] // index-aligned to each row's cells; col 0 (names) is null
  rows: ParsedRow[]
}

const WEEKDAYS = new Set([
  'sun','mon','tue','wed','thu','fri','sat',
  'sunday','monday','tuesday','wednesday','thursday','friday','saturday',
])

// Words that mean "not a working shift" (off / leave of any kind), EN + AR.
const OFF_WORDS = [
  'off','annual','vacation','sick','casual','maternity','maternity','leave',
  'holiday','rest','absent','unpaid','day off','no show','noshow',
  'عطلة','عطله','اجازة','أجازة','اجازه','راحة','راحه','غياب','مرضي','مرضى','سنوية','سنويه','عارضة',
]

/** Classify one cell's text into an empty / work / off shift descriptor. */
export function classifyCell(raw: string): {
  kind: 'empty' | 'work' | 'off'
  name: string
  start_time: string | null
  is_off: boolean
} {
  const v = (raw ?? '').trim()
  if (!v || v === '—' || v === '-' || v === '–' || v === '_')
    return { kind: 'empty', name: '', start_time: null, is_off: false }

  const low = v.toLowerCase()
  if (OFF_WORDS.some(w => low.includes(w)))
    return { kind: 'off', name: v, start_time: null, is_off: true }

  const start = parseTime(v)
  if (start) return { kind: 'work', name: v, start_time: start, is_off: false }

  // Unknown label (e.g. "Training") — keep as a named working shift, no clock time.
  return { kind: 'work', name: v, start_time: null, is_off: false }
}

/** Extract a 24h "HH:MM" start time from a cell like "9:00 am", "12:00 am", "4 pm", "16:30". */
function parseTime(v: string): string | null {
  const s = v.toLowerCase().trim()
  let m = s.match(/(\d{1,2}):(\d{2})\s*(am|pm)/)          // 9:00 am
  if (m) return to24(+m[1], +m[2], m[3])
  m = s.match(/(\d{1,2})\s*(am|pm)/)                      // 9 am
  if (m) return to24(+m[1], 0, m[2])
  m = s.match(/^(\d{1,2}):(\d{2})$/)                      // 16:30 (24h)
  if (m) { const h = +m[1], mm = +m[2]; if (h < 24 && mm < 60) return pad(h) + ':' + pad(mm) }
  return null
}
function to24(h: number, m: number, ap: string): string {
  if (ap === 'am') { if (h === 12) h = 0 }
  else { if (h !== 12) h += 12 }
  return pad(h) + ':' + pad(m)
}
const pad = (n: number) => String(n).padStart(2, '0')

/** Parse a header like "21-Aug", "1-Sep", "2025-08-21", "8/21/2025" into a Date. */
export function parseHeaderDate(raw: string, now: Date = new Date()): Date | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  const fmts = ['d-MMM-yyyy', 'd-MMM-yy', 'd-MMM', 'yyyy-MM-dd', 'M/d/yyyy', 'd/M/yyyy', 'MMM d', 'MMMM d']
  for (const f of fmts) {
    const d = parse(v, f, now)
    if (isValid(d)) return f.includes('y') ? d : nearestYear(d, now)
  }
  return null
}

/** Pick the year (this / prev / next) that puts the date closest to `now`. */
function nearestYear(d: Date, now: Date): Date {
  const cands = [-1, 0, 1].map(dy => {
    const c = new Date(d); c.setFullYear(d.getFullYear() + dy); return c
  })
  cands.sort((a, b) => Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime()))
  return cands[0]
}

function isWeekdayRow(cells: string[]): boolean {
  const named = cells.slice(1).filter(c => WEEKDAYS.has(c.trim().toLowerCase())).length
  return named >= 3
}

/** Parse the whole pasted blob. */
export function parseSheet(text: string, now: Date = new Date()): ParsedSheet {
  const lines = text.replace(/\r/g, '').split('\n')
  const grid = lines.map(l => l.split('\t'))

  // Header = first row with >= 3 date-parseable cells (skipping the first/name column).
  let headerIdx = -1
  let colDates: (Date | null)[] = []
  for (let i = 0; i < grid.length; i++) {
    const dates = grid[i].map((c, ci) => (ci === 0 ? null : parseHeaderDate(c, now)))
    if (dates.filter(Boolean).length >= 3) { headerIdx = i; colDates = dates; break }
  }
  if (headerIdx === -1) return { headerFound: false, colDates: [], rows: [] }

  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const cells = grid[i]
    const name = (cells[0] ?? '').trim()
    if (!name) continue
    const low = name.toLowerCase()
    if (low === 'name' || low === 'date') continue
    if (isWeekdayRow(cells)) continue
    rows.push({ name, cells })
  }
  return { headerFound: true, colDates, rows }
}

// Palette for auto-created shifts.
export const IMPORT_PALETTE = [
  '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777',
  '#ca8a04', '#4f46e5', '#059669', '#dc2626', '#7c3aed', '#0d9488',
  '#c026d3', '#65a30d', '#e11d48', '#0284c7',
]
