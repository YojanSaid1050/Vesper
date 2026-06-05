const { ApifyClient } =
  require('apify');

const client =
  new ApifyClient({

    token:
      process.env.APIFY_TOKEN

  });

module.exports =
  async function checkUser(
    username
  ) {

    try {

      const run =
        await client.actor(
          'clockworks/tiktok-scraper'
        ).call({

          profiles: [
            `https://www.tiktok.com/@${username}`
          ],

          resultsPerPage: 1

        });

      const { items } =
        await client
          .dataset(
            run.defaultDatasetId
          )
          .listItems();

      const user =
        items.find(
          item =>
            item.authorMeta?.name
              ?.toLowerCase() ===
            username.toLowerCase()
        );

      if (!user) {

        return {

          exists: false

        };

      }

      return {

        exists: true,

        username:
          user.authorMeta.name,

        nickname:
          user.authorMeta.nickName ||

          user.authorMeta.name

      };

    } catch (error) {

      console.error(
        '❌ Error validando usuario TikTok'
      );

      console.error(error);

      return {

        exists: false

      };

    }

  };