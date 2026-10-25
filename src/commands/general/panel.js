const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function panelUrl() {
  try {
    const url = new URL(process.env.WEB_BASE_URL || '');
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;
    return `${url.toString().replace(/\/$/, '')}/panel`;
  } catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Abre el panel web de administración y usuario de Vesper.'),
  async execute(interaction) {
    const url = panelUrl();
    if (!url || String(process.env.WEB_DASHBOARD_ENABLED || 'false').toLowerCase() !== 'true') {
      return interaction.reply({ content: 'El panel web todavía no está habilitado.', flags: 64 });
    }
    // El nombre con el que el bot aparece en este servidor (Vesper, AnkeBot…).
    const botName = interaction.guild?.members?.me?.displayName || interaction.client?.user?.username || 'Vesper';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Abrir panel web').setEmoji('🧭').setStyle(ButtonStyle.Link).setURL(url)
    );
    return interaction.reply({
      content: `Configura el servidor, revisa tus casos o administra ${botName} desde la web.`,
      components: [row],
      flags: 64
    });
  },
  panelUrl
};
