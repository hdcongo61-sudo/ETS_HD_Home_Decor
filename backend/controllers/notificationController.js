const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const { isPushConfigured } = require('../utils/pushNotifications');

const getPublicKey = asyncHandler(async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({
      message: 'Push notifications are not configured on the server.'
    });
  }

  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

const subscribe = asyncHandler(async (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({
      message: 'Push notifications are not enabled on this server.'
    });
  }

  const { subscription, metadata } = req.body || {};

  if (
    !subscription ||
    !subscription.endpoint ||
    !subscription.keys ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    return res.status(400).json({ message: 'Invalid subscription payload.' });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }

  const existingSubscription = user.pushSubscriptions.find(
    (item) => item.endpoint === subscription.endpoint
  );

  if (existingSubscription) {
    existingSubscription.expirationTime =
      typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null;
    existingSubscription.keys = {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    };
    existingSubscription.device = {
      platform: metadata?.platform || '',
      userAgent: metadata?.userAgent || '',
      language: metadata?.language || ''
    };
    existingSubscription.updatedAt = new Date();
    await user.save();
    return res.json({ message: 'Subscription updated' });
  }

  user.pushSubscriptions.push({
    endpoint: subscription.endpoint,
    expirationTime:
      typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    },
    device: {
      platform: metadata?.platform || '',
      userAgent: metadata?.userAgent || '',
      language: metadata?.language || ''
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await user.save();

  res.status(201).json({ message: 'Subscription registered' });
});

const unsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = req.body || {};

  if (!endpoint) {
    return res.status(400).json({ message: 'Subscription endpoint is required.' });
  }

  await User.updateOne(
    { _id: req.user._id },
    { $pull: { pushSubscriptions: { endpoint } } }
  );

  res.json({ message: 'Subscription removed' });
});

module.exports = {
  getPublicKey,
  subscribe,
  unsubscribe
};
