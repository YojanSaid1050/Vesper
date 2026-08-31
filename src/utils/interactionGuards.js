// Administrator corresponde al bit 1 << 3 en Discord. Mantener la constante
// local permite probar las guardas sin inicializar un cliente de Discord.
const ADMINISTRATOR_PERMISSION = 8n;

function getOwnerIds() {
  return new Set(
    (process.env.BOT_OWNER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
  );
}

function isAdministrator(interaction) {
  if (!interaction?.inGuild?.()) return false;
  return interaction.memberPermissions?.has(ADMINISTRATOR_PERMISSION) === true;
}

function isBotOwner(userId) {
  return Boolean(userId) && getOwnerIds().has(userId);
}

async function deny(interaction, message) {
  const payload = { content: message, flags: 64 };

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch(() => null);
  }

  return interaction.reply(payload).catch(() => null);
}

async function requireAdministrator(interaction) {
  if (isAdministrator(interaction)) return true;
  await deny(interaction, '🔒 Solo los administradores del servidor pueden usar este panel.');
  return false;
}

async function requireBotOwner(interaction) {
  if (isBotOwner(interaction?.user?.id)) return true;
  await deny(interaction, '🔒 Esta operación está reservada al propietario global de Vesper.');
  return false;
}

module.exports = {
  getOwnerIds,
  isAdministrator,
  isBotOwner,
  requireAdministrator,
  requireBotOwner
};
