'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateAppointmentStatus } from '@/app/actions';
import { toast } from 'sonner';
import { Check, X, Clock, User } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';

type AppointmentRequest = {
    id: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    businessName?: string | null; // Added businessName
    preferredDate: string;
    preferredTime: string;
    reason: string;
    status: 'pending' | 'confirmed' | 'rejected';
    createdAt: Date | null;
    preferredStaffUsername?: string | null;
    staffName?: string | null;
};

export default function AppointmentRequests({ requests }: { requests: AppointmentRequest[] }) {
    
    const handleStatusUpdate = async (id: number, status: 'confirmed' | 'rejected') => {
        try {
            await updateAppointmentStatus(id, status);
            toast.success(`Appointment ${status}`);
        } catch (e) {
            toast.error('Failed to update status');
        }
    };

    if (requests.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    No appointment requests found.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {requests.map((request) => {
                const apptDate = new Date(request.preferredDate);
                const isPast = isBefore(apptDate, startOfDay(new Date()));

                let statusBadge;
                if (isPast) {
                    statusBadge = (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border bg-gray-100 text-gray-600 border-gray-200">
                            Past
                        </div>
                    );
                } else if (request.status === 'confirmed') {
                    statusBadge = (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border bg-green-100 text-green-700 border-green-200">
                            Approved
                        </div>
                    );
                } else if (request.status === 'rejected') {
                    statusBadge = (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border bg-red-100 text-red-700 border-red-200">
                            Rejected
                        </div>
                    );
                } else {
                    statusBadge = (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border bg-yellow-100 text-yellow-700 border-yellow-200">
                            Pending
                        </div>
                    );
                }

                return (
                    <Card key={request.id} className="overflow-hidden">
                        <div className="flex flex-col md:flex-row">
                            <div className="p-6 flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-lg">{request.customerName}</h3>
                                        {request.businessName && (
                                            <p className="text-sm text-muted-foreground font-medium pt-1">
                                                Business: <span className="text-foreground">{request.businessName}</span>
                                            </p>
                                        )}
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p>{request.customerEmail} • {request.customerPhone}</p>
                                            <p className="flex items-center gap-2 mt-2 font-medium text-slate-900">
                                                <Clock className="h-4 w-4" />
                                                {format(new Date(request.preferredDate), 'MMM d, yyyy')} • {request.preferredTime}
                                            </p>
                                            {request.preferredStaffUsername && (
                                                <p className="flex items-center gap-2 mt-1 text-primary font-medium">
                                                    <User className="h-4 w-4" />
                                                    To: {request.staffName || request.preferredStaffUsername}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {statusBadge}
                                </div>
                                
                                <div className="bg-slate-50 p-3 rounded-md text-sm border">
                                    <span className="font-semibold text-slate-700">Reason:</span> {request.reason}
                                </div>
                            </div>

                            {request.status === 'pending' && !isPast && (
                                <div className="bg-slate-50 p-6 flex flex-row md:flex-col justify-center gap-2 border-t md:border-t-0 md:border-l">
                                    <Button 
                                        className="w-full bg-green-600 hover:bg-green-700" 
                                        onClick={() => handleStatusUpdate(request.id, 'confirmed')}
                                    >
                                        <Check className="mr-2 h-4 w-4" /> Confirm
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                        onClick={() => handleStatusUpdate(request.id, 'rejected')}
                                    >
                                        <X className="mr-2 h-4 w-4" /> Reject
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
