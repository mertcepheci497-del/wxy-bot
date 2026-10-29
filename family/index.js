const { SlashCommandBuilder: S, PermissionFlagsBits: P, ChannelType, Events } = require('discord.js');
const runBot = require('../shared/runBot');
const perms = require('../shared/perms');
const db = require('../shared/db')('family');
const { embed, eph, BRAND } = require('../shared/util');

const commands = [];
const add = (data, execute) => commands.push({ data, execute });
const base = (n, d) => new S().setName(n).setDescription(d).setDMPermission(false);
const need = (lvl, fn) => async (i, c) =>
  perms.level(i.user.id) < lvl ? i.reply(eph(`❌ Bu komut için bot yetkisi gerekiyor (${lvl === 1 ? 'normal yetkili' : lvl === 2 ? 'üst yetkili' : 'bot sahibi'}).`)) : fn(i, c);
const fmt = n => n.toLocaleString('tr-TR');

// ---------- Yetkili yönetimi ----------
for (const [key, label, addLvl] of [['normal', 'normal', 2], ['ust', 'üst', 3]]) {
  const n = `bot-${label}-yetkili`, title = label === 'normal' ? 'Normal' : 'Üst';
  add(base(`${n}-ekle`, `Bota ${label} yetkili ekler`).addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    need(addLvl, async i => { const u = i.options.getUser('kullanici'); i.reply(eph(perms.add(key, u.id) ? `✅ ${u} ${label} yetkili yapıldı.` : '❌ Zaten yetkili.')); }));
  add(base(`${n}-kaldır`, `Bottan ${label} yetkiliyi kaldırır`).addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    need(addLvl, async i => { const u = i.options.getUser('kullanici'); i.reply(eph(perms.remove(key, u.id) ? `✅ ${u} yetkisi alındı.` : '❌ Yetkili değil.')); }));
  add(base(`${n}-listesi`, `${title} yetkilileri listeler`),
    need(1, async i => { const l = perms.list(key); i.reply({ embeds: [embed(`👮 ${title} Yetkililer`, l.length ? l.map(x => `<@${x}>`).join('\n') : 'Liste boş.')] }); }));
}

// ---------- Kalıcı ban ----------
const pbKey = gid => 'pb:' + gid;
add(base('kalıcı-ban', 'Elle kaldırılamayan ban atar')
  .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
  .addStringOption(o => o.setName('sebep').setDescription('Sebep')),
need(2, async i => {
  const u = i.options.getUser('kullanici'), sebep = i.options.getString('sebep') || 'Sebep belirtilmedi';
  if (perms.level(u.id) >= perms.level(i.user.id)) return i.reply(eph('❌ Bu kullanıcıya işlem yapamazsın.'));
  const l = db.get(pbKey(i.guild.id), []);
  if (!l.find(x => x.id === u.id)) l.push({ id: u.id, tag: u.tag, sebep, by: i.user.id, t: Date.now() });
  db.set(pbKey(i.guild.id), l);
  await i.guild.members.ban(u.id, { reason: `Kalıcı ban • ${i.user.tag}: ${sebep}` }).catch(() => {});
  i.reply({ embeds: [embed('⛔ Kalıcı Ban', `${u} kalıcı olarak yasaklandı.\n**Sebep:** ${sebep}`, 0xed4245)] });
}));

add(base('kalıcı-ban-kaldır', 'Kalıcı banı kaldırır').addStringOption(o => o.setName('id').setDescription('Kullanıcı ID').setRequired(true)),
need(2, async i => {
  const id = i.options.getString('id'), l = db.get(pbKey(i.guild.id), []);
  db.set(pbKey(i.guild.id), l.filter(x => x.id !== id));
  await i.guild.members.unban(id).catch(() => {});
  i.reply({ embeds: [embed('✅ Kalıcı ban kaldırıldı', `<@${id}> artık yasaklı değil.`, 0x57f287)] });
}));

