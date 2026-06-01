require('dotenv').config();

const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' })
  .setToken(process.env.TOKEN);

(async () => {

  try {

    await rest.put(

      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        '1506580021232406540'
      ),

      {
        body: []
      }

    );

    console.log(
      '✅ Comandos locales eliminados.'
    );

  } catch (error) {

    console.error(error);

  }

})();