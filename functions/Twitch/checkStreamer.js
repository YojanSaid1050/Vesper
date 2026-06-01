const axios = require('axios');

const getAccessToken =
  require('./getAccessToken');

module.exports = async (username) => {

  try {

    const token =
      await getAccessToken();

    if (!token) return null;

    // =====================================
    // BUSCAR USUARIO
    // =====================================

    const userResponse =
      await axios.get(

        'https://api.twitch.tv/helix/users',

        {
          headers: {
            'Client-ID':
              process.env.TWITCH_CLIENT_ID,
            'Authorization':
              `Bearer ${token}`
          },

          params: {
            login: username
          }
        }

      );

    if (
      !userResponse.data.data.length
    ) {

      return {
        exists: false
      };

    }

    const user =
      userResponse.data.data[0];

    // =====================================
    // BUSCAR STREAM
    // =====================================

    const streamResponse =
      await axios.get(

        'https://api.twitch.tv/helix/streams',

        {
          headers: {
            'Client-ID':
              process.env.TWITCH_CLIENT_ID,
            'Authorization':
              `Bearer ${token}`
          },

          params: {
            user_login: username
          }
        }

      );

    // =====================================
    // OFFLINE
    // =====================================

    if (
      !streamResponse.data.data.length
    ) {

      return {

        exists: true,

        online: false,

        streamer:
          user.display_name

      };

    }

    // =====================================
    // ONLINE
    // =====================================

    const stream =
      streamResponse.data.data[0];

    return {

      exists: true,

      online: true,

      streamer:
        stream.user_name,

      title:
        stream.title,

      game:
        stream.game_name,

      viewers:
        stream.viewer_count,

      thumbnail:
        stream.thumbnail_url
          .replace('{width}', '1280')
          .replace('{height}', '720')

    };

  } catch (error) {

    console.error(
      `❌ Error consultando ${username}`
    );

    console.error(
      error.response?.data ||
      error.message
    );

    return null;

  }

};