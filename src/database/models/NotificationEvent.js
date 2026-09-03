const mongoose = require('mongoose');

const notificationEventSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  guildId: { type: String, required: true, index: true },
  platform: { type: String, required: true, enum: ['tiktok', 'twitch', 'youtube', 'system'], index: true },
  account: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  eventId: { type: String, required: true },
  status: { type: String, enum: ['reserved', 'sent', 'failed', 'ended'], default: 'reserved', index: true },
  channelId: { type: String, default: null },
  messageId: { type: String, default: null },
  payload: { type: mongoose.Schema.Types.Mixed, default: null },
  attempts: { type: Number, default: 0 },
  error: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  sentAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: null },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

notificationEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationEventSchema.index({ guildId: 1, platform: 1, createdAt: -1 });
notificationEventSchema.index({ guildId: 1, platform: 1, account: 1, eventType: 1, status: 1 });

module.exports = mongoose.model('NotificationEvent', notificationEventSchema);
