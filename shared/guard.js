const db = require('./db')('security');
const { embed } = require('./util');
const defaults = { link: true, spam: true, raid: true, nuke: true, logChannel: null, whitelist: [] };

exports.get = gid => ({ ...defaults, ...db.get('g:' + gid, {}) });
exports.set = (gid, patch) => { db.set('g:' + gid, { ...exports.get(gid), ...patch }); return exports.get(gid); };
exports.isWL = (cfg, member) =>
  !!member && (cfg.whitelist.includes(member.id) || member.roles.cache.some(r => cfg.whitelist.includes(r.id)));
exports.blackbox = gid => db.get('bb:' + gid, []);
exports.log = (guild, text) => {
  const bb = exports.blackbox(guild.id);
  bb.unshift({ t: Date.now(), text });
  db.set('bb:' + guild.id, bb.slice(0, 50));
  const cfg = exports.get(guild.id);
  if (cfg.logChannel) {
    guild.channels.cache.get(cfg.logChannel)
      ?.send({ embeds: [embed('🛡️ Güvenlik Olayı', text, 0xfaa61a)] }).catch(() => {});
  }
};
