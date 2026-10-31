const nodemailer = require('nodemailer');

// Envoi d'emails via SMTP (config .env). Sans SMTP configuré, sendEmail est
// un no-op documenté : les rappels restent tracés sans échec bloquant.

let transport = null;
let configured = null;

const isEmailConfigured = () => {
  if (configured === null) {
    configured = Boolean(
      process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS
    );
  }
  return configured;
};

const getTransport = () => {
  if (!isEmailConfigured()) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transport;
};

// Retourne { sent: true } ou { sent: false, reason/error } — ne lève jamais.
const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) {
    return { sent: false, reason: 'missing_recipient' };
  }
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'smtp_not_configured' };
  }
  try {
    const from = process.env.EMAIL_FROM_NAME
      ? `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`
      : process.env.EMAIL_USER;
    await getTransport().sendMail({ from, to, subject, text, html });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message };
  }
};

module.exports = { sendEmail, isEmailConfigured };
