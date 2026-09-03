const { SlashCommandBuilder } = require('discord.js');
const { CAPABILITIES, can } = require('../../core/PermissionService');

function trackName(track) {
  return track?.info?.title || 'Canción desconocida';
}

function sameVoice(interaction, player) {
  return interaction.member?.voice?.channelId && interaction.member.voice.channelId === player?.voiceChannelId;
}

module.exports = {
  capability: CAPABILITIES.MUSIC_USE,
  data: new SlashCommandBuilder()
    .setName('musica')
    .setDescription('Reproductor musical gratuito de Vesper.')
    .addSubcommand(command => command.setName('reproducir').setDescription('Busca o reproduce una canción').addStringOption(option => option.setName('busqueda').setDescription('Título o URL').setRequired(true)))
    .addSubcommand(command => command.setName('pausar').setDescription('Pausa la canción actual'))
    .addSubcommand(command => command.setName('continuar').setDescription('Continúa la reproducción'))
    .addSubcommand(command => command.setName('saltar').setDescription('Vota para saltar la canción'))
    .addSubcommand(command => command.setName('cola').setDescription('Muestra la cola actual'))
    .addSubcommand(command => command.setName('actual').setDescription('Muestra la canción actual'))
    .addSubcommand(command => command.setName('bucle').setDescription('Activa o desactiva la repetición').addBooleanOption(option => option.setName('activo').setDescription('Estado').setRequired(true)))
    .addSubcommand(command => command.setName('volumen').setDescription('Cambia el volumen').addIntegerOption(option => option.setName('nivel').setDescription('1 a 100').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand(command => command.setName('detener').setDescription('Detiene la música y desconecta a Vesper')),
  async execute(interaction, client) {
    const music = client.music;
    const subcommand = interaction.options.getSubcommand();
    try {
      if (subcommand === 'reproducir') {
        await interaction.deferReply();
        const result = await music.enqueue(interaction, interaction.options.getString('busqueda'));
        return interaction.editReply(`${result.position === 0 ? '▶️ Reproduciendo' : `➕ Añadida en posición ${result.position}`}: **${trackName(result.item)}**`);
      }

      const player = music.queue(interaction.guildId);
      if (!player) return interaction.reply({ content: 'No hay una sesión de música activa.', flags: 64 });
      if (!sameVoice(interaction, player)) return interaction.reply({ content: `Debes estar en <#${player.voiceChannelId}> para controlar la música.`, flags: 64 });

      if (subcommand === 'cola') {
        const rows = player.queue.slice(0, 15).map((track, index) => `${index + 1}. ${trackName(track)} · <@${track.requesterId}>`);
        return interaction.reply({ content: `**Ahora:** ${trackName(player.current)}\n\n${rows.join('\n') || 'La cola está vacía.'}`, allowedMentions: { parse: [] } });
      }
      if (subcommand === 'actual') return interaction.reply(`▶️ **${trackName(player.current)}** · volumen ${player.volume}%${player.loop ? ' · bucle activo' : ''}`);

      const dj = can(interaction, CAPABILITIES.MUSIC_DJ);
      if (subcommand === 'saltar' && !dj) {
        player.skipVotes = music.players.get(interaction.guildId).skipVotes;
        player.skipVotes.add(interaction.user.id);
        const channel = interaction.guild.channels.cache.get(player.voiceChannelId);
        const listeners = channel?.members?.filter(member => !member.user.bot).size || 1;
        const needed = Math.max(1, Math.ceil(listeners / 2));
        if (player.skipVotes.size < needed) return interaction.reply(`⏭️ Voto registrado (${player.skipVotes.size}/${needed}).`);
      }

      if (!dj && ['pausar', 'continuar', 'bucle', 'volumen', 'detener'].includes(subcommand)) {
        return interaction.reply({ content: 'Esta acción requiere el permiso DJ.', flags: 64 });
      }
      if (subcommand === 'saltar') { await music.skip(interaction.guildId); return interaction.reply('⏭️ Canción saltada.'); }
      if (subcommand === 'pausar') { await music.pause(interaction.guildId, true); return interaction.reply('⏸️ Reproducción pausada.'); }
      if (subcommand === 'continuar') { await music.pause(interaction.guildId, false); return interaction.reply('▶️ Reproducción reanudada.'); }
      if (subcommand === 'bucle') { music.players.get(interaction.guildId).loop = interaction.options.getBoolean('activo'); return interaction.reply(`🔁 Bucle ${interaction.options.getBoolean('activo') ? 'activado' : 'desactivado'}.`); }
      if (subcommand === 'volumen') { const level = interaction.options.getInteger('nivel'); await music.setVolume(interaction.guildId, level); return interaction.reply(`🔊 Volumen ajustado a ${level}%.`); }
      if (subcommand === 'detener') { await music.stop(interaction.guildId); return interaction.reply('⏹️ Reproducción detenida y sesión cerrada.'); }
    } catch (error) {
      const message = String(error.message || error).slice(0, 500);
      if (interaction.deferred || interaction.replied) return interaction.editReply(`❌ ${message}`).catch(() => null);
      return interaction.reply({ content: `❌ ${message}`, flags: 64 }).catch(() => null);
    }
  }
};
