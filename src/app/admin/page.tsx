import { getAllBookings, getRooms, getSettings, getAdmins, logout } from '@/app/actions';
import AdminDashboard from '@/components/AdminDashboard';
import StaffDashboard from '@/components/StaffDashboard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  try {
    const session = await getSession() as any;
    const role = session?.role || 'admin'; 

    // Common data
    const settings = await getSettings();

    if (role === 'staff') {
        const staffMember = await db.query.admins.findFirst({
            where: eq(admins.id, session.id)
        });

        return (
            <main className="min-h-screen bg-slate-50 p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-8">
                    <header className="flex justify-between items-center pb-6 border-b">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff Portal</h1>
                            <p className="text-slate-500">Welcome back, {session?.username}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button variant="ghost">View Public Site</Button>
                            </Link>
                            <form action={logout}>
                                <Button variant="outline" type="submit">Sign Out</Button>
                            </form>
                        </div>
                    </header>
                    <StaffDashboard 
                        officeHours={staffMember?.officeHours || ''} 
                        bio={staffMember?.bio || ''}
                    />
                </div>
            </main>
        );
    }

    // Admin Data
    const bookings = await getAllBookings();
    const rooms = await getRooms();
    const adminUsers = await getAdmins();

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
                            <Button variant="ghost">View Public Site</Button>
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
                />
            </div>
        </main>
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