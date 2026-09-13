const mongoose = require('mongoose');

const starboardEntrySchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  sourceMessageId: { type: String, required: true },
  sourceChannelId: { type: String, required: true },
  starboardMessageId: { type: String, required: true },
  authorId: { type: String, required: true },
  count: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

starboardEntrySchema.index({ guildId: 1, sourceMessageId: 1 }, { unique: true });

module.exports = mongoose.model('StarboardEntry', starboardEntrySchema);
