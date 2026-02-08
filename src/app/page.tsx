import { getRooms, getStaffHours, getAllBookings } from './actions';
import BookingInterface from '@/components/BookingInterface';
import WeeklyOverview from '@/components/WeeklyOverview';
import PublicBookings from '@/components/PublicBookings';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

// Helper to group slots into ranges
function formatSchedule(schedule: Record<string, string[]>) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const formatted: { day: string; ranges: string[] }[] = [];

    days.forEach(day => {
        const slots = schedule[day]?.sort() || [];
        if (slots.length === 0) return;

        const ranges: string[] = [];
        let start = slots[0];
        let end = slots[0];

        for (let i = 1; i < slots.length; i++) {
            const current = slots[i];
            const prev = slots[i - 1];
            
            // Check if current slot is immediately after previous (30 mins diff)
            const [h1, m1] = prev.split(':').map(Number);
            const [h2, m2] = current.split(':').map(Number);
            
            const d1 = new Date(); 
            d1.setHours(h1, m1, 0, 0); // Zero seconds/ms
            
            const d2 = new Date(); 
            d2.setHours(h2, m2, 0, 0); // Zero seconds/ms
            
            // 30 mins in ms = 30 * 60 * 1000
            if (d2.getTime() - d1.getTime() === 1800000) {
                end = current;
            } else {
                // Push range
                ranges.push(formatRange(start, end));
                start = current;
                end = current;
            }
        }
        ranges.push(formatRange(start, end));
        formatted.push({ day, ranges });
    });

    return formatted;
}

function formatRange(start: string, end: string) {
    const [h1, m1] = start.split(':').map(Number);
    const d1 = new Date(); 
    d1.setHours(h1, m1, 0, 0);
    
    // For end time, we need to add 30 mins to the *start* of the last slot
    const [h2, m2] = end.split(':').map(Number);
    const d2 = new Date(); 
    d2.setHours(h2, m2, 0, 0);
    const d3 = new Date(d2.getTime() + 1800000); // Add 30 mins

    return `${format(d1, 'h:mm a')} - ${format(d3, 'h:mm a')}`;
}

export default async function Home() {
  const rooms = await getRooms();
  const staffMembers = await getStaffHours();
  const bookings = await getAllBookings();

  return (
    <main className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center pb-6 border-b border-secondary">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Community Scheduler</h1>
            <p className="text-gray-500">Book a room for your event or meeting</p>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/admin">
                <Button variant="ghost">Admin Login</Button>
            </Link>
            <SignedOut>
              <SignInButton mode="modal">
                  <Button variant="outline" disabled>Sign In</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <Tabs defaultValue="bookings">
            <TabsList className="grid w-full grid-cols-3 mb-8 max-w-xl">
                <TabsTrigger value="bookings">Current Bookings</TabsTrigger>
                <TabsTrigger value="book">Book a Room</TabsTrigger>
                <TabsTrigger value="hours">Office Hours</TabsTrigger>
            </TabsList>

            <TabsContent value="book">
                <BookingInterface rooms={rooms} />
            </TabsContent>

            <TabsContent value="bookings">
                <PublicBookings rooms={rooms} bookings={bookings} />
            </TabsContent>

            <TabsContent value="hours">
                {staffMembers.length > 0 && <WeeklyOverview staffMembers={staffMembers} />}

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {staffMembers.length === 0 ? (
                        <div className="col-span-full">
                            <Card>
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    No staff office hours posted yet.
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        staffMembers.map((staff) => {
                            let schedule: Record<string, string[]> = {};
                            try {
                                if (staff.officeHours && staff.officeHours.startsWith('{')) {
                                    schedule = JSON.parse(staff.officeHours);
                                }
                            } catch (e) {}

                            const formattedSchedule = formatSchedule(schedule);

                            if (formattedSchedule.length === 0) return null;

                            return (
                                <Card key={staff.username} className="h-full">
                                    <CardHeader>
                                        <CardTitle>{staff.fullName || staff.username}</CardTitle>
                                        {staff.bio && (
                                            <p className="text-sm text-muted-foreground font-medium pt-1 italic">
                                                Ask me about: <span className="text-foreground">{staff.bio}</span>
                                            </p>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {formattedSchedule.map(({ day, ranges }) => (
                                                <div key={day}>
                                                    <h4 className="font-semibold text-sm text-primary mb-1">{day}</h4>
                                                    <ul className="text-sm text-gray-600 space-y-1">
                                                        {ranges.map((range, i) => (
                                                            <li key={i}>{range}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}