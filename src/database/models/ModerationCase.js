const mongoose = require('mongoose');
const crypto = require('crypto');

function createCaseId() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

const noteSchema = new mongoose.Schema({
  moderatorId: { type: String, required: true },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const moderationCaseSchema = new mongoose.Schema({
  caseId: { type: String, default: createCaseId },
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  action: { type: String, enum: ['warning', 'timeout', 'filter'], required: true, index: true },
  reason: { type: String, required: true, maxlength: 1000 },
  evidence: { type: String, default: null, maxlength: 1000 },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'resolved', 'revoked'], default: 'active', index: true },
  notes: { type: [noteSchema], default: [] },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, default: null }
}, { timestamps: true });

moderationCaseSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
moderationCaseSchema.index(
  { guildId: 1, caseId: 1 },
  { unique: true, partialFilterExpression: { caseId: { $type: 'string' } } }
);

moderationCaseSchema.statics.createCaseId = createCaseId;

module.exports = mongoose.model('ModerationCase', moderationCaseSchema);
