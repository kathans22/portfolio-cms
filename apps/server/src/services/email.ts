import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const RESEND_KEY = process.env.RESEND_API_KEY;
let resendClient: Resend | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

if (RESEND_KEY) {
  resendClient = new Resend(RESEND_KEY);
  logger.info('Resend client initialized.');
} else if (
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASSWORD
) {
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  logger.info('Nodemailer SMTP Transporter initialized.');
} else {
  logger.warn('Neither Resend API key nor SMTP configuration found. Contact form emails will be logged directly to the server terminal output.');
}

interface EmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactNotification({ name, email, subject, message }: EmailPayload): Promise<boolean> {
  const htmlContent = `
    <h2>New Contact Form Submission</h2>
    <p><strong>From:</strong> ${name} (&lt;${email}&gt;)</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Message:</strong></p>
    <blockquote style="background: #f1f5f9; padding: 15px; border-left: 4px solid #6366f1; border-radius: 4px;">
      ${message.replace(/\n/g, '<br/>')}
    </blockquote>
  `;

  const textContent = `New Contact Submission\nFrom: ${name} (${email})\nSubject: ${subject}\nMessage:\n${message}`;

  try {
    if (resendClient) {
      await resendClient.emails.send({
        from: 'Portfolio Contact <onboarding@resend.dev>',
        to: process.env.CONTACT_RECEIVER_EMAIL || 'admin@portfolio.com',
        subject: `Contact Inquiry: ${subject}`,
        text: textContent,
        html: htmlContent,
      });
      logger.info('Email notification sent successfully via Resend API.');
      return true;
    }

    if (smtpTransporter) {
      await smtpTransporter.sendMail({
        from: `"${name}" <${email}>`,
        to: process.env.CONTACT_RECEIVER_EMAIL || 'admin@portfolio.com',
        subject: `Contact Inquiry: ${subject}`,
        text: textContent,
        html: htmlContent,
      });
      logger.info('Email notification sent successfully via SMTP.');
      return true;
    }

    logger.info({ name, email, subject, message }, 'CONTACT FORM SUBMISSION (no email provider configured)');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to send contact notification email');
    return false;
  }
}
