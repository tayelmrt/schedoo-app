import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient }                from '@supabase/supabase-js'
import { cookies }                     from 'next/headers'

/** For Server Components (respects RLS via auth cookie) */
export const createServerClient = () =>
  createServerComponentClient({ cookies })

/** For API Routes that need to bypass RLS (service role) */
export const createServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
