'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, format, isSameMonth, isSameDay, isSameWeek,
    addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Repeat, Clock, User, Users, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { programOccursOn } from '@/lib/programs';

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

type ProgType = 'oneoff' | 'daily' | 'weekly' | 'monthly';

// Program-type colors drawn from the site's warm red / maroon / neutral palette (no purple).
const TYPE_STYLES: Record<ProgType, { label: string; chip: string; solid: string; tint: string; text: string }> = {
    oneoff: { label: 'One-time', chip: 'bg-red-100 text-red-900', solid: '#b00d0f', tint: 'bg-red-50', text: 'text-red-800' },
    weekly: { label: 'Weekly', chip: 'bg-amber-100 text-amber-900', solid: '#b45309', tint: 'bg-amber-50', text: 'text-amber-800' },
    monthly: { label: 'Monthly', chip: 'bg-stone-200 text-stone-800', solid: '#57534e', tint: 'bg-stone-100', text: 'text-stone-700' },
    daily: { label: 'Daily', chip: 'bg-rose-100 text-rose-900', solid: '#9f1239', tint: 'bg-rose-50', text: 'text-rose-800' },
};

function getProgramType(p: Program): ProgType {
    if (!p.isRecurring || !p.recurrencePattern) return 'oneoff';
    try {
        const f = JSON.parse(p.recurrencePattern).frequency;
        if (f === 'monthly') return 'monthly';
        if (f === 'daily') return 'daily';
        return 'weekly';
    } catch {
        return 'oneoff';
    }
}

function recurrenceText(p: Program): string {
    if (!p.isRecurring || !p.recurrencePattern) return 'One-time event';
    try {
        const pat = JSON.parse(p.recurrencePattern);
        if (pat.frequency === 'daily') return 'Repeats daily';
        if (pat.frequency === 'weekly') {
            const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dows = (pat.daysOfWeek as number[] | undefined)?.map(d => names[d]).join(', ');
            return dows ? `Repeats weekly on ${dows}` : 'Repeats weekly';
        }
        if (pat.frequency === 'monthly') return pat.dayOfMonth ? `Repeats monthly on day ${pat.dayOfMonth}` : 'Repeats monthly';
    } catch {
        // fall through
    }
    return 'Recurring';
}

function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h)) return t;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const WEEK_OPTS = { weekStartsOn: 0 } as const;

