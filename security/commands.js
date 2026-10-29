const { SlashCommandBuilder: S, PermissionFlagsBits: P, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
const { embed, eph, BRAND } = require('../shared/util');
const guard = require('../shared/guard');
const perms = require('../shared/perms');
const db = require('../shared/db')('security');

const cmds = [];
const add = (data, execute) => cmds.push({ data, execute });
const base = (name, desc, perm) => {
  const b = new S().setName(name).setDescription(desc).setDMPermission(false);
  return perm ? b.setDefaultMemberPermissions(perm) : b;
};
const higher = (i, m) => i.guild.ownerId === i.user.id || i.member.roles.highest.position > m.roles.highest.position;
const levelOf = xp => Math.floor(0.1 * Math.sqrt(xp));

// ---------- Moderasyon ----------
add(base('kick', 'Üyeyi sunucudan atar.', P.KickMembers)
  .addUserOption(o => o.setName('kullanici').setDescription('Atılacak üye').setRequired(true))
  .addStringOption(o => o.setName('sebep').setDescription('Sebep')),
async i => {
  const m = i.options.getMember('kullanici'), sebep = i.options.getString('sebep') || 'Sebep belirtilmedi';
  if (!m || !m.kickable || !higher(i, m) || m.id === i.user.id) return i.reply(eph('❌ Bu üyeyi atamam.'));
  await m.kick(`${i.user.tag}: ${sebep}`);
  i.reply({ embeds: [embed('👢 Atıldı', `${m} sunucudan atıldı.\n**Sebep:** ${sebep}`, 0xfaa61a)] });
});

add(base('ban', 'Üyeyi yasaklar.', P.BanMembers)
  .addUserOption(o => o.setName('kullanici').setDescription('Yasaklanacak üye').setRequired(true))
  .addStringOption(o => o.setName('sebep').setDescription('Sebep')),
async i => {
  const u = i.options.getUser('kullanici'), sebep = i.options.getString('sebep') || 'Sebep belirtilmedi';
  const m = await i.guild.members.fetch(u.id).catch(() => null);
  if (u.id === i.user.id || (m && (!m.bannable || !higher(i, m)))) return i.reply(eph('❌ Bu üyeyi yasaklayamam.'));
  await i.guild.members.ban(u.id, { reason: `${i.user.tag}: ${sebep}` });
  i.reply({ embeds: [embed('🔨 Yasaklandı', `${u} yasaklandı.\n**Sebep:** ${sebep}`, 0xed4245)] });
});

add(base('unban', 'Kullanıcının yasağını kaldırır.', P.BanMembers)
  .addStringOption(o => o.setName('id').setDescription('Kullanıcı ID').setRequired(true)),
async i => {
  const id = i.options.getString('id');
  await i.guild.members.unban(id).then(
    () => i.reply({ embeds: [embed('✅ Yasak kaldırıldı', `<@${id}> yasağı kaldırıldı.`, 0x57f287)] }),
    () => i.reply(eph('❌ Bu ID yasaklı değil.')));
});

add(base('sustur', 'Üyeyi belirli süre susturur.', P.ModerateMembers)
  .addUserOption(o => o.setName('kullanici').setDescription('Üye').setRequired(true))
  .addIntegerOption(o => o.setName('dakika').setDescription('Süre (dakika)').setMinValue(1).setMaxValue(40320).setRequired(true))
  .addStringOption(o => o.setName('sebep').setDescription('Sebep')),
async i => {
  const m = i.options.getMember('kullanici'), dk = i.options.getInteger('dakika'), sebep = i.options.getString('sebep') || 'Sebep belirtilmedi';
  if (!m || !m.moderatable || !higher(i, m)) return i.reply(eph('❌ Bu üyeyi susturamam.'));
  await m.timeout(dk * 60000, `${i.user.tag}: ${sebep}`);
  i.reply({ embeds: [embed('🔇 Susturuldu', `${m} **${dk} dakika** susturuldu.\n**Sebep:** ${sebep}`, 0xfaa61a)] });
});

add(base('susturma-kaldir', 'Üyenin susturmasını kaldırır.', P.ModerateMembers)
  .addUserOption(o => o.setName('kullanici').setDescription('Üye').setRequired(true)),
async i => {
  const m = i.options.getMember('kullanici');
  if (!m || !m.moderatable) return i.reply(eph('❌ İşlem yapılamadı.'));
  await m.timeout(null);
  i.reply({ embeds: [embed('🔊 Susturma kaldırıldı', `${m} artık konuşabilir.`, 0x57f287)] });
});

for (const [name, give] of [['rol-ver', true], ['rol-al', false]]) {
  add(base(name, give ? 'Üyeye rol verir.' : 'Üyeden rol alır.', P.ManageRoles)
    .addUserOption(o => o.setName('kullanici').setDescription('Üye').setRequired(true))
    .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),
  async i => {
    const m = i.options.getMember('kullanici'), r = i.options.getRole('rol');
    if (!m || !r.editable || (i.guild.ownerId !== i.user.id && r.position >= i.member.roles.highest.position))
      return i.reply(eph('❌ Bu rolü yönetemem/yönetemezsin.'));
    await (give ? m.roles.add(r) : m.roles.remove(r));
    i.reply({ embeds: [embed(give ? '✅ Rol verildi' : '✅ Rol alındı', `${m} ${give ? 'üyesine' : 'üyesinden'} ${r} ${give ? 'verildi' : 'alındı'}.`, 0x57f287)] });
  });
}

