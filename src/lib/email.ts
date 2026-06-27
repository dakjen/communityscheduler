import { format } from 'date-fns';

// Brevo (formerly Sendinblue) transactional email — sent via the REST API with fetch,
// so no SDK dependency is required. Free tier allows 300 emails/day.
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const FROM_NAME = 'NINETYFOURTEN';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@ninetyfourten.com';
const REPLY_TO_EMAIL = process.env.BREVO_REPLY_TO_EMAIL || process.env.SENDGRID_REPLY_TO_EMAIL || FROM_EMAIL;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://booking.ninetyfourten.com';

const BRAND_COLOR = '#b00d0f';

type DetailRow = { label: string; value: string };

/**
 * Renders a branded, email-client-safe HTML message with a details table and CTA button.
 */
function buildEmailHtml(opts: {
  heading: string;
  greeting: string;
  intro: string;
  rows: DetailRow[];
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const rowsHtml = opts.rows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;width:130px;vertical-align:top;">${r.label}</td>
          <td style="padding:8px 0;color:#111827;font-size:15px;font-weight:600;">${r.value}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:${BRAND_COLOR};padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.08em;">${FROM_NAME}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">${opts.heading}</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#374151;">${opts.greeting}</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.5;">${opts.intro}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:8px 16px;margin-bottom:28px;">
              ${rowsHtml}
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="border-radius:8px;background-color:${BRAND_COLOR};">
                <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${opts.ctaLabel}</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
              PCC Building &middot; NINETYFOURTEN<br>
              This is an automated message. Reply to reach us at ${REPLY_TO_EMAIL}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Low-level Brevo send. Errors are logged and swallowed so a failed email never breaks
 * the booking/appointment flow (matching prior behavior).
 */
async function sendEmail(opts: { to: string; toName?: string; subject: string; html: string }): Promise<void> {
  if (!BREVO_API_KEY) {
    console.error(`BREVO_API_KEY is not set; skipping email to ${opts.to}`);
    return;
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: opts.to, ...(opts.toName ? { name: opts.toName } : {}) }],
        replyTo: { email: REPLY_TO_EMAIL },
        subject: opts.subject,
        htmlContent: opts.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Brevo send failed (${res.status}) to ${opts.to}: ${body}`);
      return;
    }
    console.log(`Email sent to ${opts.to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

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

  await sendEmail({
    to: data.customerEmail,
    toName: data.customerName,
    subject: `Booking confirmed: ${data.purpose}`,
    html: buildEmailHtml({
      heading: 'Your booking is confirmed',
      greeting: `Hi ${firstName},`,
      intro: 'Your room booking at the PCC Building is confirmed. Here are the details:',
      rows: [
        { label: 'Event', value: data.purpose },
        { label: 'Date', value: format(new Date(data.startTime), 'EEEE, MMMM d, yyyy') },
        { label: 'Time', value: `${format(new Date(data.startTime), 'h:mm a')} – ${format(new Date(data.endTime), 'h:mm a')}` },
        { label: 'Location', value: data.roomName },
      ],
      ctaLabel: 'View Details',
      ctaUrl: SITE_URL,
    }),
  });
}

/**
 * Acknowledge a room request that still needs approval (e.g. Community Room).
 */
export async function sendBookingRequestReceived(data: {
  customerName: string;
  customerEmail: string;
  purpose: string;
  startTime: Date;
  endTime: Date;
  roomName: string;
}) {
  const firstName = data.customerName.split(' ')[0];

  await sendEmail({
    to: data.customerEmail,
    toName: data.customerName,
    subject: `Request received: ${data.purpose}`,
    html: buildEmailHtml({
      heading: 'We received your request',
      greeting: `Hi ${firstName},`,
      intro: `Thanks for your request to use the ${data.roomName}. It's pending approval — we'll email you again as soon as it's reviewed.`,
      rows: [
        { label: 'Event', value: data.purpose },
        { label: 'Date', value: format(new Date(data.startTime), 'EEEE, MMMM d, yyyy') },
        { label: 'Time', value: `${format(new Date(data.startTime), 'h:mm a')} – ${format(new Date(data.endTime), 'h:mm a')}` },
        { label: 'Location', value: data.roomName },
        { label: 'Status', value: 'Pending approval' },
      ],
      ctaLabel: 'View Details',
      ctaUrl: SITE_URL,
    }),
  });
}

/**
 * Notify a requester that their room request was declined.
 */
export async function sendBookingDeclined(data: {
  customerName: string;
  customerEmail: string;
  purpose: string;
  startTime: Date;
  endTime: Date;
  roomName: string;
}) {
  const firstName = data.customerName.split(' ')[0];

  await sendEmail({
    to: data.customerEmail,
    toName: data.customerName,
    subject: `Update on your request: ${data.purpose}`,
    html: buildEmailHtml({
      heading: 'Your request was not approved',
      greeting: `Hi ${firstName},`,
      intro: `Unfortunately we couldn't approve your request for the ${data.roomName} at the time below. Please feel free to submit a new request for a different time, or reach out with questions.`,
      rows: [
        { label: 'Event', value: data.purpose },
        { label: 'Date', value: format(new Date(data.startTime), 'EEEE, MMMM d, yyyy') },
        { label: 'Time', value: `${format(new Date(data.startTime), 'h:mm a')} – ${format(new Date(data.endTime), 'h:mm a')}` },
        { label: 'Location', value: data.roomName },
      ],
      ctaLabel: 'Submit a New Request',
      ctaUrl: SITE_URL,
    }),
  });
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
  await sendEmail({
    to: data.staffEmail,
    subject: `New appointment request from ${data.clientName}`,
    html: buildEmailHtml({
      heading: 'New appointment request',
      greeting: 'Hello,',
      intro: `${data.clientName} (${data.clientEmail}) has requested an appointment. Review it in the admin dashboard:`,
      rows: [
        { label: 'Client', value: `${data.clientName} (${data.clientEmail})` },
        { label: 'Purpose', value: data.purpose },
        { label: 'Date', value: data.date },
        { label: 'Time', value: data.time },
        { label: 'Location', value: data.location || 'PCC Building' },
      ],
      ctaLabel: 'Open Admin Dashboard',
      ctaUrl: `${SITE_URL}/admin`,
    }),
  });
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

  await sendEmail({
    to: data.customerEmail,
    toName: data.customerName,
    subject: `Reminder: ${data.purpose} on ${format(new Date(data.startTime), 'MMM d')}`,
    html: buildEmailHtml({
      heading: 'Appointment reminder',
      greeting: `Hi ${firstName},`,
      intro: 'This is a friendly reminder about your upcoming appointment at the PCC Building:',
      rows: [
        { label: 'Event', value: data.purpose },
        { label: 'Date', value: format(new Date(data.startTime), 'EEEE, MMMM d, yyyy') },
        { label: 'Time', value: `${format(new Date(data.startTime), 'h:mm a')} – ${format(new Date(data.endTime), 'h:mm a')}` },
        { label: 'Location', value: data.roomName },
      ],
      ctaLabel: 'View Details',
      ctaUrl: SITE_URL,
    }),
  });
}
