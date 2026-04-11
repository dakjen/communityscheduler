import { NextResponse } from 'next/server';
import { db } from '@/db';
import { bookings, rooms, appointmentRequests, admins } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { sendAppointmentReminder, sendStaffNotification } from '@/lib/email';

// Protect the endpoint with a secret
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify the request is from the cron job
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = { customerReminders: 0, staffReminders: 0 };

  // --- Customer Reminders: bookings starting in ~24 hours ---
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowWindowStart = new Date(tomorrow.getTime() - 30 * 60 * 1000); // 23.5h from now
  const tomorrowWindowEnd = new Date(tomorrow.getTime() + 30 * 60 * 1000);   // 24.5h from now

  const upcomingBookings = await db
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      purpose: bookings.purpose,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      roomName: rooms.name,
    })
    .from(bookings)
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(
      and(
        gte(bookings.startTime, tomorrowWindowStart),
        lte(bookings.startTime, tomorrowWindowEnd)
      )
    )
    .execute();

  for (const booking of upcomingBookings) {
    await sendAppointmentReminder({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      purpose: booking.purpose,
      startTime: booking.startTime,
      endTime: booking.endTime,
      roomName: booking.roomName || 'PCC Building',
    });
    results.customerReminders++;
  }

  // --- Staff Reminders: appointments starting in ~12 hours ---
  const twelveHours = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const staffWindowStart = new Date(twelveHours.getTime() - 30 * 60 * 1000);
  const staffWindowEnd = new Date(twelveHours.getTime() + 30 * 60 * 1000);

  // Get confirmed appointment requests in the 12h window
  const upcomingAppointments = await db
    .select()
    .from(appointmentRequests)
    .where(eq(appointmentRequests.status, 'confirmed'))
    .execute();

  for (const appt of upcomingAppointments) {
    // Parse the appointment datetime
    const [year, month, day] = appt.preferredDate.split('-').map(Number);
    const [hour, minute] = appt.preferredTime.split(':').map(Number);
    const apptTime = new Date(year, month - 1, day, hour, minute);

    // Check if it falls in the 12h reminder window
    if (apptTime >= staffWindowStart && apptTime <= staffWindowEnd) {
      // Find the staff member's email
      if (appt.preferredStaffUsername) {
        const staffMember = await db.query.admins.findFirst({
          where: eq(admins.username, appt.preferredStaffUsername),
        });

        if (staffMember?.email) {
          await sendStaffNotification({
            staffEmail: staffMember.email,
            clientName: appt.customerName,
            clientEmail: appt.customerEmail,
            purpose: appt.reason,
            date: appt.preferredDate,
            time: appt.preferredTime,
          });
          results.staffReminders++;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    sent: results,
    timestamp: now.toISOString(),
  });
}
