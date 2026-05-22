require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Events
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('clientReady', () => {
  console.log(`✅ Conectado como ${client.user.tag}`);
});

// =========================
// FUNCIÓN WELCOME
// =========================

async function enviarWelcome(member) {

  const canal = member.guild.channels.cache.get('1506586185307263036');

  await canal.send({
    flags: 32768,
    components: [
      {
        type: 17,
        accent_color: 16777215,
        spoiler: false,
        components: [

          // TITLE GRANDE
          {
            type: 10,
            content: '# ⛧°. ⋆༺ 𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟 ℎ𝑎𝑠 𝑎𝑟𝑟𝑖𝑣𝑒𝑑 ༻⋆. °⛧'
          },

          // DIVIDER
          {
            type: 14,
            spacing: 1
          },

          // TEXTO MÁS PEQUEÑO
          {
            type: 10,
            content:
`### 𝑾𝒆𝒍𝒄𝒐𝒎𝒆 𝒕𝒐 𝑬𝒎𝒃𝒆𝒓𝒔 𝑽𝒐𝒊𝒅, ${member}!

༺𓆩~~𝐿𝑒𝑡 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑 𝑔𝑢𝑖𝑑𝑒 𝑦𝑜𝑢𝑟 𝑝𝑎𝑡ℎ.~~𓆪༻`
          },

          // IMAGE
          {
            type: 12,
            items: [
              {
                media: {
                  url: 'https://i.redd.it/gaoeixac0boe1.gif'
                }
              }
            ]
          }

        ]
      }
    ]
  });

}

// =========================
// FUNCIÓN GOODBYE
// =========================

async function enviarGoodbye(member) {

  const canal = member.guild.channels.cache.get('1507249804529369108');

  await canal.send({
    flags: 32768,
    components: [
      {
        type: 17,
        accent_color: 0,
        spoiler: false,
        components: [

          // TITLE GRANDE
          {
            type: 10,
            content: '# ☾°.⋆༺ 𝑇ℎ𝑒 𝑣𝑜𝑖𝑑 𝑐𝑙𝑎𝑖𝑚𝑠 𝑎𝑛𝑜𝑡ℎ𝑒𝑟 𝑠𝑜𝑢𝑙 ༻⋆.°☽'
          },

          // DIVIDER
          {
            type: 14,
            spacing: 1
          },

          // TEXTO MÁS PEQUEÑO
          {
            type: 10,
            content:
`### 𝑭𝒂𝒓𝒆𝒘𝒆𝒍𝒍, .˚⊱${member.user.username}⊰˚. 𝑨𝒏𝒐𝒕𝒉𝒆𝒓 𝒆𝒄𝒉𝒐 𝒇𝒂𝒍𝒍𝒔 𝒔𝒊𝒍𝒆𝒏𝒕.

༺𓆩~~𝑀𝑎𝑦 𝑖𝑡𝑠 𝑒𝑚𝑏𝑒𝑟𝑠 𝑐𝑜𝑛𝑡𝑖𝑛𝑢𝑒 𝑡𝑜 𝑏𝑢𝑟𝑛 𝑏𝑒𝑦𝑜𝑛𝑑 𝑡ℎ𝑒 𝑣𝑜𝑖𝑑.~~𓆪༻`
          },

          // IMAGE
          {
            type: 12,
            items: [
              {
                media: {
                  url: 'https://i.redd.it/gaoeixac0boe1.gif'
                }
              }
            ]
          }

        ]
      }
    ]
  });

}

// =========================
// EVENTO WELCOME REAL
// =========================

client.on('guildMemberAdd', async (member) => {

  console.log(`${member.user.tag} entró al servidor`);

  enviarWelcome(member);

});

// =========================
// EVENTO GOODBYE REAL
// =========================

client.on('guildMemberRemove', async (member) => {

  console.log(`${member.user.tag} salió del servidor`);

  enviarGoodbye(member);

});

// =========================
// MODO PRUEBA
// =========================

client.on(Events.MessageCreate, async (message) => {

  if (message.author.bot) return;

  // TEST WELCOME

  if (message.content === '!testwelcome') {

    enviarWelcome(message.member);

  }

  // TEST GOODBYE

  if (message.content === '!testgoodbye') {

    enviarGoodbye(message.member);

  }

});

client.login(process.env.TOKEN);