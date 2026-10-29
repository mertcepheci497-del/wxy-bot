const { SlashCommandBuilder: S, PermissionFlagsBits: P, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const runBot = require('../shared/runBot');
const guard = require('../shared/guard');
const perms = require('../shared/perms');
const db = require('../shared/db')('mod');
const { embed, eph, BRAND } = require('../shared/util');

const cfgOf = gid => ({ logChannel: null, logOn: true, lang: 'tr', ...db.get('g:' + gid, {}) });
const setCfg = (gid, patch) => db.set('g:' + gid, { ...cfgOf(gid), ...patch });
const T = {
  tr: { del: 'Mesaj silindi', edit: 'Mesaj düzenlendi', join: 'Üye katıldı', leave: 'Üye ayrıldı', ban: 'Üye yasaklandı', unban: 'Yasak kaldırıldı' },
  en: { del: 'Message deleted', edit: 'Message edited', join: 'Member joined', leave: 'Member left', ban: 'Member banned', unban: 'Ban removed' },
};
const base = (n, d, perm) => { const b = new S().setName(n).setDescription(d).setDMPermission(false); return perm ? b.setDefaultMemberPermissions(perm) : b; };
const ownerOnly = fn => async (i, c) => (perms.level(i.user.id) < 3 ? i.reply(eph('❌ Bu komutu sadece bot sahibi kullanabilir.')) : fn(i, c));

const commands = [];
const add = (data, execute) => commands.push({ data, execute });

add(base('bot-yetkili-ekle', 'Bir kullanıcıyı bot yetkilisi yapar (sadece bot sahibi)')
  .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
ownerOnly(async i => {
  const u = i.options.getUser('kullanici');
  i.reply(eph(perms.add('yetkili', u.id) ? `✅ ${u} bot yetkilisi yapıldı.` : '❌ Zaten yetkili.'));
}));

add(base('bot-yetkili-kaldir', 'Bir kullanıcının bot yetkisini alır (sadece bot sahibi)')
  .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
ownerOnly(async i => {
  const u = i.options.getUser('kullanici');
  i.reply(eph(perms.remove('yetkili', u.id) ? `✅ ${u} yetkisi alındı.` : '❌ Bu kullanıcı yetkili değil.'));
}));

add(base('bot-yetkili-liste', 'Bot yetkililerini listeler (sadece bot sahibi)'),
ownerOnly(async i => {
  const l = perms.list('yetkili');
  i.reply({ embeds: [embed('👮 Bot Yetkilileri', l.length ? l.map(x => `<@${x}>`).join('\n') : 'Liste boş.')], flags: 64 });
}));

function panel(gid) {
  const c = guard.get(gid), keys = ['link', 'spam', 'raid', 'nuke'];
  return {
    embeds: [embed('🛡️ Guard Paneli', keys.map(k => `${c[k] ? '🟢' : '🔴'} **${k}**`).join('\n') + '\n\nButonlara basarak korumaları aç/kapat.')],
    components: [new ActionRowBuilder().addComponents(keys.map(k =>
      new ButtonBuilder().setCustomId('gp_' + k).setLabel(k).setStyle(c[k] ? ButtonStyle.Success : ButtonStyle.Danger)))],
  };
}
add(base('guard-panel', 'Guard (anti-nuke) ayar panelini açar', P.Administrator), async i => i.reply(panel(i.guild.id)));

add(base('language-settings', 'Botun bu sunucudaki dilini ayarlar', P.Administrator)
  .addStringOption(o => o.setName('dil').setDescription('Dil').setRequired(true).addChoices({ name: 'Türkçe', value: 'tr' }, { name: 'English', value: 'en' })),
async i => { setCfg(i.guild.id, { lang: i.options.getString('dil') }); i.reply(eph('✅ Dil güncellendi / Language updated.')); });

add(base('log-settings', 'Log sistemi ayarlarını açar', P.Administrator)
  .addChannelOption(o => o.setName('kanal').setDescription('Log kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addBooleanOption(o => o.setName('durum').setDescription('Log açık mı?')),
async i => {
  const ch = i.options.getChannel('kanal'), on = i.options.getBoolean('durum') ?? true;
  setCfg(i.guild.id, { logChannel: ch.id, logOn: on });
  i.reply(eph(`✅ Log kanalı ${ch}, durum: **${on ? 'açık' : 'kapalı'}**.`));
});

add(base('yardım', 'Botun komutlarını gösterir'), async i =>
  i.reply({ embeds: [embed(`🛠️ ${BRAND} Family Moderasyon`,
    '`/bot-yetkili-ekle` `/bot-yetkili-kaldir` `/bot-yetkili-liste`\n`/guard-panel` `/language-settings` `/log-settings`\n\nLog sistemi: mesaj silme/düzenleme, giriş/çıkış, ban/unban olaylarını log kanalına yazar.')] }));

runBot({
  name: 'Moderasyon',
  token: process.env.MODERASYON_TOKEN,
  commands,
  setup(client) {
    const log = (guild, key, text, color = 0x5865f2) => {
      const c = cfgOf(guild.id);
      if (!c.logOn || !c.logChannel) return;
      guild.channels.cache.get(c.logChannel)?.send({ embeds: [embed(`📝 ${T[c.lang][key]}`, text, color)] }).catch(() => {});
    };
    client.on(Events.MessageDelete, m => {
      if (!m.guild || m.author?.bot) return;
      log(m.guild, 'del', `**Kullanıcı:** ${m.author || 'bilinmiyor'}\n**Kanal:** ${m.channel}\n**İçerik:** ${(m.content || '—').slice(0, 1000)}`, 0xed4245);
    });
    client.on(Events.MessageUpdate, (a, b) => {
      if (!a.guild || a.author?.bot || a.content === b.content) return;
      log(a.guild, 'edit', `**Kullanıcı:** ${a.author}\n**Kanal:** ${a.channel}\n**Önce:** ${(a.content || '—').slice(0, 500)}\n**Sonra:** ${(b.content || '—').slice(0, 500)}`, 0xfaa61a);
    });
    client.on(Events.GuildMemberAdd, m => log(m.guild, 'join', `${m} (${m.user.tag})`, 0x57f287));
    client.on(Events.GuildMemberRemove, m => log(m.guild, 'leave', `${m.user.tag}`, 0xed4245));
    client.on(Events.GuildBanAdd, b => log(b.guild, 'ban', `${b.user.tag}`, 0xed4245));
    client.on(Events.GuildBanRemove, b => log(b.guild, 'unban', `${b.user.tag}`, 0x57f287));

    client.onComponent = async i => {
      if (!i.isButton() || !i.customId.startsWith('gp_')) return;
      if (!i.memberPermissions.has(P.Administrator)) return i.reply(eph('❌ Yönetici olmalısın.'));
      const k = i.customId.slice(3);
      guard.set(i.guild.id, { [k]: !guard.get(i.guild.id)[k] });
      i.update(panel(i.guild.id));
    };
  },
});
