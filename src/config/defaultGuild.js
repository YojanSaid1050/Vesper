const { moduleDefaults, isMainGuild, isThemedMainGuild } = require('./guildPolicy');
const { defaultEmbedsConfig } = require('../core/EmbedTemplateService');

const CURRENT_SCHEMA_VERSION = 8;

function defaultProfileConfig(guildId = null) {
  if (isThemedMainGuild(guildId)) {
    return {
      theme: 'cinnamoroll',
      displayName: process.env.THEMED_MAIN_DEFAULT_NAME || 'AnkeBot',
      avatar: null,
      primaryColor: '#8DDCF4',
      secondaryColor: '#F8C8DC',
      welcomeTitle: '☁️ ¡Una nueva estrella llegó!',
      welcomeMessage: 'Hola {user}, bienvenido a **{server}**. Tu aventura entre nubes comienza aquí. ✨',
      goodbyeTitle: '🌙 Hasta pronto',
      goodbyeMessage: '**{username}** dejó {server}. Que las nubes acompañen su próximo viaje.',
      memberRole: null
    };
  }
  return {
    theme: isMainGuild(guildId) ? 'void' : 'neutral',
    displayName: null,
    avatar: null,
    primaryColor: isMainGuild(guildId) ? '#9D63FF' : '#5865F2',
    secondaryColor: isMainGuild(guildId) ? '#100C18' : '#747F8D',
    welcomeTitle: null,
    welcomeMessage: null,
    goodbyeTitle: null,
    goodbyeMessage: null,
    memberRole: null
  };
}

function defaultCommunityConfig() {
  return {
    tickets: {
      panelChannel: null,
      category: null,
      transcriptChannel: null,
      staffRoles: [],
      maxOpenPerUser: 1,
      panelMessage: null
    },
    suggestions: { channel: null },
    selfRoles: { panelChannel: null, panelMessage: null, roles: [] },
    starboard: { channel: null, threshold: 3, emoji: '⭐', ignoredChannels: [] }
  };
}

function createDefaultGuildConfig(guildId = null) {
  return {
    ...(guildId ? { guildId: String(guildId) } : {}),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    alerts: {},
    plan: 'free',
    general: { welcomeChannel: null, goodbyeChannel: null, logChannel: null, botLogChannel: null, botRole: null, boostChannel: null },
    dashboard: { channel: null, message: null, enabled: false, currentPanel: 'main', currentMode: 'default' },
    tiktok: { liveChannel: null, videoChannel: null, users: [], showUsers: false, pingRole: null },
    twitch: { liveChannel: null, users: [], showUsers: false, pingRole: null },
    youtube: { liveChannel: null, videoChannel: null, shortChannel: null, users: [], showUsers: false, pingRole: null },
    branding: { name: null, avatar: null },
    profile: defaultProfileConfig(guildId),
    embeds: defaultEmbedsConfig(),
    features: moduleDefaults(),
    permissions: { socialManagerRoles: [], moderatorRoles: [], musicDjRoles: [] },
    moderation: {
      filterLinks: false,
      allowedDomains: [],
      exemptChannels: [],
      exemptRoles: [],
      blockInvites: true,
      maxMentions: 5,
      repeatLimit: 4,
      action: 'warn'
    },
    deals: {
      channel: null, pingRole: null,
      epicFree: true, giveaways: true, steamSpecials: false,
      minDiscount: 50, giveawayPlatforms: ['steam', 'epic-games-store', 'gog'], maxPerCycle: 5
    },
    music: { requestChannel: null, preferredVoiceChannel: null, defaultVolume: 50, maxQueue: 100, maxPerUser: 3, maxTrackMinutes: 15, idleSeconds: 180 },
    community: defaultCommunityConfig(),
    testPanel: { activeSection: 'general' }
  };
}

module.exports = { CURRENT_SCHEMA_VERSION, createDefaultGuildConfig, defaultCommunityConfig, defaultProfileConfig, defaultEmbedsConfig };
