const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { clampEmbed } = require('../../utils/discordLimits');
const {
  getGuildConfig,
  updateGuildSection,
  addGuildListItem,
  removeGuildListItem
} = require('../../database/mongoManager');
const { MODULE_DEFAULTS } = require('../../config/guildPolicy');
const { setupChecks, moduleSummary, mentionList } = require('../../core/SetupService');

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const CAPABILITY_FIELDS = {
  redes: 'socialManagerRoles',
  moderacion: 'moderatorRoles',
  dj: 'musicDjRoles'
};
const EXEMPTION_FIELDS = { canal: 'exemptChannels', rol: 'exemptRoles' };

function optionalChannel(option, name, description) {
  return option.setName(name).setDescription(description).addChannelTypes(...TEXT_CHANNEL_TYPES);
}

// Devuelve true si se puede escribir, false si no, y null si no se pudo
// comprobar. Antes las dos últimas situaciones se confundían: cuando el
// miembro del bot no estaba en caché, `permissionsFor` devolvía null y
// canales perfectamente válidos se rechazaban con un mensaje que no era
// cierto.
function channelWritable(interaction, channel) {
  const me = interaction.guild.members.me;
  if (!me) return null;
  const permissions = channel.permissionsFor(me);
  if (!permissions) return null;
  return permissions.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks
  ]);
}

function statusEmbed(guild, config) {
  const status = setupChecks(config);
  return new EmbedBuilder()
    .setTitle(`Configuración de ${guild.name}`)
    .setDescription(`Progreso orientativo: **${status.percentage}%** (${status.ready}/${status.total})`)
    .setColor(status.percentage === 100 ? 0x57F287 : status.percentage >= 60 ? 0xFEE75C : 0xED4245)
    .addFields(
      { name: 'Comprobaciones', value: status.checks.map(check => `${check.ready ? '✅' : '⬜'} ${check.label}`).join('\n'), inline: true },
      { name: 'Módulos', value: moduleSummary(config), inline: true },
      { name: 'Gestores de redes', value: mentionList(config.permissions?.socialManagerRoles) },
      { name: 'Moderadores', value: mentionList(config.permissions?.moderatorRoles), inline: true },
      { name: 'DJ', value: mentionList(config.permissions?.musicDjRoles), inline: true },
      { name: 'Exclusiones', value: `Canales: ${mentionList(config.moderation?.exemptChannels, 'channel')}\nRoles: ${mentionList(config.moderation?.exemptRoles)}` }
    )
    .setFooter({ text: 'Usa los demás subcomandos de /vesper-setup para completar la configuración' })
    .setTimestamp();
}

