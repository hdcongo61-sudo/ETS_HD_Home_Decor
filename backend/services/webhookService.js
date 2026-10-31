const crypto = require('crypto');
const Webhook = require('../models/webhookModel');

const VALID_EVENTS = ['sale.created', 'payment.received', 'stock.updated'];

const signBody = (body, secret) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

const recordAttempt = (webhookId, status) => {
  Webhook.updateOne({ _id: webhookId }, { lastStatus: status, lastAttemptAt: new Date() }).catch(() => {});
};

// Distribue un événement aux webhooks actifs de la boutique (fire-and-forget).
// Ne lève jamais : les échecs sont journalisés et mémorisés sur le webhook.
const dispatchWebhookEvent = async (tenantId, event, data) => {
  if (!tenantId || !VALID_EVENTS.includes(event)) return;

  let webhooks;
  try {
    webhooks = await Webhook.find({ tenantId, active: true, events: event }).select('+secret').lean();
  } catch (error) {
    console.error('Webhook lookup error:', error.message);
    return;
  }

  for (const webhook of webhooks) {
    const body = JSON.stringify({
      event,
      sentAt: new Date().toISOString(),
      data,
    });

    const headers = { 'Content-Type': 'application/json' };
    if (webhook.secret) {
      headers['X-HD-Signature'] = `sha256=${signBody(body, webhook.secret)}`;
    }

    // Node 18+ dispose de fetch global.
    if (typeof fetch !== 'function') {
      console.error('Webhook delivery skipped: global fetch unavailable.');
      return;
    }

    fetch(webhook.url, { method: 'POST', headers, body, redirect: 'error' })
      .then((res) => recordAttempt(webhook._id, res.status))
      .catch((error) => {
        console.error(`Webhook delivery failed (${webhook.url}):`, error.message);
        recordAttempt(webhook._id, 0);
      });
  }
};

module.exports = { dispatchWebhookEvent, VALID_EVENTS };
