const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
} = require('discord.js');

const {
  getGuildConfig,
  updateGuildSection
} = require('../utils/guildManager');

const mainPanel =
  require('../functions/Embeds/dashboard/mainPanel');

const generalPanel =
  require('../functions/Embeds/dashboard/generalPanel');

const botPanel =
  require('../functions/Embeds/dashboard/botPanel');

const brandingPanel =
  require('../functions/Embeds/dashboard/brandingPanel');

const testPanel =
  require('../functions/Embeds/dashboard/testPanel');

const tiktokPanel =
  require('../functions/Embeds/dashboard/tiktokPanel');

const twitchPanel =
  require('../functions/Embeds/dashboard/twitchPanel');

module.exports =
  async function dashboardButtons(interaction) {

    // =========================
    // SAFE UPDATE (FIX 10062)
    // =========================
    const safeUpdate = async (data) => {
      try {
        if (!interaction.deferred && !interaction.replied) {
          return await interaction.update(data);
        }
      } catch (err) {
        if (err.code === 10062) return; // interacción expirada
        console.error('❌ Update error:', err);
      }
    };

    try {

      // ==================================
      // BRANDING - EDITAR NOMBRE
      // ==================================
      if (interaction.customId === 'branding_name') {

        const modal = new ModalBuilder()
          .setCustomId('branding_name_modal')
          .setTitle('Editar Nombre');

        const input = new TextInputBuilder()
          .setCustomId('server_name')
          .setLabel('Nombre del Bot')
          .setRequired(true)
          .setMaxLength(80)
          .setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==================================
      // BRANDING - EDITAR AVATAR
      // ==================================
      if (interaction.customId === 'branding_avatar') {

        const modal = new ModalBuilder()
          .setCustomId('branding_avatar_modal')
          .setTitle('Editar Avatar');

        const input = new TextInputBuilder()
          .setCustomId('avatar_url')
          .setLabel('URL de la Imagen')
          .setRequired(true)
          .setPlaceholder('https://imagen.com/avatar.png')
          .setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==================================
      // BRANDING - RESET
      // ==================================
      if (interaction.customId === 'branding_reset') {

        updateGuildSection(
          interaction.guild.id,
          'branding',
          { name: null, avatar: null }
        );

        return safeUpdate(
          brandingPanel(interaction.guild.id)
        );
      }

      // ==================================
      // TIKTOK - ADD
      // ==================================
      if (interaction.customId === 'tiktok_add_user') {

        const modal = new ModalBuilder()
          .setCustomId('tiktok_add_modal')
          .setTitle('Añadir Usuario TikTok');

        const input = new TextInputBuilder()
          .setCustomId('username')
          .setLabel('Usuario TikTok')
          .setPlaceholder('@usuario')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==================================
      // TIKTOK - REMOVE
      // ==================================
      if (interaction.customId === 'tiktok_remove_user') {

        const modal = new ModalBuilder()
          .setCustomId('tiktok_remove_modal')
          .setTitle('Eliminar Usuario TikTok');

        const input = new TextInputBuilder()
          .setCustomId('username')
          .setLabel('Usuario TikTok')
          .setPlaceholder('@usuario')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==================================
      // TIKTOK - LIST
      // ==================================
      if (interaction.customId === 'tiktok_list_users') {

  const config = getGuildConfig(interaction.guild.id);

  const users = config.tiktok?.users || [];

  // Detectar si ya está en modo list viendo el texto del mensaje
  const isAlreadyList =
    interaction.message?.components?.some(c =>
      JSON.stringify(c).includes('𝑼𝒔𝒆𝒓𝒔 𝑳𝒊𝒔𝒕')
    );

  const mode = isAlreadyList ? 'default' : 'list';

  const panel = tiktokPanel(interaction.guild.id, mode);

  return interaction.update(panel);
}

      // ==================================
      // TWITCH - ADD
      // ==================================
      if (interaction.customId === 'twitch_add_user') {

        const modal = new ModalBuilder()
          .setCustomId('twitch_add_modal')
          .setTitle('Añadir Usuario Twitch');

        const input = new TextInputBuilder()
          .setCustomId('username')
          .setLabel('Usuario Twitch')
          .setPlaceholder('nombre_canal')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==================================
      // TWITCH - REMOVE
      // ==================================
      if (interaction.customId === 'twitch_remove_user') {

        const modal = new ModalBuilder()
          .setCustomId('twitch_remove_modal')
          .setTitle('Eliminar Usuario Twitch');

        const input = new TextInputBuilder()
          .setCustomId('username')
          .setLabel('Usuario Twitch')
          .setPlaceholder('nombre_canal')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==================================
      // TWITCH - LIST
      // ==================================
      if (interaction.customId === 'twitch_list_users') {

  const config = getGuildConfig(interaction.guild.id);

  config.twitch.showUsers = !config.twitch.showUsers;

  updateGuildSection(interaction.guild.id, 'twitch', {
    showUsers: config.twitch.showUsers
  });

  const twitchPanel =
    require('../functions/Embeds/dashboard/twitchPanel');

  return interaction.update(
    twitchPanel(interaction.guild.id)
  );
}

      // ==================================
      // NAVEGACIÓN (FIX SEGURO)
      // ==================================
      let panel = null;

      switch (interaction.customId) {

        case 'dashboard_home':
          panel = mainPanel();
          break;

        case 'dashboard_general':
          panel = generalPanel(interaction.guild.id);
          break;

        case 'dashboard_bot':
          panel = botPanel(interaction.guild.id);
          break;

        case 'dashboard_branding':
          panel = brandingPanel(interaction.guild.id);
          break;

        case 'dashboard_tiktok':
          panel = tiktokPanel(interaction.guild.id);
          break;

        case 'dashboard_twitch':
          panel = twitchPanel(interaction.guild.id);
          break;

        case 'dashboard_tests':
          panel = testPanel(interaction.guild.id);
          break;
      }

      if (!panel) return;

      return safeUpdate(panel);

    } catch (error) {

      console.error('❌ Error dashboardButtons');
      console.error(error);

      if (error.code === 10062) return;

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Error en el dashboard.',
            flags: 64
          });
        }
      } catch {}
    }

  };