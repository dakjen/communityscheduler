'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { submitAppointmentRequest } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfDay, addMinutes, parse, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface StaffMember {
    username: string;
    fullName: string | null;
    officeHours: string | null;
    bio: string | null;
}

export function RequestAppointmentForm({ staffMembers }: { staffMembers: StaffMember[] }) {
    const [selectedStaff, setSelectedStaff] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]); // Array of start times "HH:mm"
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        businessName: '', // New state for business name
        reason: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get available slots based on staff and date
    const availableSlots = useMemo(() => {
        if (!selectedStaff || !date) return [];

        const staff = staffMembers.find(s => s.username === selectedStaff);
        if (!staff || !staff.officeHours) return [];

        try {
            const schedule = JSON.parse(staff.officeHours);
            const dayName = format(date, 'EEEE'); // e.g., "Monday"
            const dateKey = format(date, 'yyyy-MM-dd'); // e.g., "2023-10-27"
            
            // Check for specific date override first
            let rawSlots = schedule[dateKey];
            
            // If not found, use default day schedule
            if (rawSlots === undefined) {
                rawSlots = schedule[dayName] || [];
            }
            
            // Sort raw slots
            const sorted = rawSlots.sort();

            return sorted.map((time: string) => {
                const [h, m] = time.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                return {
                    value: time,
                    label: format(d, 'h:mm a')
                };
            });
        } catch (e) {
            console.error("Error parsing schedule", e);
            return [];
        }
    }, [selectedStaff, date, staffMembers]);

    const handleSlotClick = (slotValue: string) => {
        let newSlots = [...selectedSlots];

        if (newSlots.includes(slotValue)) {
            // Deselect
            newSlots = newSlots.filter(s => s !== slotValue);
            // If we deselect the middle of 2 (shouldn't happen with 2), or one of 2, just keep remaining
        } else {
            if (newSlots.length === 0) {
                newSlots = [slotValue];
            } else if (newSlots.length === 1) {
                // Check if contiguous
                const current = parse(newSlots[0], 'HH:mm', new Date());
                const clicked = parse(slotValue, 'HH:mm', new Date());
                const diff = Math.abs(current.getTime() - clicked.getTime()) / (1000 * 60); // minutes

                if (diff === 30) {
                    newSlots.push(slotValue);
                } else {
                    // Not contiguous, start over
                    newSlots = [slotValue];
                }
            } else {
                // Already have 2, start over
                newSlots = [slotValue];
            }
        }
        
        // Sort slots to ensure correct order
        setSelectedSlots(newSlots.sort());
    };

    const getFormattedTimeRange = () => {
        if (selectedSlots.length === 0) return null;
        
        const start = selectedSlots[0];
        const startDate = parse(start, 'HH:mm', new Date());
        
        if (selectedSlots.length === 1) {
            // 30 min duration
            const endDate = addMinutes(startDate, 30);
            return `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
        } else {
            // 2 slots = 60 min duration (assuming 30 min slots)
            // End time is start of last slot + 30
            const last = selectedSlots[selectedSlots.length - 1];
            const lastDate = parse(last, 'HH:mm', new Date());
            const endDate = addMinutes(lastDate, 30);
            return `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedStaff || !date || selectedSlots.length === 0) {
            toast.error('Please complete all selection steps.');
            return;
        }

        setIsSubmitting(true);

        // Construct preferred time string
        // We'll verify slots are available in the backend via the same logic if needed, 
        // but for now we trust the client selection from valid slots.
        
        // Calculate strict range string for storage e.g., "09:00 - 10:00"
        const startStr = selectedSlots[0];
        const lastStr = selectedSlots[selectedSlots.length - 1];
        
        // Calculate end time string (24h)
        const [h, m] = lastStr.split(':').map(Number);
        const endDate = new Date();
        endDate.setHours(h, m + 30, 0, 0);
        const endStr = format(endDate, 'HH:mm');
        
        const preferredTimeRange = `${startStr} - ${endStr}`;

        try {
            await submitAppointmentRequest({
                customerName: formData.name,
                customerEmail: formData.email,
                customerPhone: formData.phone,
                businessName: formData.businessName, // Pass businessName
                preferredDate: format(date, 'yyyy-MM-dd'),
                preferredTime: preferredTimeRange,
                reason: formData.reason,
                preferredStaffUsername: selectedStaff,
            });
            toast.success('Appointment request submitted successfully!');
            // Reset form
            setSelectedStaff('');
            setDate(new Date());
            setSelectedSlots([]);
            setFormData({ name: '', email: '', phone: '', reason: '' });
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit appointment request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: Staff & Date */}
            <div className="lg:col-span-4 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Select Staff & Date</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Select Staff Member</Label>
                            <Select value={selectedStaff} onValueChange={(val) => { setSelectedStaff(val); setSelectedSlots([]); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a staff member" />
                                </SelectTrigger>
                                <SelectContent>
                                    {staffMembers.map((staff) => (
                                        <SelectItem key={staff.username} value={staff.username}>
                                            {staff.fullName || staff.username}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedStaff && (() => {
                                const staff = staffMembers.find(s => s.username === selectedStaff);
                                return staff?.bio ? (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Ask about: {staff.bio}
                                    </p>
                                ) : null;
                            })()}
                        </div>

                        <div className="flex justify-center border rounded-md p-2">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => { setDate(d); setSelectedSlots([]); }}
                                className="rounded-md"
                                disabled={(date) => date < startOfDay(new Date())}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MIDDLE COLUMN: Time Selection */}
            <div className="lg:col-span-4">
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>2. Select Time</CardTitle>
                        <CardDescription>
                            {date ? format(date, 'PPPP') : 'Select a date first'}
                            <br/>
                            <span className="text-xs text-muted-foreground">Max 1 hour (2 slots)</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!selectedStaff ? (
                            <div className="flex items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-md">
                                Select Staff first
                            </div>
                        ) : !date ? (
                            <div className="flex items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-md">
                                Select Date first
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                                {availableSlots.length > 0 ? (
                                    availableSlots.map((slot) => {
                                        const isSelected = selectedSlots.includes(slot.value);
                                        return (
                                            <button
                                                key={slot.value}
                                                type="button"
                                                onClick={() => handleSlotClick(slot.value)}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 rounded-md text-sm transition-colors border",
                                                    isSelected
                                                        ? "bg-primary text-white border-primary"
                                                        : "hover:bg-secondary/20 border-gray-200"
                                                )}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span>{slot.label}</span>
                                                    {isSelected && <span className="text-xs font-medium">Selected</span>}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <p className="text-center text-muted-foreground py-4">
                                        No available office hours on this day.
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: Details Form */}
            <div className="lg:col-span-4">
                <Card>
                    <CardHeader>
                        <CardTitle>3. Your Details</CardTitle>
                        <CardDescription>
                            {selectedSlots.length > 0 ? (
                                <span className="font-medium text-slate-900">
                                    Appointment: {getFormattedTimeRange()}
                                </span>
                            ) : 'Select a time slot'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input 
                                    id="name" 
                                    value={formData.name} 
                                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessName">Business Name (Optional)</Label>
                                <Input 
                                    id="businessName" 
                                    value={formData.businessName} 
                                    onChange={(e) => setFormData({...formData, businessName: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input 
                                    id="email" 
                                    type="email" 
                                    value={formData.email} 
                                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input 
                                    id="phone" 
                                    type="tel" 
                                    value={formData.phone} 
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reason">Reason for Appointment</Label>
                                <Textarea 
                                    id="reason" 
                                    value={formData.reason} 
                                    onChange={(e) => setFormData({...formData, reason: e.target.value})} 
                                    required 
                                    rows={3}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting || selectedSlots.length === 0}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Submit Request
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
