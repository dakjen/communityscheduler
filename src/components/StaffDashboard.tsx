'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateOfficeHours } from '@/app/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Repeat } from 'lucide-react';
import { format, setHours, setMinutes, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const START_HOUR = 8;
const END_HOUR = 18; // 6 PM

// Generate time slots (08:00, 08:30, ...)
const TIME_SLOTS: { raw: string; display: string }[] = [];
const baseDate = new Date();
baseDate.setHours(0, 0, 0, 0);

for (let h = START_HOUR; h < END_HOUR; h++) {
    const time00 = `${h.toString().padStart(2, '0')}:00`;
    const time30 = `${h.toString().padStart(2, '0')}:30`;
    
    const d00 = new Date(baseDate);
    d00.setHours(h, 0, 0, 0);
    
    const d30 = new Date(baseDate);
    d30.setHours(h, 30, 0, 0);

    TIME_SLOTS.push({ raw: time00, display: format(d00, 'h:mm a') });
    TIME_SLOTS.push({ raw: time30, display: format(d30, 'h:mm a') });
}

type Schedule = Record<string, string[]>;

export default function StaffDashboard({ officeHours, bio }: { officeHours: string; bio: string }) {
    const [schedule, setSchedule] = useState<Schedule>({});
    const [bioText, setBioText] = useState(bio || '');
    const [isSaving, setIsSaving] = useState(false);
    
    // Mode: 'default' (recurring) or 'specific' (specific dates)
    const [mode, setMode] = useState<'default' | 'specific'>('default');
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Columns configuration based on mode
    const columns = mode === 'default' 
        ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({
            key: day,
            label: day,
            isDate: false
          }))
        : Array.from({ length: 7 }).map((_, i) => {
            const date = addDays(currentWeekStart, i);
            return {
                key: format(date, 'yyyy-MM-dd'),
                label: format(date, 'EEE M/d'),
                isDate: true
            };
          });

    useEffect(() => {
        try {
            if (officeHours && officeHours.startsWith('{')) {
                setSchedule(JSON.parse(officeHours));
            } else {
                setSchedule({});
            }
        } catch (e) {
            setSchedule({});
        }
        setBioText(bio || '');
    }, [officeHours, bio]);

    const toggleSlot = (key: string, rawTime: string) => {
        setSchedule(prev => {
            const currentSlots = prev[key] || [];
            // If in specific mode, and no slots exist yet for this date, should we copy from default? 
            // Maybe convenient, but also maybe confusing if they want to clear it.
            // Let's start with empty. Logic: specific overrides default completely if present.
            // If they want to "disable" a day that has default hours, they need to explicitly set it to empty array?
            // Actually with the current logic (in RequestForm), if date key exists, it uses it. If not, falls back.
            // So to "close" a day that is normally open, they need to create an empty entry `key: []`.
            // But if `prev[key]` is undefined, it's not in the object.
            // We need to ensure we set it to [] if clicked and empty.
            
            let newSlots;
            if (currentSlots.includes(rawTime)) {
                newSlots = currentSlots.filter(t => t !== rawTime);
            } else {
                newSlots = [...currentSlots, rawTime];
            }
            
            // If specific mode and slots become empty, we should keep the key as [] 
            // so it overrides the default schedule (making it closed).
            // But if it was undefined (fallback to default) and we toggle one ON, it becomes [time].
            // If we toggle it OFF, it becomes []. 
            return { ...prev, [key]: newSlots };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateOfficeHours(JSON.stringify(schedule), bioText);
            toast.success('Profile updated');
        } catch (e) {
            toast.error('Failed to update');
        } finally {
            setIsSaving(false);
        }
    };

    const navigateWeek = (direction: 'prev' | 'next') => {
        setCurrentWeekStart(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    };

    return (
        <Card className="max-w-6xl mx-auto mt-8">
            <CardHeader>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Manage Office Hours</CardTitle>
                        <CardDescription>
                            Set your recurring weekly schedule or override specific dates.
                        </CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Changes
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="bio">What you can ask me about:</Label>
                    <Input 
                        id="bio" 
                        value={bioText} 
                        onChange={(e) => setBioText(e.target.value)} 
                        placeholder="e.g. Events, Room Booking, Community Programs..."
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted p-2 rounded-lg">
                        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full sm:w-auto">
                            <TabsList>
                                <TabsTrigger value="default" className="flex items-center gap-2">
                                    <Repeat className="h-4 w-4" /> Default Weekly
                                </TabsTrigger>
                                <TabsTrigger value="specific" className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4" /> Specific Dates
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {mode === 'specific' && (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium min-w-[140px] text-center">
                                    {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                                </span>
                                <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto border rounded-md">
                        <div className="grid grid-cols-8 gap-0 min-w-[800px]">
                            {/* Header Row */}
                            <div className="h-12 bg-muted/50 border-b border-r flex items-center justify-center text-xs font-medium text-muted-foreground">
                                Time
                            </div>
                            {columns.map(col => (
                                <div key={col.key} className={cn(
                                    "h-12 border-b flex flex-col items-center justify-center text-sm font-medium",
                                    // Highlight today if in specific view
                                    col.isDate && col.key === format(new Date(), 'yyyy-MM-dd') ? "bg-primary/5 text-primary" : "bg-muted/50",
                                    // Add right border except for last item (though grid gap usually handles visual separation, explicit borders are nice for schedules)
                                    "border-r last:border-r-0"
                                )}>
                                    {col.label}
                                </div>
                            ))}

                            {/* Time Rows */}
                            {TIME_SLOTS.map(slot => (
                                <Fragment key={slot.raw}>
                                    {/* Time Label */}
                                    <div className="h-10 flex items-center justify-center text-xs text-muted-foreground border-b border-r bg-slate-50/50">
                                        {slot.display}
                                    </div>
                                    
                                    {/* Slot Cells */}
                                    {columns.map(col => {
                                        // Resolution logic:
                                        // If specific mode: Use specific date key. 
                                        // If not found in specific date key? 
                                        // The user is EDITING. If they haven't touched this date yet, what should they see?
                                        // 1. Empty? (Means closed)
                                        // 2. The default schedule inherited? (Better UX).
                                        // If we show inherited, clicking it should 'instantiate' the override.
                                        
                                        // HOWEVER, simply checking `schedule[col.key]` will return undefined if not set.
                                        // If we want to show inherited availability visually, we need to check the default schedule too.
                                        
                                        // Let's define `isInherited` and `isSet`.
                                        
                                        const specificSlots = schedule[col.key];
                                        const defaultDayKey = col.isDate ? format(parseDate(col.key), 'EEEE') : col.key; // e.g. "Monday"
                                        const defaultSlots = schedule[defaultDayKey];
                                        
                                        let isSelected = false;
                                        let isInherited = false;

                                        if (mode === 'default') {
                                            isSelected = specificSlots?.includes(slot.raw) ?? false;
                                        } else {
                                            // Specific Mode
                                            if (specificSlots !== undefined) {
                                                // Explicitly set (even if empty array)
                                                isSelected = specificSlots.includes(slot.raw);
                                            } else {
                                                // Not set, fallback to default for display?
                                                // If we display it as selected, the user might think it's "set".
                                                // Let's show it as "Inherited" (maybe lighter color?).
                                                if (defaultSlots?.includes(slot.raw)) {
                                                    isInherited = true;
                                                }
                                            }
                                        }

                                        return (
                                            <button
                                                key={`${col.key}-${slot.raw}`}
                                                onClick={() => {
                                                    // Logic for clicking
                                                    if (mode === 'default') {
                                                        toggleSlot(col.key, slot.raw);
                                                    } else {
                                                        // Specific mode
                                                        // If currently undefined (inherited state), we need to initialize this day's schedule 
                                                        // starting with the default schedule, then toggle this slot.
                                                        if (specificSlots === undefined) {
                                                            const base = defaultSlots || [];
                                                            // If we click an inherited slot, we are turning it OFF (toggle). 
                                                            // If we click an empty slot, we are turning it ON.
                                                            let newForDay;
                                                            if (base.includes(slot.raw)) {
                                                                newForDay = base.filter(t => t !== slot.raw);
                                                            } else {
                                                                newForDay = [...base, slot.raw];
                                                            }
                                                            setSchedule(prev => ({ ...prev, [col.key]: newForDay }));
                                                        } else {
                                                            // Already exists, just toggle
                                                            toggleSlot(col.key, slot.raw);
                                                        }
                                                    }
                                                }}
                                                className={cn(
                                                    "h-10 border-b border-r last:border-r-0 transition-all",
                                                    isSelected ? "bg-primary hover:bg-primary/90" : 
                                                    isInherited ? "bg-primary/30 hover:bg-primary/40" : // Lighter for inherited
                                                    "hover:bg-slate-100"
                                                )}
                                                title={`${col.label} ${slot.display}`}
                                            >
                                            </button>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                    
                    {mode === 'specific' && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground justify-end">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-primary rounded"></div>
                                <span>Specific Override</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-primary/30 rounded"></div>
                                <span>Default (Inherited)</span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Helper to avoid import loop or complexity if date-fns parse isn't handy with this format
function parseDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}