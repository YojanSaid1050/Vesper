const mongoose = require('mongoose');

const webIdentityLinkSchema = new mongoose.Schema({
  discord: {
    id: { type: String, required: true },
    username: { type: String, required: true },
    globalName: { type: String, default: null },
    avatar: { type: String, default: null }
  },
  google: {
    id: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    name: { type: String, default: null },
    picture: { type: String, default: null },
    verified: { type: Boolean, required: true }
  }
}, { timestamps: true });

webIdentityLinkSchema.index({ 'discord.id': 1 }, { unique: true });
webIdentityLinkSchema.index({ 'google.id': 1 }, { unique: true });

module.exports = mongoose.models.WebIdentityLink || mongoose.model('WebIdentityLink', webIdentityLinkSchema);
