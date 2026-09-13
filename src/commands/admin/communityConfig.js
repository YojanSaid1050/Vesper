const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const { CAPABILITIES } = require('../../core/PermissionService');
const { getGuildConfig, updateCommunitySection, updateGuildSection } = require('../../database/mongoManager');
const { publishSelfRolePanel, publishTicketPanel, reviewSuggestion } = require('../../core/CommunityService');
const { isModuleEnabledConfig } = require('../../config/guildPolicy');

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

function moduleLine(config, name, detail) {
  return `${isModuleEnabledConfig(config, name) ? '🟢' : '⚫'} **${name}** · ${detail}`;
}

function statusEmbed(guild, config) {
  const community = config.community || {};
  return new EmbedBuilder().setTitle(`Comunidad · ${guild.name}`).setColor(0x7C3AED).setDescription([
    moduleLine(config, 'tickets', `panel ${community.tickets?.panelChannel ? `<#${community.tickets.panelChannel}>` : 'sin configurar'} · transcripciones ${community.tickets?.transcriptChannel ? `<#${community.tickets.transcriptChannel}>` : 'en el ticket'}`),
    moduleLine(config, 'suggestions', community.suggestions?.channel ? `<#${community.suggestions.channel}>` : 'sin canal'),
    moduleLine(config, 'selfroles', `${community.selfRoles?.roles?.length || 0} rol(es)`),
    moduleLine(config, 'starboard', community.starboard?.channel ? `<#${community.starboard.channel}> · umbral ${community.starboard.threshold || 3}` : 'sin canal')
  ].join('\n')).setFooter({ text: 'Los módulos comienzan desactivados para evitar publicaciones accidentales.' }).setTimestamp();
}

function assignableRole(guild, role) {
  const me = guild.members.me;
  return role && role.id !== guild.id && !role.managed && me?.permissions?.has(PermissionFlagsBits.ManageRoles) && role.position < me.roles.highest.position;
}

module.exports = {
  capability: CAPABILITIES.GUILD_ADMIN,
  data: new SlashCommandBuilder()
    .setName('vesper-comunidad')
    .setDescription('Configura tickets, sugerencias, autorroles y starboard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(command => command.setName('estado').setDescription('Muestra la configuración de comunidad.'))
    .addSubcommand(command => command.setName('tickets').setDescription('Configura y publica el panel de tickets.')
      .addBooleanOption(option => option.setName('activo').setDescription('Activa o desactiva tickets'))
      .addChannelOption(option => option.setName('panel').setDescription('Canal del panel').addChannelTypes(...TEXT_TYPES))
      .addChannelOption(option => option.setName('categoria').setDescription('Categoría para los tickets').addChannelTypes(ChannelType.GuildCategory))
      .addChannelOption(option => option.setName('transcripciones').setDescription('Canal privado para transcripciones').addChannelTypes(...TEXT_TYPES))
      .addRoleOption(option => option.setName('staff').setDescription('Rol que podrá ver y cerrar tickets'))
      .addStringOption(option => option.setName('accion_staff').setDescription('Cambio del rol staff').addChoices(
        { name: 'Añadir', value: 'add' }, { name: 'Retirar', value: 'remove' }, { name: 'Limpiar', value: 'clear' }
      ))
      .addIntegerOption(option => option.setName('max_abiertos').setDescription('Tickets abiertos por usuario').setMinValue(1).setMaxValue(5))
      .addBooleanOption(option => option.setName('publicar').setDescription('Publica un panel nuevo ahora')))
    .addSubcommand(command => command.setName('sugerencias').setDescription('Configura el canal de sugerencias.')
      .addBooleanOption(option => option.setName('activo').setDescription('Activa o desactiva sugerencias'))
      .addChannelOption(option => option.setName('canal').setDescription('Canal de sugerencias').addChannelTypes(...TEXT_TYPES)))
    .addSubcommand(command => command.setName('autoroles').setDescription('Administra y publica autorroles.')
      .addStringOption(option => option.setName('accion').setDescription('Acción').setRequired(true).addChoices(
        { name: 'Añadir rol', value: 'add' }, { name: 'Retirar rol', value: 'remove' }, { name: 'Listar', value: 'list' }, { name: 'Publicar panel', value: 'publish' }
      ))
      .addBooleanOption(option => option.setName('activo').setDescription('Activa o desactiva autorroles'))
      .addRoleOption(option => option.setName('rol').setDescription('Rol que se modificará'))
      .addStringOption(option => option.setName('etiqueta').setDescription('Nombre visible').setMaxLength(80))
      .addStringOption(option => option.setName('emoji').setDescription('Emoji Unicode o personalizado').setMaxLength(100))
      .addStringOption(option => option.setName('descripcion').setDescription('Texto breve opcional').setMaxLength(100))
      .addChannelOption(option => option.setName('panel').setDescription('Canal para publicar').addChannelTypes(...TEXT_TYPES)))
    .addSubcommand(command => command.setName('starboard').setDescription('Configura mensajes destacados.')
      .addBooleanOption(option => option.setName('activo').setDescription('Activa o desactiva starboard'))
      .addChannelOption(option => option.setName('canal').setDescription('Canal de destacados').addChannelTypes(...TEXT_TYPES))
      .addIntegerOption(option => option.setName('umbral').setDescription('Reacciones necesarias').setMinValue(2).setMaxValue(50))
      .addStringOption(option => option.setName('emoji').setDescription('Emoji usado para destacar').setMaxLength(100))
      .addChannelOption(option => option.setName('ignorar_canal').setDescription('Canal que no contará').addChannelTypes(...TEXT_TYPES))
      .addStringOption(option => option.setName('accion_ignorado').setDescription('Cambio en exclusiones').addChoices(
        { name: 'Añadir', value: 'add' }, { name: 'Retirar', value: 'remove' }, { name: 'Limpiar', value: 'clear' }
      )))
    .addSubcommand(command => command.setName('revisar_sugerencia').setDescription('Cambia el estado de una sugerencia.')
      .addStringOption(option => option.setName('mensaje').setDescription('ID del mensaje de sugerencia').setRequired(true))
      .addStringOption(option => option.setName('estado').setDescription('Estado nuevo').setRequired(true).addChoices(
        { name: 'Pendiente', value: 'open' }, { name: 'Aprobada', value: 'approved' }, { name: 'Rechazada', value: 'rejected' }
      ))
      .addStringOption(option => option.setName('nota').setDescription('Respuesta del equipo').setMaxLength(500))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guildId);
    if (subcommand === 'estado') return interaction.reply({ embeds: [statusEmbed(interaction.guild, config)], flags: 64, allowedMentions: { parse: [] } });

    if (subcommand === 'tickets') {
      const values = {};
      const active = interaction.options.getBoolean('activo');
      const panel = interaction.options.getChannel('panel');
      const category = interaction.options.getChannel('categoria');
      const transcripts = interaction.options.getChannel('transcripciones');
      const role = interaction.options.getRole('staff');
      const roleAction = interaction.options.getString('accion_staff');
      const maximum = interaction.options.getInteger('max_abiertos');
      const publish = interaction.options.getBoolean('publicar') === true;
      if (active !== null) await updateGuildSection(interaction.guildId, 'features', { tickets: active });
      if (panel) values.panelChannel = panel.id;
      if (category) values.category = category.id;
      if (transcripts) values.transcriptChannel = transcripts.id;
      if (maximum !== null) values.maxOpenPerUser = maximum;
      const staffRoles = [...(config.community?.tickets?.staffRoles || [])];
      if (roleAction === 'clear') values.staffRoles = [];
      else if (roleAction) {
        if (!role) return interaction.reply({ content: 'Selecciona el rol staff que deseas modificar.', flags: 64 });
        if (roleAction === 'add' && !staffRoles.includes(role.id)) staffRoles.push(role.id);
        if (roleAction === 'remove' && staffRoles.includes(role.id)) staffRoles.splice(staffRoles.indexOf(role.id), 1);
        values.staffRoles = staffRoles.filter(Boolean).slice(0, 25);
      }
      if (Object.keys(values).length) await updateCommunitySection(interaction.guildId, 'tickets', values);
      if (publish) {
        const target = panel || interaction.guild.channels.cache.get(values.panelChannel || config.community?.tickets?.panelChannel);
        if (!target) return interaction.reply({ content: 'Selecciona primero el canal del panel.', flags: 64 });
        const message = await publishTicketPanel(interaction.guild, target);
        await updateCommunitySection(interaction.guildId, 'tickets', { panelChannel: target.id, panelMessage: message.id });
      }
      if (active === null && !Object.keys(values).length && !publish) return interaction.reply({ content: 'Indica al menos un cambio.', flags: 64 });
      return interaction.reply({ content: publish ? '✅ Tickets configurados y panel publicado.' : '✅ Configuración de tickets actualizada.', flags: 64 });
    }

    if (subcommand === 'sugerencias') {
      const active = interaction.options.getBoolean('activo');
      const channel = interaction.options.getChannel('canal');
      if (active === null && !channel) return interaction.reply({ content: 'Indica al menos un cambio.', flags: 64 });
      if (active !== null) await updateGuildSection(interaction.guildId, 'features', { suggestions: active });
      if (channel) await updateCommunitySection(interaction.guildId, 'suggestions', { channel: channel.id });
      return interaction.reply({ content: '✅ Configuración de sugerencias actualizada.', flags: 64 });
    }

    if (subcommand === 'autoroles') {
      const action = interaction.options.getString('accion');
      const active = interaction.options.getBoolean('activo');
      if (active !== null) await updateGuildSection(interaction.guildId, 'features', { selfroles: active });
      const current = [...(config.community?.selfRoles?.roles || [])].map(item => ({ roleId: item.roleId, label: item.label, emoji: item.emoji || null, description: item.description || null }));
      if (action === 'list') {
        return interaction.reply({ content: current.length ? current.map(item => `• <@&${item.roleId}> — ${item.label}`).join('\n') : 'No hay autorroles configurados.', flags: 64, allowedMentions: { parse: [] } });
      }
      if (action === 'add') {
        const role = interaction.options.getRole('rol');
        const label = interaction.options.getString('etiqueta');
        if (!role || !label) return interaction.reply({ content: 'Para añadir necesitas **rol** y **etiqueta**.', flags: 64 });
        if (!assignableRole(interaction.guild, role)) return interaction.reply({ content: 'No puedo asignar ese rol por sus permisos o jerarquía.', flags: 64 });
        if (!current.some(item => item.roleId === role.id) && current.length >= 25) return interaction.reply({ content: 'El panel admite un máximo de 25 autorroles.', flags: 64 });
        const entry = { roleId: role.id, label, emoji: interaction.options.getString('emoji') || null, description: interaction.options.getString('descripcion') || null };
        const index = current.findIndex(item => item.roleId === role.id);
        if (index >= 0) current[index] = entry; else current.push(entry);
        await updateCommunitySection(interaction.guildId, 'selfRoles', { roles: current });
        return interaction.reply({ content: `✅ ${role} disponible como autorrol.`, flags: 64, allowedMentions: { parse: [] } });
      }
      if (action === 'remove') {
        const role = interaction.options.getRole('rol');
        if (!role) return interaction.reply({ content: 'Selecciona el rol que deseas retirar.', flags: 64 });
        await updateCommunitySection(interaction.guildId, 'selfRoles', { roles: current.filter(item => item.roleId !== role.id) });
        return interaction.reply({ content: '✅ Autorrol retirado del panel.', flags: 64 });
      }
      const channel = interaction.options.getChannel('panel') || interaction.guild.channels.cache.get(config.community?.selfRoles?.panelChannel);
      if (!channel) return interaction.reply({ content: 'Selecciona el canal del panel.', flags: 64 });
      const message = await publishSelfRolePanel(interaction.guild, channel, current);
      await updateCommunitySection(interaction.guildId, 'selfRoles', { panelChannel: channel.id, panelMessage: message.id });
      return interaction.reply({ content: '✅ Panel de autorroles publicado.', flags: 64 });
    }

    if (subcommand === 'starboard') {
      const values = {};
      const active = interaction.options.getBoolean('activo');
      const channel = interaction.options.getChannel('canal');
      const threshold = interaction.options.getInteger('umbral');
      const emoji = interaction.options.getString('emoji');
      const ignored = interaction.options.getChannel('ignorar_canal');
      const ignoredAction = interaction.options.getString('accion_ignorado');
      if (active !== null) await updateGuildSection(interaction.guildId, 'features', { starboard: active });
      if (channel) values.channel = channel.id;
      if (threshold !== null) values.threshold = threshold;
      if (emoji) values.emoji = emoji.trim();
      const ignoredChannels = [...(config.community?.starboard?.ignoredChannels || [])];
      if (ignoredAction === 'clear') values.ignoredChannels = [];
      else if (ignoredAction) {
        if (!ignored) return interaction.reply({ content: 'Selecciona el canal ignorado que deseas modificar.', flags: 64 });
        if (ignoredAction === 'add' && !ignoredChannels.includes(ignored.id)) ignoredChannels.push(ignored.id);
        values.ignoredChannels = ignoredAction === 'remove' ? ignoredChannels.filter(id => id !== ignored.id) : ignoredChannels;
      }
      if (active === null && !Object.keys(values).length) return interaction.reply({ content: 'Indica al menos un cambio.', flags: 64 });
      if (Object.keys(values).length) await updateCommunitySection(interaction.guildId, 'starboard', values);
      return interaction.reply({ content: '✅ Starboard actualizado.', flags: 64 });
    }

    try {
      const suggestion = await reviewSuggestion(interaction.guild, interaction.options.getString('mensaje').trim(), interaction.options.getString('estado'), interaction.user.id, interaction.options.getString('nota'));
      return interaction.reply({ content: `✅ Sugerencia de <@${suggestion.userId}> actualizada a **${suggestion.status}**.`, flags: 64, allowedMentions: { parse: [] } });
    } catch (error) {
      return interaction.reply({ content: `❌ ${error.message}`, flags: 64 });
    }
  }
};

module.exports.statusEmbed = statusEmbed;
module.exports.assignableRole = assignableRole;
