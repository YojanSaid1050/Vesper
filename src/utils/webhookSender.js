const { getGuildConfig } = require('../database/mongoManager');
const { monitorError } = require('./logger');

const webhookCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const rateLimits = new Map();

function getRateLimitKey(channelId) {
  return `webhook_${channelId}`;
}

async function checkRateLimit(channelId) {
  const key = getRateLimitKey(channelId);
  const now = Date.now();
  const limit = rateLimits.get(key);
  
  if (limit && now - limit.timestamp < 1000) {
    if (limit.count >= 5) return false;
    limit.count++;
  } else {
    rateLimits.set(key, { timestamp: now, count: 1 });
  }
  return true;
}

async function getWebhook(channel) {
  const cacheKey = `${channel.guild.id}_${channel.id}`;
  const cached = webhookCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.webhook;
  }
  
  try {
    const hooks = await channel.fetchWebhooks();
    let webhook = hooks.find(hook => hook.owner?.id === channel.client.user.id);
    
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'Vesper Bot',
        reason: 'Auto-created webhook for branded messages'
      });
    }
    
    webhookCache.set(cacheKey, {
      webhook: webhook,
      timestamp: Date.now()
    });
    
    return webhook;
  } catch (error) {
    monitorError('Webhook', 'Fetch/Create', channel.guild.id, error);
    return null;
  }
}

async function sendBrandedMessage(channel, payload) {
  try {
    const canSend = await checkRateLimit(channel.id);
    if (!canSend) {
      console.warn(`⚠️ Rate limit exceeded for channel ${channel.id}`);
      return null;
    }
    
    const config = await getGuildConfig(channel.guild.id);
    const branding = config.branding || {};

    const webhook = await getWebhook(channel);
    
    if (webhook) {
      // Usar branding solo si está configurado, si no usar los valores del bot
      const webhookOptions = {
        ...payload,
        username: branding.name || channel.client.user.username,
        avatarURL: branding.avatar || channel.client.user.displayAvatarURL()
      };
      
      if (payload.embeds && payload.embeds.length > 0) {
        webhookOptions.embeds = payload.embeds;
      }
      if (payload.content) {
        webhookOptions.content = payload.content;
      }
      if (payload.components) {
        webhookOptions.components = payload.components;
      }
      if (payload.files) {
        webhookOptions.files = payload.files;
      }
      
      return webhook.send(webhookOptions);
    } else {
      // Fallback a mensaje normal con el bot (sin branding personalizado)
      return channel.send(payload);
    }
  } catch (error) {
    monitorError('Webhook', 'Send Message', channel.guild.id, error, {
      channelId: channel.id
    });
    return channel.send(payload).catch(fallbackError => {
      monitorError('Webhook', 'Fallback Send', channel.guild.id, fallbackError);
      return null;
    });
  }
}

function clearWebhookCache(guildId = null) {
  if (guildId) {
    for (const [key, value] of webhookCache.entries()) {
      if (key.startsWith(guildId)) {
        webhookCache.delete(key);
      }
    }
  } else {
    webhookCache.clear();
  }
  console.log(`🗑️ Webhook cache cleared${guildId ? ` for guild ${guildId}` : ''}`);
}

module.exports = { 
  sendBrandedMessage,
  clearWebhookCache
};