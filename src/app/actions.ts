'use server';

import { db } from '@/db';
import { bookings, rooms, settings, admins } from '@/db/schema';
import { eq, and, gt, lt, gte, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { compare, hash } from 'bcryptjs';
import { getSession, signSession, setSession, clearSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

// --- Admin User Management Actions ---

export async function getAdmins() {
  return await db.select({
    id: admins.id,
    username: admins.username,
    fullName: admins.fullName,
    email: admins.email,
    role: admins.role,
    status: admins.status,
  }).from(admins).execute();
}

export async function createAdmin(data: { username: string; password: string; fullName: string; email: string; role: 'admin' | 'staff' }) {
  const normalizedUsername = data.username.toLowerCase();
  const existing = await db.query.admins.findFirst({
    where: eq(admins.username, normalizedUsername)
  });
  
  if (existing) {
    throw new Error('Username already taken.');
  }

  const hashedPassword = await hash(data.password, 10);
  
  await db.insert(admins).values({
    username: normalizedUsername,
    password: hashedPassword,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
  }).execute();

  revalidatePath('/admin');
  return { success: true };
}

export async function createAdminAction(formData: FormData) {
  const username = (formData.get('username') as string).toLowerCase();
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;

  if (!username || !password || !fullName || !email) {
    throw new Error('All fields are required.');
  }

  await createAdmin({
    username,
    password,
    fullName,
    email,
    role: 'admin',
  });

  // Automatically log in the new admin - REMOVED
  /*
  const newAdmin = await db.query.admins.findFirst({
    where: eq(admins.username, username),
  });

  if (newAdmin) {
    const token = await signSession({ id: newAdmin.id, username: newAdmin.username, role: newAdmin.role });
    await setSession(token);
  }

  redirect('/admin');
  */
  redirect('/login?registered=true');
}

export async function approveAdmin(id: number, role: 'admin' | 'staff') {
  await db.update(admins).set({ status: 'active', role }).where(eq(admins.id, id)).execute();
  revalidatePath('/admin');
}

export async function rejectAdmin(id: number) {
  await db.delete(admins).where(eq(admins.id, id)).execute();
  revalidatePath('/admin');
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

  await db.update(admins).set(updateData).where(eq(admins.id, data.id)).execute();
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteAdmin(id: number) {
  await db.delete(admins).where(eq(admins.id, id)).execute();
  revalidatePath('/admin');
}

// --- Authentication Actions ---

export async function login(formData: FormData) {
  const username = (formData.get('username') as string).toLowerCase();
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

  if (admin.status !== 'active') {
    throw new Error('Account pending approval.');
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

// --- Settings Actions ---

export async function getSettings() {
  const allSettings = await db.select().from(settings).execute();
  const defaults = {
    officeHours: '', // Empty string for default, as it's now per-staff
  };

  const map: Record<string, string> = {};
  allSettings.forEach(s => map[s.key] = s.value);

  return { ...defaults, ...map };
}

// --- Public Room Actions ---

export async function getRooms() {
  return await db.select().from(rooms).execute();
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
  ).execute();

  return foundBookings;
}

export async function getBookingsForDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select().from(bookings).where(
        and(
            gte(bookings.endTime, startOfDay),
            lte(bookings.startTime, endOfDay)
        )
    ).execute();
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

  if (startTotal < openTotal || endTotal > closeTotal) {
    throw new Error(`Bookings for ${room.name} must be between ${room.openTime} and ${room.closeTime}.`);
  }

  const conflict = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.roomId, data.roomId),
      gt(bookings.endTime, data.startTime),
      lt(bookings.startTime, data.endTime)
    )
  });

  if (conflict) {
    throw new Error('Time slot is already booked.');
  }

  await db.insert(bookings).values({
    ...data,
    status: 'pending',
  }).execute();

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function approveBooking(id: number) {
  await db.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, id)).execute();
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function rejectBooking(id: number) {
  await db.delete(bookings).where(eq(bookings.id, id)).execute();
  revalidatePath('/admin');
  revalidatePath('/');
}

// --- Admin Room Management Actions ---

export async function getAllBookings() {
    return await db.select({
        id: bookings.id,
        roomId: bookings.roomId,
        roomName: rooms.name,
        customerName: bookings.customerName,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        purpose: bookings.purpose,
        status: bookings.status,
    })
    .from(bookings)
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .orderBy(bookings.startTime)
    .execute();
}

export async function deleteBooking(id: number) {
  await db.delete(bookings).where(eq(bookings.id, id)).execute();
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
    const mimeType = imageFile.type || 'image/jpeg';
    const base64 = buffer.toString('base64');
    imageUrl = `data:${mimeType};base64,${base64}`;
  }

  await db.insert(rooms).values({
    name,
    capacity,
    description,
    imageUrl,
    openTime,
    closeTime
  }).execute();

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
    const mimeType = imageFile.type || 'image/jpeg';
    const base64 = buffer.toString('base64');
    updateData.imageUrl = `data:${mimeType};base64,${base64}`;
  }

  await db.update(rooms).set(updateData).where(eq(rooms.id, id)).execute();
  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteRoom(id: number) {
  await db.delete(rooms).where(eq(rooms.id, id)).execute();
  revalidatePath('/');
  revalidatePath('/admin');
}

// --- Staff Office Hours Actions ---

export async function getStaffHours() {
    return await db.select({
        username: admins.username,
        fullName: admins.fullName,
        officeHours: admins.officeHours,
        bio: admins.bio,
    })
    .from(admins)
    .where(eq(admins.role, 'staff'))
    .execute();
}

export async function updateOfficeHours(scheduleText: string, bioText: string) {
    const session = await getSession() as any;
    if (!session || !session.id) throw new Error('Unauthorized');

    await db.update(admins)
        .set({ 
            officeHours: scheduleText,
            bio: bioText
        })
        .where(eq(admins.id, session.id)).execute();
    
    revalidatePath('/');
    revalidatePath('/admin');
}
