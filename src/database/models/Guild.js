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