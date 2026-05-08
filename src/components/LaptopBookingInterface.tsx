'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createLaptopBooking, getLaptopBookingsForDate } from '@/app/actions';
import { toast } from 'sonner';
import { format, addMinutes, setHours, setMinutes, isBefore, isAfter, startOfDay } from 'date-fns';
import { Loader2, Laptop } from 'lucide-react';
import { useUser } from "@clerk/nextjs";
import { cn } from '@/lib/utils';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayHours = { open: string; close: string; closed: boolean };
type WeeklyHoursMap = Record<typeof DAY_KEYS[number], DayHours>;

function getDayHours(weeklyHoursJson: string, date: Date): DayHours | null {
    try {
        const wh = JSON.parse(weeklyHoursJson) as WeeklyHoursMap;
        const day = wh[DAY_KEYS[date.getDay()]];
        if (!day || day.closed) return null;
        return day;
    } catch { return null; }
}

type Slot = { time: Date; label: string; freeCount: number; isSelected: boolean };

const TOTAL_LAPTOPS = 10; // matches seeded count; UI only — server is authoritative
const MAX_HOURS = 2;

export default function LaptopBookingInterface({ laptopHours }: { laptopHours: string }) {
    const { user } = useUser();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [selectionStart, setSelectionStart] = useState<Date | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);

    const [existingBookings, setExistingBookings] = useState<{ laptopId: number; startTime: Date; endTime: Date }[]>([]);
    const [isLoadingBookings, setIsLoadingBookings] = useState(false);

    const [formData, setFormData] = useState({ name: '', email: '', phone: '', idAgreed: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState<{ laptopNumber: number; start: Date; end: Date } | null>(null);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: prev.name || user.fullName || '',
                email: prev.email || user.primaryEmailAddress?.emailAddress || '',
            }));
        }
    }, [user]);

    useEffect(() => {
        async function fetchBookings() {
            if (!date) return;
            setIsLoadingBookings(true);
            try {
                const rows = await getLaptopBookingsForDate(date);
                setExistingBookings(rows.map(r => ({ laptopId: r.laptopId, startTime: new Date(r.startTime), endTime: new Date(r.endTime) })));
                setSelectionStart(null);
                setSelectionEnd(null);
            } catch (e) {
                console.error(e);
                toast.error('Failed to load availability');
            } finally {
                setIsLoadingBookings(false);
            }
        }
        fetchBookings();
    }, [date]);

    const slots: Slot[] = useMemo(() => {
        if (!date) return [];
        const dh = getDayHours(laptopHours, date);
        if (!dh) return [];

        const [openH, openM] = dh.open.split(':').map(Number);
        const [closeH, closeM] = dh.close.split(':').map(Number);
        let current = setMinutes(setHours(date, openH), openM);
        const end = setMinutes(setHours(date, closeH), closeM);

        const out: Slot[] = [];
        while (isBefore(current, end)) {
            const next = addMinutes(current, 30);
            const occupiedLaptopIds = new Set(
                existingBookings
                    .filter(b => isBefore(current, b.endTime) && isAfter(next, b.startTime))
                    .map(b => b.laptopId)
            );
            const freeCount = Math.max(0, TOTAL_LAPTOPS - occupiedLaptopIds.size);

            let isSelected = false;
            if (selectionStart) {
                if (!selectionEnd) {
                    isSelected = current.getTime() === selectionStart.getTime();
                } else {
                    const s = isBefore(selectionStart, selectionEnd) ? selectionStart : selectionEnd;
                    const e = isBefore(selectionStart, selectionEnd) ? selectionEnd : selectionStart;
                    isSelected = (isAfter(current, s) || current.getTime() === s.getTime()) && isBefore(current, e);
                }
            }

            out.push({ time: current, label: format(current, 'h:mm a'), freeCount, isSelected });
            current = next;
        }
        return out;
    }, [date, laptopHours, existingBookings, selectionStart, selectionEnd]);

    const handleSlotClick = (slot: Slot) => {
        if (slot.freeCount === 0) return;

        if (!selectionStart || (selectionStart && selectionEnd)) {
            setSelectionStart(slot.time);
            setSelectionEnd(null);
            return;
        }
        const start = isBefore(selectionStart, slot.time) ? selectionStart : slot.time;
        const endOfClicked = addMinutes(isBefore(selectionStart, slot.time) ? slot.time : selectionStart, 30);

        const durationHours = (endOfClicked.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (durationHours > MAX_HOURS) {
            toast.error(`Laptop reservations are limited to ${MAX_HOURS} hours.`);
            setSelectionStart(slot.time);
            setSelectionEnd(null);
            return;
        }
        setSelectionStart(start);
        setSelectionEnd(endOfClicked);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !selectionStart || !formData.phone || !formData.name || !formData.email) {
            toast.error('Please fill in all required fields');
            return;
        }
        if (!formData.idAgreed) {
            toast.error('You must agree to leave your ID or wallet with the PCC admin.');
            return;
        }

        const finalStart = selectionStart;
        const finalEnd = selectionEnd || addMinutes(selectionStart, 30);

        setIsSubmitting(true);
        try {
            const result = await createLaptopBooking({
                userId: user?.id,
                customerName: formData.name,
                customerEmail: formData.email,
                customerPhone: formData.phone,
                idAgreed: formData.idAgreed,
                startTime: finalStart,
                endTime: finalEnd,
            });
            if (result.success) {
                setConfirmation({ laptopNumber: result.laptopNumber, start: finalStart, end: finalEnd });
                toast.success(`Reserved laptop #${result.laptopNumber}`);
                setSelectionStart(null);
                setSelectionEnd(null);
                setFormData(prev => ({ ...prev, phone: '', idAgreed: false }));
                const rows = await getLaptopBookingsForDate(date);
                setExistingBookings(rows.map(r => ({ laptopId: r.laptopId, startTime: new Date(r.startTime), endTime: new Date(r.endTime) })));
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to reserve laptop';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const todayHours = date ? getDayHours(laptopHours, date) : null;

    return (
        <div className="grid lg:grid-cols-12 gap-8">
            {/* LEFT: Date */}
            <div className="lg:col-span-4 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Select a Date</CardTitle>
                        <CardDescription>Reserve up to {MAX_HOURS} hours.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-center">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                className="rounded-md border"
                                disabled={(d) => d < startOfDay(new Date())}
                            />
                        </div>
                        {date && (
                            <p className="text-xs font-medium text-slate-900">
                                {todayHours
                                    ? `${format(date, 'EEEE')}: ${todayHours.open} – ${todayHours.close}`
                                    : `Closed ${format(date, 'EEEE')}`}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* MIDDLE: Time slots */}
            <div className="lg:col-span-4">
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>2. Select Time</CardTitle>
                        <CardDescription>{date ? format(date, 'PPPP') : 'Select a date first'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingBookings ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : slots.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-md">
                                {todayHours ? 'No times available' : 'Closed this day'}
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                                {slots.map((slot, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSlotClick(slot)}
                                        disabled={slot.freeCount === 0}
                                        className={cn(
                                            "w-full text-left px-4 py-3 rounded-md text-sm transition-colors border",
                                            slot.freeCount === 0
                                                ? "bg-gray-100 text-gray-400 border-transparent cursor-not-allowed"
                                                : slot.isSelected
                                                    ? "bg-primary text-white border-primary"
                                                    : "hover:bg-secondary/20 border-gray-200"
                                        )}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{slot.label}</span>
                                            <span className={cn("text-xs font-medium", slot.freeCount === 0 ? "" : slot.isSelected ? "text-white/90" : "text-slate-500")}>
                                                {slot.freeCount === 0 ? 'Full' : `${slot.freeCount} free`}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT: Form */}
            <div className="lg:col-span-4">
                <Card>
                    <CardHeader>
                        <CardTitle>3. Your Details</CardTitle>
                        <CardDescription>
                            {selectionStart ? (
                                <span className="font-medium text-slate-900">
                                    {format(selectionStart, 'h:mm a')} – {selectionEnd ? format(selectionEnd, 'h:mm a') : format(addMinutes(selectionStart, 30), 'h:mm a')}
                                </span>
                            ) : 'Select a time slot'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {confirmation ? (
                            <div className="rounded-md border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Laptop className="h-5 w-5 text-blue-600" />
                                    <h4 className="font-semibold text-blue-900">Laptop #{confirmation.laptopNumber} reserved</h4>
                                </div>
                                <p className="text-sm text-blue-900">
                                    {format(confirmation.start, 'PPP')}<br/>
                                    {format(confirmation.start, 'h:mm a')} – {format(confirmation.end, 'h:mm a')}
                                </p>
                                <p className="text-xs text-blue-900">
                                    Bring a valid ID or wallet to the PCC admin to check out laptop #{confirmation.laptopNumber}.
                                </p>
                                <Button variant="outline" onClick={() => setConfirmation(null)}>Reserve another</Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="lname">Full Name</Label>
                                    <Input id="lname" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lemail">Email</Label>
                                    <Input id="lemail" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lphone">Phone Number</Label>
                                    <Input id="lphone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                                </div>

                                <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={formData.idAgreed}
                                        onChange={(e) => setFormData({ ...formData, idAgreed: e.target.checked })}
                                        className="h-4 w-4 mt-0.5"
                                        required
                                    />
                                    <span className="text-sm text-slate-700">
                                        I agree to give my ID or wallet to the PCC admin in order to receive and use the laptop.
                                    </span>
                                </label>

                                <Button type="submit" className="w-full" disabled={isSubmitting || !selectionStart}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Reserve Laptop
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
