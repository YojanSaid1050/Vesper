const config = require('../config/config.json');
const enviarWelcome = require('../functions/welcomeEmbed');

module.exports = async (member) => {

  const canal = member.guild.channels.cache.get(config.welcomeChannel);

  enviarWelcome(member, canal);

};