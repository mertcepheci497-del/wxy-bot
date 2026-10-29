require('dotenv').config();
const http = require('http');

// Render "web service" bir port dinlemeni ister
http.createServer((req, res) => res.end('WXY botları aktif')).listen(process.env.PORT || 3000);

// Render ücretsiz planda uyumasın diye kendine ping atar
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => fetch(process.env.RENDER_EXTERNAL_URL).catch(() => {}), 10 * 60 * 1000);
}

process.on('unhandledRejection', e => console.error('unhandledRejection:', e));
process.on('uncaughtException', e => console.error('uncaughtException:', e));

require('./security');
require('./moderasyon');
require('./family');
