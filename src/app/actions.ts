'use server';

import { db } from '@/db';
import { bookings, rooms, settings, admins, appointmentRequests, programs, laptops, laptopBookings } from '@/db/schema';
import { eq, and, gt, lt, gte, lte, or, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { compare, hash } from 'bcryptjs';
import { getSession, signSession, setSession, clearSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { sendBookingConfirmation, sendStaffNotification } from '@/lib/email';
import { loginLimiter, registrationLimiter, usernameCheckLimiter } from '@/lib/rate-limit';

// --- Weekly Hours Helpers ---

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = typeof DAY_KEYS[number];
type DayHours = { open: string; close: string; closed: boolean };
type WeeklyHours = Record<DayKey, DayHours>;

function parseWeeklyHours(raw: string | null | undefined): WeeklyHours | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed as WeeklyHours;
  } catch {
    return null;
  }
}

// Validates a [startTime, endTime] window (same calendar day) against a weeklyHours JSON.
// Throws with a friendly message if outside hours or on a closed day.
function assertWithinWeeklyHours(weeklyHoursRaw: string, startTime: Date, endTime: Date, label: string) {
  const wh = parseWeeklyHours(weeklyHoursRaw);
  if (!wh) throw new Error(`${label} hours are not configured.`);

  const dayKey = DAY_KEYS[startTime.getDay()];
  const dayHours = wh[dayKey];
  if (!dayHours || dayHours.closed) {
    throw new Error(`${label} is closed on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}.`);
  }

  const [openH, openM] = dayHours.open.split(':').map(Number);
  const [closeH, closeM] = dayHours.close.split(':').map(Number);
  const startTotal = startTime.getHours() * 60 + startTime.getMinutes();
  const endTotal = endTime.getHours() * 60 + endTime.getMinutes();
  const openTotal = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  if (startTotal < openTotal || endTotal > closeTotal) {
    throw new Error(`${label} is open ${dayHours.open} – ${dayHours.close} on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}.`);
  }
}

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

  usernameCheckLimiter.check(normalizedUsername);

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

  registrationLimiter.check(username);

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

  loginLimiter.check(username);

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

  const durationMs = data.endTime.getTime() - data.startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  if (durationHours > 3) {
    throw new Error('Maximum booking duration is 3 hours.');
  }

  assertWithinWeeklyHours(room.weeklyHours, data.startTime, data.endTime, room.name);

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

const DEFAULT_WEEKLY_HOURS_JSON = JSON.stringify({
  mon: { open: '09:00', close: '17:00', closed: false },
  tue: { open: '09:00', close: '17:00', closed: false },
  wed: { open: '09:00', close: '17:00', closed: false },
  thu: { open: '09:00', close: '17:00', closed: false },
  fri: { open: '09:00', close: '17:00', closed: false },
  sat: { open: '09:00', close: '17:00', closed: false },
  sun: { open: '09:00', close: '17:00', closed: true },
});

function readWeeklyHoursFromForm(formData: FormData): string {
  const raw = formData.get('weeklyHours') as string | null;
  if (!raw) return DEFAULT_WEEKLY_HOURS_JSON;
  // Validate it parses and has all 7 days, otherwise fall back to default
  const parsed = parseWeeklyHours(raw);
  if (!parsed) return DEFAULT_WEEKLY_HOURS_JSON;
  for (const k of DAY_KEYS) {
    if (!parsed[k]) return DEFAULT_WEEKLY_HOURS_JSON;
  }
  return raw;
}

export async function createRoom(formData: FormData) {
  const name = formData.get('name') as string;
  const capacity = parseInt(formData.get('capacity') as string);
  const description = formData.get('description') as string;
  const weeklyHours = readWeeklyHoursFromForm(formData);
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
    weeklyHours,
  }).execute();

  revalidatePath('/');
  revalidatePath('/admin');
}

