import { db } from './src/db/index';
import { admins } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function fix() {
  console.log('Activating all existing admins...');
  await db.update(admins).set({ status: 'active' });
  console.log('Done.');
}

fix().catch(console.error);
