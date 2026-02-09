import { getAllBookings, getRooms, getSettings, getAdmins, logout, getAppointmentRequests, getAllAppointmentRequests } from '@/app/actions';
import AdminDashboard from '@/components/AdminDashboard';
import StaffDashboard from '@/components/StaffDashboard';
import AppointmentRequests from '@/components/AppointmentRequests';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  try {
    const session = await getSession() as any;
    if (!session) redirect('/login');
    
    const role = session.role;

    // Staff / HTH View
    if (role === 'staff' || role === 'HTH') {
        const staffMember = await db.query.admins.findFirst({
            where: eq(admins.id, session.id)
        });
        
        // Fetch requests for this staff member
        const requests = await getAppointmentRequests();

        return (
            <main className="min-h-screen bg-slate-50 p-4 md:p-8">
                {/* ... Staff Portal Content ... */}
                <div className="max-w-5xl mx-auto space-y-8">
                    <header className="flex justify-between items-center pb-6 border-b">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff Portal</h1>
                            <p className="text-slate-500">Welcome back, {session?.username}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button variant="ghost">Scheduling</Button>
                            </Link>
                            <Link href="/services">
                                <Button variant="ghost">Services</Button>
                            </Link>
                            <Link href="/admin/profile">
                                <Button variant="ghost">Profile</Button>
                            </Link>
                            <form action={logout}>
                                <Button variant="outline" type="submit">Sign Out</Button>
                            </form>
                        </div>
                    </header>
                    
                    <Tabs defaultValue="hours" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8 max-w-sm">
                            <TabsTrigger value="hours">My Hours</TabsTrigger>
                            <TabsTrigger value="appointments">Appointments</TabsTrigger>
                        </TabsList>

                        <TabsContent value="hours">
                            <StaffDashboard 
                                officeHours={staffMember?.officeHours || ''} 
                                bio={staffMember?.bio || ''}
                            />
                        </TabsContent>

                        <TabsContent value="appointments">
                            <AppointmentRequests requests={requests} />
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        );
    }

    // Admin View - Strictly check for 'admin' role
    if (role === 'admin') {
        // Admin Data
        const bookings = await getAllBookings();
        const rooms = await getRooms();
        const adminUsers = await getAdmins();
        const allAppointmentRequests = await getAllAppointmentRequests();

        return (
            <main className="min-h-screen bg-slate-50 p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-8">
                    <header className="flex justify-between items-center pb-6 border-b">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
                            <p className="text-slate-500">Welcome back, Admin</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button variant="ghost">Scheduling</Button>
                            </Link>
                            <Link href="/services">
                                <Button variant="ghost">Services</Button>
                            </Link>
                            <Link href="/admin/profile">
                                <Button variant="ghost">Profile</Button>
                            </Link>
                            <form action={logout}>
                                <Button variant="outline" type="submit">Sign Out</Button>
                            </form>
                        </div>
                    </header>

                    <AdminDashboard 
                        bookings={bookings} 
                        rooms={rooms}
                        admins={adminUsers}
                        appointmentRequests={allAppointmentRequests}
                    />
                </div>
            </main>
        );
    }

    // Fallback for unknown roles or errors
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-red-50 p-6 rounded-lg border border-red-200">
                <h1 className="text-xl font-bold text-red-800 mb-2">Access Denied</h1>
                <p className="text-red-600 mb-4">You do not have permission to view this page.</p>
                <div className="mt-4">
                    <form action={logout}>
                        <Button variant="outline" type="submit">Sign Out</Button>
                    </form>
                </div>
            </div>
        </div>
    );
  } catch (e: any) {
    console.error('AdminPage Error:', e);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-50 p-6 rounded-lg border border-red-200">
          <h1 className="text-xl font-bold text-red-800 mb-2">Something went wrong</h1>
          <p className="text-red-600 mb-4">The admin dashboard could not be loaded.</p>
          <pre className="text-xs bg-white p-2 rounded border overflow-auto text-red-900">
            {e.message}
            {`\n\n`}
            {e.stack}
          </pre>
          <div className="mt-4">
             <Link href="/">
                <Button variant="outline">Back to Home</Button>
             </Link>
          </div>
        </div>
      </div>
    );
  }
}