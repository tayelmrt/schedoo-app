'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 }   from 'lucide-react'
import { getMe }     from '@/lib/me'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function route() {
      const me = await getMe().catch(() => ({ authenticated: false }))

      if (!me.authenticated) { router.replace('/auth/login'); return }
      if (me.isManager) { router.replace('/dashboard'); return }
      if (me.role === 'agent') { router.replace('/me'); return }
      router.replace('/onboarding')   // brand-new user with no org → create their company
    }
    route()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )
}
