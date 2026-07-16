import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from '@/lib/providers'

export const metadata: Metadata = {
  title: 'Schedoo — Shift Scheduler',
  description: 'Shift scheduling for any team, any sector',
}

// Runs before hydration to apply saved theme/lang and avoid a flash.
const noFlash = `
(function(){try{
  var t=localStorage.getItem('schedoo-theme')||'light';
  var l=localStorage.getItem('schedoo-lang')||'en';
  var e=document.documentElement;
  if(t==='dark')e.classList.add('dark');
  e.setAttribute('lang',l);
  e.setAttribute('dir',l==='ar'?'rtl':'ltr');
}catch(_){}})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><script dangerouslySetInnerHTML={{ __html: noFlash }} /></head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
