const mongoose = require('mongoose');

const moderationCaseSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  action: { type: String, enum: ['warning', 'timeout', 'filter'], required: true, index: true },
  reason: { type: String, required: true, maxlength: 1000 },
  evidence: { type: String, default: null, maxlength: 1000 },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

moderationCaseSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationCase', moderationCaseSchema);
