const webpush = require('web-push');
const User = require('../models/userModel');

const CONTACT_EMAIL =
  process.env.VAPID_CONTACT_EMAIL ||
  process.env.NOTIFICATION_CONTACT_EMAIL ||
  process.env.NOTIFICATION_EMAIL ||
  'notifications@example.com';

const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-192.png';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'XOF',
  maximumFractionDigits: 0
});

let pushConfigured = false;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${CONTACT_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  pushConfigured = true;
} else {
  console.warn(
    'Push notifications are not configured. VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.'
  );
}

const isPushConfigured = () => pushConfigured;

const formatCurrency = (value) => {
  try {
    return currencyFormatter.format(Number(value) || 0);
  } catch (error) {
    return `${Number(value) || 0} CFA`;
  }
};

const sendNotification = async (payload, excludeUserId) => {
  if (!pushConfigured) {
    return;
  }

  const users = await User.find({ 'pushSubscriptions.0': { $exists: true } }).select(
    'pushSubscriptions'
  );

  if (!users.length) {
    return;
  }

  const notifications = [];

  users.forEach((user) => {
    if (excludeUserId && String(user._id) === String(excludeUserId)) {
      return;
    }

    user.pushSubscriptions.forEach((subscriptionDoc) => {
      const subscription = subscriptionDoc.toObject ? subscriptionDoc.toObject() : subscriptionDoc;
      notifications.push(
        webpush.sendNotification(subscription, JSON.stringify(payload)).catch(async (error) => {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await User.updateOne(
              { _id: user._id },
              { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } }
            );
          } else {
            console.error('Failed to send push notification', error);
          }
        })
      );
    });
  });

  if (notifications.length) {
    await Promise.allSettled(notifications);
  }
};

const notifySaleCreated = async ({ saleId, totalAmount, clientName, actorId }) => {
  const tag = `sale-${saleId}`;
  const payload = {
    title: 'Nouvelle vente enregistrée',
    body: `${clientName ? `${clientName} • ` : ''}Montant total : ${formatCurrency(totalAmount)}`,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag,
    data: {
      url: `/sales/${saleId}`,
      tag,
      type: 'sale.created',
      saleId,
      timestamp: Date.now()
    },
    vibrate: [150, 100, 150],
    renotify: true
  };

  await sendNotification(payload, actorId);
};

const notifyPaymentRecorded = async ({
  saleId,
  amount,
  clientName,
  remainingBalance,
  actorId
}) => {
  const parts = [`Montant : ${formatCurrency(amount)}`];
  if (remainingBalance > 0) {
    parts.push(`Reste : ${formatCurrency(remainingBalance)}`);
  } else {
    parts.push('Vente soldée');
  }

  const timestamp = Date.now();
  const tag = `payment-${saleId}-${timestamp}`;
  const payload = {
    title: 'Paiement enregistré',
    body: `${clientName ? `${clientName} • ` : ''}${parts.join(' • ')}`,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag,
    data: {
      url: `/sales/${saleId}`,
      tag,
      type: 'sale.payment',
      saleId,
      timestamp
    },
    vibrate: [150, 100, 150],
    renotify: true
  };

  await sendNotification(payload, actorId);
};

module.exports = {
  isPushConfigured,
  notifySaleCreated,
  notifyPaymentRecorded
};
