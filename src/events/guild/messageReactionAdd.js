const { Events } = require('discord.js');
const { handleStarReaction } = require('../../core/CommunityService');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction) {
    await handleStarReaction(reaction);
  }
};
