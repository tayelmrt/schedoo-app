import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Schedoo — Call Center Scheduler',
  description: 'Weekly shift scheduling for call center teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
