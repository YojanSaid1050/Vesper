const {
  Events
} = require('discord.js');

module.exports = {

  name: Events.InteractionCreate,

  async execute(interaction) {

    if (!interaction.isButton()) return;

    // =========================
    // ROLES COLORES
    // =========================

    const colorRoles = {

      color_red:
        '1506884291412365433',

      color_orange:
        '1506884404939853925',

      color_yellow:
        '1506884466109579354',

      color_green:
        '1506884494366609598',

      color_lightblue:
        '1506884562192437469',

      color_darkblue:
        '1506884645109764106',

      color_purple:
        '1506884712772141079',

      color_pink:
        '1506884766954164254',

      color_black:
        '1506885746106306731',

      color_white:
        '1506885873768206468'

    };

    // =========================
    // ROLES PAISES
    // =========================

    const countryRoles = {

      country_colombia:
        '1506885125605167195',

      country_argentina:
        '1506885202868441190',

      country_mexico:
        '1506885228637978705',

      country_peru:
        '1506885261466796173',

      country_chile:
        '1506885280211140719',

      country_ecuador:
        '1506885297156390922',

      country_venezuela:
        '1506885319428018177',

      country_spain:
        '1506885344195514408',

      country_usa:
        '1506885361706729574',

      country_other:
        '1506885386415247380'

    };

    // =========================
    // ROLES JUEGOS
    // =========================

    const gameRoles = {

      game_ds1:
        '1506893432105209878',

      game_ds2:
        '1506893458105700392',

      game_ds3:
        '1506893490108366859',

      game_er:
        '1506893678344409181',

      game_sekiro:
        '1506893596891287692',

      game_hk:
        '1506893720459546694',

      game_silksong:
        '1506893743066972260',

      game_valorant:
        '1506893689874813100',

      game_lol:
        '1506893705187954728'

    };

    // =========================
    // ROLES PLATAFORMAS
    // =========================

    const platformRoles = {

      platform_pc:
        '1506895274688249978',

      platform_xbox:
        '1506895290484002888',

      platform_ps:
        '1506895307063955508',

      platform_nintendo:
        '1506895325653106708',

      platform_mobile:
        '1506895342153764974'

    };

    // =========================
    // RESET COLOR
    // =========================

    if (
      interaction.customId ===
      'color_remove'
    ) {

      await interaction.member.roles.remove(
        Object.values(colorRoles)
      );

      return interaction.reply({

        content:
          '❌ Color eliminado.',

        ephemeral: true

      });

    }

    // =========================
    // COLORES
    // =========================

    if (
      colorRoles[interaction.customId]
    ) {

      await interaction.member.roles.remove(
        Object.values(colorRoles)
      );

      await interaction.member.roles.add(
        colorRoles[interaction.customId]
      );

      return interaction.reply({

        content:
          '✅ Color actualizado.',

        ephemeral: true

      });

    }

    // =========================
    // PAISES
    // =========================

    if (
      countryRoles[interaction.customId]
    ) {

      // SOLO 1 PAIS A LA VEZ

      await interaction.member.roles.remove(
        Object.values(countryRoles)
      );

      await interaction.member.roles.add(
        countryRoles[interaction.customId]
      );

      return interaction.reply({

        content:
          '🌍 País actualizado.',

        ephemeral: true

      });

    }

    // =========================
    // JUEGOS
    // =========================

    if (
      gameRoles[interaction.customId]
    ) {

      const roleId =
        gameRoles[interaction.customId];

      // TOGGLE

      if (
        interaction.member.roles.cache.has(roleId)
      ) {

        await interaction.member.roles.remove(
          roleId
        );

        return interaction.reply({

          content:
            '❌ Juego removido.',

          ephemeral: true

        });

      }

      await interaction.member.roles.add(
        roleId
      );

      return interaction.reply({

        content:
          '✅ Juego añadido.',

        ephemeral: true

      });

    }

    // =========================
    // PLATAFORMAS
    // =========================

    if (
      platformRoles[interaction.customId]
    ) {

      const roleId =
        platformRoles[interaction.customId];

      // TOGGLE

      if (
        interaction.member.roles.cache.has(roleId)
      ) {

        await interaction.member.roles.remove(
          roleId
        );

        return interaction.reply({

          content:
            '❌ Plataforma removida.',

          ephemeral: true

        });

      }

      await interaction.member.roles.add(
        roleId
      );

      return interaction.reply({

        content:
          '✅ Plataforma añadida.',

        ephemeral: true

      });

    }

  }

};