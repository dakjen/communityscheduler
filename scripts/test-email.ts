/**
 * One-off test for the Brevo email integration.
 *
 * Usage:
 *   npx tsx scripts/test-email.ts you@email.com
 *
 * Loads BREVO_* vars from .env.local (no extra deps), then sends a sample
 * booking-confirmation email so you can verify formatting + deliverability.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env.local loader (shell env wins if already set).
function loadEnv(file: string) {
    try {
        const content = readFileSync(resolve(process.cwd(), file), 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq === -1) continue;
            const key = trimmed.slice(0, eq).trim();
            let val = trimmed.slice(eq + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!(key in process.env)) process.env[key] = val;
        }
    } catch {
        // .env.local missing — rely on shell env
    }
}

loadEnv('.env.local');

async function main() {
    const to = process.argv[2];
    if (!to) {
        console.error('Usage: npx tsx scripts/test-email.ts <recipient@email.com>');
        process.exit(1);
    }
    if (!process.env.BREVO_API_KEY) {
        console.error('BREVO_API_KEY is not set (checked .env.local and shell env). Add it and retry.');
        process.exit(1);
    }

    // Import AFTER env is loaded — email.ts reads env at module load.
    const { sendBookingConfirmation } = await import('../src/lib/email');

    const start = new Date();
    start.setHours(14, 0, 0, 0);
    const end = new Date();
    end.setHours(15, 0, 0, 0);

    console.log(`Sending test booking confirmation to ${to} via Brevo...`);
    await sendBookingConfirmation({
        customerName: 'Test User',
        customerEmail: to,
        purpose: 'Brevo Test Booking',
        startTime: start,
        endTime: end,
        roomName: 'Conference Room A',
    });
    console.log(
        'Send attempt complete. Check the inbox (and spam folder).\n' +
        'If nothing arrives, look above for a "Brevo send failed" line — that has the exact API error.'
    );
}

main();
