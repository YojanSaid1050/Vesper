const mongoose = require('mongoose');

const webAuditLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  actorDiscordId: { type: String, default: null, index: true },
  actorGoogleEmail: { type: String, default: null },
  action: { type: String, required: true, maxlength: 80, index: true },
  target: { type: String, default: null, maxlength: 160 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipHash: { type: String, default: null },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

webAuditLogSchema.index({ guildId: 1, createdAt: -1 });
webAuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.WebAuditLog || mongoose.model('WebAuditLog', webAuditLogSchema);
