import { getRooms, getAllBookings, getStaffHours, getTodaysPrograms } from './actions';
import BookingInterface from '@/components/BookingInterface';
import PublicBookings from '@/components/PublicBookings';
import TodayDashboard from '@/components/TodayDashboard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NavBar } from '@/components/NavBar';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const rooms = await getRooms();
  const bookings = await getAllBookings();
  const staff = await getStaffHours();
  const todaysPrograms = await getTodaysPrograms();

  return (
    <main className="min-h-screen bg-white p-4 md:p-6 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-4 flex-grow w-full">
        <NavBar
            title="PCC Building Room Scheduler"
            description="Browse rooms, book services, and reserve your space"
        />

        <Tabs defaultValue="dashboard">
            <TabsList className="grid w-full grid-cols-3 mb-4 max-w-xl">
                <TabsTrigger value="dashboard">Today</TabsTrigger>
                <TabsTrigger value="book">Book a Room</TabsTrigger>
                <TabsTrigger value="bookings">Current Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
                <TodayDashboard rooms={rooms} bookings={bookings} staff={staff} programs={todaysPrograms} />
            </TabsContent>

            <TabsContent value="book">
                <BookingInterface rooms={rooms} />
            </TabsContent>

            <TabsContent value="bookings">
                <PublicBookings rooms={rooms} bookings={bookings} />
            </TabsContent>
        </Tabs>
      </div>

      <footer className="mt-12 py-6 border-t border-secondary text-center">
        <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-muted-foreground">Admin Login</Button>
        </Link>
      </footer>
    </main>
  );
}