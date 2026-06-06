const fs = require('fs');
const path = require('path');

const guildsPath = path.join(
  __dirname,
  '..',
  'data',
  'server',
  'guilds.json'
);

// ==================================================
// ASEGURAR DIRECTORIO
// ==================================================

fs.mkdirSync(
  path.dirname(guildsPath),
  { recursive: true }
);

// ==================================================
// CACHE
// ==================================================

let guildCache = null;

// ==================================================
// CONFIG POR DEFECTO
// ==================================================

function createDefaultGuild() {

  return {

    general: {

      welcomeChannel: null,
      goodbyeChannel: null,
      logChannel: null,
      botLogChannel: null,
      botRole: null

    },

    dashboard: {

      channel: null,
      message: null,
      enabled: false

    },

    tiktok: {

      liveChannel: null,
      videoChannel: null,
      users: []

    },

    twitch: {

      liveChannel: null,
      users: []

    },

    branding: {

      name: null,
      avatar: null

    }

  };

}

// ==================================================
// MIGRACIÓN AUTOMÁTICA
// ==================================================

function migrateGuildConfig(config) {

  const defaults =
    createDefaultGuild();

  let changed = false;

  for (
    const section of Object.keys(
      defaults
    )
  ) {

    if (!config[section]) {

      config[section] =
        structuredClone(
          defaults[section]
        );

      changed = true;

      continue;

    }

    for (
      const key of Object.keys(
        defaults[section]
      )
    ) {

      if (
        !(key in config[section])
      ) {

        config[section][key] =
          defaults[section][key];

        changed = true;

      }

    }

  }

  return changed;

}

// ==================================================
// CARGAR JSON
// ==================================================

function loadGuilds() {

  if (guildCache) {

    return guildCache;

  }

  if (!fs.existsSync(guildsPath)) {

    fs.writeFileSync(
      guildsPath,
      '{}',
      'utf8'
    );

    guildCache = {};

    return guildCache;

  }

  try {

    const raw =
      fs.readFileSync(
        guildsPath,
        'utf8'
      );

    guildCache =

      raw &&
      raw.trim()

        ? JSON.parse(raw)

        : {};

    return guildCache;

  }

  catch (error) {

    console.error(
      '⚠️ guilds.json corrupto. Restaurando...'
    );

    guildCache = {};

    fs.writeFileSync(
      guildsPath,
      '{}',
      'utf8'
    );

    return guildCache;

  }

}

// ==================================================
// GUARDAR JSON
// ==================================================

function saveGuilds(data) {

  guildCache = data;

  fs.writeFileSync(

    guildsPath,

    JSON.stringify(
      data,
      null,
      2
    ),

    'utf8'

  );

}

// ==================================================
// OBTENER CONFIG
// ==================================================

function getGuildConfig(
  guildId
) {

  const data =
    loadGuilds();

  let changed = false;

  if (!data[guildId]) {

    data[guildId] =
      createDefaultGuild();

    changed = true;

  }

  if (

    migrateGuildConfig(
      data[guildId]
    )

  ) {

    changed = true;

  }

  if (changed) {

    saveGuilds(data);

  }

  return data[guildId];

}

// ==================================================
// OBTENER TODAS
// ==================================================

function getAllGuildConfigs() {

  const data =
    loadGuilds();

  let changed = false;

  for (
    const guildId of Object.keys(
      data
    )
  ) {

    if (

      migrateGuildConfig(
        data[guildId]
      )

    ) {

      changed = true;

    }

  }

  if (changed) {

    saveGuilds(data);

  }

  return data;

}

function getAllGuilds() {

  return Object.entries(
    getAllGuildConfigs()
  ).map(

    ([guildId, config]) => ({

      guildId,

      ...config

    })

  );

}

// ==================================================
// ACTUALIZAR CONFIG
// ==================================================

function updateGuildConfig(
  guildId,
  config
) {

  const data =
    loadGuilds();

  migrateGuildConfig(
    config
  );

  data[guildId] =
    config;

  saveGuilds(data);

}

// ==================================================
// ACTUALIZAR SECCIÓN
// ==================================================

function updateGuildSection(
  guildId,
  section,
  values
) {

  const config =
    getGuildConfig(
      guildId
    );

  if (!config[section]) {

    config[section] = {};

  }

  Object.assign(

    config[section],

    values

  );

  updateGuildConfig(

    guildId,

    config

  );

}

// ==================================================
// HELPERS
// ==================================================

function getGeneralConfig(
  guildId
) {

  return getGuildConfig(
    guildId
  ).general;

}

// ==================================================
// EXPORTS
// ==================================================

module.exports = {

  getGuildConfig,
  getAllGuildConfigs,
  getAllGuilds,

  getGeneralConfig,

  updateGuildConfig,
  updateGuildSection,

  createDefaultGuild,
  migrateGuildConfig

};