const mongoose = require('mongoose');

const temporaryVoiceChannelSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: String, required: true, index: true },
  controlMessageId: { type: String, default: null },
  locked: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false }
}, { timestamps: true });

temporaryVoiceChannelSchema.index({ guildId: 1, ownerId: 1 });

module.exports = mongoose.model('TemporaryVoiceChannel', temporaryVoiceChannelSchema);
