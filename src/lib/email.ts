import crypto from 'crypto';

// Lazy import nodemailer only if env present to avoid SSR bundle weight when unused
async function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT) return null;
  try {
    const nodemailer = await import('nodemailer');
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10),
      secure: parseInt(SMTP_PORT, 10) === 465,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  } catch {
    return null;
  }
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(opts: SendEmailOptions) {
  const transport = await getTransport();
  const from = process.env.EMAIL_FROM || 'no-reply@wellness.local';
  if (!transport) {
    console.warn('[email] Transport not configured. Email would be:', { ...opts, from });
    return { queued: false, simulated: true };
  }
  await transport.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
  return { queued: true };
}

export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex'); // hex string 64 chars by default
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function resetLink(baseUrl: string, token: string) {
  const url = new URL(baseUrl.replace(/\/$/, '') + '/reset');
  url.searchParams.set('token', token);
  return url.toString();
}
