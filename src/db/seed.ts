import { db } from './index';
import { rooms, admins } from './schema';
import { hash } from 'bcryptjs';

async function main() {
  console.log('Seeding rooms...');
  
  const existingRooms = await db.select().from(rooms).all();
  if (existingRooms.length === 0) {
    await db.insert(rooms).values([
      {
        name: 'Community Room A',
        description: 'Large gathering space with projector',
        capacity: 50,
      },
      {
        name: 'Meeting Room B',
        description: 'Conference table with 10 chairs',
        capacity: 10,
      },
      {
        name: 'Activity Room C',
        description: 'Open space for kids and activities',
        capacity: 25,
      },
    ]);
    console.log('Rooms seeded.');
  } else {
    console.log('Rooms already exist. Skipping.');
  }

  console.log('Seeding admin...');
  const existingAdmin = await db.select().from(admins).all();
  if (existingAdmin.length === 0) {
    const hashedPassword = await hash('password123', 10);
    await db.insert(admins).values({
      username: 'admin',
      password: hashedPassword,
      fullName: 'System Administrator',
      email: 'admin@example.com'
    });
    console.log('Default admin created: admin / password123');
  } else {
    console.log('Admin already exists. Skipping.');
  }

  console.log('Seeding complete.');
}

main().catch(console.error);
