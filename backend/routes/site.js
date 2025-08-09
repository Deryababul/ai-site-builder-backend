const express = require('express');
    const router = express.Router();
    const fs = require('fs');
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');
    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const db = require('../db');

    async function generateContent(topic, theme) {
      const prompt = `
Sen profesyonel bir web sitesi içerik üretme asistanısın.
Kullanıcı konusu: "${topic}"
Tema: "${theme}"
Bana aşağıdaki formatta JSON ver (hero_image alanı olmadan):
{
  "title": "...",
  "description": "...",
  "pages": [
    { "slug": "index", "title": "Ana Sayfa", "body": "..." },
    { "slug": "about", "title": "Hakkında", "body": "..." },
    { "slug": "products", "title": "Ürünler", "body": "..." },
    { "slug": "contact", "title": "İletişim", "body": "..." }
  ]
      // "hero_image": "https://picsum.photos/1200/400"
}
İçeriği kısa ve net yaz.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      try {
        let jsonText = completion.choices[0].message.content.trim();
        console.log("AI cevabı:", jsonText);

        // Remove unwanted formatting like triple backticks
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/```[a-zA-Z]*\n?|```$/g, "").trim();
        }

        return JSON.parse(jsonText);
      } catch (err) {
        console.error("AI cevabı JSON formatında değil:", err);
        throw new Error("AI yanıtı işlenemedi");
      }
    }

    // 2. DALL-E ile görsel üretimi
    async function generateImage(topic, theme) {
      console.log("generateImage",topic, theme);
      const dallePrompt = `${topic} konseptinde, ${theme} temalı, modern ve ilgi çekici bir web sitesi için hero görseli. Sade, profesyonel, yüksek çözünürlük.`;
      const dalleRes = await openai.images.generate({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024"
      });
      console.log("dalleRes",dalleRes);
      return dalleRes.data[0].url;
    }

    // Tema yapılandırmaları
    const THEMES = {
      cafe: {
        mainColor: '#d2691e',
        bgLight: '#f8f5f2',
        font: "'Merriweather', serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Merriweather:400,700&display=swap' rel='stylesheet'>"
      },
      ecommerce: {
        mainColor: '#1976d2',
        bgLight: '#f7f9fb',
        font: "'Montserrat', sans-serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap' rel='stylesheet'>"
      },
      portfolio: {
        mainColor: '#6a1b9a',
        bgLight: '#f6f3fa',
        font: "'Poppins', sans-serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Poppins:400,700&display=swap' rel='stylesheet'>"
      },
      blog: {
        mainColor: '#388e3c',
        bgLight: '#f7faf7',
        font: "'Lora', serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Lora:400,700&display=swap' rel='stylesheet'>"
      },
      corporate: {
        mainColor: '#455a64',
        bgLight: '#f4f6f8',
        font: "'Roboto', sans-serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap' rel='stylesheet'>"
      },
      default: {
        mainColor: '#0d6efd',
        bgLight: '#f7f9fb',
        font: "'Segoe UI', 'Arial', sans-serif",
        fontLink: ''
      }
    };

    router.post('/create', async (req, res) => {
      try {
        const { topic, theme } = req.body;
        if (!topic) return res.status(400).json({ error: 'topic required' });

        const siteId = uuidv4();
        const content = await generateContent(topic, theme || 'default');
        // DALL-E ile görsel üret
        const heroImage = await generateImage(topic, theme || 'default');
        content.hero_image = heroImage;

        // Tema seçimi
        const t = THEMES[theme] || THEMES.default;
        console.log("t",t);
        const siteDir = path.join(__dirname, '..', '..', 'frontend', 'sites', siteId);
        fs.mkdirSync(siteDir, { recursive: true });

        const indexHtml = `
        <!doctype html>
        <html lang="tr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>${content.title}</title>
          <meta name="description" content="${content.description}">
          ${t.fontLink}
          <style>
            :root {
              --main-color: ${t.mainColor};
              --bg-light: ${t.bgLight};
              --text-dark: #222;
              --section-bg: #fff;
              --radius: 18px;
              --shadow: 0 4px 24px rgba(0,0,0,0.08);
            }
            html { box-sizing: border-box; }
            *, *:before, *:after { box-sizing: inherit; }
            body {
              margin: 0; padding: 0;
              font-family: ${t.font};
              background: var(--bg-light);
              color: var(--text-dark);
              min-height: 100vh;
            }
            nav {
              background: var(--main-color);
              color: #fff;
              padding: 18px 0 12px 0;
              text-align: center;
              font-size: 1.1rem;
              letter-spacing: 1px;
              box-shadow: var(--shadow);
            }
            nav a {
              color: #fff;
              text-decoration: none;
              margin: 0 18px;
              font-weight: 500;
              transition: color 0.2s;
            }
            nav a:hover {
              color: #ffe082;
            }
            .hero {
              width: 100%;
              min-height: 220px;
              background-image: url('${content.hero_image}');
              background-size: cover;
              background-position: center;
              border-radius: var(--radius);
              margin: 24px auto 0 auto;
              max-width: 900px;
              box-shadow: var(--shadow);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              max-width: 900px;
              margin: 0 auto;
              padding: 0 16px;
            }
            .section {
              background: var(--section-bg);
              border-radius: var(--radius);
              box-shadow: var(--shadow);
              margin: 32px 0;
              padding: 32px 24px;
            }
            h1, h2, h3 {
              margin-top: 0;
              font-weight: 700;
            }
            h1 { font-size: 2.5rem; letter-spacing: 1px; }
            h2 { font-size: 1.5rem; color: var(--main-color); }
            h3 { font-size: 1.15rem; color: #444; }
            p { font-size: 1.08rem; line-height: 1.7; }
            .btn {
              display: inline-block;
              padding: 12px 28px;
              background: var(--main-color);
              color: #fff;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              margin-top: 18px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
              transition: background 0.2s;
              border: none;
              cursor: pointer;
              font-size: 1rem;
            }
            .btn:hover { background: #084298; }
            /* Chatbot alanı */
            .chatbot-box {
              background: #fff7e6;
              border-radius: 14px;
              box-shadow: 0 2px 12px rgba(0,0,0,0.07);
              margin: 40px auto 0 auto;
              padding: 24px 18px 18px 18px;
              max-width: 420px;
              text-align: center;
            }
            .chatbot-box input {
              width: 80%;
              padding: 10px;
              border-radius: 8px;
              border: 1px solid #ccc;
              font-size: 1rem;
              margin-bottom: 10px;
            }
            .chatbot-box button {
              padding: 10px 22px;
              border-radius: 8px;
              background: var(--main-color);
              color: #fff;
              border: none;
              font-weight: 600;
              cursor: pointer;
              margin-left: 8px;
              font-size: 1rem;
            }
            .chatbot-box button:disabled { opacity: 0.6; }
            .chatbot-msg { margin-top: 12px; font-size: 1.05rem; }
            /* Chatbot widget */
            #chatbot-widget {
              position: fixed;
              bottom: 32px;
              right: 32px;
              z-index: 9999;
              font-family: inherit;
            }
            #chatbot-bubble {
              background: #0d6efd;
              color: #fff;
              border-radius: 32px;
              padding: 16px 28px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.18);
              cursor: pointer;
              font-size: 1.15rem;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 10px;
              transition: background 0.2s, box-shadow 0.2s;
            }
            #chatbot-bubble:hover {
              background: #1976d2;
              box-shadow: 0 8px 32px rgba(0,0,0,0.22);
            }
            #chatbot-panel {
              display: none;
              flex-direction: column;
              align-items: stretch;
              background: #fff;
              border-radius: 18px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.18);
              padding: 24px 18px 18px 18px;
              min-width: 320px;
              max-width: 90vw;
              position: absolute;
              bottom: 60px;
              right: 0;
              animation: chatbot-fadein 0.2s;
            }
            #chatbot-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-weight: bold;
              font-size: 1.1rem;
              margin-bottom: 10px;
            }
            #chatbot-close {
              background: none;
              border: none;
              font-size: 1.5rem;
              color: #888;
              cursor: pointer;
              margin-left: 8px;
            }
            #chatbot-input {
              width: 90%;
              padding: 10px;
              border-radius: 8px;
              border: 1px solid #ccc;
              font-size: 1rem;
              margin-bottom: 10px;
            }
            #chatbot-send {
              padding: 10px 22px;
              border-radius: 8px;
              background: #0d6efd;
              color: #fff;
              border: none;
              font-weight: 600;
              cursor: pointer;
              font-size: 1rem;
              margin-bottom: 8px;
            }
            #chatbot-send:disabled { opacity: 0.6; }
            .chatbot-msg { margin-top: 8px; font-size: 1.05rem; min-height: 20px; }
            @media (max-width: 700px) {
              #chatbot-widget { right: 4vw; bottom: 4vw; }
              #chatbot-panel { min-width: 90vw; }
            }
            @keyframes chatbot-fadein {
              from { opacity: 0; transform: translateY(30px); }
              to { opacity: 1; transform: translateY(0); }
            }
          </style>
        </head>
        <body>
          <nav>
            <a href="#index">${content.pages[0].title}</a>
            <a href="#about">${content.pages[1].title}</a>
            <a href="#products">${content.pages[2].title}</a>
            <a href="#contact">${content.pages[3].title}</a>
          </nav>
          <div class="container">
            <div class="hero">
              <h1 style="background:rgba(0,0,0,0.45);color:#fff;padding:18px 32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">${content.title}</h1>
            </div>
            <div class="section" id="index">
              <h2>${content.pages[0].title}</h2>
              <p>${content.pages[0].body}</p>
            </div>
            <div class="section" id="about">
              <h2>${content.pages[1].title}</h2>
              <p>${content.pages[1].body}</p>
            </div>
            <div class="section" id="products">
              <h2>${content.pages[2].title}</h2>
              <p>${content.pages[2].body}</p>
            </div>
            <div class="section" id="contact">
              <h2>${content.pages[3].title}</h2>
              <p>${content.pages[3].body}</p>
              <a class="btn" href="mailto:info@example.com">İletişime Geç</a>
            </div>
            <!-- Chatbot ile düzenle alanı -->
            <div id="chatbot-widget">
              <div id="chatbot-bubble" onclick="openChatbot()">
                💬 Chatbot ile Düzenle
              </div>
              <div id="chatbot-panel">
                <div id="chatbot-header">
                  <span>Chatbot ile Düzenle</span>
                  <button id="chatbot-close" onclick="closeChatbot()">×</button>
                </div>
                <input id="chatbot-input" type="text" placeholder="Örn: Başlık rengini kırmızı yap" />
                <button id="chatbot-send">Gönder</button>
                <div class="chatbot-msg" id="chatbot-msg"></div>
              </div>
            </div>

            <!-- Basit Kenar Düzenleme Paneli -->
            <div id="simple-editor-toggle" onclick="toggleSimpleEditor()">✏️</div>
            <div id="simple-editor">
              <div class="se-head">
                <span>Hızlı Düzenle</span>
                <button onclick="toggleSimpleEditor()">×</button>
              </div>
              <div class="se-body">
                <label>Site Başlığı
                  <input id="se-title" type="text" value="${content.title.replace(/"/g, '&quot;')}" />
                </label>
                <label>Ana Sayfa Başlığı
                  <input id="se-index-title" type="text" value="${content.pages[0].title.replace(/"/g, '&quot;')}" />
                </label>
                <label>Ana Sayfa Yazısı
                  <textarea id="se-index-body" rows="2">${content.pages[0].body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </label>
                <label>Hakkında Başlığı
                  <input id="se-about-title" type="text" value="${content.pages[1].title.replace(/"/g, '&quot;')}" />
                </label>
                <label>Hakkında Yazısı
                  <textarea id="se-about-body" rows="2">${content.pages[1].body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </label>
                <label>Ürünler Başlığı
                  <input id="se-products-title" type="text" value="${content.pages[2].title.replace(/"/g, '&quot;')}" />
                </label>
                <label>Ürünler Yazısı
                  <textarea id="se-products-body" rows="2">${content.pages[2].body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </label>
                <label>İletişim Başlığı
                  <input id="se-contact-title" type="text" value="${content.pages[3].title.replace(/"/g, '&quot;')}" />
                </label>
                <label>İletişim Yazısı
                  <textarea id="se-contact-body" rows="2">${content.pages[3].body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </label>
                <button id="se-save">Yayınla</button>
                <div id="se-msg"></div>
              </div>
            </div>
          </div>
          <script>
            function openChatbot() {
              document.getElementById('chatbot-bubble').style.display = 'none';
              document.getElementById('chatbot-panel').style.display = 'flex';
            }
            function closeChatbot() {
              document.getElementById('chatbot-panel').style.display = 'none';
              document.getElementById('chatbot-bubble').style.display = 'flex';
            }
            document.getElementById('chatbot-send').onclick = async function() {
              var input = document.getElementById('chatbot-input');
              var msg = document.getElementById('chatbot-msg');
              var command = input.value.trim();
              if (!command) return;
              msg.textContent = 'Gönderiliyor...';
              this.disabled = true;
              try {
                const res = await fetch('/api/chatbot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    siteId: window.location.pathname.split('/')[2],
                    command
                  })
                });
                const data = await res.json();
                if (data.success) {
                  msg.textContent = 'Güncellendi, sayfa yenileniyor...';
                  setTimeout(()=>window.location.reload(), 1200);
                } else {
                  msg.textContent = data.error || 'Bir hata oluştu.';
                }
              } catch (err) {
                msg.textContent = 'Sunucuya bağlanılamadı.';
              }
              this.disabled = false;
            };

            // Basit Kenar Düzenleyici JS
            function toggleSimpleEditor(){
              var el = document.getElementById('simple-editor');
              el.classList.toggle('open');
            }
            document.getElementById('se-save').onclick = async function(){
              var title = document.getElementById('se-title').value.trim();
              var tIndex = document.getElementById('se-index-title').value.trim();
              var tAbout = document.getElementById('se-about-title').value.trim();
              var tProducts = document.getElementById('se-products-title').value.trim();
              var tContact = document.getElementById('se-contact-title').value.trim();
              var bIndex = document.getElementById('se-index-body').value.trim();
              var bAbout = document.getElementById('se-about-body').value.trim();
              var bProducts = document.getElementById('se-products-body').value.trim();
              var bContact = document.getElementById('se-contact-body').value.trim();
              var msg = document.getElementById('se-msg');
              msg.textContent = 'Yayınlanıyor...';
              try{
                var titles = {};
                var bodies = {};
                if (tIndex) titles.index = tIndex;
                if (tAbout) titles.about = tAbout;
                if (tProducts) titles.products = tProducts;
                if (tContact) titles.contact = tContact;
                if (bIndex) bodies.index = bIndex;
                if (bAbout) bodies.about = bAbout;
                if (bProducts) bodies.products = bProducts;
                if (bContact) bodies.contact = bContact;
                var body = { siteId: window.location.pathname.split('/')[2] };
                if (title) body.title = title;
                if (Object.keys(titles).length) body.titles = titles;
                if (Object.keys(bodies).length) body.bodies = bodies;

                const res = await fetch('/api/site/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body)
                });
                const data = await res.json();
                 if (data.success) {
                   msg.textContent = 'Yayınlandı! Sayfa yenileniyor...';
                   var se = document.getElementById('simple-editor');
                   if (se) se.classList.remove('open'); // Paneli sadece kapat, DOM'dan silme
                   setTimeout(()=>window.location.reload(), 800);
                 } else {
                   msg.textContent = data.error || 'Güncelleme başarısız.';
                 }
              } catch(e){
                msg.textContent = 'Sunucuya bağlanılamadı.';
              }
            };
          </script>
          <style>
            /* Basit Kenar Düzenleyici CSS */
            #simple-editor-toggle{
              position: fixed; right: 0; top: 50%; transform: translateY(-50%);
              background: var(--main-color); color:#fff; padding: 10px 12px; border-radius: 8px 0 0 8px;
              font-size: 1.2rem; cursor: pointer; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            #simple-editor{
              position: fixed; right: -320px; top:0; height: 100vh; width: 300px; background:#fff;
              box-shadow: -2px 0 14px rgba(0,0,0,0.08); border-left: 1px solid #eee; z-index: 10000;
              transition: right .25s ease; display:flex; flex-direction: column;
            }
            #simple-editor.open{ right: 0; }
            #simple-editor .se-head{ display:flex; justify-content: space-between; align-items:center; padding: 14px; font-weight: 700; border-bottom:1px solid #eee; }
            #simple-editor .se-head button{ background:none; border:none; font-size:1.4rem; color:#888; cursor:pointer; }
            #simple-editor .se-body{ padding: 14px; display:flex; flex-direction:column; gap:10px; }
            #simple-editor label{ font-size:.95rem; color:#444; display:block; }
            #simple-editor input{ width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; }
            #simple-editor #se-save{ margin-top:6px; background: var(--main-color); color:#fff; border:none; border-radius:8px; padding:10px; font-weight:600; cursor:pointer; }
            #simple-editor #se-msg{ margin-top:8px; font-size:.95rem; color:#333; }
            @media (max-width: 700px){ #simple-editor{ width: 92vw; right: -92vw; } }
          </style>
        </body>
        </html>
        `;
        // console.log("indexHtml",indexHtml);
        fs.writeFileSync(path.join(siteDir, 'index.html'), indexHtml, 'utf8');

        // DB'ye kaydet
        const insertSite = db.prepare(`INSERT INTO sites (id, topic, theme, title, description, hero_image) VALUES (?, ?, ?, ?, ?, ?)`);
        insertSite.run(siteId, topic, theme || 'default', content.title, content.description, content.hero_image);
        const insertPage = db.prepare(`INSERT INTO pages (id, site_id, slug, title, body) VALUES (?, ?, ?, ?, ?)`);
        for (const p of content.pages) {
          insertPage.run(uuidv4(), siteId, p.slug, p.title, p.body);
        }

        return res.json({ siteId, url: `/sites/${siteId}/index.html` });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
      }
    });

    router.post('/update', async (req, res) => {
      try {
        const { siteId, title, titles, bodies } = req.body || {};
        if (!siteId) return res.status(400).json({ error: 'siteId required' });

        // Mevcut site verisini al
        const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
        if (!site) return res.status(404).json({ error: 'site not found' });

        // Güncellemeler
        if (typeof title === 'string' && title.length) {
          db.prepare('UPDATE sites SET title = ? WHERE id = ?').run(title, siteId);
          site.title = title;
        }
        if (titles && typeof titles === 'object') {
          const updPage = db.prepare('UPDATE pages SET title = ? WHERE site_id = ? AND slug = ?');
          if (titles.index) updPage.run(titles.index, siteId, 'index');
          if (titles.about) updPage.run(titles.about, siteId, 'about');
          if (titles.products) updPage.run(titles.products, siteId, 'products');
          if (titles.contact) updPage.run(titles.contact, siteId, 'contact');
        }
        if (bodies && typeof bodies === 'object') {
          const updPageBody = db.prepare('UPDATE pages SET body = ? WHERE site_id = ? AND slug = ?');
          if (bodies.index) updPageBody.run(bodies.index, siteId, 'index');
          if (bodies.about) updPageBody.run(bodies.about, siteId, 'about');
          if (bodies.products) updPageBody.run(bodies.products, siteId, 'products');
          if (bodies.contact) updPageBody.run(bodies.contact, siteId, 'contact');
        }

        // Güncellenmiş veriyi tekrar çek
        const siteRow = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
        const pageRows = db.prepare('SELECT slug, title, body FROM pages WHERE site_id = ?').all(siteId);
        const slugToPage = Object.fromEntries(pageRows.map(p => [p.slug, p]));

        const t = THEMES[siteRow.theme] || THEMES.default;
        const siteDir = path.join(__dirname, '..', '..', 'frontend', 'sites', siteId);
        fs.mkdirSync(siteDir, { recursive: true });

        const indexHtml = `
        <!doctype html>
        <html lang="tr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>${siteRow.title}</title>
          <meta name="description" content="${siteRow.description}">
          ${t.fontLink}
          <style>
            :root { --main-color: ${t.mainColor}; --bg-light: ${t.bgLight}; --text-dark: #222; --section-bg:#fff; --radius:18px; --shadow: 0 4px 24px rgba(0,0,0,0.08); }
            html { box-sizing: border-box; } *, *:before, *:after { box-sizing: inherit; }
            body { margin:0; padding:0; font-family:${t.font}; background:var(--bg-light); color:var(--text-dark); min-height:100vh; }
            nav { background: var(--main-color); color:#fff; padding:18px 0 12px; text-align:center; font-size:1.1rem; letter-spacing:1px; box-shadow:var(--shadow); }
            nav a { color:#fff; text-decoration:none; margin:0 18px; font-weight:500; transition: color .2s; }
            nav a:hover { color:#ffe082; }
            .hero { width:100%; min-height:220px; background-image:url('${siteRow.hero_image}'); background-size:cover; background-position:center; border-radius:var(--radius); margin:24px auto 0; max-width:900px; box-shadow:var(--shadow); display:flex; align-items:center; justify-content:center; }
            .container { max-width:900px; margin:0 auto; padding:0 16px; }
            .section { background:#fff; border-radius:var(--radius); box-shadow:var(--shadow); margin:32px 0; padding:32px 24px; }
            h1,h2,h3 { margin-top:0; font-weight:700; }
            h1 { font-size:2.5rem; letter-spacing:1px; }
            h2 { font-size:1.5rem; color:var(--main-color); }
            p { font-size:1.08rem; line-height:1.7; }
            .btn { display:inline-block; padding:12px 28px; background:var(--main-color); color:#fff; border-radius:8px; text-decoration:none; font-weight:600; margin-top:18px; box-shadow:0 2px 8px rgba(0,0,0,0.08); border:none; cursor:pointer; font-size:1rem; }
            .btn:hover { background:#084298; }
            /* Chatbot alanı */
            .chatbot-box { background: #fff7e6; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); margin: 40px auto 0 auto; padding: 24px 18px 18px 18px; max-width: 420px; text-align: center; }
            .chatbot-box input { width: 80%; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 1rem; margin-bottom: 10px; }
            .chatbot-box button { padding: 10px 22px; border-radius: 8px; background: var(--main-color); color: #fff; border: none; font-weight: 600; cursor: pointer; margin-left: 8px; font-size: 1rem; }
            .chatbot-box button:disabled { opacity: 0.6; }
            .chatbot-msg { margin-top: 12px; font-size: 1.05rem; }
            /* Chatbot widget */
            #chatbot-widget { position: fixed; bottom: 32px; right: 32px; z-index: 9999; font-family: inherit; }
            #chatbot-bubble { background: #0d6efd; color: #fff; border-radius: 32px; padding: 16px 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); cursor: pointer; font-size: 1.15rem; font-weight: 600; display: flex; align-items: center; gap: 10px; transition: background 0.2s, box-shadow 0.2s; }
            #chatbot-bubble:hover { background: #1976d2; box-shadow: 0 8px 32px rgba(0,0,0,0.22); }
            #chatbot-panel { display: none; flex-direction: column; align-items: stretch; background: #fff; border-radius: 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); padding: 24px 18px 18px 18px; min-width: 320px; max-width: 90vw; position: absolute; bottom: 60px; right: 0; animation: chatbot-fadein 0.2s; }
            #chatbot-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 1.1rem; margin-bottom: 10px; }
            #chatbot-close { background: none; border: none; font-size: 1.5rem; color: #888; cursor: pointer; margin-left: 8px; }
            #chatbot-input { width: 90%; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 1rem; margin-bottom: 10px; }
            #chatbot-send { padding: 10px 22px; border-radius: 8px; background: #0d6efd; color: #fff; border: none; font-weight: 600; cursor: pointer; font-size: 1rem; margin-bottom: 8px; }
            #chatbot-send:disabled { opacity: 0.6; }
            .chatbot-msg { margin-top: 8px; font-size: 1.05rem; min-height: 20px; }
            @media (max-width: 700px) { #chatbot-widget { right: 4vw; bottom: 4vw; } #chatbot-panel { min-width: 90vw; } }
            @keyframes chatbot-fadein { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            /* Basit Kenar Düzenleyici CSS */
            #simple-editor-toggle{ position: fixed; right: 0; top: 50%; transform: translateY(-50%); background: var(--main-color); color:#fff; padding: 10px 12px; border-radius: 8px 0 0 8px; font-size: 1.2rem; cursor: pointer; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            #simple-editor{ position: fixed; right: -320px; top:0; height: 100vh; width: 300px; background:#fff; box-shadow: -2px 0 14px rgba(0,0,0,0.08); border-left: 1px solid #eee; z-index: 10000; transition: right .25s ease; display:flex; flex-direction: column; }
            #simple-editor.open{ right: 0; }
            #simple-editor .se-head{ display:flex; justify-content: space-between; align-items:center; padding: 14px; font-weight: 700; border-bottom:1px solid #eee; }
            #simple-editor .se-head button{ background:none; border:none; font-size:1.4rem; color:#888; cursor:pointer; }
            #simple-editor .se-body{ padding: 14px; display:flex; flex-direction:column; gap:10px; }
            #simple-editor label{ font-size:.95rem; color:#444; display:block; }
            #simple-editor input{ width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; }
            #simple-editor #se-save{ margin-top:6px; background: var(--main-color); color:#fff; border:none; border-radius:8px; padding:10px; font-weight:600; cursor:pointer; }
            #simple-editor #se-msg{ margin-top:8px; font-size:.95rem; color:#333; }
            @media (max-width: 700px){ #simple-editor{ width: 92vw; right: -92vw; } }
          </style>
        </head>
        <body>
          <nav>
            <a href="#index">${slugToPage.index?.title || 'Ana Sayfa'}</a>
            <a href="#about">${slugToPage.about?.title || 'Hakkında'}</a>
            <a href="#products">${slugToPage.products?.title || 'Ürünler'}</a>
            <a href="#contact">${slugToPage.contact?.title || 'İletişim'}</a>
          </nav>
          <div class="container">
            <div class="hero">
              <h1 style="background:rgba(0,0,0,0.45);color:#fff;padding:18px 32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">${siteRow.title}</h1>
            </div>
            <div class="section" id="index">
              <h2>${slugToPage.index?.title || 'Ana Sayfa'}</h2>
              <p>${slugToPage.index?.body || ''}</p>
            </div>
            <div class="section" id="about">
              <h2>${slugToPage.about?.title || 'Hakkında'}</h2>
              <p>${slugToPage.about?.body || ''}</p>
            </div>
            <div class="section" id="products">
              <h2>${slugToPage.products?.title || 'Ürünler'}</h2>
              <p>${slugToPage.products?.body || ''}</p>
            </div>
            <div class="section" id="contact">
              <h2>${slugToPage.contact?.title || 'İletişim'}</h2>
              <p>${slugToPage.contact?.body || ''}</p>
              <a class="btn" href="mailto:info@example.com">İletişime Geç</a>
            </div>
            <!-- Chatbot ile düzenle alanı -->
            <div id="chatbot-widget">
              <div id="chatbot-bubble" onclick="openChatbot()">
                💬 Chatbot ile Düzenle
              </div>
              <div id="chatbot-panel">
                <div id="chatbot-header">
                  <span>Chatbot ile Düzenle</span>
                  <button id="chatbot-close" onclick="closeChatbot()">×</button>
                </div>
                <input id="chatbot-input" type="text" placeholder="Örn: Başlık rengini kırmızı yap" />
                <button id="chatbot-send">Gönder</button>
                <div class="chatbot-msg" id="chatbot-msg"></div>
              </div>
            </div>

            <!-- Basit Kenar Düzenleme Paneli -->
            <div id="simple-editor-toggle" onclick="toggleSimpleEditor()">✏️</div>
            <div id="simple-editor">
              <div class="se-head">
                <span>Hızlı Düzenle</span>
                <button onclick="toggleSimpleEditor()">×</button>
              </div>
              <div class="se-body">
                <label>Site Başlığı
                  <input id="se-title" type="text" value="${siteRow.title.replace(/"/g, '&quot;')}" />
                </label>
                <label>Ana Sayfa Başlığı
                  <input id="se-index-title" type="text" value="${slugToPage.index?.title.replace(/"/g, '&quot;') || ''}" />
                </label>
                <label>Ana Sayfa Yazısı
                  <textarea id="se-index-body" rows="2">${slugToPage.index?.body.replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''}</textarea>
                </label>
                <label>Hakkında Başlığı
                  <input id="se-about-title" type="text" value="${slugToPage.about?.title.replace(/"/g, '&quot;') || ''}" />
                </label>
                <label>Hakkında Yazısı
                  <textarea id="se-about-body" rows="2">${slugToPage.about?.body.replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''}</textarea>
                </label>
                <label>Ürünler Başlığı
                  <input id="se-products-title" type="text" value="${slugToPage.products?.title.replace(/"/g, '&quot;') || ''}" />
                </label>
                <label>Ürünler Yazısı
                  <textarea id="se-products-body" rows="2">${slugToPage.products?.body.replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''}</textarea>
                </label>
                <label>İletişim Başlığı
                  <input id="se-contact-title" type="text" value="${slugToPage.contact?.title.replace(/"/g, '&quot;') || ''}" />
                </label>
                <label>İletişim Yazısı
                  <textarea id="se-contact-body" rows="2">${slugToPage.contact?.body.replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''}</textarea>
                </label>
                <button id="se-save">Yayınla</button>
                <div id="se-msg"></div>
              </div>
            </div>
          </div>
          <script>
            function openChatbot() {
              document.getElementById('chatbot-bubble').style.display = 'none';
              document.getElementById('chatbot-panel').style.display = 'flex';
            }
            function closeChatbot() {
              document.getElementById('chatbot-panel').style.display = 'none';
              document.getElementById('chatbot-bubble').style.display = 'flex';
            }
            document.getElementById('chatbot-send').onclick = async function() {
              var input = document.getElementById('chatbot-input');
              var msg = document.getElementById('chatbot-msg');
              var command = input.value.trim();
              if (!command) return;
              msg.textContent = 'Gönderiliyor...';
              this.disabled = true;
              try {
                const res = await fetch('/api/chatbot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    siteId: window.location.pathname.split('/')[2],
                    command
                  })
                });
                const data = await res.json();
                if (data.success) {
                  msg.textContent = 'Güncellendi, sayfa yenileniyor...';
                  setTimeout(()=>window.location.reload(), 1200);
                } else {
                  msg.textContent = data.error || 'Bir hata oluştu.';
                }
              } catch (err) {
                msg.textContent = 'Sunucuya bağlanılamadı.';
              }
              this.disabled = false;
            };

            // Basit Kenar Düzenleyici JS
            function toggleSimpleEditor(){
              var el = document.getElementById('simple-editor');
              el.classList.toggle('open');
            }
            document.getElementById('se-save').onclick = async function(){
              var title = document.getElementById('se-title').value.trim();
              var tIndex = document.getElementById('se-index-title').value.trim();
              var tAbout = document.getElementById('se-about-title').value.trim();
              var tProducts = document.getElementById('se-products-title').value.trim();
              var tContact = document.getElementById('se-contact-title').value.trim();
              var bIndex = document.getElementById('se-index-body').value.trim();
              var bAbout = document.getElementById('se-about-body').value.trim();
              var bProducts = document.getElementById('se-products-body').value.trim();
              var bContact = document.getElementById('se-contact-body').value.trim();
              var msg = document.getElementById('se-msg');
              msg.textContent = 'Yayınlanıyor...';
              try{
                var titles = {};
                var bodies = {};
                if (tIndex) titles.index = tIndex;
                if (tAbout) titles.about = tAbout;
                if (tProducts) titles.products = tProducts;
                if (tContact) titles.contact = tContact;
                if (bIndex) bodies.index = bIndex;
                if (bAbout) bodies.about = bAbout;
                if (bProducts) bodies.products = bProducts;
                if (bContact) bodies.contact = bContact;
                var body = { siteId: window.location.pathname.split('/')[2] };
                if (title) body.title = title;
                if (Object.keys(titles).length) body.titles = titles;
                if (Object.keys(bodies).length) body.bodies = bodies;

                const res = await fetch('/api/site/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body)
                });
                const data = await res.json();
                 if (data.success) {
                   msg.textContent = 'Yayınlandı! Sayfa yenileniyor...';
                   var se = document.getElementById('simple-editor');
                   if (se) se.classList.remove('open');
                   setTimeout(()=>window.location.reload(), 800);
                 } else {
                   msg.textContent = data.error || 'Güncelleme başarısız.';
                 }
              } catch(e){
                msg.textContent = 'Sunucuya bağlanılamadı.';
              }
            };
          </script>
        </body>
        </html>`;

        fs.writeFileSync(path.join(siteDir, 'index.html'), indexHtml, 'utf8');
        return res.json({ success: true, url: `/sites/${siteId}/index.html` });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'update failed' });
      }
    });

    module.exports = router;