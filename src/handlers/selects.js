const { updateGuildSection } = require('../database/mongoManager');
const { generalPanel, botPanel, tiktokPanel, twitchPanel, youtubePanel } = require('../dashboard/panels');

async function handleSelect(interaction, client) {
  const guildId = interaction.guild.id;
  const channelId = interaction.values[0];

  const handlers = {
    general_welcome: () => updateGuildSection(guildId, 'general', { welcomeChannel: channelId }),
    general_goodbye: () => updateGuildSection(guildId, 'general', { goodbyeChannel: channelId }),
    general_log: () => updateGuildSection(guildId, 'general', { logChannel: channelId }),
    bot_log_channel: () => updateGuildSection(guildId, 'general', { botLogChannel: channelId }),
    tiktok_live_channel: () => updateGuildSection(guildId, 'tiktok', { liveChannel: channelId }),
    tiktok_video_channel: () => updateGuildSection(guildId, 'tiktok', { videoChannel: channelId }),
    twitch_live_channel: () => updateGuildSection(guildId, 'twitch', { liveChannel: channelId }),
    youtube_live_channel: () => updateGuildSection(guildId, 'youtube', { liveChannel: channelId }),
    youtube_video_channel: () => updateGuildSection(guildId, 'youtube', { videoChannel: channelId }),
    youtube_short_channel: () => updateGuildSection(guildId, 'youtube', { shortChannel: channelId })
  };

  const roleHandlers = {
    bot_role: () => updateGuildSection(guildId, 'general', { botRole: interaction.values[0] })
  };

  if (handlers[interaction.customId]) {
    handlers[interaction.customId]();
    
    const panelMap = {
      general_welcome: await generalPanel(guildId),
      general_goodbye: await generalPanel(guildId),
      general_log: await generalPanel(guildId),
      bot_log_channel: await botPanel(guildId),
      tiktok_live_channel: await tiktokPanel(guildId),
      tiktok_video_channel: await tiktokPanel(guildId),
      twitch_live_channel: await twitchPanel(guildId),
      youtube_live_channel: await youtubePanel(guildId),
      youtube_video_channel: await youtubePanel(guildId),
      youtube_short_channel: await youtubePanel(guildId)
    };
    
    return interaction.update(panelMap[interaction.customId]);
  }

  if (roleHandlers[interaction.customId]) {
    roleHandlers[interaction.customId]();
    return interaction.update(await botPanel(guildId));
  }
}

module.exports = { handleSelect };