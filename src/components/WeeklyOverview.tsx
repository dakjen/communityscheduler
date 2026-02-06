'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes } from 'date-fns';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 8;
const END_HOUR = 18;

// Generate time slots
const TIME_SLOTS: string[] = [];
for (let h = START_HOUR; h < END_HOUR; h++) {
    const d00 = new Date(); d00.setHours(h, 0, 0, 0);
    const d30 = new Date(); d30.setHours(h, 30, 0, 0);
    TIME_SLOTS.push(format(d00, 'HH:mm')); // Use 24h for matching
    TIME_SLOTS.push(format(d30, 'HH:mm'));
}

const COLORS = [
    '#7a6151',
    '#ececec',
    '#155591',
    '#ac8d79',
    '#000000',
];

type Staff = {
    username: string;
    fullName: string | null;
    officeHours: string | null;
};

export default function WeeklyOverview({ staffMembers }: { staffMembers: Staff[] }) {
    // Parse all schedules
    const schedules = staffMembers.map((staff, index) => {
        let schedule: Record<string, string[]> = {};
        try {
            if (staff.officeHours && staff.officeHours.startsWith('{')) {
                schedule = JSON.parse(staff.officeHours);
            }
        } catch (e) {}
        return {
            name: staff.fullName || staff.username,
            schedule,
            color: COLORS[index % COLORS.length]
        };
    });

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>PCC Team Office Hours</CardTitle>
                <div className="flex flex-wrap gap-4 pt-2">
                    {schedules.map(s => (
                        <div key={s.name} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                            <span>{s.name}</span>
                        </div>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="grid grid-cols-8 gap-px bg-slate-200 border border-slate-200 min-w-[800px]">
                        {/* Header Row */}
                        <div className="bg-white h-6 text-xs"></div>
                        {DAYS.map(day => (
                            <div key={day} className="bg-slate-50 h-6 flex items-center justify-center font-medium text-xs">
                                {day.slice(0, 3)}
                            </div>
                        ))}

                        {/* Time Rows */}
                        {TIME_SLOTS.map(time => {
                            // Format time label (e.g., 08:00 -> 8:00 AM)
                            const [h, m] = time.split(':').map(Number);
                            const d = new Date(); d.setHours(h, m, 0, 0);
                            const label = format(d, 'h a'); // Abbreviated time for smaller slots

                            return (
                                <>
                                    <div key={time} className="bg-white h-4 flex items-center justify-end pr-2 text-[8px] text-muted-foreground">
                                        {label}
                                    </div>
                                    
                                    {DAYS.map(day => {
                                        // Find staff available at this time
                                        const availableStaff = schedules.filter(s => s.schedule[day]?.includes(time));
                                        
                                        return (
                                            <div key={`${day}-${time}`} className="bg-white h-4 relative group flex">
                                                {availableStaff.map(s => (
                                                    <div 
                                                        key={s.name}
                                                        className="h-full flex-1 opacity-80 hover:opacity-100 transition-opacity"
                                                        style={{ backgroundColor: s.color }}
                                                        title={`${s.name} is available`}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    })}
                                </>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
