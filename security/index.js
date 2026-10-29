const { Events, AuditLogEvent, PermissionFlagsBits: P, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const runBot = require('../shared/runBot');
const guard = require('../shared/guard');
const db = require('../shared/db')('security');
const { embed } = require('../shared/util');

runBot({
  name: 'Security',
  token: process.env.SECURITY_TOKEN,
  commands: require('./commands'),
  setup(client) {
    const spam = new Map(), nukeHits = new Map(), joins = new Map(), xpCd = new Map();

    // ----- Mesaj: link guard, spam guard, otomatik cevap, XP -----
    client.on(Events.MessageCreate, async m => {
      if (!m.guild || m.author.bot || !m.member) return;
      const cfg = guard.get(m.guild.id);
      const trusted = guard.isWL(cfg, m.member) || m.member.permissions.has(P.Administrator) || m.author.id === m.guild.ownerId;

      if (!trusted) {
        if (cfg.link && /(discord\.gg\/|discord(app)?\.com\/invite\/|https?:\/\/)/i.test(m.content)) {
          await m.delete().catch(() => {});
          m.channel.send(`⚠️ ${m.author}, link paylaşmak yasak!`).then(x => setTimeout(() => x.delete().catch(() => {}), 4000));
          return guard.log(m.guild, `Link engellendi: **${m.author.tag}**`);
        }
        if (cfg.spam) {
          const key = m.guild.id + m.author.id, now = Date.now();
          const arr = (spam.get(key) || []).filter(t => now - t < 5000); arr.push(now); spam.set(key, arr);
          if (arr.length >= 6) {
            spam.delete(key);
            await m.member.timeout(5 * 60000, 'Spam').catch(() => {});
            m.channel.send(`🔇 ${m.author} spam yaptığı için 5 dk susturuldu.`);
            return guard.log(m.guild, `Spam: **${m.author.tag}** 5 dk susturuldu.`);
          }
        }
      }

      const ar = db.get('ar:' + m.guild.id, {})[m.content.toLowerCase().trim()];
      if (ar) m.reply(ar).catch(() => {});

      const ck = m.guild.id + m.author.id;
      if (Date.now() - (xpCd.get(ck) || 0) > 60000) {
        xpCd.set(ck, Date.now());
        const k = `xp:${m.guild.id}:${m.author.id}`;
        db.set(k, db.get(k, 0) + 15 + Math.floor(Math.random() * 10));
      }
    });

    // ----- Anti-nuke -----
    async function nukeCheck(guild, auditType, label) {
      const cfg = guard.get(guild.id);
      if (!cfg.nuke) return;
      const logs = await guild.fetchAuditLogs({ type: auditType, limit: 1 }).catch(() => null);
      const e = logs?.entries.first();
      if (!e || !e.executor || Date.now() - e.createdTimestamp > 5000) return;
      const ex = e.executor;
      if (ex.id === client.user.id || ex.id === guild.ownerId) return;
      const member = await guild.members.fetch(ex.id).catch(() => null);
      if (guard.isWL(cfg, member)) return;
      const key = guild.id + ex.id, now = Date.now();
      const arr = (nukeHits.get(key) || []).filter(t => now - t < 15000); arr.push(now); nukeHits.set(key, arr);
      guard.log(guild, `${label} — **${ex.tag}** (${arr.length}/3)`);
      if (arr.length >= 3) {
        nukeHits.delete(key);
        await guild.members.ban(ex.id, { reason: 'Anti-nuke' }).catch(() => {});
        guard.log(guild, `🚨 **${ex.tag}** nuke girişimi nedeniyle yasaklandı.`);
      }
    }
    client.on(Events.ChannelDelete, c => c.guild && nukeCheck(c.guild, AuditLogEvent.ChannelDelete, `Kanal silindi: #${c.name}`));
    client.on(Events.GuildRoleDelete, r => nukeCheck(r.guild, AuditLogEvent.RoleDelete, `Rol silindi: ${r.name}`));
    client.on(Events.GuildBanAdd, b => nukeCheck(b.guild, AuditLogEvent.MemberBanAdd, `Üye yasaklandı: ${b.user.tag}`));

    // ----- Üye girişi: izinsiz bot + raid -----
    client.on(Events.GuildMemberAdd, async member => {
      const cfg = guard.get(member.guild.id);
      if (cfg.nuke && member.user.bot) {
        const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 }).catch(() => null);
        const e = logs?.entries.first();
        if (e && e.target?.id === member.id && e.executor.id !== member.guild.ownerId) {
          const ex = await member.guild.members.fetch(e.executor.id).catch(() => null);
          if (!guard.isWL(cfg, ex)) {
            await member.kick('İzinsiz bot').catch(() => {});
            return guard.log(member.guild, `İzinsiz bot atıldı: **${member.user.tag}** (ekleyen: ${e.executor.tag})`);
          }
        }
      }
      if (cfg.raid) {
        const now = Date.now();
        const arr = (joins.get(member.guild.id) || []).filter(j => now - j.t < 10000);
        arr.push({ t: now, id: member.id }); joins.set(member.guild.id, arr);
        if (arr.length >= 5) {
          guard.log(member.guild, `🚨 Raid algılandı! ${arr.length} üye 10 sn içinde girdi, atılıyor.`);
          for (const j of arr) member.guild.members.kick(j.id, 'Raid koruması').catch(() => {});
          joins.set(member.guild.id, []);
        }
      }
    });

    // ----- Ticket butonları -----
    client.onComponent = async i => {
      if (!i.isButton()) return;
      if (i.customId === 'ticket_open') {
        const exists = i.guild.channels.cache.find(c => c.topic === 'ticket:' + i.user.id);
        if (exists) return i.reply({ content: `❌ Zaten açık ticketin var: ${exists}`, flags: 64 });
        const staff = db.get('ticket:' + i.guild.id, {}).staffRole;
        const ow = [
          { id: i.guild.roles.everyone.id, deny: [P.ViewChannel] },
          { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
          { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels] },
        ];
        if (staff) ow.push({ id: staff, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] });
        const ch = await i.guild.channels.create({
          name: `ticket-${i.user.username}`.slice(0, 90), type: ChannelType.GuildText,
          topic: 'ticket:' + i.user.id, permissionOverwrites: ow,
        });
        await ch.send({
          content: `${i.user}${staff ? ` <@&${staff}>` : ''}`,
          embeds: [embed('🎫 Destek Talebi', 'Sorununu yaz, yetkililer en kısa sürede dönecek.')],
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('Ticketi Kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger))],
        });
        return i.reply({ content: `✅ Ticket açıldı: ${ch}`, flags: 64 });
      }
      if (i.customId === 'ticket_close') {
        const owner = i.channel.topic === 'ticket:' + i.user.id;
        if (!owner && !i.memberPermissions.has(P.ManageChannels)) return i.reply({ content: '❌ Yetkin yok.', flags: 64 });
        await i.reply('🔒 Ticket 5 saniye içinde kapanıyor...');
        setTimeout(() => i.channel.delete().catch(() => {}), 5000);
      }
    };
  },
});
