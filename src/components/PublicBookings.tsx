'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isWithinInterval, setHours, setMinutes } from 'date-fns';
import { ChevronDown, ChevronRight, ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Booking = {
    id: number;
    roomId: number | null;
    roomName: string | null;
    customerName: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
};

type Room = {
    id: number;
    name: string;
    description: string | null;
    capacity: number;
    imageUrl: string | null;
    openTime: string;
    closeTime: string;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const START_HOUR = 8;
const END_HOUR = 22; // 10 PM to cover late events

export default function PublicBookings({ rooms, bookings }: { rooms: Room[], bookings: Booking[] }) {
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    // Determine which rooms are open (collapsible state)
    // Default: first room open? or all closed? Let's say all closed to save space, or first one open.
    const [openRooms, setOpenRooms] = useState<number[]>([rooms[0]?.id]);

    const toggleRoom = (id: number) => {
        setOpenRooms(prev => 
            prev.includes(id) ? prev.filter(roomId => roomId !== id) : [...prev, id]
        );
    };

    const nextWeek = () => setWeekStart(addWeeks(weekStart, 1));
    const prevWeek = () => setWeekStart(subWeeks(weekStart, 1));

    // Generate week days
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    // Generate time slots (30 min chunks)
    const timeSlots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
        const d = new Date(); d.setHours(h, 0, 0, 0);
        timeSlots.push(format(d, 'HH:mm'));
        d.setMinutes(30);
        timeSlots.push(format(d, 'HH:mm'));
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-slate-500" />
                    <span className="font-semibold text-slate-700">
                        Week of {format(weekStart, 'MMMM d, yyyy')}
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={prevWeek}>
                        <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                        Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextWeek}>
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Rooms List */}
            <div className="space-y-4">
                {rooms.map(room => {
                    const isOpen = openRooms.includes(room.id);
                    // Filter bookings for this room and this week (optimization)
                    const roomBookings = bookings.filter(b => 
                        b.roomId === room.id && 
                        b.endTime > weekStart && 
                        b.startTime < addWeeks(weekStart, 1)
                    );

                    return (
                        <Card key={room.id} className="overflow-hidden">
                            <div 
                                onClick={() => toggleRoom(room.id)}
                                className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 cursor-pointer transition-colors border-b"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn("transition-transform duration-200", isOpen && "rotate-90")}>
                                        <ChevronRight className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">{room.name}</h3>
                                        <p className="text-sm text-muted-foreground">{room.description} • Capacity: {room.capacity}</p>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-500">
                                    {roomBookings.length} bookings this week
                                </div>
                            </div>

                            {isOpen && (
                                <CardContent className="p-0 overflow-x-auto">
                                    <div className="min-w-[800px] bg-slate-100 p-px">
                                        {/* Header */}
                                        <div className="grid grid-cols-8 gap-px bg-slate-200">
                                            <div className="bg-white h-10"></div>
                                            {weekDays.map(day => (
                                                <div key={day.toISOString()} className={cn(
                                                    "bg-white h-10 flex flex-col items-center justify-center font-medium text-sm",
                                                    isSameDay(day, new Date()) && "bg-blue-50 text-blue-600"
                                                )}>
                                                    <span>{format(day, 'EEE')}</span>
                                                    <span className="text-xs text-muted-foreground">{format(day, 'MMM d')}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Grid */}
                                        <div className="grid grid-cols-8 gap-px bg-slate-200">
                                            {/* Time Column */}
                                            <div className="grid grid-rows-[repeat(auto-fill,minmax(2rem,1fr))] gap-px bg-slate-200">
                                                 {timeSlots.map(time => (
                                                     <div key={time} className="bg-white h-8 flex items-center justify-end pr-3 text-xs text-muted-foreground">
                                                         {format(setMinutes(setHours(new Date(), parseInt(time.split(':')[0])), parseInt(time.split(':')[1])), 'h:mm a')}
                                                     </div>
                                                 ))}
                                            </div>

                                            {/* Days Columns */}
                                            {weekDays.map(day => (
                                                <div key={day.toISOString()} className="relative bg-white h-full">
                                                    {/* Render lines for slots */}
                                                    {timeSlots.map(time => (
                                                        <div key={time} className="h-8 border-b border-slate-50" />
                                                    ))}

                                                    {/* Render Bookings Overlays */}
                                                    {roomBookings.map(booking => {
                                                        // Check if booking belongs to this day
                                                        // A booking might span days, but let's assume single day for now as per schema implies (startTime/endTime usually same day)
                                                        // If it spans, we clip it.
                                                        
                                                        const bookingStart = new Date(booking.startTime);
                                                        const bookingEnd = new Date(booking.endTime);

                                                        // Check intersection with this day (00:00 - 23:59)
                                                        const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
                                                        const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999);

                                                        if (bookingEnd <= dayStart || bookingStart >= dayEnd) return null;

                                                        // Calculate position
                                                        // Grid starts at START_HOUR
                                                        const startHour = Math.max(START_HOUR, bookingStart.getHours() + bookingStart.getMinutes()/60);
                                                        const endHour = Math.min(END_HOUR, bookingEnd.getHours() + bookingEnd.getMinutes()/60);
                                                        
                                                        if (endHour <= startHour) return null; // Outside of view

                                                        const top = (startHour - START_HOUR) * 2; // 2rem per hour (since 30min slots are 2rem total? No. 30min slot is h-8 which is 2rem. So 1 hour is 4rem)
                                                        // Wait. timeSlots has 30min intervals. Each is h-8 (2rem).
                                                        // So 1 hour = 2 slots = 4rem.
                                                        
                                                        const durationHours = endHour - startHour;
                                                        const height = durationHours * 4; // 4rem per hour
                                                        const topOffset = (startHour - START_HOUR) * 4;

                                                        return (
                                                            <div 
                                                                key={booking.id}
                                                                className="absolute left-1 right-1 bg-blue-100 border-l-4 border-blue-500 rounded-r px-2 py-1 text-xs overflow-hidden z-10 hover:z-20 shadow-sm transition-all hover:shadow-md cursor-help"
                                                                style={{
                                                                    top: `${topOffset}rem`,
                                                                    height: `${height}rem`
                                                                }}
                                                                title={`${booking.purpose} (${format(bookingStart, 'h:mm a')} - ${format(bookingEnd, 'h:mm a')})`}
                                                            >
                                                                <div className="font-semibold text-blue-700 truncate">
                                                                    {booking.purpose}
                                                                </div>
                                                                <div className="text-blue-600/80 truncate text-[10px]">
                                                                    {format(bookingStart, 'h:mm')} - {format(bookingEnd, 'h:mm a')}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
