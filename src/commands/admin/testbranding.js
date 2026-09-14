const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendBrandedMessage } = require('../../utils/webhookSender');
const { getGuildConfig } = require('../../database/mongoManager'); // Cambiado a mongoManager
const { liveEmbed: twitchLiveEmbed } = require('../../platforms/twitch/embeds');
const { liveEmbed: tiktokLiveEmbed, videoEmbed: tiktokVideoEmbed } = require('../../platforms/tiktok/embeds');

// Las pruebas usan EXACTAMENTE las mismas funciones que publican de verdad.
// Antes había aquí una copia a mano del diseño, en texto plano y sin leer la
// configuración del servidor: quien personalizaba la bienvenida desde el panel
// la probaba con /testbranding y veía otra cosa.
const { buildWelcomePayload } = require('../../events/guild/memberAdd');
const { buildGoodbyePayload } = require('../../events/guild/memberRemove');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testbranding')
    .setDescription('Prueba el branding configurado')
    .addStringOption(opt => opt.setName('tipo').setDescription('Tipo de mensaje de prueba').setRequired(true).addChoices(
      { name: 'General', value: 'general' },
      { name: 'Welcome', value: 'welcome' },
      { name: 'Goodbye', value: 'goodbye' },
      { name: 'Twitch Live', value: 'twitch' },
      { name: 'TikTok Live', value: 'tiktok' },
      { name: 'TikTok Video', value: 'tiktokvideo' }
    ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const tipo = interaction.options.getString('tipo');
    const config = await getGuildConfig(interaction.guild.id); // Añadir await
    const branding = config.branding || {};

    let payload;
    switch (tipo) {
      case 'welcome':
        payload = buildWelcomePayload(interaction.member, config);
        break;
      case 'goodbye':
        payload = buildGoodbyePayload(interaction.member, config);
        break;
      case 'twitch':
        payload = twitchLiveEmbed({
          streamer: 'streamer_demo',
          title: 'Probando branding de Twitch',
          game: 'Just Chatting',
          viewers: 567,
          thumbnail: 'https://picsum.photos/1280/720',
          streamUrl: 'https://twitch.tv'
        });
        break;
      case 'tiktok':
        payload = tiktokLiveEmbed({
          username: 'streamer_demo',
          nickname: 'Streamer Demo',
          viewers: 1234,
          title: 'Probando branding de TikTok',
          cover: 'https://picsum.photos/1280/720',
          liveUrl: 'https://www.tiktok.com'
        });
        break;
      case 'tiktokvideo':
        payload = tiktokVideoEmbed({
          username: 'streamer_demo',
          nickname: 'Streamer Demo',
          description: 'Probando branding para alertas de videos TikTok.',
          url: 'https://www.tiktok.com',
          thumbnail: 'https://picsum.photos/1280/720',
          playCount: 123456,
          commentCount: 789
        });
        break;
      default:
        payload = {
          flags: 32768,
          components: [{
            type: 17, accent_color: 16777215, spoiler: false,
            components: [
              { type: 10, content: '# 🎨 Branding Test' },
              { type: 14, spacing: 1 },
              { type: 10, content: `### Configuración actual\n\n**Nombre**\n${branding.name || 'Sin configurar'}\n\n**Avatar**\n${branding.avatar || 'Sin configurar'}\n\n**Servidor**\n${interaction.guild.name}\n\n✅ El branding funciona correctamente.` }
            ]
          }]
        };
    }

    // `sendBrandedMessage` se traga sus propios errores y devuelve null. Antes
    // se confirmaba el éxito sin mirarlo, así que cuando el bot no podía
    // escribir en el canal el administrador leía «enviada correctamente» y no
    // aparecía ningún mensaje.
    const sent = await sendBrandedMessage(interaction.channel, payload);
    await interaction.editReply({
      content: sent
        ? `✅ Prueba de **${tipo}** enviada correctamente.`
        : `❌ No pude publicar la prueba en ${interaction.channel}. Revisa que tenga permiso para escribir e insertar enlaces ahí.`
    });
  }
};