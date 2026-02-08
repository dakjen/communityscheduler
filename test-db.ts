import { db } from './src/db/index';
import { admins } from './src/db/schema';

async function test() {
  try {
    console.log('Checking admins...');
    const result = await db.select().from(admins);
    console.log('Admins found:', result);
  } catch (error) {
    console.error('Query failed:', error);
  }
}

test();
