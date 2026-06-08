const MonitorService = require('../core/MonitorService');
const youtubeMonitors = require('./youtube/monitors');
const twitchMonitors = require('./twitch/monitors');
const tiktokMonitors = require('./tiktok/monitors');

const monitors = [];

function startAllMonitors(client) {
  if (process.env.YOUTUBE_API_KEY) {
    monitors.push(new MonitorService({
      name: 'YouTube Lives',
      interval: 180000,
      executeFunction: youtubeMonitors.monitorLives
    }));
    monitors.push(new MonitorService({
      name: 'YouTube Videos',
      interval: 180000,
      executeFunction: youtubeMonitors.monitorVideos
    }));
    monitors.push(new MonitorService({
      name: 'YouTube Shorts',
      interval: 180000,
      executeFunction: youtubeMonitors.monitorShorts
    }));
  }

  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    monitors.push(new MonitorService({
      name: 'Twitch Streams',
      interval: 120000,
      executeFunction: twitchMonitors.monitorStreams
    }));
  }

  monitors.push(new MonitorService({
    name: 'TikTok Lives',
    interval: 120000,
    executeFunction: tiktokMonitors.monitorLives
  }));
  monitors.push(new MonitorService({
    name: 'TikTok Videos',
    interval: 120000,
    executeFunction: tiktokMonitors.monitorVideos
  }));

  for (const monitor of monitors) {
    monitor.start(client);
  }
}

function stopAllMonitors() {
  for (const monitor of monitors) {
    monitor.stop();
  }
}

module.exports = { startAllMonitors, stopAllMonitors };