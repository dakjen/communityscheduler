import { format } from 'date-fns';

export type Program = {
    id: number;
    name: string;
    responsibleParty: string;
    date: string; // yyyy-MM-dd
    time: string; // HH:mm
    isRecurring: boolean;
    recurrencePattern: string | null;
    attendees: string;
};

// Does a program occur on the given day — honoring one-off dates and
// daily/weekly/monthly recurrence patterns (with optional endDate)?
export function programOccursOn(program: Program, day: Date): boolean {
    const dayStr = format(day, 'yyyy-MM-dd');
    if (program.date === dayStr) return true;

    if (!program.isRecurring || !program.recurrencePattern) return false;

    try {
        const pattern = JSON.parse(program.recurrencePattern);
        if (pattern.endDate && pattern.endDate < dayStr) return false;
        if (program.date && program.date > dayStr) return false;

        if (pattern.frequency === 'daily') return true;
        if (pattern.frequency === 'weekly') return (pattern.daysOfWeek as number[] | undefined)?.includes(day.getDay()) ?? false;
        if (pattern.frequency === 'monthly') return pattern.dayOfMonth === day.getDate();
    } catch {
        return false;
    }
    return false;
}
