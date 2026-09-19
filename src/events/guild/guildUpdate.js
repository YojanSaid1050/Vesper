// guildUpdate.js — cambios del propio servidor
const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { buildMessage } = require('../../core/EmbedCatalog');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

module.exports = {
  name: Events.GuildUpdate,
  async execute(oldGuild, newGuild) {
    // Solo interesa el nivel de mejora. El resto de cambios del servidor
    // (nombre, icono, banner) los registra Discord por su cuenta.
    if (oldGuild.premiumTier === newGuild.premiumTier) return;

    const guildConfig = await getGuildConfig(newGuild.id);
    if (!isModuleEnabledConfig(guildConfig, 'boosts')) return;

    const channelId = guildConfig.general?.boostChannel || guildConfig.general?.logChannel;
    const channel = channelId && newGuild.channels.cache.get(channelId);
    if (!channel) return;

    const subió = newGuild.premiumTier > oldGuild.premiumTier;
    await sendBrandedMessage(channel, buildMessage('boost_level', {
      config: guildConfig,
      vars: {
        server: newGuild.name,
        memberCount: newGuild.memberCount,
        boostLevel: newGuild.premiumTier,
        previousLevel: oldGuild.premiumTier,
        boostCount: newGuild.premiumSubscriptionCount ?? 0
      }
    }));
  }
};
