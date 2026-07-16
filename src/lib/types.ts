// ============================================================
// Core domain types
// ============================================================

export interface Profile {
  id: string
  email: string
  created_at: string
}

export interface Organization {
  id: string
  name: string
  owner_id?: string
  created_at?: string
}

export interface Account {
  id: string
  org_id: string
  name: string
  week_start_day: number          // 0=Sunday … 6=Saturday
  weekly_off_days: number[]        // e.g. [5,6] = Fri/Sat
  coverage_type: string            // '24_7' | 'daytime' | 'custom'
  created_at?: string
}

export interface Team {
  id: string
  name: string
  manager_emails: string[]
  admin_id: string
  org_id?: string | null
  account_id?: string | null
  week_start_day?: number | null
  weekly_off_days?: number[] | null
  coverage_type?: string | null
  created_at: string
}

export const COVERAGE_LABELS: Record<string, string> = {
  '24_7':    'تغطية 24/7',
  'daytime': 'دوام نهاري',
  'custom':  'مخصّص',
}

// Account week starts on Sunday=0 … Saturday=6
export const WEEK_START_LABELS: Record<number, string> = {
  0: 'الأحد', 1: 'الإثنين', 2: 'الثلاثاء', 3: 'الأربعاء',
  4: 'الخميس', 5: 'الجمعة', 6: 'السبت',
}

export interface Shift {
  id: string
  team_id: string
  name: string
  start_time: string | null
  end_time: string | null
  color_code: string
  is_off: boolean
  sort_order: number
  created_at: string
}

export interface Requirement {
  id: string
  team_id: string
  day_of_week: number
  shift_id: string
  min_agents_required: number
  max_agents: number | null
  shift?: Shift
}

export interface Agent {
  id: string
  team_id: string
  name: string
  share_token: string
  is_active: boolean
  email: string | null
  auth_user_id: string | null
  status: 'pending' | 'approved'
  created_at: string
}

export interface Week {
  id: string
  team_id: string
  week_start_date: string   // 'YYYY-MM-DD'
  status: 'open' | 'confirmed'
  confirmed_at: string | null
  export_url_excel: string | null
  export_url_pdf: string | null
  created_at: string
}

export interface ScheduleEntry {
  id: string
  week_id: string
  agent_id: string
  day_of_week: number        // 1=Mon … 7=Sun
  shift_id: string | null
  status: 'draft' | 'submitted'
  submitted_at: string | null
  // Joins
  shift?: Shift
  agent?: Agent
}

// ============================================================
// UI helpers
// ============================================================

// Week starts on Sunday (Egypt convention): 1=Sunday … 7=Saturday
export const DAYS: Record<number, string> = {
  1: 'Sunday',
  2: 'Monday',
  3: 'Tuesday',
  4: 'Wednesday',
  5: 'Thursday',
  6: 'Friday',
  7: 'Saturday',
}

export const DAY_SHORTS: Record<number, string> = {
  1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat',
}

/** Validation result for a single (day, shift) cell */
export type CellStatus = 'ok' | 'less' | 'more' | 'none'

export interface DayShiftSummary {
  shift_id: string
  shift_name: string
  shift_color: string
  count: number
  required: number
  status: CellStatus
}