add(base('kalıcı-ban-listesi', 'Bu sunucudaki kalıcı banları listeler'),
need(1, async i => {
  const l = db.get(pbKey(i.guild.id), []);
  i.reply({ embeds: [embed('⛔ Kalıcı Banlar', l.length ? l.map(x => `**${x.tag}** (\`${x.id}\`) — ${x.sebep}`).join('\n') : 'Kayıt yok.')] });
}));

// ---------- Mute ----------
add(base('mute', 'Kişiyi susturur')
  .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
  .addIntegerOption(o => o.setName('dakika').setDescription('Süre (dk)').setMinValue(1).setMaxValue(40320).setRequired(true))
  .addStringOption(o => o.setName('sebep').setDescription('Sebep')),
need(1, async i => {
  const m = i.options.getMember('kullanici'), dk = i.options.getInteger('dakika');
  if (!m || !m.moderatable || perms.level(m.id) >= perms.level(i.user.id)) return i.reply(eph('❌ Bu kişiyi susturamam.'));
  await m.timeout(dk * 60000, i.options.getString('sebep') || 'Mute');
  i.reply({ embeds: [embed('🔇 Susturuldu', `${m} **${dk} dk** susturuldu.`, 0xfaa61a)] });
}));

add(base('unmute', 'Susturmayı kaldırır').addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
need(1, async i => {
  const m = i.options.getMember('kullanici');
  if (!m || !m.moderatable) return i.reply(eph('❌ İşlem yapılamadı.'));
  await m.timeout(null);
  i.reply({ embeds: [embed('🔊 Susturma kaldırıldı', `${m} artık konuşabilir.`, 0x57f287)] });
}));

// ---------- Ünvan ----------
const titles = () => db.get('titles', {});
add(base('unvan-ekle', 'Bot yetkilisine ünvan verir')
  .addUserOption(o => o.setName('kullanici').setDescription('Yetkili').setRequired(true))
  .addStringOption(o => o.setName('unvan').setDescription('Ünvan').setRequired(true))
  .addIntegerOption(o => o.setName('derece').setDescription('Yetki derecesi (1-5)').setMinValue(1).setMaxValue(5).setRequired(true)),
need(2, async i => {
  const u = i.options.getUser('kullanici');
  if (perms.level(u.id) < 1) return i.reply(eph('❌ Ünvan sadece bot yetkililerine verilebilir.'));
  const t = titles(); t[u.id] = { unvan: i.options.getString('unvan'), derece: i.options.getInteger('derece') };
  db.set('titles', t);
  i.reply({ embeds: [embed('🏷️ Ünvan verildi', `${u} → **${t[u.id].unvan}** (Derece ${t[u.id].derece})`, 0x57f287)] });
}));

add(base('unvan-kaldır', 'Bot yetkilisinin ünvanını kaldırır').addUserOption(o => o.setName('kullanici').setDescription('Yetkili').setRequired(true)),
need(2, async i => {
  const u = i.options.getUser('kullanici'), t = titles();
  if (!t[u.id]) return i.reply(eph('❌ Bu kişinin ünvanı yok.'));
  delete t[u.id]; db.set('titles', t);
  i.reply(eph(`✅ ${u} ünvanı kaldırıldı.`));
}));

add(base('unvan-listesi', 'Ünvanları ve yetki derecelerini listeler'), async i => {
  const e = Object.entries(titles()).sort((a, b) => b[1].derece - a[1].derece);
  i.reply({ embeds: [embed('🏷️ Ünvanlar', e.length ? e.map(([id, t]) => `<@${id}> • **${t.unvan}** • Derece ${t.derece}`).join('\n') : 'Kayıt yok.')] });
});

