const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.sqlite');
const db = new Database(dbPath);

// Tablolar
// sites: id, topic, theme, title, description, hero_image, created_at
// pages: id, site_id, slug, title, body

db.exec(`
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  topic TEXT,
  theme TEXT,
  title TEXT,
  description TEXT,
  hero_image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  site_id TEXT,
  slug TEXT,
  title TEXT,
  body TEXT,
  FOREIGN KEY(site_id) REFERENCES sites(id)
);
`);

module.exports = db; 