add(base('kilitle', 'Bu kanalı mesaj gönderimine kapatır/açar.', P.ManageChannels), async i => {
  const everyone = i.guild.roles.everyone;
  const open = i.channel.permissionsFor(everyone).has(P.SendMessages);
  await i.channel.permissionOverwrites.edit(everyone, { SendMessages: open ? false : null });
  i.reply(open ? '🔒 Kanal kilitlendi.' : '🔓 Kanal kilidi açıldı.');
});

add(base('toplurolver', 'Sunucudaki üyelere seçilen rolü verir.', P.Administrator)
  .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),
async i => {
  const r = i.options.getRole('rol');
  if (!r.editable) return i.reply(eph('❌ Bu rol benim rolümden yüksek.'));
  await i.deferReply();
  const members = await i.guild.members.fetch();
  let n = 0;
  for (const m of members.values()) if (!m.roles.cache.has(r.id)) { await m.roles.add(r).then(() => n++).catch(() => {}); }
  i.editReply(`✅ ${r} rolü **${n}** üyeye verildi.`);
});

add(base('toplurolal', 'Sunucudaki üyelerden seçilen rolü alır.', P.Administrator)
  .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),
async i => {
  const r = i.options.getRole('rol');
  if (!r.editable) return i.reply(eph('❌ Bu rol benim rolümden yüksek.'));
  await i.deferReply();
  await i.guild.members.fetch();
  let n = 0;
  for (const m of r.members.values()) await m.roles.remove(r).then(() => n++).catch(() => {});
  i.editReply(`✅ ${r} rolü **${n}** üyeden alındı.`);
});

