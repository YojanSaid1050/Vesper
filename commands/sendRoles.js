const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('sendroles')

    .setDescription(
      'Envía el panel de roles'
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    try {

      // ==================================================
      // RESPONDER INMEDIATAMENTE
      // ==================================================

      await interaction.deferReply({
        flags: 64
      });

      // ==================================================
      // EMOJIS PERSONALIZADOS
      // ==================================================

      const emojis = {

        DS1: '1506893178022789130',
        DS2: '1506893128328675370',
        DS3: '1506893213837824122',
        ER: '1506893263338999931',
        Sekiro: '1506892892906459186',
        Hollow_Knight: '1506893087576821893',
        Silksong: '1506892987085623356',
        Valorant: '1506892411815727134',
        LoL: '1506893034099445901',

        PC: '1507040253821583400',
        Xbox: '1507040189653057707',
        PS: '1507040150348365955',
        Nintendo: '1507040122519158945',
        Cel: '1507040091108020355'

      };

      // ==================================================
      // MENU COLORES
      // ==================================================

      const colorMenu =
        new ActionRowBuilder()

          .addComponents(

            new StringSelectMenuBuilder()

              .setCustomId('select_color')

              .setPlaceholder(
                'Escoge un color'
              )

              .addOptions([

                {
                  label: 'Rojo',
                  value: 'color_red',
                  emoji: '🔴'
                },

                {
                  label: 'Naranja',
                  value: 'color_orange',
                  emoji: '🟠'
                },

                {
                  label: 'Amarillo',
                  value: 'color_yellow',
                  emoji: '🟡'
                },

                {
                  label: 'Verde',
                  value: 'color_green',
                  emoji: '🟢'
                },

                {
                  label: 'Azul Claro',
                  value: 'color_lightblue',
                  emoji: '🩵'
                },

                {
                  label: 'Azul Oscuro',
                  value: 'color_darkblue',
                  emoji: '🔵'
                },

                {
                  label: 'Morado',
                  value: 'color_purple',
                  emoji: '🟣'
                },

                {
                  label: 'Rosa',
                  value: 'color_pink',
                  emoji: '🩷'
                },

                {
                  label: 'Blanco',
                  value: 'color_white',
                  emoji: '⚪'
                },

                {
                  label: 'Negro',
                  value: 'color_black',
                  emoji: '⚫'
                },

                {
                  label: 'Reset',
                  value: 'color_remove',
                  emoji: '❌'
                }

              ])

          );

      // ==================================================
      // MENU PAISES
      // ==================================================

      const countryMenu =
        new ActionRowBuilder()

          .addComponents(

            new StringSelectMenuBuilder()

              .setCustomId('select_country')

              .setPlaceholder(
                'Escoge tu país'
              )

              .addOptions([

                {
                  label: 'Colombia',
                  value: 'country_colombia',
                  emoji: '🇨🇴'
                },

                {
                  label: 'Argentina',
                  value: 'country_argentina',
                  emoji: '🇦🇷'
                },

                {
                  label: 'México',
                  value: 'country_mexico',
                  emoji: '🇲🇽'
                },

                {
                  label: 'Perú',
                  value: 'country_peru',
                  emoji: '🇵🇪'
                },

                {
                  label: 'Chile',
                  value: 'country_chile',
                  emoji: '🇨🇱'
                },

                {
                  label: 'Ecuador',
                  value: 'country_ecuador',
                  emoji: '🇪🇨'
                },

                {
                  label: 'Venezuela',
                  value: 'country_venezuela',
                  emoji: '🇻🇪'
                },

                {
                  label: 'España',
                  value: 'country_spain',
                  emoji: '🇪🇸'
                },

                {
                  label: 'Estados Unidos',
                  value: 'country_usa',
                  emoji: '🇺🇸'
                },

                {
                  label: 'Otro País',
                  value: 'country_other',
                  emoji: '🌍'
                }

              ])

          );

      // ==================================================
      // BOTONES JUEGOS
      // ==================================================

      const gamesRow1 =
        new ActionRowBuilder()

          .addComponents(

            new ButtonBuilder()
              .setCustomId('game_ds1')
              .setEmoji({
                name: 'DS1',
                id: emojis.DS1
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('game_ds2')
              .setEmoji({
                name: 'DS2',
                id: emojis.DS2
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('game_ds3')
              .setEmoji({
                name: 'DS3',
                id: emojis.DS3
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('game_er')
              .setEmoji({
                name: 'ER',
                id: emojis.ER
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('game_sekiro')
              .setEmoji({
                name: 'Sekiro',
                id: emojis.Sekiro
              })
              .setStyle(ButtonStyle.Secondary)

          );

      const gamesRow2 =
        new ActionRowBuilder()

          .addComponents(

            new ButtonBuilder()
              .setCustomId('game_hk')
              .setEmoji({
                name: 'Hollow_Knight',
                id: emojis.Hollow_Knight
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('game_silksong')
              .setEmoji({
                name: 'Silksong',
                id: emojis.Silksong
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('game_valorant')
              .setEmoji({
                name: 'Valorant',
                id: emojis.Valorant
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('game_lol')
              .setEmoji({
                name: 'LoL',
                id: emojis.LoL
              })
              .setStyle(ButtonStyle.Secondary)

          );

      // ==================================================
      // BOTONES PLATAFORMAS
      // ==================================================

      const platformRow =
        new ActionRowBuilder()

          .addComponents(

            new ButtonBuilder()
              .setCustomId('platform_pc')
              .setEmoji({
                name: 'PC',
                id: emojis.PC
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('platform_xbox')
              .setEmoji({
                name: 'Xbox',
                id: emojis.Xbox
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('platform_ps')
              .setEmoji({
                name: 'PS',
                id: emojis.PS
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('platform_nintendo')
              .setEmoji({
                name: 'Nintendo',
                id: emojis.Nintendo
              })
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId('platform_mobile')
              .setEmoji({
                name: 'Cel',
                id: emojis.Cel
              })
              .setStyle(ButtonStyle.Secondary)

          );

      // ==================================================
      // ENVIAR PANEL
      // ==================================================

      await interaction.channel.send({

        flags: 32768,

        components: [

          {
            type: 17,
            accent_color: 16777215,
            spoiler: false,

            components: [

              {
                type: 10,
                content:
'# ꧁𓊈𒆜𓆩༺ 𝑪𝒉𝒐𝒐𝒔𝒆 𝒀𝒐𝒖𝒓 𝑷𝒂𝒕𝒉 ༻𓆪𒆜𓊉꧂'
              },

              {
                type: 14,
                spacing: 2
              },

              {
                type: 10,
                content:
'𝐸𝑙 𝑣𝑎𝑐𝑖́𝑜 𝑜𝑏𝑠𝑒𝑟𝑣𝑎, 𝑝𝑒𝑟𝑜 𝑙𝑎𝑠 𝑏𝑟𝑎𝑠𝑎𝑠 𝑟𝑒𝑐𝑢𝑒𝑟𝑑𝑎𝑛.\n\n𝐴𝑛𝑡𝑒𝑠 𝑑𝑒 𝑐𝑜𝑛𝑡𝑖𝑛𝑢𝑎𝑟 𝑡𝑢 𝑡𝑟𝑎𝑣𝑒𝑠𝑖́𝑎, 𝑟𝑒𝑣𝑒𝑙𝑎 𝑎𝑞𝑢𝑒𝑙𝑙𝑜 𝑞𝑢𝑒 𝑡𝑒 𝑑𝑒𝑓𝑖𝑛𝑒.'
              },

              {
                type: 14,
                spacing: 2
              },

              {
                type: 10,
                content:
'¿𝑄𝑢𝑒́ 𝑙𝑙𝑎𝑚𝑎 𝑔𝑢𝑖́𝑎 𝑡𝑢 𝑐𝑎𝑚𝑖𝑛𝑜?'
              },

              colorMenu.toJSON(),

              {
                type: 14,
                spacing: 2
              },

              {
                type: 10,
                content:
'¿𝐷𝑒 𝑞𝑢𝑒́ 𝑟𝑒𝑖𝑛𝑜 𝑝𝑟𝑜𝑣𝑖𝑒𝑛𝑒𝑠?'
              },

              countryMenu.toJSON(),

              {
                type: 14,
                spacing: 2
              },

              {
                type: 10,
                content:
'¿𝑄𝑢𝑒́ 𝑚𝑢𝑛𝑑𝑜𝑠 𝑟𝑒𝑐𝑜𝑟𝑟𝑒𝑠?'
              },

              gamesRow1.toJSON(),
              gamesRow2.toJSON(),

              {
                type: 14,
                spacing: 2
              },

              {
                type: 10,
                content:
'¿𝐷𝑜́𝑛𝑑𝑒 𝑒𝑚𝑝𝑟𝑒𝑛𝑑𝑒𝑠 𝑡𝑢𝑠 𝑡𝑟𝑎𝑣𝑒𝑠𝑖́𝑎𝑠?'
              },

              platformRow.toJSON()

            ]
          }

        ]

      });

      // ==================================================
      // FINALIZAR INTERACCION
      // ==================================================

      await interaction.editReply({

      });

    } catch (error) {

      console.error(error);

      // EVITAR InteractionAlreadyReplied

      if (
        interaction.deferred &&
        !interaction.replied
      ) {

        await interaction.editReply({

          content:
            '❌ Error enviando el panel.'

        }).catch(() => {});

      }

    }

  }

};