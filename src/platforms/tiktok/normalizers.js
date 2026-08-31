const { normalizeUsername } = require('./utils');

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null);
}

function normalizeLiveResult(item = {}) {
  const nested = Array.isArray(item.data) ? item.data[0] || {} : item.data || {};
  const username = normalizeUsername(firstDefined(
    item.username,
    item.handle,
    item.unique_id,
    item.uniqueId,
    item.hostUsername,
    nested.username,
    nested.unique_id
  ));

  const legacyLive = Boolean(
    item.liveRoom?.streamId && item.liveRoomUserInfo?.status !== 4
  );
  const isLive = Boolean(firstDefined(
    item.isLive,
    item.is_live,
    nested.alive,
    item.status === 'live' ? true : undefined,
    legacyLive
  ));

  return {
    success: !item.error && Boolean(username),
    username,
    isLive,
    roomId: String(firstDefined(
      item.roomId,
      item.room_id,
      nested.room_id,
      item.liveRoom?.streamId,
      ''
    )),
    nickname: firstDefined(
      item.nickname,
      item.hostName,
      item.liveRoomUserInfo?.nickname,
      username
    ),
    viewers: Number(firstDefined(
      item.viewerCount,
      item.viewer_count,
      nested.userCount,
      item.liveRoom?.liveRoomStats?.userCount,
      0
    )) || 0,
    title: firstDefined(
      item.title,
      item.room_title,
      item.liveRoom?.title,
      'TikTok Live'
    ),
    cover: firstDefined(
      item.coverUrl,
      item.cover_url,
      item.hostAvatarUrl,
      item.avatar_url,
      item.liveRoom?.coverUrl,
      null
    ),
    liveUrl: firstDefined(
      item.roomUrl,
      item.room_url,
      item.sourceUrl,
      username ? `https://www.tiktok.com/@${username}/live` : null
    ),
    rawError: item.error || (item.httpStatus && item.httpStatus >= 400 ? `HTTP ${item.httpStatus}` : null)
  };
}

function normalizeVideoResult(item = {}) {
  const author = item.authorMeta || item.author || {};
  const username = normalizeUsername(firstDefined(
    author.name,
    author.uniqueId,
    author.unique_id,
    item.username,
    item.uniqueId
  ));

  return {
    exists: Boolean(username && item.id),
    username,
    nickname: firstDefined(author.nickName, author.nickname, author.name, username),
    avatar: firstDefined(author.avatar, author.originalAvatarUrl, null),
    followers: Number(firstDefined(author.fans, author.followerCount, 0)) || 0,
    hearts: Number(firstDefined(author.heart, author.heartCount, 0)) || 0,
    videos: Number(firstDefined(author.video, author.videoCount, 0)) || 0,
    latestVideoId: item.id ? String(item.id) : null,
    latestVideoUrl: firstDefined(item.webVideoUrl, item.url, null),
    latestVideoTimestamp: Number(firstDefined(item.createTime, 0)) || 0,
    latestVideoTitle: firstDefined(item.text, item.description, ''),
    latestVideoThumbnail: firstDefined(
      item.videoMeta?.coverUrl,
      item.videoMeta?.originalCoverUrl,
      item.cover,
      null
    ),
    latestVideoPlayCount: Number(firstDefined(item.playCount, item.stats?.playCount, 0)) || 0,
    latestVideoCommentCount: Number(firstDefined(item.commentCount, item.stats?.commentCount, 0)) || 0
  };
}

module.exports = { normalizeLiveResult, normalizeVideoResult };
