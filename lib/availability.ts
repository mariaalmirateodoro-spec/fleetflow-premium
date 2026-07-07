// ─────────────────────────────────────────────────────────────
// Derived (computed, not stored) "is this driver busy right now"
// status — based on their currently-approved bookings, not a
// manually-toggled flag. This intentionally does NOT touch
// drivers.is_available: that field stays a manual master switch
// staff use for things unrelated to any single trip (day off,
// inactive, etc). "Busy" is layered on top for assignment purposes
// so a driver already mid-trip isn't offered a second one, and
// automatically stops being "busy" the moment the trip window ends
// — no cron or reset needed, since it's computed live every time.
// ─────────────────────────────────────────────────────────────

export const DEFAULT_TRIP_BUFFER_HOURS = 4

export interface DriverAssignmentRow {
  driver_id: string | null
  status: string
  pickup_datetime: string
  dropoff_datetime: string | null
}

function tripWindow(b: DriverAssignmentRow): { start: number; end: number } {
  const start = new Date(b.pickup_datetime).getTime()
  const end = b.dropoff_datetime
    ? new Date(b.dropoff_datetime).getTime()
    : start + DEFAULT_TRIP_BUFFER_HOURS * 60 * 60 * 1000
  return { start, end }
}

// Returns the active booking (if any) that has this driver out on a trip right now.
export function getActiveAssignment(
  driverId: string,
  bookings: DriverAssignmentRow[],
  now: Date = new Date()
): DriverAssignmentRow | null {
  const nowMs = now.getTime()
  return (
    bookings.find((b) => {
      if (b.driver_id !== driverId || b.status !== 'approved') return false
      const { start, end } = tripWindow(b)
      return nowMs >= start && nowMs <= end
    }) ?? null
  )
}

export function isDriverBusyNow(
  driverId: string,
  bookings: DriverAssignmentRow[],
  now: Date = new Date()
): boolean {
  return getActiveAssignment(driverId, bookings, now) !== null
}
