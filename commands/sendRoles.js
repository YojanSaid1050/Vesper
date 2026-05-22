const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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

    // =========================
    // EMOJIS PERSONALIZADOS
    // =========================

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
      nintendo: '1507040122519158945',
      Cel: '1507040091108020355'

    };

    // =========================
    // PANEL PRINCIPAL
    // =========================

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
'### 𝐸𝑙 𝑣𝑎𝑐𝑖́𝑜 𝑜𝑏𝑠𝑒𝑟𝑣𝑎, 𝑝𝑒𝑟𝑜 𝑙𝑎𝑠 𝑏𝑟𝑎𝑠𝑎𝑠 𝑟𝑒𝑐𝑢𝑒𝑟𝑑𝑎𝑛.\n\n𝐴𝑛𝑡𝑒𝑠 𝑑𝑒 𝑐𝑜𝑛𝑡𝑖𝑛𝑢𝑎𝑟 𝑡𝑢 𝑡𝑟𝑎𝑣𝑒𝑠𝑖́𝑎, 𝑟𝑒𝑣𝑒𝑙𝑎 𝑎𝑞𝑢𝑒𝑙𝑙𝑜 𝑞𝑢𝑒 𝑡𝑒 𝑑𝑒𝑓𝑖𝑛𝑒.'
            },

            {
              type: 14,
              spacing: 2
            },

            {
              type: 10,

              content:
'### ¿𝑄𝑢𝑒́ 𝑙𝑙𝑎𝑚𝑎 𝑔𝑢𝑖́𝑎 𝑡𝑢 𝑐𝑎𝑚𝑖𝑛𝑜?'
            }

          ]
        }

      ]

    });

    // =========================
    // BOTONES COLORES
    // =========================

    const colorRow1 =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()
            .setCustomId('color_red')
            .setLabel('🔴')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_orange')
            .setLabel('🟠')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_yellow')
            .setLabel('🟡')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_green')
            .setLabel('🟢')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_lightblue')
            .setLabel('🩵')
            .setStyle(ButtonStyle.Secondary)

        );

    const colorRow2 =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()
            .setCustomId('color_darkblue')
            .setLabel('🔵')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_purple')
            .setLabel('🟣')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_pink')
            .setLabel('🩷')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_white')
            .setLabel('⚪')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('color_black')
            .setLabel('⚫')
            .setStyle(ButtonStyle.Secondary)

        );

    const colorRow3 =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()
            .setCustomId('color_remove')
            .setLabel('❌ Reset')
            .setStyle(ButtonStyle.Danger)

        );

    await interaction.channel.send({

      components: [
        colorRow1,
        colorRow2,
        colorRow3
      ]

    });

    // =========================
    // PAISES
    // =========================

    await interaction.channel.send({

      flags: 32768,

      components: [

        {
          type: 17,

          accent_color: 16777215,

          spoiler: false,

          components: [

            {
              type: 14,
              spacing: 2
            },

            {
              type: 10,

              content:
'### ¿𝐷𝑒 𝑞𝑢𝑒́ 𝑟𝑒𝑖𝑛𝑜 𝑝𝑟𝑜𝑣𝑖𝑒𝑛𝑒𝑠?'
            }

          ]
        }

      ]

    });

    const countryRow1 =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()
            .setCustomId('country_colombia')
            .setLabel('🇨🇴 Colombia')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_argentina')
            .setLabel('🇦🇷 Argentina')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_mexico')
            .setLabel('🇲🇽 México')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_peru')
            .setLabel('🇵🇪 Perú')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_chile')
            .setLabel('🇨🇱 Chile')
            .setStyle(ButtonStyle.Secondary)

        );

    const countryRow2 =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()
            .setCustomId('country_ecuador')
            .setLabel('🇪🇨 Ecuador')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_venezuela')
            .setLabel('🇻🇪 Venezuela')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_spain')
            .setLabel('🇪🇸 España')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_usa')
            .setLabel('🇺🇸 USA')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('country_other')
            .setLabel('🌍 Otro')
            .setStyle(ButtonStyle.Primary)

        );

    await interaction.channel.send({

      components: [
        countryRow1,
        countryRow2
      ]

    });

    // =========================
    // JUEGOS
    // =========================

    await interaction.channel.send({

      flags: 32768,

      components: [

        {
          type: 17,

          accent_color: 16777215,

          spoiler: false,

          components: [

            {
              type: 14,
              spacing: 2
            },

            {
              type: 10,

              content:
'### ¿𝑄𝑢𝑒́ 𝑚𝑢𝑛𝑑𝑜𝑠 𝑟𝑒𝑐𝑜𝑟𝑟𝑒𝑠?'
            }

          ]
        }

      ]

    });

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

    await interaction.channel.send({

      components: [
        gamesRow1,
        gamesRow2
      ]

    });

    // =========================
    // PLATAFORMAS
    // =========================

    await interaction.channel.send({

      flags: 32768,

      components: [

        {
          type: 17,

          accent_color: 16777215,

          spoiler: false,

          components: [

            {
              type: 14,
              spacing: 2
            },

            {
              type: 10,

              content:
'### ¿𝐷𝑜́𝑛𝑑𝑒 𝑒𝑚𝑝𝑟𝑒𝑛𝑑𝑒𝑠 𝑡𝑢𝑠 𝑡𝑟𝑎𝑣𝑒𝑠𝑖́𝑎𝑠?'
            }

          ]
        }

      ]

    });

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
              name: 'nintendo',
              id: emojis.nintendo
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

    await interaction.channel.send({

      components: [
        platformRow
      ]

    });

    // =========================
    // RESPUESTA FINAL
    // =========================

    await interaction.reply({

      content:
        '✅ Panel enviado.',

      ephemeral: true

    });

  }

};