// ---------- Duyuru ----------
add(base('duyuru', 'Seçilen kanala duyuru gönderir')
  .addChannelOption(o => o.setName('kanal').setDescription('Kanal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
  .addStringOption(o => o.setName('baslik').setDescription('Başlık').setRequired(true))
  .addStringOption(o => o.setName('mesaj').setDescription('Mesaj').setRequired(true))
  .addBooleanOption(o => o.setName('etiket').setDescription('@everyone etiketlensin mi?')),
need(2, async i => {
  const ch = i.options.getChannel('kanal');
  await ch.send({
    content: i.options.getBoolean('etiket') ? '@everyone' : undefined,
    embeds: [embed(i.options.getString('baslik'), i.options.getString('mesaj').replace(/\\n/g, '\n')).setFooter({ text: i.user.username })],
  });
  i.reply(eph(`✅ Duyuru ${ch} kanalına gönderildi.`));
}));

// ---------- Ekonomi / Oyun ----------
const uk = (g, u) => `u:${g}:${u}`;
const getU = (g, u) => ({ bal: 0, lastDaily: 0, lastWork: 0, ...db.get(uk(g, u), {}) });
const saveU = (g, u, d) => db.set(uk(g, u), d);
const bet = o => o.setName('miktar').setDescription('Bahis miktarı').setMinValue(1).setRequired(true);
const left = ms => `${Math.floor(ms / 3600000)}s ${Math.floor((ms % 3600000) / 60000)}dk`;

add(base('bakiye', 'Bakiyeni gösterir').addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı')), async i => {
  const u = i.options.getUser('kullanici') || i.user;
  i.reply({ embeds: [embed('💰 Bakiye', `${u} → **${fmt(getU(i.guild.id, u.id).bal)}** 🪙`)] });
});

add(base('günlük', 'Günlük ödülünü al'), async i => {
  const d = getU(i.guild.id, i.user.id), wait = 86400000 - (Date.now() - d.lastDaily);
  if (wait > 0) return i.reply(eph(`⏳ Günlük ödülün için **${left(wait)}** beklemelisin.`));
  d.bal += 500; d.lastDaily = Date.now(); saveU(i.guild.id, i.user.id, d);
  i.reply({ embeds: [embed('🎁 Günlük Ödül', `**500** 🪙 kazandın! Bakiye: **${fmt(d.bal)}**`, 0x57f287)] });
});

add(base('çalış', 'Çalışıp para kazan'), async i => {
  const d = getU(i.guild.id, i.user.id), wait = 3600000 - (Date.now() - d.lastWork);
  if (wait > 0) return i.reply(eph(`⏳ Tekrar çalışmak için **${left(wait)}** bekle.`));
  const g = 50 + Math.floor(Math.random() * 151);
  d.bal += g; d.lastWork = Date.now(); saveU(i.guild.id, i.user.id, d);
  i.reply({ embeds: [embed('💼 Çalıştın', `**${g}** 🪙 kazandın! Bakiye: **${fmt(d.bal)}**`, 0x57f287)] });
});

add(base('yazıtura', 'Yazı tura at').addIntegerOption(bet)
  .addStringOption(o => o.setName('secim').setDescription('Seçim').setRequired(true).addChoices({ name: 'Yazı', value: 'yazı' }, { name: 'Tura', value: 'tura' })),
async i => {
  const m = i.options.getInteger('miktar'), d = getU(i.guild.id, i.user.id);
  if (d.bal < m) return i.reply(eph('❌ Yeterli bakiyen yok.'));
  const res = Math.random() < 0.5 ? 'yazı' : 'tura', win = res === i.options.getString('secim');
  d.bal += win ? m : -m; saveU(i.guild.id, i.user.id, d);
  i.reply({ embeds: [embed('🪙 Yazı Tura', `Sonuç: **${res}**\n${win ? `🎉 **${fmt(m)}** 🪙 kazandın!` : `😢 **${fmt(m)}** 🪙 kaybettin.`}\nBakiye: **${fmt(d.bal)}**`, win ? 0x57f287 : 0xed4245)] });
});

add(base('slot', 'Slot makinesi').addIntegerOption(bet), async i => {
  const m = i.options.getInteger('miktar'), d = getU(i.guild.id, i.user.id);
  if (d.bal < m) return i.reply(eph('❌ Yeterli bakiyen yok.'));
  const sy = ['🍒', '🍋', '🍉', '⭐', '💎'], r = [0, 0, 0].map(() => sy[Math.floor(Math.random() * sy.length)]);
  const same = new Set(r).size; // 1 = üçlü, 2 = ikili
  const delta = same === 1 ? m * 4 : same === 2 ? Math.floor(m * 0.5) : -m;
  d.bal += delta; saveU(i.guild.id, i.user.id, d);
  i.reply({ embeds: [embed('🎰 Slot', `**[ ${r.join(' | ')} ]**\n${delta >= 0 ? `🎉 **${fmt(delta)}** 🪙 kazandın!` : `😢 **${fmt(m)}** 🪙 kaybettin.`}\nBakiye: **${fmt(d.bal)}**`, delta >= 0 ? 0x57f287 : 0xed4245)] });
});

add(base('gönder', 'Birine para gönder')
  .addUserOption(o => o.setName('kullanici').setDescription('Alıcı').setRequired(true)).addIntegerOption(bet),
async i => {
  const to = i.options.getUser('kullanici'), m = i.options.getInteger('miktar');
  if (to.bot || to.id === i.user.id) return i.reply(eph('❌ Geçersiz alıcı.'));
  const a = getU(i.guild.id, i.user.id), b = getU(i.guild.id, to.id);
  if (a.bal < m) return i.reply(eph('❌ Yeterli bakiyen yok.'));
  a.bal -= m; b.bal += m; saveU(i.guild.id, i.user.id, a); saveU(i.guild.id, to.id, b);
  i.reply({ embeds: [embed('💸 Transfer', `${i.user} → ${to}: **${fmt(m)}** 🪙`, 0x57f287)] });
});

add(base('sıralama', 'Sunucunun en zenginlerini gösterir'), async i => {
  const pre = `u:${i.guild.id}:`;
  const top = Object.entries(db.all()).filter(([k]) => k.startsWith(pre)).sort((a, b) => b[1].bal - a[1].bal).slice(0, 10);
  i.reply({ embeds: [embed('🏆 En Zenginler', top.length ? top.map(([k, v], n) => `**${n + 1}.** <@${k.slice(pre.length)}> — ${fmt(v.bal)} 🪙`).join('\n') : 'Henüz kimse yok.')] });
});

add(base('yardım', 'Bot komutlarını gösterir'), async i =>
  i.reply({ embeds: [embed(`🤖 ${BRAND} FAMİLY BOTU`,
    '**Yetkili:** `/kalıcı-ban` `/kalıcı-ban-kaldır` `/kalıcı-ban-listesi` `/mute` `/unmute` `/duyuru`\n' +
    '**Ünvan:** `/unvan-ekle` `/unvan-kaldır` `/unvan-listesi`\n' +
    '**Yetki yönetimi:** `/bot-normal-yetkili-*` `/bot-üst-yetkili-*`\n' +
    '**Ekonomi/Oyun:** `/bakiye` `/günlük` `/çalış` `/yazıtura` `/slot` `/gönder` `/sıralama`')] }));

runBot({
  name: 'Family',
  token: process.env.FAMILY_TOKEN,
  commands,
  setup(client) {
    // Kalıcı ban: biri banı elle kaldırırsa bot tekrar banlar
    client.on(Events.GuildBanRemove, async b => {
      if (db.get(pbKey(b.guild.id), []).find(x => x.id === b.user.id))
        b.guild.members.ban(b.user.id, { reason: 'Kalıcı ban (otomatik yeniden)' }).catch(() => {});
    });
    client.on(Events.GuildMemberAdd, m => {
      if (db.get(pbKey(m.guild.id), []).find(x => x.id === m.id)) m.ban({ reason: 'Kalıcı ban' }).catch(() => {});
    });
    // sa -> as
    client.on(Events.MessageCreate, m => {
      if (m.author.bot || !m.guild) return;
      if (['sa', 'sea', 'selam', 'selamun aleykum', 'selamün aleyküm'].includes(m.content.toLowerCase().trim())) m.reply('as').catch(() => {});
    });
  },
});
