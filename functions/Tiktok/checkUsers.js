const { ApifyClient } =
  require('apify');

const client =
  new ApifyClient({

    token:
      process.env.APIFY_TOKEN

  });

module.exports =
  async function checkUsers(
    usernames = []
  ) {

    try {

      const profiles =
        usernames.map(
          user =>
            `https://www.tiktok.com/@${user}`
        );

      const run =
        await client.actor(
          'clockworks/tiktok-scraper'
        ).call({

          profiles,

          resultsPerPage: 1

        });

      const { items } =
        await client
          .dataset(
            run.defaultDatasetId
          )
          .listItems();

      return items;

    } catch (error) {

      console.error(
        '❌ Error consultando TikTok'
      );

      console.error(error);

      return [];

    }

  };