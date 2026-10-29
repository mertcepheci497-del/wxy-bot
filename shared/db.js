const fs = require('fs');
const path = require('path');
const cache = {};

module.exports = function db(name) {
  if (cache[name]) return cache[name];
  const file = path.join(__dirname, '..', 'data', name + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  let t;
  const save = () => {
    clearTimeout(t);
    t = setTimeout(() => fs.writeFileSync(file, JSON.stringify(data, null, 1)), 500);
  };
  cache[name] = {
    get: (k, def) => (data[k] === undefined ? def : data[k]),
    set: (k, v) => { data[k] = v; save(); },
    del: k => { delete data[k]; save(); },
    all: () => data,
  };
  return cache[name];
};