// Popover wrapper showing full program details. `trigger` is rendered as the clickable element.
function ProgramPopover({ program, day, trigger }: { program: Program; day: Date; trigger: ReactNode }) {
    const type = getProgramType(program);
    const style = TYPE_STYLES[type];
    return (
        <Popover>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="start" className="w-72">
                <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-slate-900 leading-tight">{program.name}</h4>
                        <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full whitespace-nowrap", style.chip)}>
                            {style.label}
                        </span>
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                            {format(day, 'EEEE, MMMM d, yyyy')}
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatTime(program.time)}
                        </div>
                        <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            Led by {program.responsibleParty}
                        </div>
                        {program.attendees && (
                            <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                                {program.attendees}
                            </div>
                        )}
                        <div className="flex items-center gap-2 pt-0.5">
                            <Repeat className="h-3.5 w-3.5 text-slate-400" />
                            {recurrenceText(program)}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default function MonthlyProgrammingCalendar({ programs }: { programs: Program[] }) {
    const [cursor, setCursor] = useState(() => new Date());
    const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfWeek(new Date(), WEEK_OPTS));
    const today = new Date();

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(cursor), WEEK_OPTS);
        const end = endOfWeek(endOfMonth(cursor), WEEK_OPTS);
        return eachDayOfInterval({ start, end });
    }, [cursor]);

    const programsByDay = useMemo(() => {
        const map = new Map<string, Program[]>();
        for (const day of days) {
            const key = format(day, 'yyyy-MM-dd');
            const list = programs
                .filter(p => programOccursOn(p, day))
                .sort((a, b) => a.time.localeCompare(b.time));
            map.set(key, list);
        }
        return map;
    }, [days, programs]);

    // Which program types actually exist, for the legend.
    const presentTypes = useMemo(() => {
        const set = new Set<ProgType>();
        for (const p of programs) set.add(getProgramType(p));
        return (['oneoff', 'weekly', 'monthly', 'daily'] as ProgType[]).filter(t => set.has(t));
    }, [programs]);

    const goToMonth = (newCursor: Date) => {
        setCursor(newCursor);
        if (isSameMonth(newCursor, today)) {
            setSelectedWeekStart(startOfWeek(today, WEEK_OPTS));
        } else {
            setSelectedWeekStart(startOfWeek(startOfMonth(newCursor), WEEK_OPTS));
        }
    };

    const goToday = () => {
        setCursor(new Date());
        setSelectedWeekStart(startOfWeek(new Date(), WEEK_OPTS));
    };

    const selectedWeekDays = useMemo(() => {
        return eachDayOfInterval({ start: selectedWeekStart, end: endOfWeek(selectedWeekStart, WEEK_OPTS) })
            .map(day => ({ day, items: programs.filter(p => programOccursOn(p, day)).sort((a, b) => a.time.localeCompare(b.time)) }));
    }, [selectedWeekStart, programs]);

    const weekHasPrograms = selectedWeekDays.some(d => d.items.length > 0);
    const selectedIsCurrentWeek = isSameWeek(selectedWeekStart, today, WEEK_OPTS);
    const weekRangeLabel = `${format(selectedWeekStart, 'MMM d')} – ${format(endOfWeek(selectedWeekStart, WEEK_OPTS), 'MMM d')}`;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Programming • {format(cursor, 'MMMM yyyy')}</CardTitle>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => goToMonth(subMonths(cursor, 1))} aria-label="Previous month">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={goToday}>
                            Today
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => goToMonth(addMonths(cursor, 1))} aria-label="Next month">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 text-xs font-medium text-slate-500 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="px-2 py-1">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map(day => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayPrograms = programsByDay.get(key) || [];
                        const inMonth = isSameMonth(day, cursor);
                        const isCurrent = isSameDay(day, today);
                        const inSelectedWeek = isSameWeek(day, selectedWeekStart, WEEK_OPTS);
                        return (
                            <div
                                key={key}
                                onClick={() => setSelectedWeekStart(startOfWeek(day, WEEK_OPTS))}
                                className={cn(
                                    "min-h-[88px] rounded-md border p-1.5 text-xs flex flex-col gap-1 cursor-pointer transition-colors",
                                    inMonth ? "bg-white" : "bg-slate-50 text-slate-400",
                                    inSelectedWeek && "bg-stone-100 ring-1 ring-stone-300",
                                    isCurrent && "ring-2 ring-primary",
                                    "hover:border-slate-300"
                                )}
                            >
                                <div className={cn("font-medium", isCurrent ? "text-primary" : "text-slate-700")}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-0.5 overflow-hidden">
                                    {dayPrograms.slice(0, 3).map(p => {
                                        const style = TYPE_STYLES[getProgramType(p)];
                                        return (
                                            <ProgramPopover
                                                key={`${p.id}-${key}`}
                                                program={p}
                                                day={day}
                                                trigger={
                                                    <button
                                                        type="button"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={cn(
                                                            "w-full flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-tight truncate cursor-pointer hover:brightness-95",
                                                            style.chip
                                                        )}
                                                        title="Click for details"
                                                    >
                                                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: style.solid }} />
                                                        <span className="truncate">{formatTime(p.time)} {p.name}</span>
                                                    </button>
                                                }
                                            />
                                        );
                                    })}
                                    {dayPrograms.length > 3 && (
                                        <div className="text-[10px] text-slate-500">+{dayPrograms.length - 3} more</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                {presentTypes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                        {presentTypes.map(t => (
                            <span key={t} className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_STYLES[t].solid }} />
                                {TYPE_STYLES[t].label}
                            </span>
                        ))}
                    </div>
                )}

                {/* This-week detail panel */}
                <div className="mt-4 rounded-lg border bg-muted/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-primary">
                            {selectedIsCurrentWeek ? 'This Week' : 'Selected Week'}
                        </h3>
                        <span className="text-xs font-medium text-slate-500">{weekRangeLabel}</span>
                    </div>

                    {!weekHasPrograms ? (
                        <p className="text-sm text-slate-500">No programming scheduled this week.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedWeekDays.filter(d => d.items.length > 0).map(({ day, items }) => (
                                <div key={format(day, 'yyyy-MM-dd')} className="rounded-md border bg-white p-2">
                                    <div className={cn(
                                        "text-xs font-semibold uppercase tracking-wide mb-1.5",
                                        isSameDay(day, today) ? "text-primary" : "text-slate-500"
                                    )}>
                                        {format(day, 'EEEE, MMM d')}{isSameDay(day, today) && ' • Today'}
                                    </div>
                                    <ul className="space-y-1.5">
                                        {items.map(p => {
                                            const style = TYPE_STYLES[getProgramType(p)];
                                            return (
                                                <ProgramPopover
                                                    key={`${p.id}-${format(day, 'yyyy-MM-dd')}`}
                                                    program={p}
                                                    day={day}
                                                    trigger={
                                                        <li
                                                            className={cn("text-sm rounded-md px-2 py-1.5 cursor-pointer hover:brightness-95 border-l-2", style.tint)}
                                                            style={{ borderLeftColor: style.solid }}
                                                        >
                                                            <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                                                {p.isRecurring && <Repeat className="h-3 w-3 flex-shrink-0" style={{ color: style.solid }} />}
                                                                <span>{p.name}</span>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />{formatTime(p.time)}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <User className="h-3 w-3" />{p.responsibleParty}
                                                                </span>
                                                                {p.attendees && <span>{p.attendees}</span>}
                                                            </div>
                                                        </li>
                                                    }
                                                />
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
