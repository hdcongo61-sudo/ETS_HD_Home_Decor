// Helpers to build WhatsApp / phone reminders for clients with an unpaid balance.
// The shop's international dialing code (e.g. "+242") is configured per tenant
// by the super-admin and exposed on auth.tenant.dialCode.

import api from '../services/api';

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

export const REMINDER_CHANNEL_LABEL = {
  whatsapp: 'WhatsApp',
  call: 'Appel',
  sms: 'SMS',
  manual: 'Manuel',
};

// Log a collection follow-up on a sale. Fire-and-forget: failures are swallowed
// so they never block opening WhatsApp / the phone dialer.
export const recordReminder = (saleId, channel, note = '') =>
  api.post(`/sales/${saleId}/remind`, { channel, note }).then((r) => r.data).catch(() => null);

export const formatReminderAgo = (date) => {
  if (!date) return '';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} j`;
};

const fmtCFA = (n) => `${Number(n || 0).toLocaleString('fr-FR')} CFA`;

/**
 * Normalise a client phone number to an international, digits-only form
 * suitable for wa.me: the shop dial code (e.g. +242) directly followed by the
 * client number AS STORED. The local leading 0 is KEPT (Congo +242 keeps it,
 * e.g. +242 06 XXX XXXX). Falls back to a best effort when no dial code is set.
 */
export const normalizePhone = (phone, dialCode) => {
  const raw = String(phone || '').trim();
  const d = onlyDigits(raw);
  if (!d) return '';
  const dial = onlyDigits(dialCode);
  // Already international (typed with a leading +) → use as-is.
  if (raw.startsWith('+')) return d;
  // Already prefixed with the country code → use as-is.
  if (dial && d.startsWith(dial)) return d;
  // Otherwise: dial code followed by the client number (no trunk-0 stripping).
  return dial ? dial + d : d;
};

export const canWhatsApp = (phone) => onlyDigits(phone).length >= 6;

/**
 * Graduated, polite French reminder message. Tone firms up with lateness.
 */
export const buildReminderMessage = ({ clientName, shopName, balance, lastPaymentLabel, daysSince }) => {
  const hello = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
  const shop = shopName || 'notre boutique';
  const solde = fmtCFA(balance);
  const lp = lastPaymentLabel ? ` Votre dernier paiement date du ${lastPaymentLabel}.` : '';

  let core;
  if (daysSince == null || daysSince <= 15) {
    core = `nous revenons vers vous concernant votre commande chez ${shop}. Il reste un solde de ${solde} à régler.${lp} Merci de nous indiquer quand vous pourrez passer.`;
  } else if (daysSince <= 30) {
    core = `nous vous rappelons que votre commande chez ${shop} présente un solde impayé de ${solde}.${lp} Merci de bien vouloir régulariser dès que possible.`;
  } else {
    core = `votre commande chez ${shop} reste impayée depuis un certain temps : solde dû de ${solde}.${lp} Nous vous prions de régulariser votre situation rapidement. N'hésitez pas à nous contacter pour convenir d'un arrangement.`;
  }
  return `${hello} ${core}\n\nMerci, ${shop}.`;
};

export const whatsAppLink = (phone, dialCode, message) => {
  const num = normalizePhone(phone, dialCode);
  if (!num) return '';
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
};

export const telLink = (phone) => {
  const raw = String(phone || '').trim();
  const num = raw.startsWith('+') ? `+${onlyDigits(raw)}` : onlyDigits(raw);
  return num ? `tel:${num}` : '';
};
