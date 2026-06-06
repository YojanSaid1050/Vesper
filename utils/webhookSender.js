const {
  getGuildConfig
} = require('./guildManager');

async function sendBrandedMessage(
  channel,
  payload
) {

  try {

    const config =
      getGuildConfig(
        channel.guild.id
      );

    const branding =
      config.branding || {};

    // =====================
    // SIN BRANDING
    // =====================

    if (
      !branding.name &&
      !branding.avatar
    ) {

      return channel.send(
        payload
      );

    }

    // =====================
    // BUSCAR WEBHOOK
    // =====================

    const hooks =
      await channel.fetchWebhooks();

    let webhook =
      hooks.find(

        hook =>

          hook.owner?.id ===
          channel.client.user.id

      );

    // =====================
    // CREAR WEBHOOK
    // =====================

    if (!webhook) {

      webhook =
        await channel.createWebhook({

          name:
            'Custom Branding'

        });

    }

    // =====================
    // ENVIAR MENSAJE
    // =====================

    return webhook.send({

      username:
        branding.name ||
        channel.client.user.username,

      avatarURL:
        branding.avatar ||
        channel.client.user.displayAvatarURL(),

      content:
        payload.content,

      embeds:
        payload.embeds,

      components:
        payload.components,

      files:
        payload.files,

      flags:
        payload.flags

    });

  } catch (error) {

    console.error(
      'Webhook Error:',
      error
    );

    return channel.send(
      payload
    );

  }

}

module.exports = {
  sendBrandedMessage
};