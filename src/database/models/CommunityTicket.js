const mongoose = require('mongoose');
const crypto = require('crypto');

function createTicketId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

const communityTicketSchema = new mongoose.Schema({
  ticketId: { type: String, default: createTicketId },
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true },
  subject: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  closedBy: { type: String, default: null },
  closeReason: { type: String, default: null, maxlength: 500 },
  closedAt: { type: Date, default: null },
  transcriptMessageId: { type: String, default: null }
}, { timestamps: true });

communityTicketSchema.index({ guildId: 1, userId: 1, status: 1 });
communityTicketSchema.index({ guildId: 1, ticketId: 1 }, { unique: true });
communityTicketSchema.statics.createTicketId = createTicketId;

module.exports = mongoose.model('CommunityTicket', communityTicketSchema);
