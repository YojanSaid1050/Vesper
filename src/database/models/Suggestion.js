const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  text: { type: String, required: true, maxlength: 1500 },
  status: { type: String, enum: ['open', 'approved', 'rejected'], default: 'open', index: true },
  reviewedBy: { type: String, default: null },
  reviewNote: { type: String, default: null, maxlength: 500 }
}, { timestamps: true });

suggestionSchema.index({ guildId: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);
