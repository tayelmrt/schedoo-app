'use client'

import { createContext, useContext, useEffect, useState } from 'react'

// ============================================================
// Theme (light / dark) + Language (en / ar) providers
// ============================================================

type Theme = 'light' | 'dark'
type Lang  = 'en' | 'ar'

const THEME_KEY = 'schedoo-theme'
const LANG_KEY  = 'schedoo-lang'

interface AppCtx {
  theme: Theme
  toggleTheme: () => void
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: string) => string
  dir: 'rtl' | 'ltr'
}

const Ctx = createContext<AppCtx | null>(null)

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [lang, setLangState] = useState<Lang>('en')

  // hydrate from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem(THEME_KEY) as Theme) || 'light'
    const savedLang  = (localStorage.getItem(LANG_KEY)  as Lang)  || 'en'
    setTheme(savedTheme)
    setLangState(savedLang)
  }, [])

  // apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  // apply language + direction
  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', dir)
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr'

  const value: AppCtx = {
    theme,
    toggleTheme: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
    lang,
    setLang: setLangState,
    toggleLang: () => setLangState(l => (l === 'ar' ? 'en' : 'ar')),
    t: (key: string) => DICT[lang][key] ?? DICT.en[key] ?? key,
    dir,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProviders')
  return ctx
}

// ============================================================
// Translation dictionary
// ============================================================

type Dict = Record<string, string>

const en: Dict = {
  // shell / nav
  'nav.company':      'Company',
  'nav.teams':        'Teams',
  'nav.appearance':   'Appearance',
  'nav.language':     'Language',
  'nav.signOut':      'Sign out',
  'nav.backToTeams':  '← Teams',
  'theme.light':      'Light',
  'theme.dark':       'Dark',

  // dashboard (company)
  'dash.subtitle':    'Accounts, teams and shift schedules',
  'dash.newAccount':  'New account',
  'dash.createAccount': 'Create a new account',
  'dash.accountName': 'Account name',
  'dash.coverage':    'Coverage type',
  'dash.weekStart':   'Week starts on',
  'dash.cancel':      'Cancel',
  'dash.saveAccount': '+ Create account',
  'dash.saving':      'Saving…',
  'dash.loading':     'Loading…',
  'dash.noAccounts':  'No accounts yet',
  'dash.noAccountsHint': 'Start by creating your first account (business unit) to organize your teams',
  'dash.addTeam':     'Add team',
  'dash.noTeams':     'No teams in this account yet',
  'dash.teamName':    'Team name',
  'dash.coAdmins':    'Co-admin emails',
  'dash.managers':    'Manager emails',
  'dash.optional':    '(optional)',
  'dash.saveTeam':    '+ Create team',
  'dash.teamsCount':  'teams',
  'dash.managersCount': 'managers',
  'coverage.custom':  'Custom',
  'coverage.24_7':    '24/7 coverage',

  // team management
  'team.management':  'Team Management',
  'team.subtitle':    'Configure your team and manage weekly schedules',
  'team.shifts':      'Shifts',
  'team.shifts.desc': 'Define shift types, times, and colors',
  'team.requirements': 'Requirements',
  'team.requirements.desc': 'Min & Max agents per shift per day',
  'team.agents':      'Agents',
  'team.agents.desc': 'Add agents and approve accounts',
  'team.schedule':    'Schedule',
  'team.schedule.desc': 'View matrix, validate, and export',
  'team.reports':     'Reports',
  'team.reports.desc': 'Monthly shift stats and workload',
  'team.leaves':      'Leaves & Balances',
  'team.leaves.desc': 'Employee balances and leave requests',
  'team.holidays':    'Public Holidays',
  'team.holidays.desc': 'Official holidays and compensation tracking',
  'team.settings':    'Settings',
  'team.settings.desc': 'Admins, managers, and team config',

  // days
  'day.0': 'Sunday', 'day.1': 'Monday', 'day.2': 'Tuesday', 'day.3': 'Wednesday',
  'day.4': 'Thursday', 'day.5': 'Friday', 'day.6': 'Saturday',
  'dayShort.0': 'Sun', 'dayShort.1': 'Mon', 'dayShort.2': 'Tue', 'dayShort.3': 'Wed',
  'dayShort.4': 'Thu', 'dayShort.5': 'Fri', 'dayShort.6': 'Sat',

  // common
  'common.backToTeam': '← Team',
  'common.loading':    'Loading…',
  'common.add':        'Add',
  'common.saved':      '✓ Saved!',

  // auth
  'auth.tagline':    'Sign in to manage your team schedules',
  'auth.google':     'Continue with Google',
  'auth.orEmail':    'or email',
  'auth.email':      'Email',
  'auth.password':   'Password',
  'auth.signingIn':  'Signing in…',
  'auth.signIn':     'Sign In',
  'auth.signUp':     'Sign Up',
  'auth.checkEmail': 'Check your email to confirm your account.',

  // shifts
  'shifts.title':         'Shift Configuration',
  'shifts.addType':       'Add Shift Type',
  'shifts.name':          'Name',
  'shifts.namePlaceholder':'e.g. Morning',
  'shifts.start':         'Start Time',
  'shifts.end':           'End Time',
  'shifts.color':         'Color',
  'shifts.isOff':         'This is an "OFF / Day Off" shift',
  'shifts.adding':        'Adding…',
  'shifts.add':           'Add Shift',
  'shifts.colShift':      'Shift',
  'shifts.colHours':      'Hours',
  'shifts.colType':       'Type',
  'shifts.dayOff':        'Day Off',
  'shifts.shift':         'Shift',
  'shifts.none':          'No shifts defined yet',
  'shifts.confirmDelete': 'Delete this shift?',

  // requirements
  'req.title':    'Requirements Matrix',
  'req.subtitle': 'Min and Max agents per shift per day — leave Max empty for no limit',
  'req.saveAll':  'Save All',
  'req.saving':   'Saving…',
  'req.minMax':   'Min / Max',
  'req.noShifts': 'No shifts defined yet.',
  'req.addFirst': 'Add shifts first',
  'req.minTitle': 'Minimum',
  'req.maxTitle': 'Maximum (empty = no limit)',

  // team settings
  'set.title':         'Team Settings',
  'set.teamName':      'Team Name',
  'set.coAdmins':      'Co-Admins',
  'set.coAdminsHint':  'They can sign in and manage the team with their emails',
  'set.noCoAdmins':    'No co-admins yet',
  'set.managerEmails': 'Manager Emails',
  'set.managerHint':   'They receive the final schedule by email',
  'set.noManagers':    'No managers yet',
  'set.saveChanges':   'Save Changes',
}

