import { db } from './index';
import { rooms, admins, laptops, settings } from './schema';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';

const DEFAULT_WEEKLY_HOURS = JSON.stringify({
  mon: { open: '09:00', close: '17:00', closed: false },
  tue: { open: '09:00', close: '17:00', closed: false },
  wed: { open: '09:00', close: '17:00', closed: false },
  thu: { open: '09:00', close: '17:00', closed: false },
  fri: { open: '09:00', close: '17:00', closed: false },
  sat: { open: '09:00', close: '17:00', closed: false },
  sun: { open: '09:00', close: '17:00', closed: true },
});

async function main() {
  console.log('Seeding rooms...');

  // Clean up any existing rooms before seeding
  await db.delete(rooms).execute();

  await db.insert(rooms).values([
    {
      name: 'Community Room A',
      description: 'Large gathering space with projector',
      capacity: 50,
      weeklyHours: DEFAULT_WEEKLY_HOURS,
    },
    {
      name: 'Meeting Room B',
      description: 'Conference table with 10 chairs',
      capacity: 10,
      weeklyHours: DEFAULT_WEEKLY_HOURS,
    },
    {
      name: 'Activity Room C',
      description: 'Open space for kids and activities',
      capacity: 25,
      weeklyHours: DEFAULT_WEEKLY_HOURS,
    },
  ]).execute();

  console.log('Seeding laptops...');
  await db.delete(laptops).execute();
  await db.insert(laptops).values(
    Array.from({ length: 10 }, (_, i) => ({ number: i + 1 }))
  ).execute();

  // Default laptop hours setting
  await db.insert(settings)
    .values({ key: 'laptopHours', value: DEFAULT_WEEKLY_HOURS })
    .onConflictDoNothing()
    .execute();
  console.log('Rooms seeded.');

  console.log('Seeding admin...');
  // Clean up any existing admins before seeding
  await db.delete(admins).execute();

  const hashedPassword = await hash('password123', 10);
  await db.insert(admins).values({
    username: 'admin',
    password: hashedPassword,
    fullName: 'System Administrator',
    email: 'admin@example.com',
    role: 'admin',
    officeHours: '', // Default empty office hours
    bio: 'General inquiries and system support'
  }).execute();
  console.log('Default admin created: admin / password123');

  console.log('Seeding complete.');
}

main().catch(console.error);