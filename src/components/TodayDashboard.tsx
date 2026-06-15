'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isToday, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { parseSchedule, resolveDaySlots } from '@/lib/availability';
import { programOccursOn } from '@/lib/programs';

const SERVICES = [
    {
        title: 'Laptop & Computer Access',
        description: 'Free public computers, plus reservable laptops for up to 2 hours. Leave your ID or wallet with the PCC admin to check out a laptop — items returned when the laptop is returned.',
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
    weeklyHours: string;
};

const DAY_KEYS_TD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
function getTodayHours(weeklyHoursJson: string): { open: string; close: string } | null {
    try {
        const wh = JSON.parse(weeklyHoursJson) as Record<string, { open: string; close: string; closed: boolean }>;
        const day = wh[DAY_KEYS_TD[new Date().getDay()]];
        if (!day || day.closed) return null;
        return { open: day.open, close: day.close };
    } catch { return null; }
}

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
    roomId?: number | null;
    endTime?: string | null;
    roomName?: string | null;
};

function getStaffScheduleToday(staff: StaffMember): string[] | null {
    // Blackout-aware: time-off ranges override recurring/specific availability.
    const slots = resolveDaySlots(parseSchedule(staff.officeHours), new Date());
    return slots.length > 0 ? slots : null;
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

    // Programming for the whole current week (Sun–Sat), grouped by day.
    const weekProgramsByDay = eachDayOfInterval({
        start: startOfWeek(today, { weekStartsOn: 0 }),
        end: endOfWeek(today, { weekStartsOn: 0 }),
    })
        .map((day) => ({
            day,
            items: programs
                .filter((p) => programOccursOn(p, day))
                .sort((a, b) => a.time.localeCompare(b.time)),
        }))
        .filter((d) => d.items.length > 0);

    const weekHasPrograms = weekProgramsByDay.length > 0;

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-lg font-semibold tracking-tight text-gray-800 leading-tight">{todayStr}</h1>
                <p className="text-xs text-gray-400 leading-tight">Today&apos;s Schedule</p>
            </div>

            {/* Services row — static cards across the top */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {SERVICES.map((s) => (
                    <div
                        key={s.title}
                        className="bg-primary text-primary-foreground rounded-md px-2 py-1.5 flex flex-col gap-0.5"
                    >
                        <h3 className="text-[11px] font-semibold leading-tight">{s.title}</h3>
                        <p className="text-[10px] text-primary-foreground/80 leading-snug">{s.description}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Room Bookings */}
                <Card className="border">
                    <CardHeader className="pb-2 pt-3 border-b">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#b00d0f' }} />
                            Room Bookings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 pb-3">
                        {rooms.length === 0 ? (
                            <p className="text-gray-400 text-sm">No rooms configured.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {rooms.map((room) => {
                                    const roomBookings = bookingsByRoom.get(room.id) || [];
                                    const isBooked = roomBookings.length > 0;

                                    return (
                                        <div key={room.id} className="border rounded-md px-2 py-1.5">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-sm font-semibold text-gray-800">{room.name}</h3>
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
                                                <ul className="space-y-1 mt-1">
                                                    {roomBookings.map((b) => (
                                                        <li key={b.id} className="bg-blue-50 rounded px-2 py-1 border border-blue-100">
                                                            <div className="text-xs font-semibold text-blue-800">
                                                                {format(new Date(b.startTime), 'h:mm a')} –{' '}
                                                                {format(new Date(b.endTime), 'h:mm a')}
                                                            </div>
                                                            <p className="text-xs text-gray-700">{b.purpose}</p>
                                                            <p className="text-[10px] text-gray-400">{b.customerName}</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (() => {
                                                const todayH = getTodayHours(room.weeklyHours);
                                                return (
                                                    <p className="text-xs text-gray-400">
                                                        {todayH ? `Open ${formatTime(todayH.open)} – ${formatTime(todayH.close)}` : 'Closed today'}
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Staff Available */}
                <Card className="border">
                    <CardHeader className="pb-2 pt-3 border-b">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#431e1e' }} />
                            Staff Available
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 pb-3">
                        {staffToday.length === 0 ? (
                            <p className="text-gray-400 text-sm">No staff scheduled for today.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {staffToday.map((s) => (
                                    <div key={s.username} className="border rounded-md px-2 py-1.5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-gray-800">
                                                {s.fullName || s.username}
                                            </h3>
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                {s.role === 'HTH' ? 'SERVICES' : 'STAFF'}
                                            </span>
                                        </div>
                                        {s.serviceType && (
                                            <p className="text-xs text-emerald-600">{s.serviceType}</p>
                                        )}
                                        <p className="text-xs font-semibold text-gray-600">
                                            {formatTimeRange(s.todaySlots)}
                                        </p>
                                        {s.bio && (
                                            <p className="text-[10px] text-gray-400">{s.bio}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Programming — this week */}
                <Card className="border">
                    <CardHeader className="pb-2 pt-3 border-b">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#3b3b3b' }} />
                            Programming This Week
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 pb-3">
                        {!weekHasPrograms ? (
                            <p className="text-gray-400 text-sm">No programs scheduled this week.</p>
                        ) : (
                            <div className="space-y-3">
                                {weekProgramsByDay.map(({ day, items }) => (
                                    <div key={format(day, 'yyyy-MM-dd')}>
                                        <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isSameDay(day, today) ? 'text-primary' : 'text-gray-400'}`}>
                                            {format(day, 'EEEE, MMM d')}{isSameDay(day, today) && ' • Today'}
                                        </div>
                                        <div className="space-y-1.5">
                                            {items.map((p) => (
                                                <div key={`${p.id}-${format(day, 'yyyy-MM-dd')}`} className="border rounded-md px-2 py-1.5">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="text-base font-semibold text-gray-800">{p.name}</h3>
                                                        {p.isRecurring && (
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                                                                RECURRING
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700">
                                                        {formatTime(p.time)}{p.endTime ? ` – ${formatTime(p.endTime)}` : ''}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-0.5">
                                                        Led by {p.responsibleParty}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {p.roomName ? `${p.roomName} • ` : ''}{p.attendees}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
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