module.exports = {
  capability: CAPABILITIES.GUILD_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-setup')
    .setDescription('Configura Vesper paso a paso en este servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(command => command
      .setName('estado')
      .setDescription('Muestra el progreso y los elementos pendientes.'))
    .addSubcommand(command => command
      .setName('canales')
      .setDescription('Asigna los canales principales de Vesper.')
      .addChannelOption(option => optionalChannel(option, 'bienvenida', 'Canal de bienvenida'))
      .addChannelOption(option => optionalChannel(option, 'despedida', 'Canal de despedida'))
      .addChannelOption(option => optionalChannel(option, 'logs', 'Canal de registros'))
      .addChannelOption(option => optionalChannel(option, 'bot_logs', 'Canal de registros de bots'))
      .addChannelOption(option => optionalChannel(option, 'musica', 'Canal para solicitudes de música'))
      .addChannelOption(option => optionalChannel(option, 'tiktok_live', 'Alertas de directos de TikTok'))
      .addChannelOption(option => optionalChannel(option, 'tiktok_videos', 'Alertas de videos de TikTok'))
      .addChannelOption(option => optionalChannel(option, 'twitch_live', 'Alertas de directos de Twitch'))
      .addChannelOption(option => optionalChannel(option, 'youtube_live', 'Alertas de directos de YouTube'))
      .addChannelOption(option => optionalChannel(option, 'youtube_videos', 'Alertas de videos de YouTube'))
      .addChannelOption(option => optionalChannel(option, 'youtube_shorts', 'Alertas de Shorts de YouTube'))
      .addRoleOption(option => option.setName('rol_bots').setDescription('Rol automático para bots'))
      .addStringOption(option => option.setName('limpiar').setDescription('Borra una asignación existente').addChoices(
        { name: 'Bienvenida', value: 'general.welcomeChannel' },
        { name: 'Despedida', value: 'general.goodbyeChannel' },
        { name: 'Logs', value: 'general.logChannel' },
        { name: 'Logs de bots', value: 'general.botLogChannel' },
        { name: 'Canal de música', value: 'music.requestChannel' },
        { name: 'Rol de bots', value: 'general.botRole' },
        { name: 'TikTok live', value: 'tiktok.liveChannel' },
        { name: 'TikTok videos', value: 'tiktok.videoChannel' },
        { name: 'Twitch live', value: 'twitch.liveChannel' },
        { name: 'YouTube live', value: 'youtube.liveChannel' },
        { name: 'YouTube videos', value: 'youtube.videoChannel' },
        { name: 'YouTube Shorts', value: 'youtube.shortChannel' }
      )))
    .addSubcommand(command => {
      command.setName('modulos').setDescription('Activa o desactiva módulos en este servidor.');
      for (const name of Object.keys(MODULE_DEFAULTS)) {
        command.addBooleanOption(option => option.setName(name).setDescription(`Estado del módulo ${name}`));
      }
      return command;
    })
    .addSubcommand(command => command
      .setName('permisos')
      .setDescription('Añade o retira un rol de capacidad.')
      .addStringOption(option => option.setName('tipo').setDescription('Capacidad').setRequired(true).addChoices(
        { name: 'Gestión de redes', value: 'redes' },
        { name: 'Moderación', value: 'moderacion' },
        { name: 'DJ de música', value: 'dj' }
      ))
      .addStringOption(option => option.setName('accion').setDescription('Acción').setRequired(true).addChoices(
        { name: 'Añadir', value: 'add' },
        { name: 'Retirar', value: 'remove' },
        { name: 'Limpiar todos', value: 'clear' }
      ))
      .addRoleOption(option => option.setName('rol').setDescription('Rol que se modificará')))
    .addSubcommand(command => command
      .setName('exclusiones')
      .setDescription('Excluye canales o roles de la moderación automática.')
      .addStringOption(option => option.setName('tipo').setDescription('Tipo de exclusión').setRequired(true).addChoices(
        { name: 'Canal', value: 'canal' },
        { name: 'Rol', value: 'rol' }
      ))
      .addStringOption(option => option.setName('accion').setDescription('Acción').setRequired(true).addChoices(
        { name: 'Añadir', value: 'add' },
        { name: 'Retirar', value: 'remove' },
        { name: 'Limpiar todos', value: 'clear' }
      ))
      .addChannelOption(option => option.setName('canal').setDescription('Canal que se modificará'))
      .addRoleOption(option => option.setName('rol').setDescription('Rol que se modificará'))),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = await getGuildConfig(guildId);

    if (subcommand === 'estado') {
      return interaction.reply({ embeds: [clampEmbed(statusEmbed(interaction.guild, config))], flags: 64 });
    }

    if (subcommand === 'canales') {
      const updates = {};
      const mapping = {
        bienvenida: ['general', 'welcomeChannel'],
        despedida: ['general', 'goodbyeChannel'],
        logs: ['general', 'logChannel'],
        bot_logs: ['general', 'botLogChannel'],
        musica: ['music', 'requestChannel'],
        tiktok_live: ['tiktok', 'liveChannel'],
        tiktok_videos: ['tiktok', 'videoChannel'],
        twitch_live: ['twitch', 'liveChannel'],
        youtube_live: ['youtube', 'liveChannel'],
        youtube_videos: ['youtube', 'videoChannel'],
        youtube_shorts: ['youtube', 'shortChannel']
      };
      const changed = [];
      for (const [optionName, [section, key]] of Object.entries(mapping)) {
        const channel = interaction.options.getChannel(optionName);
        if (!channel) continue;
        const writable = channelWritable(interaction, channel);
        if (writable === null) {
          return interaction.reply({ content: `Todavía no puedo comprobar mis permisos en ${channel}. Espera unos segundos y vuelve a intentarlo.`, flags: 64 });
        }
        if (!writable) {
          return interaction.reply({ content: `No puedo ver, escribir o insertar enlaces en ${channel}.`, flags: 64 });
        }
        if (!updates[section]) updates[section] = {};
        updates[section][key] = channel.id;
        changed.push(channel.toString());
      }
      const botRole = interaction.options.getRole('rol_bots');
      if (botRole) {
        // `members.me` puede ser null si el miembro del bot no está en caché
        // (pasa justo después de arrancar): antes eso era un TypeError y el
        // administrador solo veía «Error ejecutando el comando».
        const me = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!me) {
          return interaction.reply({ content: 'Todavía no puedo comprobar mis propios permisos en este servidor. Espera unos segundos y vuelve a intentarlo.', flags: 64 });
        }
        if (botRole.managed || botRole.id === interaction.guild.id || !me.permissions.has(PermissionFlagsBits.ManageRoles) || botRole.position >= me.roles.highest.position) {
          return interaction.reply({ content: 'No puedo asignar ese rol a bots por la jerarquía de roles o porque me falta Gestionar roles.', flags: 64 });
        }
        if (!updates.general) updates.general = {};
        updates.general.botRole = botRole.id;
        changed.push(botRole.toString());
      }
      const clear = interaction.options.getString('limpiar');
      if (clear) {
        const [section, key] = clear.split('.');
        if (!updates[section]) updates[section] = {};
        updates[section][key] = null;
        changed.push(`limpieza de ${clear}`);
      }
      if (!Object.keys(updates).length) {
        return interaction.reply({ content: 'Selecciona al menos un canal, rol o elemento para limpiar.', flags: 64 });
      }
      for (const [section, values] of Object.entries(updates)) {
        await updateGuildSection(guildId, section, values);
      }
      return interaction.reply({ content: `✅ Configuración actualizada: ${changed.join(', ')}.`, flags: 64, allowedMentions: { parse: [] } });
    }

    if (subcommand === 'modulos') {
      const values = {};
      for (const name of Object.keys(MODULE_DEFAULTS)) {
        const value = interaction.options.getBoolean(name);
        if (value !== null) values[name] = value;
      }
      if (!Object.keys(values).length) return interaction.reply({ content: 'Indica al menos un módulo.', flags: 64 });
      await updateGuildSection(guildId, 'features', values);
      if (values.music === false) await client.music?.stop?.(guildId).catch(() => null);
      return interaction.reply({ content: `✅ Módulos actualizados: ${Object.entries(values).map(([name, active]) => `${name} ${active ? '🟢' : '⚫'}`).join(' · ')}`, flags: 64 });
    }

    if (subcommand === 'permisos') {
      const type = interaction.options.getString('tipo');
      const action = interaction.options.getString('accion');
      const role = interaction.options.getRole('rol');
      const field = CAPABILITY_FIELDS[type];
      if (action === 'clear') {
        await updateGuildSection(guildId, 'permissions', { [field]: [] });
      } else {
        if (!role) return interaction.reply({ content: 'Selecciona el rol que deseas añadir o retirar.', flags: 64 });
        if (action === 'add') await addGuildListItem(guildId, 'permissions', field, role.id);
        else await removeGuildListItem(guildId, 'permissions', field, role.id);
      }
      return interaction.reply({ content: `✅ Permiso **${type}** actualizado.`, flags: 64 });
    }

    if (subcommand === 'exclusiones') {
      const type = interaction.options.getString('tipo');
      const action = interaction.options.getString('accion');
      const field = EXEMPTION_FIELDS[type];
      const target = type === 'canal' ? interaction.options.getChannel('canal') : interaction.options.getRole('rol');
      if (action === 'clear') {
        await updateGuildSection(guildId, 'moderation', { [field]: [] });
      } else {
        if (!target) return interaction.reply({ content: `Selecciona el ${type} que deseas modificar.`, flags: 64 });
        if (action === 'add') await addGuildListItem(guildId, 'moderation', field, target.id);
        else await removeGuildListItem(guildId, 'moderation', field, target.id);
      }
      return interaction.reply({ content: `✅ Exclusiones de ${type} actualizadas.`, flags: 64 });
    }
  }
};

module.exports.statusEmbed = statusEmbed;
module.exports.channelWritable = channelWritable;
