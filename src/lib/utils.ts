import { clsx, type ClassValue } from 'clsx'
import { twMerge }               from 'tailwind-merge'
import { format, startOfWeek, addDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns the Monday of the week containing `date` */
export function getWeekMonday(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/** Returns an array of 7 Dates [Mon…Sun] for the week starting at `monday` */
export function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Format a Date to 'YYYY-MM-DD' */
export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** Format a Date to display label e.g. 'Mon 12' */
export function toDayLabel(d: Date): string {
  return format(d, 'EEE d')
}

/** Convert HEX color to a semi-transparent CSS background (for cell coloring) */
export function hexToAlpha(hex: string, alpha = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Returns true if color is dark (for white text contrast) */
export function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128
}

export function formatTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}
