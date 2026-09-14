const { getGuildConfig } = require('../database/mongoManager');
const { monitorError } = require('./logger');
const { clampPayload } = require('./discordLimits');

const webhookCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const channelQueues = new Map();

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

async function sendBrandedMessageNow(channel, payload, options = {}) {
  try {
    const config = await getGuildConfig(channel.guild.id);
    const branding = config.branding || {};
    const profile = config.profile || {};
    const allowedRoleIds = [
      config.tiktok?.pingRole,
      config.twitch?.pingRole,
      config.youtube?.pingRole
    ].filter(Boolean);

    const webhook = await getWebhook(channel);
    
    if (webhook) {
      // Usar branding solo si está configurado, si no usar los valores del bot
      const webhookOptions = {
        ...payload,
        username: profile.displayName || branding.name || channel.client.user.username,
        avatarURL: profile.avatar || branding.avatar || channel.client.user.displayAvatarURL(),
        allowedMentions: {
          parse: [],
          roles: allowedRoleIds,
          users: []
        }
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
      return channel.send({
        ...payload,
        allowedMentions: { parse: [], roles: allowedRoleIds, users: [] }
      });
    }
  } catch (error) {
    monitorError('Webhook', 'Send Message', channel.guild.id, error, {
      channelId: channel.id
    });
    return channel.send({ ...payload, allowedMentions: { parse: [], roles: [], users: [] } }).catch(fallbackError => {
      monitorError('Webhook', 'Fallback Send', channel.guild.id, fallbackError);
      if (options.throwOnFailure) throw fallbackError;
      return null;
    });
  }
}

function enqueueChannel(channelId, operation) {
  const previous = channelQueues.get(channelId) || Promise.resolve();
  const current = previous.catch(() => null).then(operation);
  const queued = current.finally(() => {
    if (channelQueues.get(channelId) === queued) channelQueues.delete(channelId);
  });
  channelQueues.set(channelId, queued);
  return queued;
}

async function sendBrandedMessage(channel, payload, options = {}) {
  // Red de seguridad: si algo se pasa de los límites de Discord —un registro
  // con 40 campos, una lista de canales larguísima— se recorta aquí en vez de
  // que Discord rechace el mensaje entero y el aviso no llegue a publicarse.
  return enqueueChannel(channel.id, () => sendBrandedMessageNow(channel, clampPayload(payload), options));
}

async function editBrandedMessage(channel, messageId, payload) {
  return enqueueChannel(channel.id, async () => {
    const webhook = await getWebhook(channel);
    const safePayload = {
      ...payload,
      allowedMentions: { parse: [], roles: [], users: [] }
    };
    // El mensaje puede haberse publicado por el camino de respaldo (sin
    // webhook) o el webhook puede haberse borrado y recreado desde entonces.
    // En esos casos `editMessage` lanza «Unknown Message» y el aviso de
    // directo se quedaba para siempre sin marcar como terminado.
    if (webhook) {
      try {
        return await webhook.editMessage(messageId, safePayload);
      } catch {
        // se intenta por el canal, más abajo
      }
    }
    const message = await channel.messages.fetch(messageId);
    return message.edit(safePayload);
  });
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
  editBrandedMessage,
  clearWebhookCache
};
