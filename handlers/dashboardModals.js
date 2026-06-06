const {
  updateGuildSection,
  getGuildConfig,
  updateGuildConfig
} = require('../utils/guildManager');

const tiktokPanel =
  require('../functions/Embeds/dashboard/tiktokPanel');

const twitchPanel =
  require('../functions/Embeds/dashboard/twitchPanel');

const checkUser =
  require('../functions/TikTok/checkUser');

function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

module.exports = async function dashboardModals(interaction) {

  try {

    const guildId = interaction.guild.id;
    const config = getGuildConfig(guildId);

    config.tiktok ??= { users: [] };
    config.twitch ??= { users: [] };
    config.dashboard ??= {};

    switch (interaction.customId) {

      // =========================
      // BRANDING - NOMBRE
      // =========================
      case 'branding_name_modal': {

        const name =
          interaction.fields.getTextInputValue('server_name')?.trim();

        if (!name || name.length < 1) {
          return interaction.reply({
            flags: 64,
            content: '❌ Nombre inválido.'
          });
        }

        updateGuildSection(guildId, 'branding', {
          name
        });

        return interaction.reply({
          flags: 64,
          content: '✅ Nombre actualizado correctamente.'
        });
      }

      // =========================
      // BRANDING - AVATAR (VALIDADO)
      // =========================
      case 'branding_avatar_modal': {

        const avatar =
          interaction.fields.getTextInputValue('avatar_url')?.trim();

        if (!avatar || !isValidImageUrl(avatar)) {
          return interaction.reply({
            flags: 64,
            content:
              '❌ URL inválida. Debe ser un enlace directo a una imagen (.png .jpg .jpeg .gif .webp)'
          });
        }

        updateGuildSection(guildId, 'branding', {
          avatar
        });

        return interaction.reply({
          flags: 64,
          content: '✅ Avatar actualizado correctamente.'
        });
      }

      // =========================
      // TIKTOK - AÑADIR
      // =========================
      case 'tiktok_add_modal': {

        await interaction.deferReply({ flags: 64 });

        const username =
          interaction.fields.getTextInputValue('username')
            .replace('@', '')
            .trim()
            .toLowerCase();

        const user = await checkUser(username);

        if (!user?.exists) {
          return interaction.editReply({
            content: '❌ Esa cuenta TikTok no existe.'
          });
        }

        const realUser = user.username.toLowerCase();

        if (config.tiktok.users.includes(realUser)) {
          return interaction.editReply({
            content: '⚠️ Ese usuario ya está registrado.'
          });
        }

        config.tiktok.users.push(realUser);
        updateGuildConfig(guildId, config);

        try {
          const channel = await interaction.guild.channels.fetch(config.dashboard.channel);
          const message = await channel.messages.fetch(config.dashboard.message);

          await message.edit(tiktokPanel(guildId));

        } catch (err) {
          console.error('Error actualizando dashboard:', err);
        }

        return interaction.editReply({
          content: `✅ Usuario añadido: @${user.username}`
        });
      }

      // =========================
      // TIKTOK - ELIMINAR
      // =========================
      case 'tiktok_remove_modal': {

        await interaction.deferReply({ flags: 64 });

        const username =
          interaction.fields.getTextInputValue('username')
            .replace('@', '')
            .trim()
            .toLowerCase();

        if (!config.tiktok.users.includes(username)) {
          return interaction.editReply({
            content: '⚠️ Ese usuario no está registrado.'
          });
        }

        config.tiktok.users =
          config.tiktok.users.filter(u => u !== username);

        updateGuildConfig(guildId, config);

        try {
          const channel = await interaction.guild.channels.fetch(config.dashboard.channel);
          const message = await channel.messages.fetch(config.dashboard.message);

          await message.edit(tiktokPanel(guildId));

        } catch (err) {
          console.error('Error actualizando dashboard:', err);
        }

        return interaction.editReply({
          content: `✅ Usuario eliminado: @${username}`
        });
      }

      // =========================
      // TWITCH - AÑADIR
      // =========================
      case 'twitch_add_modal': {

        await interaction.deferReply({ flags: 64 });

        const username =
          interaction.fields.getTextInputValue('username')
            .replace('@', '')
            .trim()
            .toLowerCase();

        const checkStreamer =
          require('../functions/Twitch/checkStreamer');

        const data = await checkStreamer(username);

        if (!data?.exists) {
          return interaction.editReply({
            content: '❌ Ese canal de Twitch no existe.'
          });
        }

        if (config.twitch.users.includes(username)) {
          return interaction.editReply({
            content: '⚠️ Ese streamer ya está registrado.'
          });
        }

        config.twitch.users.push(username);
        updateGuildConfig(guildId, config);

        try {
          const channel = await interaction.guild.channels.fetch(config.dashboard.channel);
          const message = await channel.messages.fetch(config.dashboard.message);

          await message.edit(twitchPanel(guildId));

        } catch (err) {
          console.error('Error actualizando dashboard:', err);
        }

        return interaction.editReply({
          content: `✅ Streamer añadido: **${data.streamer || username}**`
        });
      }

      // =========================
      // TWITCH - ELIMINAR
      // =========================
      case 'twitch_remove_modal': {

        await interaction.deferReply({ flags: 64 });

        const username =
          interaction.fields.getTextInputValue('username')
            .replace('@', '')
            .trim()
            .toLowerCase();

        if (!config.twitch.users.includes(username)) {
          return interaction.editReply({
            content: '⚠️ Ese streamer no está registrado.'
          });
        }

        config.twitch.users =
          config.twitch.users.filter(u => u !== username);

        updateGuildConfig(guildId, config);

        try {
          const channel = await interaction.guild.channels.fetch(config.dashboard.channel);
          const message = await channel.messages.fetch(config.dashboard.message);

          await message.edit(twitchPanel(guildId));

        } catch (err) {
          console.error('Error actualizando dashboard:', err);
        }

        return interaction.editReply({
          content: `✅ Streamer eliminado: **${username}**`
        });
      }

    }

  } catch (error) {
    console.error('❌ Error dashboardModals', error);
  }

};