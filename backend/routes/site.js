const express = require('express');
    const router = express.Router();
    const fs = require('fs');
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');
    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    async function generateContent(topic, theme) {
      const prompt = `
Sen profesyonel bir web sitesi içerik üretme asistanısın.
Kullanıcı konusu: "${topic}"
Tema: "${theme}"
Bana aşağıdaki formatta JSON ver:
{
  "title": "...",
  "description": "...",
  "pages": [
    { "slug": "index", "title": "Ana Sayfa", "body": "..." },
    { "slug": "about", "title": "Hakkında", "body": "..." },
    { "slug": "products", "title": "Ürünler", "body": "..." },
    { "slug": "contact", "title": "İletişim", "body": "..." }
  ],
  "hero_image": "https://picsum.photos/1200/400"
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

    router.post('/create', async (req, res) => {
      try {
        const { topic, theme } = req.body;
        if (!topic) return res.status(400).json({ error: 'topic required' });

        const siteId = uuidv4();
        const content = await generateContent(topic, theme || 'default');

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
          <style>
            :root {
              --main-color: #0d6efd;
              --bg-light: #f7f9fb;
              --text-dark: #222;
              --section-bg: #fff;
              --radius: 18px;
              --shadow: 0 4px 24px rgba(0,0,0,0.08);
            }
            html { box-sizing: border-box; }
            *, *:before, *:after { box-sizing: inherit; }
            body {
              margin: 0; padding: 0;
              font-family: 'Segoe UI', 'Arial', sans-serif;
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
            @media (max-width: 600px) {
              .container, .hero { max-width: 98vw; }
              .section { padding: 18px 6px; }
              h1 { font-size: 1.5rem; }
              h2 { font-size: 1.1rem; }
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
          </div>
        </body>
        </html>
        `;
        // console.log("indexHtml",indexHtml);
        fs.writeFileSync(path.join(siteDir, 'index.html'), indexHtml, 'utf8');

        return res.json({ siteId, url: `/sites/${siteId}/index.html` });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
      }
    });

    module.exports = router;