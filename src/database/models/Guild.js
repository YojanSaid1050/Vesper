// src/database/models/Guild.js
const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
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
  features: {
    tiktok: { type: Boolean, default: true },
    twitch: { type: Boolean, default: true },
    youtube: { type: Boolean, default: true },
    welcome: { type: Boolean, default: true },
    goodbye: { type: Boolean, default: true },
    logs: { type: Boolean, default: true },
    music: { type: Boolean, default: false },
    moderation: { type: Boolean, default: false }
  },
  permissions: {
    socialManagerRoles: { type: [String], default: [] },
    moderatorRoles: { type: [String], default: [] },
    musicDjRoles: { type: [String], default: [] }
  },
  moderation: {
    filterLinks: { type: Boolean, default: false },
    allowedDomains: { type: [String], default: [] },
    blockInvites: { type: Boolean, default: true },
    maxMentions: { type: Number, default: 5 },
    repeatLimit: { type: Number, default: 4 },
    action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'warn' }
  },
  music: {
    requestChannel: { type: String, default: null },
    defaultVolume: { type: Number, min: 1, max: 100, default: 50 },
    maxQueue: { type: Number, min: 1, max: 500, default: 100 },
    maxPerUser: { type: Number, min: 1, max: 25, default: 3 },
    maxTrackMinutes: { type: Number, min: 1, max: 180, default: 15 },
    idleSeconds: { type: Number, min: 30, max: 3600, default: 180 }
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
