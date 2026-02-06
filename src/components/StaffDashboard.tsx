'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateOfficeHours } from '@/app/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 8;
const END_HOUR = 18; // 6 PM

// Generate time slots (08:00, 08:30, ...)
const TIME_SLOTS: { raw: string; display: string }[] = [];
// Create a base date at midnight today to ensure clean formatting
const baseDate = new Date();
baseDate.setHours(0, 0, 0, 0);

for (let h = START_HOUR; h < END_HOUR; h++) {
    const time00 = `${h.toString().padStart(2, '0')}:00`;
    const time30 = `${h.toString().padStart(2, '0')}:30`;
    
    // Explicitly set hours/minutes on the clean base date
    const d00 = new Date(baseDate);
    d00.setHours(h, 0, 0, 0);
    
    const d30 = new Date(baseDate);
    d30.setHours(h, 30, 0, 0);

    TIME_SLOTS.push({ raw: time00, display: format(d00, 'h:mm a') });
    TIME_SLOTS.push({ raw: time30, display: format(d30, 'h:mm a') });
}

// Type for our schedule state: { "Monday": ["08:00", "09:30"], ... }
type Schedule = Record<string, string[]>;

export default function StaffDashboard({ officeHours, bio }: { officeHours: string; bio: string }) {
    const [schedule, setSchedule] = useState<Schedule>({});
    const [bioText, setBioText] = useState(bio || '');
    const [isSaving, setIsSaving] = useState(false);

    // Parse initial data
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

    const toggleSlot = (day: string, rawTime: string) => {
        // ... existing toggleSlot ...
        setSchedule(prev => {
            const daySlots = prev[day] || [];
            if (daySlots.includes(rawTime)) {
                return { ...prev, [day]: daySlots.filter(t => t !== rawTime) };
            } else {
                return { ...prev, [day]: [...daySlots, rawTime] };
            }
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save as JSON string
            await updateOfficeHours(JSON.stringify(schedule), bioText);
            toast.success('Profile updated');
        } catch (e) {
            toast.error('Failed to update');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-6xl mx-auto mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Manage Office Hours</CardTitle>
                    <CardDescription>
                        Set your availability and topic.
                    </CardDescription>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                </Button>
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

                <div className="overflow-x-auto">
                    {/* ... existing grid ... */}
                    <div className="grid grid-cols-8 gap-1 min-w-[800px]">
                        {/* Header Row */}
                        <div className="h-10"></div> {/* Time column spacer */}
                        {DAYS.map(day => (
                            <div key={day} className="h-10 flex items-center justify-center font-medium bg-secondary/20 rounded-t-md">
                                {day}
                            </div>
                        ))}

                        {/* Time Rows */}
                        {TIME_SLOTS.map(slot => (
                            <>
                                {/* Time Label */}
                                <div key={slot.display} className="h-8 flex items-center justify-end pr-4 text-xs text-muted-foreground border-r border-b border-gray-200">
                                    {slot.display}
                                </div>
                                
                                {/* Day Columns for this Time */}
                                {DAYS.map(day => {
                                    const isActive = schedule[day]?.includes(slot.raw);
                                    return (
                                        <button
                                            key={`${day}-${slot.raw}`}
                                            onClick={() => toggleSlot(day, slot.raw)}
                                            className={cn(
                                                "h-8 rounded-none transition-colors border border-gray-200", // More distinct border
                                                isActive 
                                                    ? "bg-primary text-primary-foreground hover:bg-primary/90" // Active state
                                                    : "bg-white hover:bg-gray-50" // Inactive state
                                            )}
                                            title={`${day} ${slot.display} - ${isActive ? 'Available' : 'Unavailable'}`}
                                        />
                                    );
                                })}
                            </>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}