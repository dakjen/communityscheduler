import { getRooms, getAllBookings, getStaffHours, getLaptopHours, getPrograms } from './actions';
import BookingInterface from '@/components/BookingInterface';
import LaptopBookingInterface from '@/components/LaptopBookingInterface';
import PublicBookings from '@/components/PublicBookings';
import TodayDashboard from '@/components/TodayDashboard';
import MonthlyProgrammingCalendar from '@/components/MonthlyProgrammingCalendar';
import HomeCarousel from '@/components/HomeCarousel';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersistentTabs } from '@/components/PersistentTabs';
import { NavBar } from '@/components/NavBar';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const rooms = await getRooms();
  const bookings = await getAllBookings();
  const staff = await getStaffHours();
  const allPrograms = await getPrograms();
  const laptopHours = await getLaptopHours();

  // The Community Room gets its own request tab; keep it out of the general room picker.
  const communityRoom = rooms.find((r) => /community/i.test(r.name));
  const bookableRooms = rooms.filter((r) => r.id !== communityRoom?.id);

  return (
    <main className="min-h-screen bg-white p-4 md:p-6 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-4 flex-grow w-full">
        <NavBar
            title="PCC Building Room Scheduler"
            description="Browse rooms, book services, and reserve your space"
        />

        <PersistentTabs defaultValue="dashboard" values={['dashboard', 'book', 'community', 'laptop', 'bookings']}>
            <TabsList className={`grid w-full mb-4 max-w-3xl ${communityRoom ? 'grid-cols-5' : 'grid-cols-4'}`}>
                <TabsTrigger value="dashboard">Today</TabsTrigger>
                <TabsTrigger value="book">Book a Room</TabsTrigger>
                {communityRoom && <TabsTrigger value="community">Community Room</TabsTrigger>}
                <TabsTrigger value="laptop">Reserve a Laptop</TabsTrigger>
                <TabsTrigger value="bookings">Current Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
                <HomeCarousel
                    slides={[
                        {
                            key: 'today',
                            title: 'Today',
                            content: <TodayDashboard rooms={rooms} bookings={bookings} staff={staff} programs={allPrograms} />,
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
                <BookingInterface rooms={bookableRooms} />
            </TabsContent>

            {communityRoom && (
                <TabsContent value="community">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Request the Community Room</h2>
                        <p className="text-sm text-muted-foreground">
                            Pick a date and time to request the {communityRoom.name}. Your request will be confirmed once approved.
                        </p>
                    </div>
                    <BookingInterface rooms={[communityRoom]} lockedRoomId={communityRoom.id} requestMode />
                </TabsContent>
            )}

            <TabsContent value="laptop">
                <LaptopBookingInterface laptopHours={laptopHours} />
            </TabsContent>

            <TabsContent value="bookings">
                <PublicBookings rooms={rooms} bookings={bookings} />
            </TabsContent>
        </PersistentTabs>
      </div>

      <footer className="mt-12 py-6 border-t border-secondary text-center">
        <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-muted-foreground">Admin Login</Button>
        </Link>
      </footer>
    </main>
  );
}