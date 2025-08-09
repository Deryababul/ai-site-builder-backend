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

    // --- Tema bazlı HTML şablon fonksiyonları ---
    function renderEditorAndChatbot(content) {
      return `
    <!-- Chatbot ile düzenle alanı -->
    <div id="chatbot-widget">
      <div id="chatbot-bubble" onclick="openChatbot()">
        💬 Chatbot
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
           console.log("data",data);
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
    <style>
      /* Chatbot ve editor için izole CSS */
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
      /* Editor CSS aynı kalıyor */
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
      #simple-editor .se-body{ padding: 14px; display:flex; flex-direction:column; gap:10px; 
        overflow-y: auto; max-height: 70vh; }
      #simple-editor label{ font-size:.95rem; color:#444; display:block; }
      #simple-editor input{ width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; }
      #simple-editor #se-save{ margin-top:6px; background: var(--main-color); color:#fff; border:none; border-radius:8px; padding:10px; font-weight:600; cursor:pointer; }
      #simple-editor #se-msg{ margin-top:8px; font-size:.95rem; color:#333; }
      @media (max-width: 700px){ #simple-editor{ width: 92vw; right: -92vw; } }
    </style>
  `;
    }

    function cafeTemplate(content, t) {
      // Dark tema, yan yana componentler
      return `
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
        --bg-light: #232323;
        --text-dark: #fff;
        --section-bg: #2d2d2d;
        --radius: 18px;
        --shadow: 0 4px 24px rgba(0,0,0,0.18);
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
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 16px;
      }
      .sections-row {
        display: flex;
        gap: 24px;
        margin-top: 32px;
        flex-wrap: wrap;
      }
      .section {
        background: var(--section-bg);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        flex: 1 1 220px;
        min-width: 220px;
        margin: 0;
        padding: 32px 24px;
        color: #fff;
      }
      h1, h2, h3 {
        margin-top: 0;
        font-weight: 700;
      }
      h1 { font-size: 2.5rem; letter-spacing: 1px; }
      h2 { font-size: 1.5rem; color: var(--main-color); }
      h3 { font-size: 1.15rem; color: #ffe082; }
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
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        transition: background 0.2s;
        border: none;
        cursor: pointer;
        font-size: 1rem;
      }
      .btn:hover { background: #6b3a1e; }
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
        <h1 style="background:rgba(0,0,0,0.45);color:#fff;padding:18px 32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.18);">${content.title}</h1>
      </div>
      <div class="sections-row">
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
      ${renderEditorAndChatbot(content)}
    </div>
  </body>
  </html>
  `;
    }

    function corporateTemplate(content, t) {
      // Açık renk, klasik alt alta componentler
      return `
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
      ${renderEditorAndChatbot(content)}
    </div>
  </body>
  </html>
  `;
    }

    function portfolioTemplate(content, t) {
      return `
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
      .cv-container {
        display: flex;
        max-width: 1000px;
        margin: 40px auto;
        background: #fff;
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        overflow: hidden;
        min-height: 600px;
      }
      .cv-sidebar {
        background: var(--main-color);
        color: #fff;
        width: 320px;
        padding: 40px 28px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
      }
      .cv-avatar {
        width: 110px;
        height: 110px;
        border-radius: 50%;
        background: #fff;
        margin-bottom: 24px;
        background-image: url('${content.hero_image}');
        background-size: cover;
        background-position: center;
        border: 4px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.10);
      }
      .cv-title {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 10px;
        text-align: center;
      }
      .cv-desc {
        font-size: 1.1rem;
        margin-bottom: 24px;
        text-align: center;
      }
      .cv-contact {
        margin-top: auto;
        font-size: 1rem;
        text-align: center;
      }
      .cv-main {
        flex: 1;
        padding: 40px 36px;
        background: var(--bg-light);
        display: flex;
        flex-direction: column;
        gap: 32px;
      }
      .cv-section {
        background: var(--section-bg);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 28px 24px;
        margin-bottom: 0;
      }
      .cv-section h2 {
        color: var(--main-color);
        margin-top: 0;
        font-size: 1.3rem;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .cv-section p {
        font-size: 1.08rem;
        line-height: 1.7;
        margin: 0;
      }
      .cv-btn {
        display: inline-block;
        padding: 10px 24px;
        background: var(--main-color);
        color: #fff;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        margin-top: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        border: none;
        cursor: pointer;
        font-size: 1rem;
        transition: background 0.2s;
      }
      .cv-btn:hover { background: #4b277a; }
      @media (max-width: 900px) {
        .cv-container { flex-direction: column; min-height: unset; }
        .cv-sidebar { width: 100%; flex-direction: row; justify-content: flex-start; align-items: center; padding: 24px 12px; }
        .cv-avatar { margin-bottom: 0; margin-right: 18px; }
        .cv-title, .cv-desc, .cv-contact { text-align: left; }
      }
      @media (max-width: 600px) {
        .cv-main { padding: 18px 4vw; }
        .cv-sidebar { padding: 18px 4vw; }
      }
    </style>
  </head>
  <body>
    <div class="cv-container">
      <div class="cv-sidebar">
        <div class="cv-avatar"></div>
        <div class="cv-title">${content.title}</div>
        <div class="cv-desc">${content.description}</div>
        <div class="cv-contact">
          <b>İletişim:</b><br>
          <a href="mailto:info@example.com" style="color:#fff;text-decoration:underline;">info@example.com</a>
        </div>
      </div>
      <div class="cv-main">
        <div class="cv-section" id="about">
          <h2>${content.pages[1].title}</h2>
          <p>${content.pages[1].body}</p>
        </div>
        <div class="cv-section" id="products">
          <h2>${content.pages[2].title}</h2>
          <p>${content.pages[2].body}</p>
        </div>
        <div class="cv-section" id="contact">
          <h2>${content.pages[3].title}</h2>
          <p>${content.pages[3].body}</p>
          <a class="cv-btn" href="mailto:info@example.com">İletişime Geç</a>
        </div>
      </div>
    </div>
    ${renderEditorAndChatbot(content)}
  </body>
  </html>
  `;
    }

    function blogTemplate(content, t) {
      return `
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
      .blog-hero {
        background: var(--main-color);
        color: #fff;
        padding: 56px 0 36px 0;
        text-align: center;
        border-radius: 0 0 32px 32px;
        box-shadow: var(--shadow);
        background-image: url('${content.hero_image}');
        background-size: cover;
        background-position: center;
        position: relative;
      }
      .blog-hero::after {
        content: '';
        position: absolute;
        left: 0; right: 0; top: 0; bottom: 0;
        background: rgba(56,142,60,0.55);
        border-radius: 0 0 32px 32px;
        z-index: 1;
      }
      .blog-hero-content {
        position: relative;
        z-index: 2;
        max-width: 700px;
        margin: 0 auto;
      }
      .blog-title {
        font-size: 2.7rem;
        font-weight: 800;
        margin-bottom: 16px;
        letter-spacing: 1px;
      }
      .blog-desc {
        font-size: 1.25rem;
        margin-bottom: 0;
        font-weight: 400;
      }
      .blog-main {
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 16px 0 16px;
        display: flex;
        flex-direction: column;
        gap: 32px;
      }
      .blog-posts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 28px;
      }
      .blog-post {
        background: var(--section-bg);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 24px 20px 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: box-shadow 0.2s;
      }
      .blog-post:hover {
        box-shadow: 0 8px 32px rgba(56,142,60,0.13);
      }
      .blog-post h3 {
        margin: 0 0 8px 0;
        color: var(--main-color);
        font-size: 1.18rem;
        font-weight: 700;
      }
      .blog-post p {
        margin: 0;
        font-size: 1.05rem;
        color: #333;
      }
      .blog-section {
        background: var(--section-bg);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 28px 24px;
      }
      .blog-section h2 {
        color: var(--main-color);
        margin-top: 0;
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .blog-section p {
        font-size: 1.08rem;
        line-height: 1.7;
        margin: 0;
      }
      .blog-btn {
        display: inline-block;
        padding: 10px 24px;
        background: var(--main-color);
        color: #fff;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        margin-top: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        border: none;
        cursor: pointer;
        font-size: 1rem;
        transition: background 0.2s;
      }
      .blog-btn:hover { background: #256d2b; }
      @media (max-width: 700px) {
        .blog-main { padding: 18px 4vw 0 4vw; }
        .blog-hero { padding: 36px 0 18px 0; }
        .blog-title { font-size: 2rem; }
      }
    </style>
  </head>
  <body>
    <div class="blog-hero">
      <div class="blog-hero-content">
        <div class="blog-title">${content.title}</div>
        <div class="blog-desc">${content.description}</div>
      </div>
    </div>
    <div class="blog-main">
      <div class="blog-posts">
        <div class="blog-post" id="index">
          <h3>${content.pages[0].title}</h3>
          <p>${content.pages[0].body}</p>
        </div>
        <div class="blog-post" id="products">
          <h3>${content.pages[2].title}</h3>
          <p>${content.pages[2].body}</p>
        </div>
      </div>
      <div class="blog-section" id="about">
        <h2>${content.pages[1].title}</h2>
        <p>${content.pages[1].body}</p>
      </div>
      <div class="blog-section" id="contact">
        <h2>${content.pages[3].title}</h2>
        <p>${content.pages[3].body}</p>
        <a class="blog-btn" href="mailto:info@example.com">İletişime Geç</a>
      </div>
    </div>
    ${renderEditorAndChatbot(content)}
  </body>
  </html>
  `;
    }

    // Tema yapılandırmaları
    const THEMES = {
      cafe: {
        mainColor: '#d2691e',
        bgLight: '#232323',
        font: "'Merriweather', serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Merriweather:400,700&display=swap' rel='stylesheet'>",
        template: cafeTemplate
      },
      ecommerce: {
        mainColor: '#1976d2',
        bgLight: '#f7f9fb',
        font: "'Montserrat', sans-serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap' rel='stylesheet'>",
        template: corporateTemplate // şimdilik klasik ile aynı
      },
      portfolio: {
        mainColor: '#6a1b9a',
        bgLight: '#f6f3fa',
        font: "'Poppins', sans-serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Poppins:400,700&display=swap' rel='stylesheet'>",
        template: portfolioTemplate
      },
      blog: {
        mainColor: '#388e3c',
        bgLight: '#f7faf7',
        font: "'Lora', serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Lora:400,700&display=swap' rel='stylesheet'>",
        template: blogTemplate
      },
      corporate: {
        mainColor: '#455a64',
        bgLight: '#f4f6f8',
        font: "'Roboto', sans-serif",
        fontLink: "<link href='https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap' rel='stylesheet'>",
        template: corporateTemplate
      },
      default: {
        mainColor: '#0d6efd',
        bgLight: '#f7f9fb',
        font: "'Segoe UI', 'Arial', sans-serif",
        fontLink: '',
        template: corporateTemplate
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
        console.log("heroImage",heroImage);
        content.hero_image = heroImage;

        // Tema seçimi
        const t = THEMES[theme] || THEMES.default;
        console.log("t",t);
        const siteDir = path.join(__dirname, '..', '..', 'frontend', 'sites', siteId);
        fs.mkdirSync(siteDir, { recursive: true });

        // Tema fonksiyonu ile HTML üret
        const indexHtml = t.template(content, t);
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
        console.log("req.body",req.body);
        const { siteId, title, titles, bodies } = req.body || {};
        if (!siteId) return res.status(400).json({ error: 'siteId required' });
        console.log("req.body",req.body);
        
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

        // Tema asla değişmesin, sadece mevcut tema ile devam
        const t = THEMES[siteRow.theme] || THEMES.default;
        console.log("t",t);
        const siteDir = path.join(__dirname, '..', '..', 'frontend', 'sites', siteId);
        console.log("siteDir",siteDir);
        fs.mkdirSync(siteDir, { recursive: true });

        // Güncel content objesi oluştur
        const content = {
          title: siteRow.title,
          description: siteRow.description,
          hero_image: siteRow.hero_image,
          pages: [
            slugToPage.index || { slug: 'index', title: 'Ana Sayfa', body: '' },
            slugToPage.about || { slug: 'about', title: 'Hakkında', body: '' },
            slugToPage.products || { slug: 'products', title: 'Ürünler', body: '' },
            slugToPage.contact || { slug: 'contact', title: 'İletişim', body: '' }
          ]
        };
        console.log("content",content);
        // Tema fonksiyonu ile HTML üret
        const indexHtml = t.template(content, t);
        fs.writeFileSync(path.join(siteDir, 'index.html'), indexHtml, 'utf8');
        return res.json({ success: true, url: `/sites/${siteId}/index.html` });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'update failed' });
      }
    });

    router.post('/preview', async (req, res) => {
      try {
        const { theme, content } = req.body || {};
        if (!theme || !content) return res.status(400).json({ error: 'theme ve content zorunlu' });
        const t = THEMES[theme] || THEMES.default;
        const html = t.template(content, t);
        return res.send(html);
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'preview failed' });
      }
    });

    module.exports = router;