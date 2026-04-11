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
}: {
    rooms: Room[];
    bookings: Booking[];
    staff: StaffMember[];
}) {
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

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center py-4">
                <h1 className="text-5xl font-bold tracking-tight text-gray-900">{todayStr}</h1>
                <p className="text-xl text-gray-500 mt-2 font-medium">Today&apos;s Schedule</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Room Bookings */}
                <Card className="border-2">
                    <CardHeader className="pb-4 border-b">
                        <CardTitle className="text-2xl font-bold flex items-center gap-3">
                            <span className="inline-block w-4 h-4 rounded-full bg-blue-500" />
                            Room Bookings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {rooms.length === 0 ? (
                            <p className="text-gray-400 text-lg">No rooms configured.</p>
                        ) : (
                            <div className="space-y-5">
                                {rooms.map((room) => {
                                    const roomBookings = bookingsByRoom.get(room.id) || [];
                                    const isBooked = roomBookings.length > 0;

                                    return (
                                        <div key={room.id} className="border-2 rounded-xl p-5">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-xl font-bold text-gray-900">{room.name}</h3>
                                                <span
                                                    className={`text-sm font-bold px-3 py-1 rounded-full ${
                                                        isBooked
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-green-100 text-green-800'
                                                    }`}
                                                >
                                                    {isBooked ? `${roomBookings.length} BOOKING${roomBookings.length > 1 ? 'S' : ''}` : 'AVAILABLE'}
                                                </span>
                                            </div>
                                            {isBooked ? (
                                                <ul className="space-y-3 mt-3">
                                                    {roomBookings.map((b) => (
                                                        <li key={b.id} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                                            <div className="text-lg font-bold text-blue-900">
                                                                {format(new Date(b.startTime), 'h:mm a')} –{' '}
                                                                {format(new Date(b.endTime), 'h:mm a')}
                                                            </div>
                                                            <p className="text-base font-semibold text-gray-800 mt-1">{b.purpose}</p>
                                                            <p className="text-sm text-gray-500 mt-1 font-medium">{b.customerName}</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-base text-gray-500 font-medium">
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
                <Card className="border-2">
                    <CardHeader className="pb-4 border-b">
                        <CardTitle className="text-2xl font-bold flex items-center gap-3">
                            <span className="inline-block w-4 h-4 rounded-full bg-emerald-500" />
                            Staff Available
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {staffToday.length === 0 ? (
                            <p className="text-gray-400 text-lg">No staff scheduled for today.</p>
                        ) : (
                            <div className="space-y-4">
                                {staffToday.map((s) => (
                                    <div key={s.username} className="border-2 rounded-xl p-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xl font-bold text-gray-900">
                                                {s.fullName || s.username}
                                            </h3>
                                            <span className="text-sm font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                                                {s.role === 'HTH' ? 'SERVICES' : 'STAFF'}
                                            </span>
                                        </div>
                                        {s.serviceType && (
                                            <p className="text-base font-semibold text-emerald-700 mt-2">{s.serviceType}</p>
                                        )}
                                        <p className="text-lg font-bold text-gray-700 mt-2">
                                            {formatTimeRange(s.todaySlots)}
                                        </p>
                                        {s.bio && (
                                            <p className="text-sm text-gray-500 mt-1 font-medium">{s.bio}</p>
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
