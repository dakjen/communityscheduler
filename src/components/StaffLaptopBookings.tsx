'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { Laptop } from 'lucide-react';

type LaptopBookingRow = {
    id: number;
    laptopId: number;
    laptopNumber: number | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    startTime: Date | string;
    endTime: Date | string;
    status: string | null;
};

export default function StaffLaptopBookings({ bookings }: { bookings: LaptopBookingRow[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Laptop Bookings</CardTitle>
                <CardDescription>Who booked which laptop and when.</CardDescription>
            </CardHeader>
            <CardContent>
                {bookings.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No laptop bookings yet.</p>
                ) : (
                    <div className="space-y-3">
                        {bookings.map(b => (
                            <div key={b.id} className="flex items-center gap-3 p-4 border rounded-lg">
                                <div className="bg-blue-50 p-2 rounded-md flex flex-col items-center justify-center min-w-[3rem]">
                                    <Laptop className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-bold text-blue-700">#{b.laptopNumber ?? '?'}</span>
                                </div>
                                <div>
                                    <h4 className="font-medium">{b.customerName}</h4>
                                    <p className="text-xs text-muted-foreground">{b.customerEmail} • {b.customerPhone}</p>
                                    <p className="text-sm font-semibold text-slate-700">
                                        {format(new Date(b.startTime), 'MMM d, h:mm a')} – {format(new Date(b.endTime), 'h:mm a')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
