const { Client, GatewayIntentBits: G, Partials, Collection, Events, ActivityType } = require('discord.js');

module.exports = function runBot({ name, token, commands, setup }) {
  if (!token) { console.log(`[${name}] token girilmemiş, bu bot atlanıyor.`); return; }

  const client = new Client({
    intents: [G.Guilds, G.GuildMembers, G.GuildMessages, G.MessageContent, G.GuildModeration, G.GuildVoiceStates],
    partials: [Partials.Channel, Partials.Message],
  });
  client.commands = new Collection(commands.map(c => [c.data.name, c]));

  client.once(Events.ClientReady, async () => {
    try {
      await client.application.commands.set(commands.map(c => c.data.toJSON()));
      client.user.setActivity('/yardım', { type: ActivityType.Listening });
      console.log(`[${name}] hazır: ${client.user.tag} (${commands.length} komut)`);
    } catch (e) { console.error(`[${name}] komut kaydı hatası:`, e); }
  });

  client.on(Events.InteractionCreate, async i => {
    try {
      if (i.isChatInputCommand()) {
        const c = client.commands.get(i.commandName);
        if (c) await c.execute(i, client);
      } else if (client.onComponent) {
        await client.onComponent(i);
      }
    } catch (e) {
      console.error(`[${name}]`, e);
      const msg = { content: '❌ Bir hata oluştu.', flags: 64 };
      if (i.deferred || i.replied) i.followUp(msg).catch(() => {});
      else i.reply(msg).catch(() => {});
    }
  });

  if (setup) setup(client);
  client.login(token).catch(e => console.error(`[${name}] giriş hatası:`, e.message));
  return client;
};
