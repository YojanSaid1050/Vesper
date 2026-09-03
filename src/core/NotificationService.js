const NotificationEvent = require('../database/models/NotificationEvent');
const { sendBrandedMessage, editBrandedMessage } = require('../utils/webhookSender');
const { isMainGuild } = require('../config/guildPolicy');

const RETRY_DELAYS = [5_000, 15_000, 45_000, 120_000];

function eventKey({ guildId, platform, account, eventType, eventId }) {
  return [guildId, platform, String(account).toLowerCase(), eventType, eventId].join(':');
}

function retentionDate() {
  const days = Math.max(1, Number(process.env.NOTIFICATION_HISTORY_DAYS || 90));
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function transientError(error) {
  const code = Number(error?.status || error?.statusCode || error?.code);
  if (code === 429 || code >= 500) return true;
  return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(String(error?.code || ''));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function claimNotification(data) {
  const key = eventKey(data);
  try {
    const event = await NotificationEvent.create({
      key,
      guildId: data.guildId,
      platform: data.platform,
      account: String(data.account).toLowerCase(),
      eventType: data.eventType,
      eventId: String(data.eventId),
      channelId: data.channelId || null,
      payload: data.payload || null,
      startedAt: data.startedAt || new Date(),
      expiresAt: retentionDate()
    });
    return { claimed: true, event };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const recovered = await NotificationEvent.findOneAndUpdate(
      {
        key,
        $or: [
          { status: 'failed' },
          { status: 'reserved', updatedAt: { $lt: staleBefore } }
        ]
      },
      {
        $set: {
          status: 'reserved',
          error: null,
          channelId: data.channelId || null,
          payload: data.payload || null,
          expiresAt: retentionDate()
        }
      },
      { returnDocument: 'after' }
    );
    if (recovered) return { claimed: true, event: recovered };
    const event = await NotificationEvent.findOne({ key });
    return { claimed: false, event };
  }
}

async function sendNotification(channel, payload, metadata) {
  const claim = await claimNotification({ ...metadata, channelId: channel.id, payload });
  if (!claim.claimed) return { sent: false, duplicate: true, event: claim.event };

  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const message = await sendBrandedMessage(channel, payload, { throwOnFailure: true });
      if (!message?.id) throw new Error('Discord no devolvió el mensaje enviado');
      claim.event.status = 'sent';
      claim.event.messageId = message.id;
      claim.event.attempts = attempt + 1;
      claim.event.sentAt = new Date();
      claim.event.error = null;
      await claim.event.save();
      return { sent: true, duplicate: false, message, event: claim.event };
    } catch (error) {
      lastError = error;
      claim.event.attempts = attempt + 1;
      if (!transientError(error) || attempt === RETRY_DELAYS.length) break;
      const jitter = Math.floor(Math.random() * 750);
      await sleep(RETRY_DELAYS[attempt] + jitter);
    }
  }

  claim.event.status = 'failed';
  claim.event.error = String(lastError?.message || lastError).slice(0, 500);
  await claim.event.save();
  return { sent: false, duplicate: false, error: lastError, event: claim.event };
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return `${hours} h ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
}

function endedPayload(payload, durationSeconds) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  const cleanMentions = value => String(value || '').replace(/<@&\d+>/g, '').replace(/[ \t]+\n/g, '\n');
  if (clone.content) clone.content = cleanMentions(clone.content);
  for (const container of clone.components || []) {
    for (const component of container.components || []) {
      if (component.type === 10 && component.content) component.content = cleanMentions(component.content);
    }
  }
  const statusLine = `\n\n**Transmisión finalizada · Duración: ${formatDuration(durationSeconds)}**`;
  const textComponent = clone.components?.[0]?.components?.find(component => component.type === 10);
  if (textComponent) textComponent.content += statusLine;
  else clone.content = `${clone.content || ''}${statusLine}`.trim();
  return clone;
}

async function completeActiveLive(channel, { guildId, platform, account }) {
  if (!isMainGuild(guildId)) return { updated: false, reason: 'main_only' };
  const event = await NotificationEvent.findOne({
    guildId,
    platform,
    account: String(account).toLowerCase(),
    eventType: 'live_started',
    status: 'sent'
  }).sort({ startedAt: -1 });
  if (!event?.messageId) return { updated: false, reason: 'not_found' };

  const endedAt = new Date();
  const durationSeconds = Math.max(0, (endedAt.getTime() - event.startedAt.getTime()) / 1000);
  await editBrandedMessage(channel, event.messageId, endedPayload(event.payload, durationSeconds));
  event.status = 'ended';
  event.endedAt = endedAt;
  event.durationSeconds = Math.round(durationSeconds);
  await event.save();
  return { updated: true, event };
}

async function recentNotifications(filters = {}, limit = 10) {
  return NotificationEvent.find(filters).sort({ createdAt: -1 }).limit(Math.min(25, Math.max(1, limit))).lean();
}

module.exports = {
  RETRY_DELAYS,
  eventKey,
  transientError,
  claimNotification,
  sendNotification,
  endedPayload,
  completeActiveLive,
  recentNotifications
};
