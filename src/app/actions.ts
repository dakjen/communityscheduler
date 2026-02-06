'use server';

import { db } from '@/db';
import { bookings, rooms, settings, admins } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { compare, hash } from 'bcryptjs';
import { signSession, setSession, clearSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function getAdmins() {
  return await db.select({
    id: admins.id,
    username: admins.username,
    fullName: admins.fullName,
    email: admins.email,
    role: admins.role,
  }).from(admins).all();
}

export async function createAdmin(data: { username: string; password: string; fullName: string; email: string; role: 'admin' | 'staff' }) {
  // Check if username exists
  const existing = await db.query.admins.findFirst({
    where: eq(admins.username, data.username)
  });
  
  if (existing) {
    throw new Error('Username already taken.');
  }

  const hashedPassword = await hash(data.password, 10);
  
  await db.insert(admins).values({
    username: data.username,
    password: hashedPassword,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function updateAdmin(data: { id: number; fullName: string; email: string; password?: string; role?: 'admin' | 'staff' }) {
  const updateData: any = {
    fullName: data.fullName,
    email: data.email,
  };

  if (data.role) {
      updateData.role = data.role;
  }

  if (data.password && data.password.trim() !== '') {
    updateData.password = await hash(data.password, 10);
  }

  await db.update(admins).set(updateData).where(eq(admins.id, data.id));
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteAdmin(id: number) {
  // Prevent deleting the last admin or yourself (optional safety, for now just allow delete)
  // Ideally, we check context to not delete self, but for this simple app, we just delete by ID.
  await db.delete(admins).where(eq(admins.id, id));
  revalidatePath('/admin');
}

// --- Auth Actions ---

export async function login(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    throw new Error('Please provide both username and password.');
  }

  const admin = await db.query.admins.findFirst({
    where: eq(admins.username, username),
  });

  if (!admin) {
    throw new Error('Invalid credentials.');
  }

  const isValid = await compare(password, admin.password);
  if (!isValid) {
    throw new Error('Invalid credentials.');
  }

  const token = await signSession({ id: admin.id, username: admin.username, role: admin.role });
  await setSession(token);
  
  redirect('/admin');
}

export async function logout() {
  await clearSession();
  redirect('/login');
}


// --- Shared / Utility ---

export async function getSettings() {
  const allSettings = await db.select().from(settings).all();
  // Default settings
  const defaults = {
    officeHours: 'Monday - Friday: 9:00 AM - 5:00 PM\nSaturday: 10:00 AM - 2:00 PM\nSunday: Closed',
  };

  const map: Record<string, string> = {};
  allSettings.forEach(s => map[s.key] = s.value);

  return { ...defaults, ...map };
}

// ... existing imports ...
import { getSession } from '@/lib/auth';

// ... existing code ...

export async function getStaffHours() {
    return await db.select({
        username: admins.username,
        fullName: admins.fullName,
        officeHours: admins.officeHours,
        bio: admins.bio,
    })
    .from(admins)
    .where(eq(admins.role, 'staff'))
    .all();
}

export async function updateOfficeHours(scheduleText: string, bioText: string) {
    const session = await getSession() as any;
    if (!session || !session.id) throw new Error('Unauthorized');

    await db.update(admins)
        .set({ 
            officeHours: scheduleText,
            bio: bioText
        })
        .where(eq(admins.id, session.id));
    
    revalidatePath('/');
    revalidatePath('/admin');
}

// --- Public Actions ---

export async function getRooms() {
  return await db.select().from(rooms).all();
}

export async function getBookings(roomId: number, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const foundBookings = await db.select({
      startTime: bookings.startTime,
      endTime: bookings.endTime
  }).from(bookings).where(
      and(
          eq(bookings.roomId, roomId),
          gte(bookings.endTime, startOfDay),
          lte(bookings.startTime, endOfDay)
      )
  ).all();

  return foundBookings;
}

export async function getBookingsForDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select().from(bookings).where(
        and(
            gte(bookings.startTime, startOfDay),
            lte(bookings.endTime, endOfDay)
        )
    ).all();
}

export async function createBooking(data: {
  roomId: number;
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization?: string;
  purpose: string;
  needPccHelp: boolean;
  startTime: Date;
  endTime: Date;
}) {
  // 1. Check Room Operating Hours
  const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, data.roomId)
  });

  if (!room) throw new Error('Room not found');

  const [openHour, openMinute] = room.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = room.closeTime.split(':').map(Number);

  const startHour = data.startTime.getHours();
  const startMinute = data.startTime.getMinutes();
  const endHour = data.endTime.getHours();
  const endMinute = data.endTime.getMinutes();

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const openTotal = openHour * 60 + openMinute;
  const closeTotal = closeHour * 60 + closeMinute;

  // Note: strict inequality for end time if bookings can end exactly at close time
  if (startTotal < openTotal || endTotal > closeTotal) {
    throw new Error(`Bookings for ${room.name} must be between ${room.openTime} and ${room.closeTime}.`);
  }

  // 2. Simple conflict check
  const conflict = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.roomId, data.roomId),
      gte(bookings.endTime, data.startTime),
      lte(bookings.startTime, data.endTime)
    )
  });

  if (conflict) {
    throw new Error('Time slot is already booked.');
  }

  await db.insert(bookings).values({
    ...data,
    status: 'confirmed', // Auto-confirm for now
  });

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

