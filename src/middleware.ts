import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'

export async function middleware(req: NextRequest) {
  const res  = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // Public routes that don't need auth
  const publicPaths = ['/auth/login', '/auth/callback', '/schedule']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (session && pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
