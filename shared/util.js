const { EmbedBuilder } = require('discord.js');
const BRAND = process.env.BRAND || 'WXY';
const embed = (title, desc, color = 0x5865f2) =>
  new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setTimestamp();
const eph = content => ({ content, flags: 64 });
module.exports = { BRAND, embed, eph };