// --- Admin Actions ---

export async function getAllBookings() {
    return await db.select({
        id: bookings.id,
        roomName: rooms.name,
        customerName: bookings.customerName,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        purpose: bookings.purpose,
    })
    .from(bookings)
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .orderBy(bookings.startTime);
}

export async function deleteBooking(id: number) {
    await db.delete(bookings).where(eq(bookings.id, id));
    revalidatePath('/admin');
    revalidatePath('/');
}

export async function createRoom(formData: FormData) {
  const name = formData.get('name') as string;
  const capacity = parseInt(formData.get('capacity') as string);
  const description = formData.get('description') as string;
  const openTime = formData.get('openTime') as string || '09:00';
  const closeTime = formData.get('closeTime') as string || '17:00';
  const imageFile = formData.get('image') as File | null;

  let imageUrl: string | null = null;

  if (imageFile && imageFile.size > 0) {
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create a unique filename
    const filename = `${Date.now()}-${imageFile.name.replace(/\s/g, '-')}`;
    const path = join(process.cwd(), 'public/uploads', filename);
    
    await writeFile(path, buffer);
    imageUrl = `/uploads/${filename}`;
  }

  await db.insert(rooms).values({
    name,
    capacity,
    description,
    imageUrl,
    openTime,
    closeTime
  });

  revalidatePath('/');
  revalidatePath('/admin');
}

export async function updateRoom(formData: FormData) {
  const id = parseInt(formData.get('id') as string);
  const name = formData.get('name') as string;
  const capacity = parseInt(formData.get('capacity') as string);
  const description = formData.get('description') as string;
  const openTime = formData.get('openTime') as string;
  const closeTime = formData.get('closeTime') as string;
  const imageFile = formData.get('image') as File | null;

  const updateData: any = {
    name,
    capacity,
    description,
    openTime,
    closeTime
  };

  if (imageFile && imageFile.size > 0) {
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create a unique filename
    const filename = `${Date.now()}-${imageFile.name.replace(/\s/g, '-')}`;
    const path = join(process.cwd(), 'public/uploads', filename);
    
    await writeFile(path, buffer);
    updateData.imageUrl = `/uploads/${filename}`;
  }

  await db.update(rooms).set(updateData).where(eq(rooms.id, id));
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteRoom(id: number) {
  // Optional: Check for future bookings before deleting?
  // For now, we will cascade delete or just delete (SQLite schema needs ON DELETE CASCADE for foreign keys to be auto, otherwise manual)
  // We'll just delete the room. Bookings might get orphaned or need cleanup.
  // Ideally: await db.delete(bookings).where(eq(bookings.roomId, id));
  await db.delete(rooms).where(eq(rooms.id, id));
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function updateSettings(data: { openTime: string; closeTime: string }) {
  await db.insert(settings).values({ key: 'openTime', value: data.openTime })
    .onConflictDoUpdate({ target: settings.key, set: { value: data.openTime } });
  
  await db.insert(settings).values({ key: 'closeTime', value: data.closeTime })
    .onConflictDoUpdate({ target: settings.key, set: { value: data.closeTime } });

  revalidatePath('/');
  revalidatePath('/admin');
}