import sgMail from '@sendgrid/mail';
import { format } from 'date-fns';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@ninetyfourten.com';
const REPLY_TO_EMAIL = process.env.SENDGRID_REPLY_TO_EMAIL || FROM_EMAIL;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://booking.ninetyfourten.com';

// SendGrid dynamic template IDs
const TEMPLATES = {
  bookingConfirmation: 'd-22cb464666f24f39a24f60b884f80d94',
  appointmentReminder: 'd-d95db8ae9a2a4762a55ae0018e875350',
  staffNotification: 'd-a786c820e5154be59fc78110469e7984',
};

/**
 * Send booking confirmation email to the customer
 */
export async function sendBookingConfirmation(data: {
  customerName: string;
  customerEmail: string;
  purpose: string;
  startTime: Date;
  endTime: Date;
  roomName: string;
}) {
  const firstName = data.customerName.split(' ')[0];

  try {
    await sgMail.send({
      to: data.customerEmail,
      from: { email: FROM_EMAIL, name: 'NINETYFOURTEN' },
      replyTo: REPLY_TO_EMAIL,
      templateId: TEMPLATES.bookingConfirmation,
      dynamicTemplateData: {
        First_Name: firstName,
        Event_Name: data.purpose,
        Event_Date: format(new Date(data.startTime), 'EEEE, MMMM d, yyyy'),
        Event_Time: `${format(new Date(data.startTime), 'h:mm a')} – ${format(new Date(data.endTime), 'h:mm a')}`,
        Event_Location: data.roomName,
        Event_Link: SITE_URL,
      },
    });
    console.log(`Booking confirmation sent to ${data.customerEmail}`);
  } catch (error) {
    console.error('Failed to send booking confirmation:', error);
  }
}

/**
 * Send notification email to staff when an appointment is requested
 */
export async function sendStaffNotification(data: {
  staffEmail: string;
  clientName: string;
  clientEmail: string;
  purpose: string;
  date: string;
  time: string;
  location?: string;
}) {
  try {
    await sgMail.send({
      to: data.staffEmail,
      from: { email: FROM_EMAIL, name: 'NINETYFOURTEN' },
      replyTo: REPLY_TO_EMAIL,
      templateId: TEMPLATES.staffNotification,
      dynamicTemplateData: {
        Client_Name: data.clientName,
        Client_Email: data.clientEmail,
        Event_Name: data.purpose,
        Event_Date: data.date,
        Event_Time: data.time,
        Event_Location: data.location || 'PCC Building',
        Admin_Link: `${SITE_URL}/admin`,
      },
    });
    console.log(`Staff notification sent to ${data.staffEmail}`);
  } catch (error) {
    console.error('Failed to send staff notification:', error);
  }
}

/**
 * Send appointment reminder email to the customer
 */
export async function sendAppointmentReminder(data: {
  customerName: string;
  customerEmail: string;
  purpose: string;
  startTime: Date;
  endTime: Date;
  roomName: string;
}) {
  const firstName = data.customerName.split(' ')[0];

  try {
    await sgMail.send({
      to: data.customerEmail,
      from: { email: FROM_EMAIL, name: 'NINETYFOURTEN' },
      replyTo: REPLY_TO_EMAIL,
      templateId: TEMPLATES.appointmentReminder,
      dynamicTemplateData: {
        First_Name: firstName,
        Event_Name: data.purpose,
        Event_Date: format(new Date(data.startTime), 'EEEE, MMMM d, yyyy'),
        Event_Time: `${format(new Date(data.startTime), 'h:mm a')} – ${format(new Date(data.endTime), 'h:mm a')}`,
        Event_Location: data.roomName,
        Event_Link: SITE_URL,
      },
    });
    console.log(`Appointment reminder sent to ${data.customerEmail}`);
  } catch (error) {
    console.error('Failed to send appointment reminder:', error);
  }
}
