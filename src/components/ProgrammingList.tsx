'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { Repeat, Clock, Users } from 'lucide-react';
import { programOccursOn, type Program } from '@/lib/programs';

function formatDateLabel(d: Date): string {
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEE, MMM d');
}

export default function ProgrammingList({
    programs,
    daysAhead = 30,
}: { programs: Program[]; daysAhead?: number }) {
    const occurrences = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const out: { key: string; date: Date; program: Program }[] = [];
        for (let i = 0; i < daysAhead; i++) {
            const day = addDays(today, i);
            for (const p of programs) {
                if (programOccursOn(p, day)) {
                    out.push({ key: `${p.id}-${format(day, 'yyyy-MM-dd')}`, date: day, program: p });
                }
            }
        }
        out.sort((a, b) => {
            const d = a.date.getTime() - b.date.getTime();
            if (d !== 0) return d;
            return a.program.time.localeCompare(b.program.time);
        });
        return out;
    }, [programs, daysAhead]);

    const grouped = useMemo(() => {
        const map = new Map<string, { date: Date; items: { key: string; program: Program }[] }>();
        for (const o of occurrences) {
            const k = format(o.date, 'yyyy-MM-dd');
            if (!map.has(k)) map.set(k, { date: o.date, items: [] });
            map.get(k)!.items.push({ key: o.key, program: o.program });
        }
        return Array.from(map.values());
    }, [occurrences]);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Upcoming Programs</CardTitle>
            </CardHeader>
            <CardContent>
                {grouped.length === 0 ? (
                    <p className="text-sm text-slate-500">No programs scheduled in the next {daysAhead} days.</p>
                ) : (
                    <ul className="space-y-4">
                        {grouped.map(group => (
                            <li key={format(group.date, 'yyyy-MM-dd')}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    {formatDateLabel(group.date)}
                                </div>
                                <ul className="space-y-1.5">
                                    {group.items.map(({ key, program }) => (
                                        <li
                                            key={key}
                                            className="flex items-start gap-3 rounded-md border bg-white px-3 py-2 text-sm"
                                        >
                                            <div className="flex items-center gap-1 text-slate-700 font-medium tabular-nums min-w-[60px]">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                {program.time}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                                    {program.isRecurring && <Repeat className="h-3 w-3 text-purple-500 flex-shrink-0" />}
                                                    <span className="truncate">{program.name}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {program.responsibleParty}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                                                <Users className="h-3 w-3" />
                                                {program.attendees}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
