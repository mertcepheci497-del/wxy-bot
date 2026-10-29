const db = require('./db')('perms');
const owners = () => (process.env.OWNER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const list = k => db.get(k, []);
function add(k, id) {
  const l = list(k);
  if (l.includes(id)) return false;
  l.push(id); db.set(k, l); return true;
}
function remove(k, id) {
  const l = list(k), n = l.filter(x => x !== id);
  db.set(k, n); return n.length !== l.length;
}
// 3 = bot sahibi, 2 = üst yetkili, 1 = normal yetkili, 0 = yok
const level = id => (owners().includes(id) ? 3 : list('ust').includes(id) ? 2 : list('normal').includes(id) ? 1 : 0);
module.exports = { owners, list, add, remove, level };
