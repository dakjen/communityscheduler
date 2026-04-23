'use server';

import { db } from '@/db';
import { bookings, rooms, settings, admins, appointmentRequests, programs } from '@/db/schema';
import { eq, and, gt, lt, gte, lte, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { compare, hash } from 'bcryptjs';
import { getSession, signSession, setSession, clearSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { sendBookingConfirmation, sendStaffNotification } from '@/lib/email';

// --- Admin User Management Actions ---

export async function getAdmins() {
  return await db.select({
    id: admins.id,
    username: admins.username,
    fullName: admins.fullName,
    email: admins.email,
    role: admins.role,
    status: admins.status,
    serviceType: admins.serviceType,
  }).from(admins).execute();
}

export async function createAdmin(data: { username: string; password: string; fullName: string; email: string; role: 'admin' | 'staff' | 'HTH'; status?: 'pending' | 'active' | 'rejected'; serviceType?: string }) {
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
    status: data.status || 'pending',
    serviceType: data.serviceType || null,
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

export async function approveAdmin(id: number, role: 'admin' | 'staff' | 'HTH') {
  await db.update(admins).set({ status: 'active', role }).where(eq(admins.id, id)).execute();
  revalidatePath('/admin');
}

export async function rejectAdmin(id: number) {
  await db.delete(admins).where(eq(admins.id, id)).execute();
  revalidatePath('/admin');
}

export async function updateAdmin(data: { id: number; fullName: string; email: string; password?: string; role?: 'admin' | 'staff' | 'HTH'; serviceType?: string }) {
  const updateData: any = {
    fullName: data.fullName,
    email: data.email,
  };

  if (data.role) {
      updateData.role = data.role;
  }

  if (data.serviceType !== undefined) {
      updateData.serviceType = data.serviceType || null;
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

  // Calculate duration in hours
  const durationMs = data.endTime.getTime() - data.startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  if (durationHours > 3) {
    throw new Error('Maximum booking duration is 3 hours.');
  }

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

  // Send booking confirmation email to customer
  sendBookingConfirmation({
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    purpose: data.purpose,
    startTime: data.startTime,
    endTime: data.endTime,
    roomName: room.name,
  });

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
    if (imageFile.size > 4 * 1024 * 1024) {
      throw new Error('Image must be under 4MB.');
    }
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
    if (imageFile.size > 4 * 1024 * 1024) {
      throw new Error('Image must be under 4MB.');
    }
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
        role: admins.role,
        serviceType: admins.serviceType,
    })
    .from(admins)
    .where(or(eq(admins.role, 'staff'), eq(admins.role, 'HTH')))
    .execute();
}

export async function getHTHStaff() {
    return await db.select({
        username: admins.username,
        fullName: admins.fullName,
        officeHours: admins.officeHours,
        bio: admins.bio,
        serviceType: admins.serviceType,
    })
    .from(admins)
    .where(eq(admins.role, 'HTH'))
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

export async function submitAppointmentRequest(data: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    businessName?: string | null;
    preferredDate: string;
    preferredTime: string;
    reason: string;
    preferredStaffUsername?: string | null;
}) {
    await db.insert(appointmentRequests).values({
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        businessName: data.businessName,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        reason: data.reason,
        preferredStaffUsername: data.preferredStaffUsername,
    }).execute();

    // Send notification to the staff member if one was selected
    if (data.preferredStaffUsername) {
        const staffMember = await db.query.admins.findFirst({
            where: eq(admins.username, data.preferredStaffUsername),
        });
        if (staffMember?.email) {
            sendStaffNotification({
                staffEmail: staffMember.email,
                clientName: data.customerName,
                clientEmail: data.customerEmail,
                purpose: data.reason,
                date: data.preferredDate,
                time: data.preferredTime,
            });
        }
    }

    revalidatePath('/services');
    revalidatePath('/admin');
    return { success: true };
}

export async function getAppointmentRequests() {
    const session = await getSession() as any;
    if (!session || !session.username) return [];

    return await db.select().from(appointmentRequests)
        .where(eq(appointmentRequests.preferredStaffUsername, session.username))
        .orderBy(appointmentRequests.createdAt) // Show oldest first? Or newest? Let's do newest for now or oldest pending.
        .execute();
}

export async function getAllAppointmentRequests() {
    const session = await getSession();
    if (!session) return []; // Ensure authenticated

    return await db.select({
        id: appointmentRequests.id,
        customerName: appointmentRequests.customerName,
        customerEmail: appointmentRequests.customerEmail,
        customerPhone: appointmentRequests.customerPhone,
        businessName: appointmentRequests.businessName, // Include businessName
        preferredDate: appointmentRequests.preferredDate,
        preferredTime: appointmentRequests.preferredTime,
        reason: appointmentRequests.reason,
        preferredStaffUsername: appointmentRequests.preferredStaffUsername,
        status: appointmentRequests.status,
        createdAt: appointmentRequests.createdAt,
        staffName: admins.fullName
    })
    .from(appointmentRequests)
    .leftJoin(admins, eq(appointmentRequests.preferredStaffUsername, admins.username))
    .orderBy(appointmentRequests.createdAt)
    .execute();
}

export async function updateProfile(data: { fullName: string; email: string; bio?: string; password?: string }) {
    const session = await getSession() as any;
    if (!session || !session.id) throw new Error('Unauthorized');

    const updateData: any = {
        fullName: data.fullName,
        email: data.email,
        bio: data.bio, // Update bio
    };

    if (data.password && data.password.trim() !== '') {
        updateData.password = await hash(data.password, 10);
    }

    await db.update(admins).set(updateData).where(eq(admins.id, session.id)).execute();
    
    revalidatePath('/admin/profile');
    revalidatePath('/admin');
    return { success: true };
}

export async function updateAppointmentStatus(id: number, status: 'confirmed' | 'rejected') {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    await db.update(appointmentRequests)
        .set({ status })
        .where(eq(appointmentRequests.id, id))
        .execute();

    revalidatePath('/admin');
    return { success: true };
}

// --- Programming Actions ---

export async function getPrograms() {
    return await db.select().from(programs).orderBy(programs.date, programs.time).execute();
}

export async function getTodaysPrograms() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...

    const allPrograms = await db.select().from(programs).execute();

    return allPrograms.filter((p) => {
        // Direct date match
        if (p.date === todayStr) return true;

        // Recurring program check
        if (!p.isRecurring || !p.recurrencePattern) return false;

        try {
            const pattern = JSON.parse(p.recurrencePattern);

            // Check if ended
            if (pattern.endDate && pattern.endDate < todayStr) return false;

            // Check start date - don't show before the program's first date
            if (p.date && p.date > todayStr) return false;

            if (pattern.frequency === 'daily') return true;

            if (pattern.frequency === 'weekly') {
                return pattern.daysOfWeek?.includes(dayOfWeek) ?? false;
            }

            if (pattern.frequency === 'monthly') {
                const dayOfMonth = today.getDate();
                return pattern.dayOfMonth === dayOfMonth;
            }
        } catch {
            return false;
        }

        return false;
    });
}

export async function createProgram(data: {
    name: string;
    responsibleParty: string;
    date: string;
    time: string;
    isRecurring: boolean;
    recurrencePattern?: string | null;
    attendees: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    await db.insert(programs).values({
        name: data.name,
        responsibleParty: data.responsibleParty,
        date: data.date,
        time: data.time,
        isRecurring: data.isRecurring,
        recurrencePattern: data.recurrencePattern || null,
        attendees: data.attendees,
    }).execute();

    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
}

export async function updateProgram(data: {
    id: number;
    name: string;
    responsibleParty: string;
    date: string;
    time: string;
    isRecurring: boolean;
    recurrencePattern?: string | null;
    attendees: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    await db.update(programs).set({
        name: data.name,
        responsibleParty: data.responsibleParty,
        date: data.date,
        time: data.time,
        isRecurring: data.isRecurring,
        recurrencePattern: data.recurrencePattern || null,
        attendees: data.attendees,
    }).where(eq(programs.id, data.id)).execute();

    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
}

export async function deleteProgram(id: number) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    await db.delete(programs).where(eq(programs.id, id)).execute();
    revalidatePath('/');
    revalidatePath('/admin');
}
