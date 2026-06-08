const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSection, getGuildConfig } = require('../../database/guildManager');
const { mainPanel } = require('../../dashboard/panels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-dashboard')
    .setDescription('Crea o reinicia el dashboard de configuración.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);

    if (config.dashboard?.channel && config.dashboard?.message) {
      try {
        const oldChannel = await interaction.guild.channels.fetch(config.dashboard.channel);
        if (oldChannel) {
          const oldMessage = await oldChannel.messages.fetch(config.dashboard.message);
          if (oldMessage) await oldMessage.delete();
        }
      } catch {}
    }

    const message = await interaction.channel.send(await mainPanel(guildId));

    updateGuildSection(guildId, 'dashboard', {
      channel: interaction.channel.id,
      message: message.id,
      enabled: true
    });

    await interaction.reply({ content: '✅ Dashboard creado correctamente.', flags: 64 });
  }
};