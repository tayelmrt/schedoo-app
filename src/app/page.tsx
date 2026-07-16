'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 }   from 'lucide-react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function route() {
      const res = await fetch('/api/me')
      const me  = await res.json()

      if (!me.authenticated) { router.replace('/auth/login'); return }
      if (me.isManager) { router.replace('/dashboard'); return }
      router.replace('/me')   // agents (and 'none') land on the agent area which shows the right state
    }
    route()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )
}
