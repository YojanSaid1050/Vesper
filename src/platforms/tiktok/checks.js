const { ApifyClient } = require('apify');

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkLiveUsers(usernames = []) {
  try {
    if (!Array.isArray(usernames) || !usernames.length) return [];

    const run = await client.actor('unseenuser/tiktok-live-status-scraper').call({
      handles: usernames,
      include_stream_urls: true
    });

    if (!run?.defaultDatasetId) return [];

    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: usernames.length });
    return items || [];
  } catch (error) {
    console.error('Error consultando TikTok Lives:', error.message);
    return [];
  }
}

async function checkUser(username) {
  try {
    const run = await client.actor('clockworks/tiktok-scraper').call({
      profiles: [`https://www.tiktok.com/@${username}`],
      resultsPerPage: 1
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const user = items.find(item => item.authorMeta?.name?.toLowerCase() === username.toLowerCase());

    if (!user) return { exists: false };

    return {
      exists: true,
      username: user.authorMeta.name,
      nickname: user.authorMeta.nickName || user.authorMeta.name
    };
  } catch (error) {
    console.error('Error validando usuario TikTok:', error.message);
    return { exists: false };
  }
}

async function checkUsers(usernames = []) {
  try {
    const profiles = usernames.map(user => `https://www.tiktok.com/@${user}`);
    const run = await client.actor('clockworks/tiktok-scraper').call({
      profiles,
      resultsPerPage: 1
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items;
  } catch (error) {
    console.error('Error consultando TikTok:', error.message);
    return [];
  }
}

module.exports = { checkLiveUsers, checkUser, checkUsers };