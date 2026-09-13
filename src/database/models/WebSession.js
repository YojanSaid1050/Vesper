const mongoose = require('mongoose');

const discordIdentitySchema = new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, required: true },
  globalName: { type: String, default: null },
  avatar: { type: String, default: null }
}, { _id: false });

const googleIdentitySchema = new mongoose.Schema({
  id: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  name: { type: String, default: null },
  picture: { type: String, default: null },
  verified: { type: Boolean, default: false }
}, { _id: false });

const webSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  csrfToken: { type: String, required: true },
  oauthStateHash: { type: String, default: null },
  oauthProvider: { type: String, enum: ['discord', 'google', null], default: null },
  discord: { type: discordIdentitySchema, default: null },
  google: { type: googleIdentitySchema, default: null },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

webSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.WebSession || mongoose.model('WebSession', webSessionSchema);
