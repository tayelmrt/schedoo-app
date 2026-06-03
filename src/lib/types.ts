// ============================================================
// Core domain types
// ============================================================

export interface Profile {
  id: string
  email: string
  created_at: string
}

export interface Team {
  id: string
  name: string
  manager_emails: string[]
  admin_id: string
  created_at: string
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

export const DAYS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

export const DAY_SHORTS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
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
