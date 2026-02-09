import { getRooms, getAllBookings } from './actions';
import BookingInterface from '@/components/BookingInterface';
import PublicBookings from '@/components/PublicBookings';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NavBar } from '@/components/NavBar';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const rooms = await getRooms();
  const bookings = await getAllBookings();

  return (
    <main className="min-h-screen bg-white p-4 md:p-8 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-8 flex-grow w-full">
        <NavBar 
            title="Welcome to the PCC Building Room Scheduler" 
            description="Book a room for your event or meeting" 
        />

        <Tabs defaultValue="book">
            <TabsList className="grid w-full grid-cols-2 mb-8 max-w-xl">
                <TabsTrigger value="book">Book a Room</TabsTrigger>
                <TabsTrigger value="bookings">Current Bookings</TabsTrigger>
            </TabsList>

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