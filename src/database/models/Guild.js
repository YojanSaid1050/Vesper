// src/database/models/Guild.js
const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  schemaVersion: { type: Number, default: 5, min: 1 },
  general: {
    welcomeChannel: { type: String, default: null },
    goodbyeChannel: { type: String, default: null },
    logChannel: { type: String, default: null },
    botLogChannel: { type: String, default: null },
    botRole: { type: String, default: null }
  },
  dashboard: {
    channel: { type: String, default: null },
    message: { type: String, default: null },
    enabled: { type: Boolean, default: false },
    currentPanel: { type: String, default: 'main' },
    currentMode: { type: String, default: 'default' }
  },
  tiktok: {
    liveChannel: { type: String, default: null },
    videoChannel: { type: String, default: null },
    users: { type: [String], default: [] },
    showUsers: { type: Boolean, default: false },
    pingRole: { type: String, default: null }  // NUEVO: Rol a etiquetar
  },
  twitch: {
    liveChannel: { type: String, default: null },
    users: { type: [String], default: [] },
    showUsers: { type: Boolean, default: false },
    pingRole: { type: String, default: null }  // NUEVO: Rol a etiquetar
  },
  youtube: {
    liveChannel: { type: String, default: null },
    videoChannel: { type: String, default: null },
    shortChannel: { type: String, default: null },
    users: { type: [String], default: [] },
    showUsers: { type: Boolean, default: false },
    pingRole: { type: String, default: null }  // NUEVO: Rol a etiquetar
  },
  branding: {
    name: { type: String, default: null },
    avatar: { type: String, default: null }
  },
  profile: {
    theme: { type: String, enum: ['void', 'cinnamoroll', 'neutral', 'custom'], default: 'neutral' },
    displayName: { type: String, default: null, maxlength: 80 },
    avatar: { type: String, default: null, maxlength: 500 },
    primaryColor: { type: String, default: '#5865F2', maxlength: 7 },
    secondaryColor: { type: String, default: '#747F8D', maxlength: 7 },
    welcomeTitle: { type: String, default: null, maxlength: 120 },
    welcomeMessage: { type: String, default: null, maxlength: 1500 },
    goodbyeTitle: { type: String, default: null, maxlength: 120 },
    goodbyeMessage: { type: String, default: null, maxlength: 1500 },
    memberRole: { type: String, default: null }
  },
  embeds: {
    welcome: {
      title: { type: String, default: null, maxlength: 240 },
      message: { type: String, default: null, maxlength: 3000 },
      color: { type: String, default: null, maxlength: 7 },
      image: { type: String, default: null, maxlength: 500 },
      footer: { type: String, default: null, maxlength: 200 },
      thumbnail: { type: Boolean, default: true }
    },
    goodbye: {
      title: { type: String, default: null, maxlength: 240 },
      message: { type: String, default: null, maxlength: 3000 },
      color: { type: String, default: null, maxlength: 7 },
      image: { type: String, default: null, maxlength: 500 },
      footer: { type: String, default: null, maxlength: 200 },
      thumbnail: { type: Boolean, default: true }
    }
  },
  features: {
    tiktok: { type: Boolean, default: true },
    twitch: { type: Boolean, default: true },
    youtube: { type: Boolean, default: true },
    welcome: { type: Boolean, default: true },
    goodbye: { type: Boolean, default: true },
    logs: { type: Boolean, default: true },
    music: { type: Boolean, default: false },
    moderation: { type: Boolean, default: false },
    tickets: { type: Boolean, default: false },
    suggestions: { type: Boolean, default: false },
    selfroles: { type: Boolean, default: false },
    starboard: { type: Boolean, default: false }
  },
  permissions: {
    socialManagerRoles: { type: [String], default: [] },
    moderatorRoles: { type: [String], default: [] },
    musicDjRoles: { type: [String], default: [] }
  },
  moderation: {
    filterLinks: { type: Boolean, default: false },
    allowedDomains: { type: [String], default: [] },
    exemptChannels: { type: [String], default: [] },
    exemptRoles: { type: [String], default: [] },
    blockInvites: { type: Boolean, default: true },
    maxMentions: { type: Number, default: 5 },
    repeatLimit: { type: Number, default: 4 },
    action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'warn' }
  },
  music: {
    requestChannel: { type: String, default: null },
    preferredVoiceChannel: { type: String, default: null },
    defaultVolume: { type: Number, min: 1, max: 100, default: 50 },
    maxQueue: { type: Number, min: 1, max: 500, default: 100 },
    maxPerUser: { type: Number, min: 1, max: 25, default: 3 },
    maxTrackMinutes: { type: Number, min: 1, max: 180, default: 15 },
    idleSeconds: { type: Number, min: 30, max: 3600, default: 180 }
  },
  community: {
    tickets: {
      panelChannel: { type: String, default: null },
      category: { type: String, default: null },
      transcriptChannel: { type: String, default: null },
      staffRoles: { type: [String], default: [] },
      maxOpenPerUser: { type: Number, min: 1, max: 5, default: 1 },
      panelMessage: { type: String, default: null }
    },
    suggestions: {
      channel: { type: String, default: null }
    },
    selfRoles: {
      panelChannel: { type: String, default: null },
      panelMessage: { type: String, default: null },
      roles: {
        type: [{
          roleId: { type: String, required: true },
          label: { type: String, required: true, maxlength: 80 },
          emoji: { type: String, default: null, maxlength: 100 },
          description: { type: String, default: null, maxlength: 100 },
          _id: false
        }],
        default: []
      }
    },
    starboard: {
      channel: { type: String, default: null },
      threshold: { type: Number, min: 2, max: 50, default: 3 },
      emoji: { type: String, default: '⭐', maxlength: 100 },
      ignoredChannels: { type: [String], default: [] }
    }
  },
  testPanel: {
    activeSection: { type: String, default: 'general' }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para búsquedas rápidas
guildSchema.index({ 'tiktok.users': 1 });
guildSchema.index({ 'twitch.users': 1 });
guildSchema.index({ 'youtube.users': 1 });

module.exports = mongoose.model('Guild', guildSchema);
