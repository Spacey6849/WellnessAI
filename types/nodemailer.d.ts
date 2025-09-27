declare module 'nodemailer' {
  interface TransportOptions {
    host: string;
    port: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  }
  interface SendMailOptions {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }
  interface Transporter {
    sendMail(opts: SendMailOptions): Promise<{ messageId?: string }>;
  }
  function createTransport(opts: TransportOptions): Transporter;
  export { createTransport };
  const _default: { createTransport: typeof createTransport };
  export default _default;
}
