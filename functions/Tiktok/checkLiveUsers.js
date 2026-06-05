const { ApifyClient } =
  require('apify');

const client =
  new ApifyClient({

    token:
      process.env.APIFY_TOKEN

  });

module.exports =
  async function checkLiveUsers(
    usernames = []
  ) {

    try {

      if (
        !Array.isArray(usernames) ||
        !usernames.length
      ) {

        return [];

      }

      const run =
        await client.actor(
          'unseenuser/tiktok-live-status-scraper'
        ).call({

          handles:
            usernames,

          include_stream_urls:
            true

        });

      if (
        !run?.defaultDatasetId
      ) {

        console.error(
          '❌ El actor no devolvió dataset.'
        );

        return [];

      }

      const { items } =
        await client
          .dataset(
            run.defaultDatasetId
          )
          .listItems({

            limit:
              usernames.length

          });

      return items || [];

    } catch (error) {

      console.error(
        '❌ Error consultando TikTok Lives'
      );

      console.error(
        error.response?.data ||
        error.message ||
        error
      );

      return [];

    }

  };