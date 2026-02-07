import { db } from './index';
import { rooms, admins } from './schema';
import { hash } from 'bcryptjs';

async function main() {
  console.log('Seeding rooms...');
  
  // Clean up any existing rooms before seeding
  await db.delete(rooms);

  await db.insert(rooms).values([
    {
      name: 'Community Room A',
      description: 'Large gathering space with projector',
      capacity: 50,
      openTime: '09:00',
      closeTime: '17:00',
    },
    {
      name: 'Meeting Room B',
      description: 'Conference table with 10 chairs',
      capacity: 10,
      openTime: '09:00',
      closeTime: '17:00',
    },
    {
      name: 'Activity Room C',
      description: 'Open space for kids and activities',
      capacity: 25,
      openTime: '09:00',
      closeTime: '17:00',
    },
  ]);
  console.log('Rooms seeded.');

  console.log('Seeding admin...');
  // Clean up any existing admins before seeding
  await db.delete(admins);

  const hashedPassword = await hash('password123', 10);
  await db.insert(admins).values({
    username: 'admin',
    password: hashedPassword,
    fullName: 'System Administrator',
    email: 'admin@example.com',
    role: 'admin',
  });
  console.log('Default admin created: admin / password123');

  console.log('Seeding complete.');
}

main().catch(console.error);