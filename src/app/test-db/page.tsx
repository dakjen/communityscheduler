import { db } from '@/db';
import { rooms } from '@/db/schema';

export default async function TestDBPage() {
  try {
    const result = await db.select().from(rooms).limit(1);
    return (
      <div>
        <h1>Database Connection Test</h1>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </div>
    );
  } catch (error: any) {
    return (
      <div>
        <h1>Database Error</h1>
        <pre>{error.message}</pre>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }
}
