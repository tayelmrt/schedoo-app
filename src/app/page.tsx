'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getMe } from '@/lib/me'
import { useApp } from '@/lib/providers'
import {
  CalendarClock, Users, ShieldCheck, Layers, Languages as LangIcon,
  FileSpreadsheet, Sun, Moon, ArrowRight, Check, Link2, Sparkles,
  LayoutDashboard, MousePointerClick,
} from 'lucide-react'

/* Reveal-on-scroll wrapper (IntersectionObserver, no deps) */
function Reveal({ children, delay = 0, className = '' }:
  { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`}
      style={{ ['--reveal-delay' as any]: `${delay}ms` }}>
      {children}
    </div>
  )
}

const Logo = ({ small = false }: { small?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div className={`${small ? 'w-8 h-8 text-base' : 'w-9 h-9 text-lg'} rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-600/30`}>S</div>
    <span className={`font-bold ${small ? 'text-lg' : 'text-xl'} text-slate-900 dark:text-white`}>Schedoo</span>
  </div>
)

export default function Landing() {
  const router = useRouter()
  const { t, theme, toggleTheme, lang, toggleLang } = useApp()
  const [me, setMe] = useState<any>(null)

  // Authed users hitting "/" go straight to their area (preserves post-login flow).
  useEffect(() => {
    (async () => {
      const m = await getMe().catch(() => ({ authenticated: false }))
      if (m?.authenticated) {
        if (m.isManager) { router.replace('/dashboard'); return }
        if (m.role === 'agent') { router.replace('/me'); return }
        router.replace('/onboarding'); return
      }
      setMe(m)
    })()
  }, [])

  const features = [
    { icon: Link2,           k: 'f1' },
    { icon: ShieldCheck,     k: 'f2' },
    { icon: Layers,          k: 'f3' },
    { icon: MousePointerClick,k: 'f4' },
    { icon: LangIcon,        k: 'f5' },
    { icon: FileSpreadsheet, k: 'f6' },
  ]
  const steps = [
    { icon: LayoutDashboard, k: 's1' },
    { icon: Users,           k: 's2' },
    { icon: Check,           k: 's3' },
  ]
  const stats = ['stat1', 'stat2', 'stat3', 'stat4']

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('landing.nav.features')}</a>
            <a href="#how" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('landing.nav.how')}</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleTheme} aria-label="theme"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={toggleLang}
              className="px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
            <Link href="/auth/login" className="hidden sm:inline-flex text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 transition-colors">
              {t('landing.nav.signin')}
            </Link>
            <Link href="/auth/login" className="btn btn-primary btn-sm shadow-lg shadow-blue-600/25">
              {t('landing.nav.start')}
            </Link>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative">
        {/* animated background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="anim-blob absolute -top-24 -start-24 w-[32rem] h-[32rem] rounded-full bg-blue-400/20 dark:bg-blue-600/20 blur-3xl" />
          <div className="anim-blob absolute top-20 -end-24 w-[30rem] h-[30rem] rounded-full bg-violet-400/20 dark:bg-violet-600/20 blur-3xl" style={{ animationDelay: '4s' }} />
          <div className="anim-blob absolute bottom-0 start-1/3 w-[26rem] h-[26rem] rounded-full bg-cyan-400/15 dark:bg-cyan-500/15 blur-3xl" style={{ animationDelay: '8s' }} />
          <div className="anim-grid absolute inset-0 opacity-[0.4] dark:opacity-[0.25]"
            style={{ backgroundImage: 'linear-gradient(to right, rgba(100,116,139,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,.12) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-2 gap-14 items-center">
          {/* copy */}
          <div className="text-center lg:text-start">
            <div className="anim-rise inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
              <Sparkles className="w-3.5 h-3.5" /> {t('landing.badge')}
            </div>
            <h1 className="anim-rise mt-6 text-4xl sm:text-5xl md:text-6xl font-black leading-[1.08] tracking-tight" style={{ animationDelay: '.08s' }}>
              {t('landing.title1')}<br />
              <span className="text-gradient">{t('landing.title2')}</span>
            </h1>
            <p className="anim-rise mt-6 text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed" style={{ animationDelay: '.16s' }}>
              {t('landing.subtitle')}
            </p>
            <div className="anim-rise mt-8 flex flex-wrap gap-3 justify-center lg:justify-start" style={{ animationDelay: '.24s' }}>
              <div className="relative">
                <div className="anim-pulse-glow absolute -inset-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 blur-md" />
                <Link href="/auth/login" className="relative btn btn-primary text-base px-6 py-3">
                  {t('landing.ctaPrimary')} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                </Link>
              </div>
              <Link href="/auth/login" className="btn btn-ghost text-base px-6 py-3">
                {t('landing.ctaSecondary')}
              </Link>
            </div>
            <p className="anim-rise mt-5 text-xs text-slate-400 dark:text-slate-500" style={{ animationDelay: '.32s' }}>
              {t('landing.trust')}
            </p>
          </div>

          {/* animated dashboard mockup */}
          <div className="anim-rise" style={{ animationDelay: '.2s' }}>
            <HeroMock t={t} />
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-5 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <Reveal key={s} delay={i * 90} className="text-center">
              <div className="text-4xl md:text-5xl font-black text-gradient anim-gradient">{t(`landing.${s}n`)}</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t(`landing.${s}l`)}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <Reveal className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t('landing.featuresKicker')}</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">{t('landing.featuresTitle')}</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">{t('landing.featuresSub')}</p>
        </Reveal>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, k }, i) => (
            <Reveal key={k} delay={(i % 3) * 100}>
              <div className="group card card-body h-full hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{t(`landing.${k}.t`)}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t(`landing.${k}.d`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="relative bg-slate-50 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-28">
          <Reveal className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t('landing.howKicker')}</div>
            <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">{t('landing.howTitle')}</h2>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-3 gap-6 relative">
            {/* connecting line */}
            <div className="hidden md:block absolute top-9 start-[16%] end-[16%] h-px bg-gradient-to-r from-blue-300 via-violet-300 to-cyan-300 dark:from-blue-800 dark:via-violet-800 dark:to-cyan-800" />
            {steps.map(({ icon: Icon, k }, i) => (
              <Reveal key={k} delay={i * 140} className="relative text-center">
                <div className="relative z-10 mx-auto w-[72px] h-[72px] rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-lg anim-float" style={{ animationDelay: `${i * 0.8}s` }}>
                  <Icon className="w-8 h-8" />
                  <div className="absolute -top-2 -end-2 w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white text-xs font-black flex items-center justify-center shadow">{i + 1}</div>
                </div>
                <h3 className="mt-5 text-lg font-bold">{t(`landing.${k}.t`)}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">{t(`landing.${k}.d`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-violet-600 to-blue-700 anim-gradient px-8 py-16 md:py-20 text-center shadow-2xl shadow-blue-600/30">
            {/* shimmer sweep */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="anim-shimmer absolute inset-y-0 -inset-x-1/2 w-1/3 bg-white/10 skew-x-12" />
            </div>
            <h2 className="relative text-3xl md:text-4xl font-black text-white max-w-2xl mx-auto leading-tight">{t('landing.finalTitle')}</h2>
            <p className="relative mt-4 text-blue-100 max-w-xl mx-auto">{t('landing.finalSub')}</p>
            <div className="relative mt-8 flex flex-wrap gap-3 justify-center">
              <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-700 font-bold px-7 py-3.5 hover:bg-blue-50 transition-colors shadow-lg">
                {t('landing.ctaPrimary')} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo small />
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('landing.footer')}</p>
          <div className="flex gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Link href="/auth/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('landing.nav.signin')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ---------- Animated weekly-schedule mockup ---------- */
function HeroMock({ t }: { t: (k: string) => string }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  // color per cell: 0 morning, 1 evening, 2 night, 3 off
  const rows = [
    [0, 0, 1, 1, 2, 3, 3],
    [1, 0, 0, 2, 2, 0, 3],
    [3, 1, 1, 0, 0, 1, 2],
    [2, 2, 3, 1, 1, 0, 0],
  ]
  const palette = [
    'bg-amber-400',   // morning
    'bg-blue-500',    // evening
    'bg-violet-600',  // night
    'bg-slate-200 dark:bg-slate-700', // off
  ]
  return (
    <div className="relative anim-float">
      {/* glow */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 to-violet-500/20 rounded-3xl blur-2xl" />
      <div className="relative card p-5 shadow-2xl border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold">{t('landing.mock.title')}</div>
            <div className="mt-1 badge-ok"><Check className="w-3 h-3" /> {t('landing.mock.covered')}</div>
          </div>
          <CalendarClock className="w-5 h-5 text-blue-500" />
        </div>

        {/* day header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {days.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
          ))}
        </div>
        {/* grid */}
        <div className="space-y-1.5">
          {rows.map((row, r) => (
            <div key={r} className="grid grid-cols-7 gap-1.5">
              {row.map((c, i) => (
                <div key={i} className={`h-7 rounded-md ${palette[c]} transition-transform hover:scale-110`}
                  style={{ animation: 'riseIn .5s cubic-bezier(.16,1,.3,1) both', animationDelay: `${0.3 + (r * 7 + i) * 0.02}s` }} />
              ))}
            </div>
          ))}
        </div>

        {/* legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />{t('landing.mock.morning')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />{t('landing.mock.evening')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-600" />{t('landing.mock.night')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />{t('landing.mock.off')}</span>
        </div>
      </div>

      {/* floating mini badges */}
      <div className="absolute -top-3 -end-3 card px-3 py-2 shadow-xl anim-float-slow flex items-center gap-2 text-xs font-semibold">
        <Users className="w-4 h-4 text-blue-500" /> 29
      </div>
      <div className="absolute -bottom-3 -start-3 card px-3 py-2 shadow-xl anim-float flex items-center gap-2 text-xs font-semibold" style={{ animationDelay: '1.5s' }}>
        <ShieldCheck className="w-4 h-4 text-emerald-500" /> 100%
      </div>
    </div>
  )
}
