module.exports = async function verifyButton(interaction) {
  const roleId = '1506900567199449179';
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role) {
    return interaction.reply({
      content: '❌ No se encontró el rol.',
      flags: 64
    });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({
      content: '🌑 Ya has abrazado el vacío.',
      flags: 64
    });
  }

  await interaction.member.roles.add(role);
  return interaction.reply({
    content: '🌑 Has abrazado el vacío.',
    flags: 64
  });
};