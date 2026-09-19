// threadCreate.js — hilos nuevos
const { Events } = require('discord.js');
const { getGuildConfig } = require('../../database/mongoManager');
const { publishAlert } = require('../../core/AlertRouter');

module.exports = {
  name: Events.ThreadCreate,
  async execute(thread, newlyCreated) {
    // `newlyCreated` es false cuando el bot simplemente se une a un hilo que ya
    // existía; sin esta comprobación se registrarían hilos antiguos al arrancar.
    if (newlyCreated === false) return;
    if (!thread.guild) return;

    const guildConfig = await getGuildConfig(thread.guild.id);

    const owner = thread.ownerId ? `<@${thread.ownerId}>` : 'Desconocido';
    await publishAlert(thread.guild, guildConfig, 'log_thread_created', {
      vars: {
        server: thread.guild.name,
        memberCount: thread.guild.memberCount,
        thread: `${thread}`,
        threadName: thread.name,
        channel: thread.parent ? `${thread.parent}` : '',
        channelName: thread.parent?.name || '',
        owner
      },
      defaults: { authorIconUrl: thread.guild.iconURL() }
});
  }
};
