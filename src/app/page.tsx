import { getRooms, getAllBookings, getStaffHours, getTodaysPrograms, getLaptopHours, getPrograms } from './actions';
import BookingInterface from '@/components/BookingInterface';
import LaptopBookingInterface from '@/components/LaptopBookingInterface';
import PublicBookings from '@/components/PublicBookings';
import TodayDashboard from '@/components/TodayDashboard';
import MonthlyProgrammingCalendar from '@/components/MonthlyProgrammingCalendar';
import HomeCarousel from '@/components/HomeCarousel';
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
  const allPrograms = await getPrograms();
  const laptopHours = await getLaptopHours();

  return (
    <main className="min-h-screen bg-white p-4 md:p-6 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-4 flex-grow w-full">
        <NavBar
            title="PCC Building Room Scheduler"
            description="Browse rooms, book services, and reserve your space"
        />

        <Tabs defaultValue="dashboard">
            <TabsList className="grid w-full grid-cols-4 mb-4 max-w-2xl">
                <TabsTrigger value="dashboard">Today</TabsTrigger>
                <TabsTrigger value="book">Book a Room</TabsTrigger>
                <TabsTrigger value="laptop">Reserve a Laptop</TabsTrigger>
                <TabsTrigger value="bookings">Current Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
                <HomeCarousel
                    slides={[
                        {
                            key: 'today',
                            title: 'Today',
                            content: <TodayDashboard rooms={rooms} bookings={bookings} staff={staff} programs={todaysPrograms} />,
                        },
                        {
                            key: 'month',
                            title: 'This Month',
                            content: <MonthlyProgrammingCalendar programs={allPrograms} />,
                        },
                    ]}
                />
            </TabsContent>

            <TabsContent value="book">
                <BookingInterface rooms={rooms} />
            </TabsContent>

            <TabsContent value="laptop">
                <LaptopBookingInterface laptopHours={laptopHours} />
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