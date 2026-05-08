'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, format, isSameMonth, isSameDay,
    addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

type Program = {
    id: number;
    name: string;
    responsibleParty: string;
    date: string; // yyyy-MM-dd
    time: string; // HH:mm
    isRecurring: boolean;
    recurrencePattern: string | null;
    attendees: string;
};

function programOccursOn(program: Program, day: Date): boolean {
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

export default function MonthlyProgrammingCalendar({ programs }: { programs: Program[] }) {
    const [cursor, setCursor] = useState(() => new Date());
    const today = new Date();

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end });
    }, [cursor]);

    const programsByDay = useMemo(() => {
        const map = new Map<string, Program[]>();
        for (const day of days) {
            const key = format(day, 'yyyy-MM-dd');
            map.set(key, programs.filter(p => programOccursOn(p, day)));
        }
        return map;
    }, [days, programs]);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Programming • {format(cursor, 'MMMM yyyy')}</CardTitle>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setCursor(subMonths(cursor, 1))} aria-label="Previous month">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
                            Today
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 text-xs font-medium text-slate-500 mb-1">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                        <div key={d} className="px-2 py-1">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map(day => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayPrograms = programsByDay.get(key) || [];
                        const inMonth = isSameMonth(day, cursor);
                        const isCurrent = isSameDay(day, today);
                        return (
                            <div
                                key={key}
                                className={cn(
                                    "min-h-[88px] rounded-md border p-1.5 text-xs flex flex-col gap-1",
                                    inMonth ? "bg-white" : "bg-slate-50 text-slate-400",
                                    isCurrent && "ring-2 ring-primary"
                                )}
                            >
                                <div className={cn("font-medium", isCurrent ? "text-primary" : "text-slate-700")}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-0.5 overflow-hidden">
                                    {dayPrograms.slice(0, 3).map(p => (
                                        <div
                                            key={`${p.id}-${key}`}
                                            className="flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] leading-tight text-purple-900 truncate"
                                            title={`${p.name} • ${p.time} • ${p.responsibleParty}`}
                                        >
                                            {p.isRecurring && <Repeat className="h-2.5 w-2.5 flex-shrink-0" />}
                                            <span className="truncate">{p.time} {p.name}</span>
                                        </div>
                                    ))}
                                    {dayPrograms.length > 3 && (
                                        <div className="text-[10px] text-slate-500">+{dayPrograms.length - 3} more</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
