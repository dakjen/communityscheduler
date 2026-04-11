'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isToday, parseISO } from 'date-fns';

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

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getStaffScheduleToday(staff: StaffMember): string[] | null {
    if (!staff.officeHours) return null;

    try {
        const schedule = JSON.parse(staff.officeHours);
        const today = new Date();
        const todayDateStr = format(today, 'yyyy-MM-dd');
        const dayName = DAYS_OF_WEEK[today.getDay()];

        // Check for specific date override first
        if (schedule[todayDateStr]) {
            const slots = schedule[todayDateStr];
            return slots.length > 0 ? slots : null;
        }

        // Fall back to recurring day schedule
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
    // Last slot is a 30-min block start, so add 30 min for end time
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
}: {
    rooms: Room[];
    bookings: Booking[];
    staff: StaffMember[];
}) {
    const today = new Date();
    const todayStr = format(today, 'EEEE, MMMM d, yyyy');

    // Filter bookings to today only, exclude cancelled
    const todaysBookings = bookings.filter((b) => {
        const start = new Date(b.startTime);
        return isToday(start) && b.status !== 'cancelled';
    });

    // Group bookings by room
    const bookingsByRoom = new Map<number, typeof todaysBookings>();
    for (const booking of todaysBookings) {
        if (booking.roomId == null) continue;
        const existing = bookingsByRoom.get(booking.roomId) || [];
        existing.push(booking);
        bookingsByRoom.set(booking.roomId, existing);
    }

    // Sort bookings within each room by time
    for (const [, roomBookings] of bookingsByRoom) {
        roomBookings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    // Get staff who are in today
    const staffToday = staff
        .map((s) => {
            const slots = getStaffScheduleToday(s);
            if (!slots) return null;
            return { ...s, todaySlots: slots };
        })
        .filter(Boolean) as (StaffMember & { todaySlots: string[] })[];

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-800">{todayStr}</h2>
                <p className="text-gray-500 mt-1">Today&apos;s schedule at a glance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Room Bookings */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                            Room Bookings Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {rooms.length === 0 ? (
                            <p className="text-gray-500 text-sm">No rooms configured.</p>
                        ) : (
                            <div className="space-y-4">
                                {rooms.map((room) => {
                                    const roomBookings = bookingsByRoom.get(room.id) || [];
                                    const isBooked = roomBookings.length > 0;

                                    return (
                                        <div key={room.id} className="border rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-medium text-gray-800">{room.name}</h3>
                                                <span
                                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                        isBooked
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-green-100 text-green-700'
                                                    }`}
                                                >
                                                    {isBooked ? `${roomBookings.length} booking${roomBookings.length > 1 ? 's' : ''}` : 'Available'}
                                                </span>
                                            </div>
                                            {isBooked ? (
                                                <ul className="space-y-2 mt-2">
                                                    {roomBookings.map((b) => (
                                                        <li key={b.id} className="text-sm bg-gray-50 rounded p-2">
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-medium text-gray-700">
                                                                    {format(new Date(b.startTime), 'h:mm a')} –{' '}
                                                                    {format(new Date(b.endTime), 'h:mm a')}
                                                                </span>
                                                            </div>
                                                            <p className="text-gray-600 mt-0.5">{b.purpose}</p>
                                                            <p className="text-gray-400 text-xs mt-0.5">Booked by {b.customerName}</p>
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

                {/* Staff In Today */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
                            Staff Available Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {staffToday.length === 0 ? (
                            <p className="text-gray-500 text-sm">No staff members scheduled for today.</p>
                        ) : (
                            <div className="space-y-3">
                                {staffToday.map((s) => (
                                    <div key={s.username} className="border rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-medium text-gray-800">
                                                {s.fullName || s.username}
                                            </h3>
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                {s.role === 'HTH' ? 'Services' : 'Staff'}
                                            </span>
                                        </div>
                                        {s.serviceType && (
                                            <p className="text-sm font-medium text-emerald-700 mt-1">{s.serviceType}</p>
                                        )}
                                        <p className="text-sm text-gray-600 mt-1">
                                            {formatTimeRange(s.todaySlots)}
                                        </p>
                                        {s.bio && (
                                            <p className="text-xs text-gray-400 mt-1">{s.bio}</p>
                                        )}
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
