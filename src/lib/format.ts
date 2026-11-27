export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export function formatLongDate(isoDate: string): string {
  if (!isoDate) return ''
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export function anniversaryCount(isoDate: string): number | null {
  if (!isoDate) return null
  const start = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  const hadAnniversaryPassed =
    now.getMonth() > start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate())
  if (!hadAnniversaryPassed) years -= 1
  return Math.max(0, years)
}

export function daysTogether(isoDate: string): number | null {
  if (!isoDate) return null
  const start = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  const difference = now.getTime() - start.getTime()
  return Math.max(0, Math.floor(difference / 86_400_000))
}

export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

export function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'backup'
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
