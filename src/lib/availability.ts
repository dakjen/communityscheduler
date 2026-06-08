import { format } from 'date-fns';

// A staff member's officeHours JSON holds:
//   - day-of-week keys ("Monday".."Sunday") -> recurring slots ["09:00", ...]
//   - specific-date keys ("yyyy-MM-dd")      -> override slots for that date ([] = closed)
//   - "_blackouts"                           -> time-off ranges that override everything

export type Schedule = Record<string, unknown>;
export type Blackout = { start: string; end: string; reason?: string };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseSchedule(officeHours: string | null | undefined): Schedule {
    if (!officeHours || !officeHours.startsWith('{')) return {};
    try {
        return JSON.parse(officeHours) as Schedule;
    } catch {
        return {};
    }
}

export function getBlackouts(schedule: Schedule): Blackout[] {
    const b = schedule?._blackouts;
    return Array.isArray(b) ? (b as Blackout[]) : [];
}

// Returns the matching blackout (inclusive of start/end) for the given date, or null.
// Date keys are ISO (yyyy-MM-dd), so lexical string comparison is chronological.
export function isBlackedOut(schedule: Schedule, date: Date): Blackout | null {
    const key = format(date, 'yyyy-MM-dd');
    for (const b of getBlackouts(schedule)) {
        if (b && b.start && b.end && b.start <= key && key <= b.end) return b;
    }
    return null;
}

// Resolves the available slots for a specific date, honoring (in priority order):
// blackout (-> closed) > specific-date override > recurring day-of-week schedule.
export function resolveDaySlots(schedule: Schedule, date: Date): string[] {
    if (isBlackedOut(schedule, date)) return [];

    const dateKey = format(date, 'yyyy-MM-dd');
    const specific = schedule[dateKey];
    if (Array.isArray(specific)) return specific as string[];

    const def = schedule[DAY_NAMES[date.getDay()]];
    return Array.isArray(def) ? (def as string[]) : [];
}
