// All date strings in this app are UTC ISO dates (YYYY-MM-DD).
// Never use local date methods — they produce IST dates on the dev machine
// which differ from UTC dates for the first 5.5 hours of each IST day.

export function getUTCDateString(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getUTCYesterdayString(): string {
  const now = new Date()
  // Subtract 1 day entirely in UTC to avoid DST/local-offset edge cases
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  return `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`
}

export function getUTCFutureDateString(daysAhead: number): string {
  const now = new Date()
  const future = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead))
  return `${future.getUTCFullYear()}-${String(future.getUTCMonth() + 1).padStart(2, '0')}-${String(future.getUTCDate()).padStart(2, '0')}`
}
