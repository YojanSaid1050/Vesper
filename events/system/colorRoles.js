const {
  Events
} = require('discord.js');

module.exports = {

  name: Events.InteractionCreate,

  async execute(interaction) {

  // ==================================================
  // SOLO BOTONES Y MENUS
  // ==================================================

  if (
    !interaction.isButton() &&
    !interaction.isStringSelectMenu()
  ) return;

  // ==================================================
  // ROLES COLORES
  // ==================================================

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

  // ==================================================
  // ROLES PAISES
  // ==================================================

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

  // ==================================================
  // ROLES JUEGOS
  // ==================================================

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

  // ==================================================
  // ROLES PLATAFORMAS
  // ==================================================

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

  // ==================================================
  // FILTRO IMPORTANTE
  // SOLO PROCESAR IDs DE ESTE ARCHIVO
  // ==================================================

  const handledInteraction =

    interaction.customId === 'select_color' ||
    interaction.customId === 'select_country' ||

    Object.prototype.hasOwnProperty.call(
      colorRoles,
      interaction.customId
    ) ||

    Object.prototype.hasOwnProperty.call(
      countryRoles,
      interaction.customId
    ) ||

    Object.prototype.hasOwnProperty.call(
      gameRoles,
      interaction.customId
    ) ||

    Object.prototype.hasOwnProperty.call(
      platformRoles,
      interaction.customId
    );

  if (!handledInteraction) return;

  // ==================================================
  // ACK SOLO PARA ESTE SISTEMA
  // ==================================================

  try {

    if (
      !interaction.deferred &&
      !interaction.replied
    ) {

      await interaction.deferUpdate();

    }

  } catch {

    return;

  }

  // ==================================================
  // SELECT MENU - COLORES
  // ==================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === 'select_color'
  ) {

    try {

      const selected =
        interaction.values[0];

      await interaction.member.roles.remove(
        Object.values(colorRoles)
      );

      if (
        selected === 'color_remove'
      ) return;

      const roleId =
        colorRoles[selected];

      if (!roleId) return;

      await interaction.member.roles.add(
        roleId
      );

    } catch (err) {

      console.error(
        'Error en colores:',
        err
      );

    }

    return;

  }

  // ==================================================
  // SELECT MENU - PAISES
  // ==================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === 'select_country'
  ) {

    try {

      const selected =
        interaction.values[0];

      await interaction.member.roles.remove(
        Object.values(countryRoles)
      );

      const roleId =
        countryRoles[selected];

      if (!roleId) return;

      await interaction.member.roles.add(
        roleId
      );

    } catch (err) {

      console.error(
        'Error en países:',
        err
      );

    }

    return;

  }

  // ==================================================
  // BOTONES - JUEGOS
  // ==================================================

  if (
    interaction.isButton() &&
    gameRoles[interaction.customId]
  ) {

    try {

      const roleId =
        gameRoles[
          interaction.customId
        ];

      if (
        interaction.member.roles.cache.has(
          roleId
        )
      ) {

        await interaction.member.roles.remove(
          roleId
        );

      } else {

        await interaction.member.roles.add(
          roleId
        );

      }

    } catch (err) {

      console.error(
        'Error en juegos:',
        err
      );

    }

    return;

  }

  // ==================================================
  // BOTONES - PLATAFORMAS
  // ==================================================

  if (
    interaction.isButton() &&
    platformRoles[
      interaction.customId
    ]
  ) {

    try {

      const roleId =
        platformRoles[
          interaction.customId
        ];

      if (
        interaction.member.roles.cache.has(
          roleId
        )
      ) {

        await interaction.member.roles.remove(
          roleId
        );

      } else {

        await interaction.member.roles.add(
          roleId
        );

      }

    } catch (err) {

      console.error(
        'Error en plataformas:',
        err
      );

    }

    return;

  }

}

};