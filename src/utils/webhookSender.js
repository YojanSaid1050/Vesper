const { getGuildConfig } = require('../database/guildManager');

async function sendBrandedMessage(channel, payload) {
  try {
    const config = getGuildConfig(channel.guild.id);
    const branding = config.branding || {};

    if (!branding.name && !branding.avatar) {
      return channel.send(payload);
    }

    const hooks = await channel.fetchWebhooks();
    let webhook = hooks.find(hook => hook.owner?.id === channel.client.user.id);

    if (!webhook) {
      webhook = await channel.createWebhook({ name: 'Custom Branding' });
    }

    return webhook.send({
      username: branding.name || channel.client.user.username,
      avatarURL: branding.avatar || channel.client.user.displayAvatarURL(),
      ...payload
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return channel.send(payload);
  }
}

module.exports = { sendBrandedMessage };