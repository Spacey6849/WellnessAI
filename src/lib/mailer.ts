// Simple Nodemailer helper for sending booking notifications.
// Environment variables (all optional except host/port if you want email):
// SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"/"false"), SMTP_USER, SMTP_PASS, SMTP_FROM
// If configuration is incomplete, sendBookingEmail will no-op and return a warning string.

import nodemailer from 'nodemailer';

interface BookingEmailParams {
  therapistEmail: string;
  therapistName?: string | null;
  date: string;      // YYYY-MM-DD
  slot: string;      // HH:MM
  meetUrl: string | null;
  notes: string | null;
  userEmail: string | null;   // authenticated user email
  contactEmail: string | null; // user-provided contact email
}

interface UserBookingEmailParams {
  to: string; // user email
  date: string;
  slot: string;
  meetUrl: string | null;
  notes: string | null;
}

// Using any for transporter because type definitions may be absent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedTransport: any | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTransport(): any | null {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  if (!host || !port) return null;
  try {
    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure: /^true$/i.test(process.env.SMTP_SECURE || ''),
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
    return cachedTransport;
  } catch {
    return null;
  }
}

export async function sendBookingEmail(params: BookingEmailParams): Promise<{ ok: boolean; warning?: string }> {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, warning: 'email_transport_unavailable' };
  }
  const from = process.env.SMTP_FROM || `Wellness Platform <no-reply@localhost>`;
  const subject = `New Booking Request: ${params.date} ${params.slot} (UTC)`;
  const safeNotes = (params.notes || '').slice(0, 4000);
  const meetLine = params.meetUrl ? `<p><strong>Meet Link:</strong> <a href="${params.meetUrl}">${params.meetUrl}</a></p>` : '<p><strong>Meet Link:</strong> (pending / not generated)</p>';
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;font-size:14px;color:#111">
      <h2 style="margin:0 0 12px">New Therapy Session Request</h2>
      <p>You have a new booking request.</p>
      <p><strong>Date:</strong> ${params.date}<br/>
         <strong>Time (UTC):</strong> ${params.slot}<br/>
         <strong>Client Contact Email:</strong> ${params.contactEmail || params.userEmail || 'n/a'}<br/>
         <strong>Account Email:</strong> ${params.userEmail || 'n/a'}</p>
      ${meetLine}
      ${safeNotes ? `<p><strong>Notes:</strong><br/>${safeNotes.replace(/\n/g,'<br/>')}</p>` : ''}
      <hr style="margin:24px 0"/>
      <p style="font-size:12px;color:#555">Automated notice from Wellness Platform. Do not reply directly if not monitored.</p>
    </div>
  `;
  try {
    await transport.sendMail({
      from,
      to: params.therapistEmail,
      subject,
      html,
      text: `New booking request for ${params.date} ${params.slot} UTC\nMeet: ${params.meetUrl || 'Pending'}\nContact: ${params.contactEmail || params.userEmail || 'n/a'}\nNotes: ${safeNotes}`
    });
    return { ok: true };
  } catch {
    return { ok: false, warning: 'email_send_failed' };
  }
}

export async function sendUserBookingEmail(params: UserBookingEmailParams): Promise<{ ok: boolean; warning?: string }> {
  const transport = getTransport();
  if (!transport) return { ok: false, warning: 'email_transport_unavailable' };
  const from = process.env.SMTP_FROM || `Wellness Platform <no-reply@localhost>`;
  const subject = `Your Session Request: ${params.date} ${params.slot} (UTC)`;
  const safeNotes = (params.notes || '').slice(0,4000);
  const meetLine = params.meetUrl ? `<p><strong>Google Meet Link:</strong> <a href="${params.meetUrl}">${params.meetUrl}</a></p>` : '<p><strong>Google Meet Link:</strong> Pending generation</p>';
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;font-size:14px;color:#111">
      <h2 style="margin:0 0 12px">Session Request Received</h2>
      <p>We received your booking request.</p>
      <p><strong>Date:</strong> ${params.date}<br/>
         <strong>Time (UTC):</strong> ${params.slot}</p>
      ${meetLine}
      ${safeNotes ? `<p><strong>Your Notes:</strong><br/>${safeNotes.replace(/\n/g,'<br/>')}</p>` : ''}
      <p>You will receive another email if anything changes.</p>
      <hr style="margin:24px 0"/>
      <p style="font-size:12px;color:#555">Thank you for using Wellness Platform.</p>
    </div>
  `;
  try {
    await transport.sendMail({ from, to: params.to, subject, html, text: `Booking request for ${params.date} ${params.slot} UTC. Meet: ${params.meetUrl || 'Pending'}` });
    return { ok: true };
  } catch { return { ok: false, warning: 'email_send_failed' }; }
}
