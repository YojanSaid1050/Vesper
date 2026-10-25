// src/core/FixedPanels.js
//
// Los mensajes fijos con botones: el controlador de música y la interfaz de
// salas de voz. Se repintan al arrancar (tras un reinicio no suena nada) y
// cuando se guardan sus textos en el panel, para que lo publicado nunca se
// quede con un diseño viejo.

const { refreshController } = require('./music/controller');
const { refreshInterface } = require('./TempVoiceService');
const { getGuildConfig } = require('../database/mongoManager');

async function refreshGuildPanels(client, guildId, config = null) {
  const settings = config || await getGuildConfig(guildId).catch(() => null);
  let count = 0;
  if (settings?.music?.controllerMessage) {
    refreshController(client, guildId, 0);
    count++;
  }
  if (settings?.tempVoice?.interfaceMessage && await refreshInterface(client, guildId).catch(() => false)) count++;
  return count;
}

async function refreshFixedPanels(client) {
  let count = 0;
  for (const guildId of client.guilds?.cache?.keys?.() || []) {
    count += await refreshGuildPanels(client, guildId);
  }
  return count;
}

module.exports = { refreshFixedPanels, refreshGuildPanels };
