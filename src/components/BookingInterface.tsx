'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createBooking, getBookings } from '@/app/actions';
import { toast } from 'sonner';
import { format, addMinutes, isSameDay, setHours, setMinutes, isBefore, isAfter, startOfDay } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useUser } from "@clerk/nextjs";
import { cn } from '@/lib/utils';

type Room = {
  id: number;
  name: string;
  description: string | null;
  capacity: number;
  imageUrl: string | null;
  openTime: string; // 24-hour format
  closeTime: string; // 24-hour format
};

type TimeSlot = {
  time: Date;
  label: string;
  isBooked: boolean;
  isSelected: boolean;
};

export default function BookingInterface({ rooms }: { rooms: Room[] }) {
  const { user } = useUser();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  
  // Time Selection State
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
  
  // Bookings Data
  const [existingBookings, setExistingBookings] = useState<{startTime: Date, endTime: Date}[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    purpose: '',
    needPccHelp: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form
  useEffect(() => {
    if (user) {
        setFormData(prev => ({
            ...prev,
            name: user.fullName || '',
            email: user.primaryEmailAddress?.emailAddress || ''
        }));
    }
  }, [user]);

  // Fetch bookings when Date or Room changes
  useEffect(() => {
    async function fetchBookings() {
      if (!date || !selectedRoom) return;
      setIsLoadingBookings(true);
      try {
        const bookings = await getBookings(parseInt(selectedRoom), date);
        setExistingBookings(bookings);
        // Reset selection on fetch
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
  }, [date, selectedRoom]);

  // Generate Time Slots
  const timeSlots = useMemo(() => {
    if (!date || !selectedRoom) return [];
    
    const room = rooms.find(r => r.id.toString() === selectedRoom);
    if (!room) return [];

    const [openH, openM] = room.openTime.split(':').map(Number);
    const [closeH, closeM] = room.closeTime.split(':').map(Number);

    let current = setMinutes(setHours(date, openH), openM);
    const end = setMinutes(setHours(date, closeH), closeM);
    
    const slots: TimeSlot[] = [];

    while (isBefore(current, end)) {
        const next = addMinutes(current, 30);
        
        // Check availability
        const isBooked = existingBookings.some(b => {
             // A slot is booked if it overlaps with an existing booking
             // Slot: current -> next
             // Booking: b.startTime -> b.endTime
             return isBefore(current, b.endTime) && isAfter(next, b.startTime);
        });

        // Check selection
        let isSelected = false;
        if (selectionStart) {
            if (!selectionEnd) {
                isSelected = current.getTime() === selectionStart.getTime();
            } else {
                 // Sort start/end to handle reverse selection
                const s = isBefore(selectionStart, selectionEnd) ? selectionStart : selectionEnd;
                const e = isBefore(selectionStart, selectionEnd) ? selectionEnd : selectionStart;
                
                // Select inclusive of start slot, up to (but not including) the end time of the booking
                isSelected = (isAfter(current, s) || current.getTime() === s.getTime()) && isBefore(current, e);
            }
        }

        slots.push({
            time: current,
            label: format(current, 'h:mm a'), // 12-hour format for display
            isBooked,
            isSelected
        });

        current = next;
    }
    return slots;
  }, [date, selectedRoom, rooms, existingBookings, selectionStart, selectionEnd]);

  // Handle Slot Click
  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.isBooked) return;

    if (!selectionStart || (selectionStart && selectionEnd)) {
        // Start new selection
        setSelectionStart(slot.time);
        setSelectionEnd(null);
    } else {
        // Complete selection
        // Determine range
        const start = isBefore(selectionStart, slot.time) ? selectionStart : slot.time;
        const end = isBefore(selectionStart, slot.time) ? slot.time : selectionStart;
        
        // Validate no booked slots in between
        const hasOverlap = existingBookings.some(b => 
            isBefore(start, b.endTime) && isAfter(addMinutes(end, 30), b.startTime)
        );

        if (hasOverlap) {
            toast.error('Selection overlaps with an existing booking');
            setSelectionStart(slot.time); // Reset to just this slot
            setSelectionEnd(null);
        } else {
            setSelectionStart(start);
            setSelectionEnd(addMinutes(end, 30)); // End of the clicked slot
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !selectedRoom || !selectionStart || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Default end to 30 mins after start if single slot selected
    const finalStart = selectionStart;
    const finalEnd = selectionEnd || addMinutes(selectionStart, 30);

    setIsSubmitting(true);

    try {
      await createBooking({
        roomId: parseInt(selectedRoom),
        userId: user?.id,
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        organization: formData.organization,
        purpose: formData.purpose,
        needPccHelp: formData.needPccHelp,
        startTime: finalStart,
        endTime: finalEnd,
      });

      toast.success('Booking successful!');
      // Reset form (keep name/email if desired)
      setSelectionStart(null);
      setSelectionEnd(null);
      // Fetch bookings again to update UI
      const bookings = await getBookings(parseInt(selectedRoom), date);
      setExistingBookings(bookings);
      
      const resetData = { phone: '', organization: '', purpose: '', needPccHelp: false, name: '', email: '' };
      if (user) {
         resetData.name = user.fullName || '';
         resetData.email = user.primaryEmailAddress?.emailAddress || '';
      }
      setFormData(resetData);

    } catch (error: any) {
      toast.error(error.message || 'Failed to book');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Date & Room (4 cols) */}
      <div className="lg:col-span-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Select Date & Room</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
                disabled={(date) => date < startOfDay(new Date())}
              />
            </div>
            
            <div className="space-y-2">
                <Label>Select Room</Label>
                <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choose a room" />
                    </SelectTrigger>
                    <SelectContent>
                        {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id.toString()}>
                                {room.name} (Cap: {room.capacity})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedRoom && (() => {
                    const room = rooms.find(r => r.id.toString() === selectedRoom);
                    return (
                        <div className="mt-4 space-y-2">
                            {room?.imageUrl && (
                                <img src={room.imageUrl} alt={room.name} className="w-full h-48 object-cover rounded-md" />
                            )}
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">
                                    {room?.description}
                                </p>
                                <p className="text-xs font-medium text-slate-900">
                                    Hours: {room?.openTime} - {room?.closeTime}
                                </p>
                            </div>
                        </div>
                    );
                })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MIDDLE COLUMN: Time Selection (4 cols) */}
      <div className="lg:col-span-4">
        <Card className="h-full">
            <CardHeader>
                <CardTitle>2. Select Time</CardTitle>
                <CardDescription>
                    {date ? format(date, 'PPPP') : 'Select a date first'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!date || !selectedRoom ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-md">
                        Select Date & Room first
                    </div>
                ) : isLoadingBookings ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                        {timeSlots.map((slot, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handleSlotClick(slot)}
                                disabled={slot.isBooked}
                                className={cn(
                                    "w-full text-left px-4 py-3 rounded-md text-sm transition-colors border",
                                    slot.isBooked 
                                        ? "bg-gray-100 text-gray-400 border-transparent cursor-not-allowed" 
                                        : slot.isSelected
                                            ? "bg-primary text-white border-primary"
                                            : "hover:bg-secondary/20 border-gray-200"
                                )}
                            >
                                <div className="flex justify-between items-center">
                                    <span>{slot.label}</span>
                                    {slot.isBooked && <span className="text-xs font-medium">Booked</span>}
                                    {slot.isSelected && <span className="text-xs font-medium">Selected</span>}
                                </div>
                            </button>
                        ))}
                        {timeSlots.length === 0 && <p className="text-center text-muted-foreground py-4">No available times.</p>}
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: Form Details (4 cols) */}
      <div className="lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle>3. Your Details</CardTitle>
            <CardDescription>
                {selectionStart ? (
                    <span className="font-medium text-slate-900">
                        {format(selectionStart, 'h:mm a')} - {selectionEnd ? format(selectionEnd, 'h:mm a') : format(addMinutes(selectionStart, 30), 'h:mm a')}
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
                    readOnly={!!user && !!formData.name}
                    className={user ? "bg-slate-100" : ""}
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
                    readOnly={!!user && !!formData.email}
                    className={user ? "bg-slate-100" : ""}
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
                <Label htmlFor="org">Organization (Optional)</Label>
                <Input 
                    id="org" 
                    value={formData.organization}
                    onChange={(e) => setFormData({...formData, organization: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose of Use</Label>
                <Textarea 
                    id="purpose" 
                    value={formData.purpose}
                    onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    required
                    minLength={10}
                    rows={3} // Provide some default rows for textarea
                />
              </div>

              <div className="flex items-center space-x-2 pt-2 pb-2">
                  <Switch 
                      id="pcc" 
                      checked={formData.needPccHelp}
                      onCheckedChange={(checked) => setFormData({...formData, needPccHelp: checked as boolean})}
                  />
                  <Label htmlFor="pcc" className="font-normal cursor-pointer">
                      Do you need PCC help with your event?
                  </Label>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || !selectionStart}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Booking
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}