export async function updateRoom(formData: FormData) {
  const id = parseInt(formData.get('id') as string);
  const name = formData.get('name') as string;
  const capacity = parseInt(formData.get('capacity') as string);
  const description = formData.get('description') as string;
  const weeklyHours = readWeeklyHoursFromForm(formData);
  const imageFile = formData.get('image') as File | null;

  const updateData: any = {
    name,
    capacity,
    description,
    weeklyHours,
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

// --- Laptop Actions ---

const LAPTOP_HOURS_KEY = 'laptopHours';

export async function getLaptops() {
    return await db.select().from(laptops).orderBy(asc(laptops.number)).execute();
}

export async function getLaptopHours(): Promise<string> {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, LAPTOP_HOURS_KEY) });
    return row?.value || DEFAULT_WEEKLY_HOURS_JSON;
}

export async function updateLaptopHours(weeklyHoursJson: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const parsed = parseWeeklyHours(weeklyHoursJson);
    if (!parsed) throw new Error('Invalid hours payload.');
    for (const k of DAY_KEYS) {
        if (!parsed[k]) throw new Error(`Missing hours for ${k}.`);
    }

    const existing = await db.query.settings.findFirst({ where: eq(settings.key, LAPTOP_HOURS_KEY) });
    if (existing) {
        await db.update(settings).set({ value: weeklyHoursJson }).where(eq(settings.key, LAPTOP_HOURS_KEY)).execute();
    } else {
        await db.insert(settings).values({ key: LAPTOP_HOURS_KEY, value: weeklyHoursJson }).execute();
    }

    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
}

// All laptop bookings overlapping a given calendar day
export async function getLaptopBookingsForDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select({
        id: laptopBookings.id,
        laptopId: laptopBookings.laptopId,
        startTime: laptopBookings.startTime,
        endTime: laptopBookings.endTime,
    }).from(laptopBookings).where(
        and(
            gte(laptopBookings.endTime, startOfDay),
            lte(laptopBookings.startTime, endOfDay)
        )
    ).execute();
}

export async function getAllLaptopBookings() {
    return await db.select({
        id: laptopBookings.id,
        laptopId: laptopBookings.laptopId,
        laptopNumber: laptops.number,
        customerName: laptopBookings.customerName,
        customerEmail: laptopBookings.customerEmail,
        customerPhone: laptopBookings.customerPhone,
        startTime: laptopBookings.startTime,
        endTime: laptopBookings.endTime,
        status: laptopBookings.status,
    })
    .from(laptopBookings)
    .leftJoin(laptops, eq(laptopBookings.laptopId, laptops.id))
    .orderBy(laptopBookings.startTime)
    .execute();
}

export async function createLaptopBooking(data: {
    userId?: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    idAgreed: boolean;
    startTime: Date;
    endTime: Date;
}) {
    if (!data.idAgreed) {
        throw new Error('You must agree to leave your ID or wallet with the PCC admin to receive a laptop.');
    }

    const durationHours = (data.endTime.getTime() - data.startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours <= 0) throw new Error('Invalid time range.');
    if (durationHours > 2) throw new Error('Maximum laptop reservation is 2 hours.');

    const hoursJson = await getLaptopHours();
    assertWithinWeeklyHours(hoursJson, data.startTime, data.endTime, 'Laptops');

    // Find the lowest-numbered laptop that has no overlapping booking
    const allLaptops = await db.select().from(laptops).orderBy(asc(laptops.number)).execute();
    if (allLaptops.length === 0) throw new Error('No laptops are configured.');

    let assigned: typeof allLaptops[number] | null = null;
    for (const laptop of allLaptops) {
        const conflict = await db.query.laptopBookings.findFirst({
            where: and(
                eq(laptopBookings.laptopId, laptop.id),
                gt(laptopBookings.endTime, data.startTime),
                lt(laptopBookings.startTime, data.endTime)
            )
        });
        if (!conflict) {
            assigned = laptop;
            break;
        }
    }

    if (!assigned) {
        throw new Error('All laptops are booked for that time. Please choose another slot.');
    }

    await db.insert(laptopBookings).values({
        laptopId: assigned.id,
        userId: data.userId || null,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        idAgreed: data.idAgreed,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'pending',
    }).execute();

    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true, laptopNumber: assigned.number };
}

export async function cancelLaptopBooking(id: number) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    await db.delete(laptopBookings).where(eq(laptopBookings.id, id)).execute();
    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
}
