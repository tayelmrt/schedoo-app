import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/import-sheet?url=<google sheet link>
// Fetches a Google Sheet tab as CSV (server-side, to avoid browser CORS).
// Only docs.google.com links are allowed. The sheet must be shared
// "anyone with the link can view".
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') ?? ''
  let u: URL
  try { u = new URL(raw) } catch { return NextResponse.json({ error: 'رابط غير صحيح' }, { status: 400 }) }

  if (u.protocol !== 'https:' || !/(^|\.)docs\.google\.com$/.test(u.hostname))
    return NextResponse.json({ error: 'الرابط لازم يكون Google Sheets' }, { status: 400 })

  const idMatch = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!idMatch) return NextResponse.json({ error: 'مش لاقي ID الشيت في الرابط' }, { status: 400 })
  const id = idMatch[1]

  // gid can be in the query (?gid=) or the hash (#gid=)
  const gidMatch = raw.match(/[?&#]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'

  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`

  try {
    const res = await fetch(exportUrl, { redirect: 'follow' })
    const text = await res.text()
    // If the sheet isn't public, Google returns an HTML sign-in page, not CSV.
    if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
      return NextResponse.json({
        error: 'مش قادر أقرأ الشيت — اتأكد إنه متشارك "Anyone with the link can view".',
      }, { status: 403 })
    }
    return NextResponse.json({ csv: text })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'فشل جلب الشيت' }, { status: 502 })
  }
}