// ---------- Guard ----------
add(base('guard-ayarla', 'Guard log kanalını ayarlar.', P.Administrator)
  .addChannelOption(o => o.setName('kanal').setDescription('Log kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true)),
async i => {
  guard.set(i.guild.id, { logChannel: i.options.getChannel('kanal').id });
  i.reply(eph(`✅ Guard log kanalı ${i.options.getChannel('kanal')} olarak ayarlandı.`));
});

for (const [k, label] of [['link', 'Link ve davet'], ['spam', 'Spam'], ['raid', 'Raid'], ['nuke', 'Anti-nuke']]) {
  add(base(`guard-${k}`, `${label} korumasını ayarlar.`, P.Administrator)
    .addBooleanOption(o => o.setName('durum').setDescription('Açık mı?').setRequired(true)),
  async i => {
    const v = i.options.getBoolean('durum');
    guard.set(i.guild.id, { [k]: v });
    i.reply(eph(`✅ ${label} koruması **${v ? 'açıldı' : 'kapatıldı'}**.`));
  });
}

add(base('guard-durum', 'Guard ayarlarını ve koruma durumunu gösterir.', P.Administrator), async i => {
  const c = guard.get(i.guild.id), on = v => (v ? '🟢 Açık' : '🔴 Kapalı');
  i.reply({ embeds: [embed('🛡️ Guard Durumu',
    `**Link/Davet:** ${on(c.link)}\n**Spam:** ${on(c.spam)}\n**Raid:** ${on(c.raid)}\n**Anti-nuke:** ${on(c.nuke)}\n` +
    `**Log kanalı:** ${c.logChannel ? `<#${c.logChannel}>` : 'Ayarlanmadı'}\n**Whitelist:** ${c.whitelist.length} kayıt`)] });
});

add(base('guard-whitelist-ekle', 'Kullanıcıyı veya rolü Guard whitelist\'e ekler.', P.Administrator)
  .addMentionableOption(o => o.setName('hedef').setDescription('Kullanıcı veya rol').setRequired(true)),
async i => {
  const t = i.options.getMentionable('hedef'), c = guard.get(i.guild.id);
  if (!c.whitelist.includes(t.id)) guard.set(i.guild.id, { whitelist: [...c.whitelist, t.id] });
  i.reply(eph(`✅ ${t} whitelist'e eklendi.`));
});

add(base('guard-whitelist-sil', 'Whitelist kaydını siler.', P.Administrator)
  .addMentionableOption(o => o.setName('hedef').setDescription('Kullanıcı veya rol').setRequired(true)),
async i => {
  const t = i.options.getMentionable('hedef'), c = guard.get(i.guild.id);
  guard.set(i.guild.id, { whitelist: c.whitelist.filter(x => x !== t.id) });
  i.reply(eph(`✅ ${t} whitelist'ten çıkarıldı.`));
});

add(base('guard-whitelist-liste', 'Whitelist kayıtlarını listeler.', P.Administrator), async i => {
  const c = guard.get(i.guild.id);
  i.reply({ embeds: [embed('📋 Guard Whitelist', c.whitelist.length ? c.whitelist.map(x => `<@${x}> / <@&${x}>`).join('\n') : 'Liste boş.')], flags: 64 });
});

add(base('blackbox-son', 'Son güvenlik olaylarını gösterir.', P.Administrator), async i => {
  const bb = guard.blackbox(i.guild.id).slice(0, 10);
  i.reply({ embeds: [embed('📦 Blackbox', bb.length ? bb.map(b => `<t:${Math.floor(b.t / 1000)}:R> • ${b.text}`).join('\n') : 'Kayıt yok.')] });
});

add(base('radar-durum', `${BRAND} RADAR güvenlik durumunu gösterir.`, P.Administrator), async (i, client) => {
  const c = guard.get(i.guild.id), active = ['link', 'spam', 'raid', 'nuke'].filter(k => c[k]).length;
  const up = Math.floor(process.uptime() / 60);
  i.reply({ embeds: [embed(`📡 ${BRAND} RADAR`,
    `**Ping:** ${client.ws.ping}ms\n**Aktif koruma:** ${active}/4\n**Çalışma süresi:** ${Math.floor(up / 60)}s ${up % 60}dk\n**Son olay:** ${guard.blackbox(i.guild.id)[0]?.text || 'Yok'}`)] });
});

// ---------- Otomatik cevap ----------
add(base('otomatik-cevap-ekle', 'Otomatik cevap ekler.', P.ManageGuild)
  .addStringOption(o => o.setName('tetik').setDescription('Mesaj').setRequired(true))
  .addStringOption(o => o.setName('cevap').setDescription('Bot cevabı').setRequired(true)),
async i => {
  const k = 'ar:' + i.guild.id, ar = db.get(k, {});
  ar[i.options.getString('tetik').toLowerCase().trim()] = i.options.getString('cevap');
  db.set(k, ar);
  i.reply(eph('✅ Otomatik cevap eklendi.'));
});

add(base('otomatik-cevap-liste', 'Otomatik cevapları listeler.', P.ManageGuild), async i => {
  const ar = db.get('ar:' + i.guild.id, {}), e = Object.entries(ar);
  i.reply({ embeds: [embed('💬 Otomatik Cevaplar', e.length ? e.map(([a, b]) => `**${a}** → ${b}`).join('\n') : 'Kayıt yok.')], flags: 64 });
});

add(base('otomatik-cevap-sil', 'Otomatik cevabı siler.', P.ManageGuild)
  .addStringOption(o => o.setName('tetik').setDescription('Silinecek mesaj').setRequired(true)),
async i => {
  const k = 'ar:' + i.guild.id, ar = db.get(k, {}), t = i.options.getString('tetik').toLowerCase().trim();
  if (!ar[t]) return i.reply(eph('❌ Böyle bir kayıt yok.'));
  delete ar[t]; db.set(k, ar);
  i.reply(eph('✅ Silindi.'));
});

// ---------- Bilgi ----------
add(base('sunucu', 'Sunucu hakkında detaylı bilgi gösterir.'), async i => {
  const g = i.guild;
  await g.members.fetch().catch(() => {});
  const ch = t => g.channels.cache.filter(c => c.type === t).size;
  const bots = g.members.cache.filter(m => m.user.bot).size;
  i.reply({ embeds: [embed(`📊 ${g.name} | Sunucu Bilgileri`,
    `👥 **Üyeler**\nToplam: ${g.memberCount}\nİnsan: ${g.memberCount - bots}\nBot: ${bots}\n\n` +
    `💬 **Kanallar**\nToplam: ${g.channels.cache.size}\nMetin: ${ch(ChannelType.GuildText)}\nSes: ${ch(ChannelType.GuildVoice)}\nKategoriler: ${ch(ChannelType.GuildCategory)}\n\n` +
    `🎭 **Toplam rol:** ${g.roles.cache.size}\n👑 **Sunucu sahibi:** <@${g.ownerId}>\n📅 **Kuruluş:** <t:${Math.floor(g.createdTimestamp / 1000)}:F>\n🆔 **ID:** \`${g.id}\``)
    .setThumbnail(g.iconURL())] });
});

add(base('seviye', 'Senin veya bir üyenin seviyesini gösterir.')
  .addUserOption(o => o.setName('kullanici').setDescription('Üye')),
async i => {
  const u = i.options.getUser('kullanici') || i.user, xp = db.get(`xp:${i.guild.id}:${u.id}`, 0), lv = levelOf(xp);
  const next = Math.pow((lv + 1) * 10, 2);
  i.reply({ embeds: [embed(`⭐ ${u.username} seviyesi`, `**Seviye:** ${lv}\n**XP:** ${xp} / ${next}`)] });
});

add(base('bot-durum', 'Botun oynuyor durumunu değiştirir.')
  .addStringOption(o => o.setName('metin').setDescription('Durum metni').setRequired(true)),
async (i, client) => {
  if (perms.level(i.user.id) < 3) return i.reply(eph('❌ Sadece bot sahibi kullanabilir.'));
  client.user.setActivity(i.options.getString('metin'), { type: ActivityType.Playing });
  i.reply(eph('✅ Durum güncellendi.'));
});

add(base('duyuru', 'Profesyonel bir sunucu duyurusu gönderir.', P.ManageGuild)
  .addChannelOption(o => o.setName('kanal').setDescription('Kanal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
  .addStringOption(o => o.setName('baslik').setDescription('Başlık').setRequired(true))
  .addStringOption(o => o.setName('mesaj').setDescription('Mesaj').setRequired(true))
  .addBooleanOption(o => o.setName('etiket').setDescription('@everyone etiketlensin mi?')),
async i => {
  const ch = i.options.getChannel('kanal');
  await ch.send({
    content: i.options.getBoolean('etiket') ? '@everyone' : undefined,
    embeds: [embed(`📢 ${i.options.getString('baslik')}`, i.options.getString('mesaj').replace(/\\n/g, '\n')).setFooter({ text: `${BRAND} SECURITY • ${i.user.username}` })],
  });
  i.reply(eph(`✅ Duyuru ${ch} kanalına gönderildi.`));
});

// ---------- Ticket ----------
add(base('ticket-panel', `${BRAND} SECURITY destek panelini gönderir.`, P.Administrator)
  .addChannelOption(o => o.setName('kanal').setDescription('Panel kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addRoleOption(o => o.setName('yetkili-rol').setDescription('Ticketlara bakacak yetkili rolü')),
async i => {
  const ch = i.options.getChannel('kanal'), role = i.options.getRole('yetkili-rol');
  db.set('ticket:' + i.guild.id, { staffRole: role?.id || null });
  await ch.send({
    embeds: [embed('🎫 Destek Sistemi', 'Yardıma mı ihtiyacın var? Aşağıdaki butona basarak özel bir destek kanalı açabilirsin.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open').setLabel('Ticket Aç').setEmoji('🎫').setStyle(ButtonStyle.Primary))],
  });
  i.reply(eph(`✅ Ticket paneli ${ch} kanalına gönderildi.`));
});

add(base('yardım', 'Botun özelliklerini ve slash komutlarını gösterir.'), async i => {
  i.reply({ embeds: [embed(`🛡️ ${BRAND} SECURITY | Yardım Menüsü`,
    'Sunucunu korumak ve yönetmek için komutları kullanabilirsin.\n\n' +
    '**🛡️ Moderasyon**\n`/kick` `/ban` `/unban` `/sustur` `/susturma-kaldir` `/rol-ver` `/rol-al` `/kilitle` `/toplurolver` `/toplurolal`\n\n' +
    '**🔐 Guard Sistemi**\n`/guard-durum` `/guard-ayarla` `/guard-link` `/guard-spam` `/guard-raid` `/guard-nuke`\n`/guard-whitelist-ekle` `/guard-whitelist-sil` `/guard-whitelist-liste` `/blackbox-son` `/radar-durum`\n\n' +
    '**🎫 Ticket Sistemi**\n`/ticket-panel`\n\n' +
    '**📋 Diğer**\n`/sunucu` `/seviye` `/duyuru` `/otomatik-cevap-ekle` `/otomatik-cevap-liste` `/otomatik-cevap-sil` `/bot-durum` `/yardım`')
    .setFooter({ text: `${BRAND} SECURITY • Güvenliğin için burada.` })] });
});

module.exports = cmds;
