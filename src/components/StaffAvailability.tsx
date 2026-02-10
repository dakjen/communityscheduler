"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Fragment } from 'react';

// Helper to group slots into ranges
function formatSchedule(schedule: Record<string, string[]>) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const formatted: { day: string; ranges: string[] }[] = [];

    days.forEach(day => {
        const slots = schedule[day]?.sort() || [];
        if (slots.length === 0) return;

        const ranges: string[] = [];
        let start = slots[0];
        let end = slots[0];

        for (let i = 1; i < slots.length; i++) {
            const current = slots[i];
            const prev = slots[i - 1];
            
            // Check if current slot is immediately after previous (30 mins diff)
            const [h1, m1] = prev.split(':').map(Number);
            const [h2, m2] = current.split(':').map(Number);
            
            const d1 = new Date(); 
            d1.setHours(h1, m1, 0, 0); // Zero seconds/ms
            
            const d2 = new Date(); 
            d2.setHours(h2, m2, 0, 0); // Zero seconds/ms
            
            // 30 mins in ms = 30 * 60 * 1000
            if (d2.getTime() - d1.getTime() === 1800000) {
                end = current;
            } else {
                // Push range
                ranges.push(formatRange(start, end));
                start = current;
                end = current;
            }
        }
        ranges.push(formatRange(start, end));
        formatted.push({ day, ranges });
    });

    return formatted;
}

function formatRange(start: string, end: string) {
    const [h1, m1] = start.split(':').map(Number);
    const d1 = new Date(); 
    d1.setHours(h1, m1, 0, 0);
    
    // For end time, we need to add 30 mins to the *start* of the last slot
    const [h2, m2] = end.split(':').map(Number);
    const d2 = new Date(); 
    d2.setHours(h2, m2, 0, 0);
    const d3 = new Date(d2.getTime() + 1800000); // Add 30 mins

    return `${format(d1, 'h:mm a')} - ${format(d3, 'h:mm a')}`;
}

interface StaffMember {
    username: string;
    fullName: string | null;
    bio: string | null;
    officeHours: string | null;
    role?: string | null;
}

export function StaffAvailability({ staffMembers }: { staffMembers: StaffMember[] }) {
    if (staffMembers.length === 0) {
        return (
            <div className="col-span-full">
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No staff office hours posted yet.
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid gap-6 grid-cols-1">
            {staffMembers.map((staff) => {
                let schedule: Record<string, string[]> = {};
                try {
                    if (staff.officeHours && staff.officeHours.startsWith('{')) {
                        schedule = JSON.parse(staff.officeHours);
                    }
                } catch (e) {}

                const formattedSchedule = formatSchedule(schedule);

                if (formattedSchedule.length === 0) return null;

                return (
                    <Fragment key={staff.username}>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>{staff.fullName || staff.username}</CardTitle>
                                {staff.bio && (
                                    <p className="text-sm text-muted-foreground font-medium pt-1 italic">
                                        Ask me about: <span className="text-foreground">{staff.bio}</span>
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {formattedSchedule.map(({ day, ranges }) => (
                                        <div key={day}>
                                            <h4 className="font-semibold text-sm text-primary mb-1">{day}</h4>
                                            <ul className="text-sm text-gray-600 space-y-1">
                                                {ranges.map((range, i) => (
                                                    <li key={i}>{range}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </Fragment>
                );
            })}
        </div>
    );
}
