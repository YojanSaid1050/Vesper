const config = require('../config/config.json');
const enviarGoodbye = require('../functions/goodbyeEmbed');

module.exports = async (member) => {

  const canal = member.guild.channels.cache.get(config.goodbyeChannel);

  enviarGoodbye(member, canal);

};