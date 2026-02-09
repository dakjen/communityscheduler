import { getSession } from '@/lib/auth';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { logout } from '@/app/actions';
import ProfileForm from '@/components/ProfileForm';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const session = await getSession() as any;
    if (!session) redirect('/login');

    const user = await db.query.admins.findFirst({
        where: eq(admins.id, session.id)
    });

    if (!user) redirect('/login');

    return (
        <main className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <header className="flex justify-between items-center pb-6 border-b">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account Settings</h1>
                        <p className="text-slate-500">Manage your profile details</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/admin">
                            <Button variant="ghost">Dashboard</Button>
                        </Link>
                        <form action={logout}>
                            <Button variant="outline" type="submit">Sign Out</Button>
                        </form>
                    </div>
                </header>

                <ProfileForm user={user} />
            </div>
        </main>
    );
}
