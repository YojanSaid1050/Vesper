// src/core/FixedPanels.js
//
// Los mensajes fijos con botones: el controlador de música y la interfaz de
// salas de voz. Se repintan al arrancar (tras un reinicio no suena nada) y
// cuando se guardan sus textos en el panel, para que lo publicado nunca se
// quede con un diseño viejo.
//
// Si alguno se publicó con la cuenta de Vesper (versiones anteriores), al
// arrancar se vuelve a publicar con el webhook del servidor, para que salga
// con su nombre y su foto: en Ankerie Dimension, AnkeBot.

const { refreshController, publishController, fetchControllerMessage } = require('./music/controller');
const { refreshInterface, publishInterface, fetchInterfaceMessage } = require('./TempVoiceService');
const { getGuildConfig } = require('../database/mongoManager');
const { brandingAvailable } = require('../utils/webhookSender');

// ¿Este mensaje salió con la cuenta del bot pudiendo salir con el webhook?
async function needsRebrand(message) {
  if (!message || message.webhookId) return false;
  return brandingAvailable(message.channel, { interactive: true }).catch(() => false);
}

async function refreshGuildPanels(client, guildId, config = null, { rebrand = false } = {}) {
  const settings = config || await getGuildConfig(guildId).catch(() => null);
  let count = 0;
  if (settings?.music?.controllerMessage) {
    const message = rebrand ? await fetchControllerMessage(client, settings).catch(() => null) : null;
    if (await needsRebrand(message)) {
      await publishController(client, guildId, settings.music.controllerChannel).catch(error => console.warn(`[Paneles] No pude volver a publicar el controlador de ${guildId}: ${error.message}`));
    } else {
      refreshController(client, guildId, 0);
    }
    count++;
  }
  if (settings?.tempVoice?.interfaceMessage) {
    const message = rebrand ? await fetchInterfaceMessage(client, settings).catch(() => null) : null;
    if (await needsRebrand(message)) {
      if (await publishInterface(client, guildId, settings.tempVoice.interfaceChannel).then(() => true).catch(() => false)) count++;
    } else if (await refreshInterface(client, guildId).catch(() => false)) {
      count++;
    }
  }
  return count;
}

async function refreshFixedPanels(client) {
  let count = 0;
  for (const guildId of client.guilds?.cache?.keys?.() || []) {
    count += await refreshGuildPanels(client, guildId, null, { rebrand: true });
  }
  return count;
}

module.exports = { refreshFixedPanels, refreshGuildPanels, needsRebrand };
