'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isToday } from 'date-fns';

const SERVICES = [
    {
        title: 'Public Computer Access',
        description: 'Free access to computers with internet and basic software.',
    },
    {
        title: 'Printing & Copying',
        description: 'Black & white printing available for small fees.',
    },
    {
        title: 'Entrepreneurship & Small Business Support',
        description: 'Meet with our Services staff for support and guidance.',
    },
    {
        title: 'Employment Clinical Services',
        description: 'Resume assistance, job search support, and career counseling.',
    },
    {
        title: 'Room Booking',
        description: 'Book a room for your event or meeting at the PCC Building.',
    },
];

type Booking = {
    id: number;
    roomId: number | null;
    roomName: string | null;
    customerName: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
    status: string | null;
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

type StaffMember = {
    username: string;
    fullName: string | null;
    officeHours: string | null;
    bio: string | null;
    role: string | null;
    serviceType: string | null;
};

type Program = {
    id: number;
    name: string;
    responsibleParty: string;
    date: string;
    time: string;
    isRecurring: boolean;
    recurrencePattern: string | null;
    attendees: string;
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getStaffScheduleToday(staff: StaffMember): string[] | null {
    if (!staff.officeHours) return null;

    try {
        const schedule = JSON.parse(staff.officeHours);
        const today = new Date();
        const todayDateStr = format(today, 'yyyy-MM-dd');
        const dayName = DAYS_OF_WEEK[today.getDay()];

        if (schedule[todayDateStr]) {
            const slots = schedule[todayDateStr];
            return slots.length > 0 ? slots : null;
        }

        if (schedule[dayName]) {
            const slots = schedule[dayName];
            return slots.length > 0 ? slots : null;
        }

        return null;
    } catch {
        return null;
    }
}

function formatTimeRange(slots: string[]): string {
    if (slots.length === 0) return '';
    const sorted = [...slots].sort();
    const first = sorted[0];
    const lastSlot = sorted[sorted.length - 1];
    const [h, m] = lastSlot.split(':').map(Number);
    const endMin = m + 30;
    const endHour = h + Math.floor(endMin / 60);
    const endMinStr = String(endMin % 60).padStart(2, '0');
    const end = `${String(endHour).padStart(2, '0')}:${endMinStr}`;

    return `${formatTime(first)} – ${formatTime(end)}`;
}

function formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function TodayDashboard({
    rooms,
    bookings,
    staff,
    programs = [],
}: {
    rooms: Room[];
    bookings: Booking[];
    staff: StaffMember[];
    programs?: Program[];
}) {
    const [activeService, setActiveService] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveService((prev) => (prev + 1) % SERVICES.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const today = new Date();
    const todayStr = format(today, 'EEEE, MMMM d, yyyy');

    const todaysBookings = bookings.filter((b) => {
        const start = new Date(b.startTime);
        return isToday(start) && b.status !== 'cancelled';
    });

    const bookingsByRoom = new Map<number, typeof todaysBookings>();
    for (const booking of todaysBookings) {
        if (booking.roomId == null) continue;
        const existing = bookingsByRoom.get(booking.roomId) || [];
        existing.push(booking);
        bookingsByRoom.set(booking.roomId, existing);
    }

    for (const [, roomBookings] of bookingsByRoom) {
        roomBookings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    const staffToday = staff
        .map((s) => {
            const slots = getStaffScheduleToday(s);
            if (!slots) return null;
            return { ...s, todaySlots: slots };
        })
        .filter(Boolean) as (StaffMember & { todaySlots: string[] })[];

    // Sort programs by time
    const sortedPrograms = [...programs].sort((a, b) => a.time.localeCompare(b.time));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center py-1">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-800">{todayStr}</h1>
                <p className="text-sm text-gray-400">Today&apos;s Schedule</p>
            </div>

            {/* Services Banner */}
            <div className="bg-gray-800 rounded-lg p-4 text-white overflow-hidden">
                <div className="flex items-center justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Our Services</p>
                        <h3 className="text-lg font-semibold transition-all duration-500">{SERVICES[activeService].title}</h3>
                        <p className="text-sm text-gray-300 mt-0.5 transition-all duration-500">{SERVICES[activeService].description}</p>
                    </div>
                    <div className="flex gap-1.5 ml-6 shrink-0">
                        {SERVICES.map((_, i) => (
                            <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                    i === activeService ? 'bg-white w-5' : 'bg-gray-600'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Room Bookings */}
                <Card className="border">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                            Room Bookings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {rooms.length === 0 ? (
                            <p className="text-gray-400 text-sm">No rooms configured.</p>
                        ) : (
                            <div className="space-y-3">
                                {rooms.map((room) => {
                                    const roomBookings = bookingsByRoom.get(room.id) || [];
                                    const isBooked = roomBookings.length > 0;

                                    return (
                                        <div key={room.id} className="border rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-base font-semibold text-gray-800">{room.name}</h3>
                                                <span
                                                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                        isBooked
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'bg-green-50 text-green-700'
                                                    }`}
                                                >
                                                    {isBooked ? `${roomBookings.length} BOOKING${roomBookings.length > 1 ? 'S' : ''}` : 'AVAILABLE'}
                                                </span>
                                            </div>
                                            {isBooked ? (
                                                <ul className="space-y-2 mt-2">
                                                    {roomBookings.map((b) => (
                                                        <li key={b.id} className="bg-blue-50 rounded-md p-2.5 border border-blue-100">
                                                            <div className="text-sm font-semibold text-blue-800">
                                                                {format(new Date(b.startTime), 'h:mm a')} –{' '}
                                                                {format(new Date(b.endTime), 'h:mm a')}
                                                            </div>
                                                            <p className="text-sm text-gray-700 mt-0.5">{b.purpose}</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">{b.customerName}</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-gray-400">
                                                    Open {formatTime(room.openTime)} – {formatTime(room.closeTime)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Staff Available */}
                <Card className="border">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
                            Staff Available
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {staffToday.length === 0 ? (
                            <p className="text-gray-400 text-sm">No staff scheduled for today.</p>
                        ) : (
                            <div className="space-y-3">
                                {staffToday.map((s) => (
                                    <div key={s.username} className="border rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-gray-800">
                                                {s.fullName || s.username}
                                            </h3>
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                {s.role === 'HTH' ? 'SERVICES' : 'STAFF'}
                                            </span>
                                        </div>
                                        {s.serviceType && (
                                            <p className="text-sm text-emerald-600 mt-1">{s.serviceType}</p>
                                        )}
                                        <p className="text-sm font-semibold text-gray-600 mt-1">
                                            {formatTimeRange(s.todaySlots)}
                                        </p>
                                        {s.bio && (
                                            <p className="text-xs text-gray-400 mt-0.5">{s.bio}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Programming */}
                <Card className="border">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-purple-500" />
                            Programming
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {sortedPrograms.length === 0 ? (
                            <p className="text-gray-400 text-sm">No programs scheduled for today.</p>
                        ) : (
                            <div className="space-y-3">
                                {sortedPrograms.map((p) => (
                                    <div key={p.id} className="border rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-base font-semibold text-gray-800">{p.name}</h3>
                                            {p.isRecurring && (
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                                                    RECURRING
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-semibold text-purple-700">
                                            {formatTime(p.time)}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-0.5">
                                            Led by {p.responsibleParty}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {p.attendees}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