const ar: Dict = {
  'nav.company':      'الشركة',
  'nav.teams':        'الفرق',
  'nav.appearance':   'المظهر',
  'nav.language':     'اللغة',
  'nav.signOut':      'تسجيل الخروج',
  'nav.backToTeams':  '← الفرق',
  'theme.light':      'فاتح',
  'theme.dark':       'داكن',

  'dash.subtitle':    'الأكونتات والفرق وجداول الشيفتات',
  'dash.newAccount':  'أكونت جديد',
  'dash.createAccount': 'إنشاء أكونت جديد',
  'dash.accountName': 'اسم الأكونت',
  'dash.coverage':    'نوع التغطية',
  'dash.weekStart':   'بداية الأسبوع',
  'dash.cancel':      'إلغاء',
  'dash.saveAccount': '+ إنشاء الأكونت',
  'dash.saving':      'جاري الحفظ…',
  'dash.loading':     'جاري التحميل…',
  'dash.noAccounts':  'لسه مفيش أكونتات',
  'dash.noAccountsHint': 'ابدأ بإنشاء أول أكونت (وحدة عمل) عشان توزّع عليه فرقك',
  'dash.addTeam':     'أضف فريق',
  'dash.noTeams':     'مفيش فرق في الأكونت ده لسه',
  'dash.teamName':    'اسم الفريق',
  'dash.coAdmins':    'إيميلات أدمن مشاركين',
  'dash.managers':    'إيميلات المانجرز',
  'dash.optional':    '(اختياري)',
  'dash.saveTeam':    '+ إنشاء الفريق',
  'dash.teamsCount':  'فريق',
  'dash.managersCount': 'مدير',
  'coverage.custom':  'مخصّص',
  'coverage.24_7':    'تغطية 24/7',

  'team.management':  'إدارة الفريق',
  'team.subtitle':    'اضبط فريقك وأدر الجداول الأسبوعية',
  'team.shifts':      'الشيفتات',
  'team.shifts.desc': 'أنواع الشيفتات ومواعيدها وألوانها',
  'team.requirements': 'المتطلبات',
  'team.requirements.desc': 'الحد الأدنى والأقصى للموظفين لكل شيفت',
  'team.agents':      'الموظفين',
  'team.agents.desc': 'إضافة الموظفين واعتماد الحسابات',
  'team.schedule':    'الجدول',
  'team.schedule.desc': 'عرض المصفوفة والتحقق والتصدير',
  'team.reports':     'التقارير',
  'team.reports.desc': 'إحصائيات وعبء الشيفتات الشهري',
  'team.leaves':      'الإجازات والأرصدة',
  'team.leaves.desc': 'أرصدة الموظفين وطلبات الإجازة',
  'team.holidays':    'الإجازات الرسمية',
  'team.holidays.desc': 'إجازات رسمية وتتبّع أيام التعويض',
  'team.settings':    'الإعدادات',
  'team.settings.desc': 'الأدمنز والمانجرز وإعدادات الفريق',

  'day.0': 'الأحد', 'day.1': 'الإثنين', 'day.2': 'الثلاثاء', 'day.3': 'الأربعاء',
  'day.4': 'الخميس', 'day.5': 'الجمعة', 'day.6': 'السبت',
  'dayShort.0': 'أحد', 'dayShort.1': 'إثنين', 'dayShort.2': 'ثلاثاء', 'dayShort.3': 'أربعاء',
  'dayShort.4': 'خميس', 'dayShort.5': 'جمعة', 'dayShort.6': 'سبت',

  'common.backToTeam': '← الفريق',
  'common.loading':    'جاري التحميل…',
  'common.add':        'إضافة',
  'common.saved':      '✓ اتحفظ!',

  'auth.tagline':    'سجّل دخولك لإدارة جداول فريقك',
  'auth.google':     'المتابعة بجوجل',
  'auth.orEmail':    'أو بالإيميل',
  'auth.email':      'الإيميل',
  'auth.password':   'كلمة المرور',
  'auth.signingIn':  'جاري الدخول…',
  'auth.signIn':     'تسجيل الدخول',
  'auth.signUp':     'إنشاء حساب',
  'auth.checkEmail': 'راجع إيميلك لتأكيد الحساب.',

  'shifts.title':         'إعداد الشيفتات',
  'shifts.addType':       'إضافة نوع شيفت',
  'shifts.name':          'الاسم',
  'shifts.namePlaceholder':'مثال: صباحي',
  'shifts.start':         'وقت البداية',
  'shifts.end':           'وقت النهاية',
  'shifts.color':         'اللون',
  'shifts.isOff':         'ده شيفت "إجازة / يوم راحة"',
  'shifts.adding':        'جاري الإضافة…',
  'shifts.add':           'إضافة شيفت',
  'shifts.colShift':      'الشيفت',
  'shifts.colHours':      'المواعيد',
  'shifts.colType':       'النوع',
  'shifts.dayOff':        'يوم راحة',
  'shifts.shift':         'شيفت',
  'shifts.none':          'مفيش شيفتات لسه',
  'shifts.confirmDelete': 'تمسح الشيفت ده؟',

  'req.title':    'مصفوفة المتطلبات',
  'req.subtitle': 'الحد الأدنى والأقصى للموظفين لكل شيفت في كل يوم — سيب الأقصى فاضي لو بدون حد',
  'req.saveAll':  'حفظ الكل',
  'req.saving':   'جاري الحفظ…',
  'req.minMax':   'أدنى / أقصى',
  'req.noShifts': 'مفيش شيفتات لسه.',
  'req.addFirst': 'أضف شيفتات الأول',
  'req.minTitle': 'الحد الأدنى',
  'req.maxTitle': 'الحد الأقصى (فاضي = بدون حد)',

  'set.title':         'إعدادات الفريق',
  'set.teamName':      'اسم الفريق',
  'set.coAdmins':      'أدمنز مشاركين',
  'set.coAdminsHint':  'يقدروا يدخلوا ويديروا الفريق بإيميلاتهم',
  'set.noCoAdmins':    'مفيش أدمنز مشاركين لسه',
  'set.managerEmails': 'إيميلات المانجرز',
  'set.managerHint':   'هيستلموا الجدول النهائي على إيميلاتهم',
  'set.noManagers':    'مفيش مانجرز لسه',
  'set.saveChanges':   'حفظ التغييرات',
}

const DICT: Record<Lang, Dict> = { en, ar }
