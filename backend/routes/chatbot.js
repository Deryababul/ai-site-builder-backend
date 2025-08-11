// routes/chatbot.js  (veya editor.js)
// Gereken paketler: npm i openai cheerio
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ===================== Yardımcılar (Hız/Token Optimizasyonu) ===================== */

/** Büyük gövdeden gereksiz kısımları ayıkla ve kısalt (token düşürür) */
function slimBodyForPrompt(fullHtml) {
  const $ = cheerio.load(fullHtml, { decodeEntities: false });
  const $body = $('body');

  // Gürültü: script/style noscript ve yorumları sil
  $body.find('script, style, noscript').remove();
  $body.contents().each((_, el) => { if (el.type === 'comment') $(el).remove(); });

  // Çok büyük sayfada sadece id/class’lı bloklar ve 2 üst parent kalsın
  if ($body.children().length > 200) {
    const keep = new Set();
    $body.find('[id], [class]').each((_, el) => {
      let cur = el;
      for (let i = 0; i < 2 && cur && cur.parent; i++) {
        keep.add(cur);
        cur = cur.parent;
      }
    });
    $body.children().each((_, el) => { if (!keep.has(el)) $(el).remove(); });
  }

  // Basit minify
  let bodyHtml = $body.html() || '';
  bodyHtml = bodyHtml.replace(/\s{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();

  // Güvenlik: 20k karakter üstünü kes
  return bodyHtml.slice(0, 20000);
}

/** Hızlı konumlama için hafif indeks (tag, id, class, kısa text) */
function buildLightIndex(bodyHtml) {
  const $ = cheerio.load(`<body>${bodyHtml}</body>`, { decodeEntities: false });
  const arr = [];
  $('*[id], h1, h2, h3, h4, h5, h6, a, button').each((_, el) => {
    const tag = el.tagName || el.name;
    const id = $(el).attr('id') || null;
    const cls = ($(el).attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const text = ($(el).text() || '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
    arr.push({ tag, id, cls, text });
  });
  // 400 öğede sınırla (gereksiz token yemesin)
  return arr.slice(0, 400);
}

/** JSON güvenli ayrıştırma */
function safeJsonParse(s, fallback = { ops: [] }) {
  try { return JSON.parse(s); } catch { return fallback; }
}

/** Patch’i Cheerio ile uygula (server-side DOM değişimi) */
function applyPatch(fullHtml, patch) {
  const $ = cheerio.load(fullHtml, { decodeEntities: false });

  for (const op of (patch.ops || [])) {
    try {
      if (!op || !op.op || !op.selector) continue;
      const $nodes = $(op.selector);
      if (!$nodes.length) continue;

      switch (op.op) {
        case 'replaceText':
          $nodes.each((_, n) => $(n).text(op.text || ''));
          break;
        case 'appendHtml': {
          const html = op.html || '';
          $nodes.each((_, n) => {
            if (op.position === 'beforeend') $(n).append(html);
            else if (op.position === 'afterbegin') $(n).prepend(html);
            else if (op.position === 'before') $(n).before(html);
            else if (op.position === 'after') $(n).after(html);
            else $(n).append(html);
          });
          break;
        }
        case 'setAttr':
          if (op.name) $nodes.attr(op.name, op.value ?? '');
          break;
        case 'remove':
          $nodes.remove();
          break;
      }
    } catch { /* tek tek yut, dayanıklı kalsın */ }
  }
  return $.html();
}

/** Gerektiğinde küçük HTML snippet üret (ikinci kısa çağrı) */
async function generateSnippet(command, selector) {
  const r = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 250, // kısa tut
      messages: [
        { role: 'system', content: 'Geçerli ve çalışır minimal HTML snippet üret. Sadece snippet döndür.' },
        { role: 'user', content: `Komut: ${command}\nBu seçiciye eklenecek basit HTML üret: ${selector}\nKısıtlar: inline CSS minimum; JS ekleme.` }
      ],
    },
    { timeout: 12000 } // <-- hız için timeout (ikinci argüman)
  );
  let txt = (r.choices?.[0]?.message?.content || '').trim();
  if (txt.startsWith('```')) txt = txt.replace(/```[a-zA-Z]*\n?|```$/g, '').trim();
  return txt;
}

/* ===================== Route ===================== */

router.post('/', async (req, res) => {
  const { siteId, command } = req.body;
  if (!siteId || !command) return res.status(400).json({ error: 'siteId ve command gereklidir.' });

  const sitePath = path.join(__dirname, '..', '..', 'frontend', 'sites', siteId, 'index.html');
  if (!fs.existsSync(sitePath)) return res.status(404).json({ error: 'Site bulunamadı.' });

  try {
    const html = fs.readFileSync(sitePath, 'utf8');

    // BODY yakala (fallback tüm HTML)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : html;

    // 1) Prompt’ı küçült ve indeks çıkar (token ↓, hız ↑)
    const slimmedBody = slimBodyForPrompt(html);
    const lightIndex = buildLightIndex(bodyHtml);

    // 2) Patch planı iste (küçük JSON). Tam HTML istemiyoruz -> üretim süresi düşer
    const planPrompt =
`Komut: "${command}"
Aşağıda sayfanın hafif indeksi ve <body> ön-izlemesi var. Şu şemaya uyan bir JSON "patch planı" döndür:

{
  "ops": [
    // Op türleri:
    // { "op":"replaceText", "selector":"CSS_SELECTOR", "text":"..." }
    // { "op":"appendHtml",  "selector":"CSS_SELECTOR", "position":"beforeend|afterbegin|before|after", "html":"<button>...</button>" }
    // { "op":"setAttr",     "selector":"CSS_SELECTOR", "name":"href", "value":"/x" }
    // { "op":"remove",      "selector":"CSS_SELECTOR" }
  ]
}

INDEX:
${JSON.stringify(lightIndex)}

BODY_PREVIEW:
${slimmedBody}
`;

    const planResp = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 550, // sınırla
        messages: [
          { role: 'system', content: 'Sen bir web sitesi düzenleyici botsun. Sadece geçerli JSON döndür.' },
          { role: 'user', content: planPrompt }
        ],
      },
      { timeout: 12000 } // <-- HIZ: istek 12sn’de zaman aşımı
    );

    // JSON içeriği çek ve temizle
    let content = (planResp.choices?.[0]?.message?.content || '').trim();
    if (content.startsWith('```')) content = content.replace(/```json\n?|\n?```$/g, '').trim();
    const patch = safeJsonParse(content, { ops: [] });

    // 3) appendHtml op’larında html alanı boşsa küçük snippet üret
    for (const op of patch.ops || []) {
      if (op.op === 'appendHtml' && (!op.html || !op.html.trim())) {
        op.html = await generateSnippet(command, op.selector);
      }
    }

    // 4) Patch’i uygula ve yaz
    const newFullHtml = applyPatch(html, patch);
    fs.writeFileSync(sitePath, newFullHtml, 'utf8');

    return res.json({ success: true, message: 'Site güncellendi.' });
  } catch (err) {
    console.error('Chatbot düzenleme hatası (patch akışı):', err);

    /* ===== İsteğe bağlı Fallback: Eski "body üret" akışına hızlı, kısıtlı dönüş ===== */
    try {
      const html = fs.readFileSync(sitePath, 'utf8');
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyHtml = bodyMatch ? bodyMatch[1] : html;

      const prompt = `
Aşağıdaki HTML <body> içeriğinde kullanıcıdan gelen komutu uygula ve sadece güncellenmiş <body> içeriğini döndür. Lütfen yalnızca gerekli düzenlemeleri yap ve gereksiz değişikliklerden kaçın. 
Komut: "${req.body.command}"

BODY:
${bodyHtml.slice(0, 15000)}

Lütfen HTML yapısını bozmadan, verilen komut doğrultusunda güncellenmiş ve geçerli <body> içeriğini döndür.`;
      console.log("prompt",prompt);
      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          temperature: 0.25,
          max_tokens: 1200, // daha düşük (hız için)
          messages: [
            { role: 'system', content: 'Sen bir web sitesi düzenleyici botsun. Sadece geçerli ve çalışır TAM HTML döndür.' },
            { role: 'user', content: prompt }
          ],
        },
        { timeout: 12000 } // <-- timeout burada da
      );

      let newBody = (completion.choices?.[0]?.message?.content || '').trim();
      if (newBody.startsWith('```')) newBody = newBody.replace(/```[a-zA-Z]*\n?|```$/g, '').trim();

      // <body> içine yaz
      let finalHtml = html;
      if (html.match(/<body[^>]*>[\s\S]*?<\/body>/i)) {
        finalHtml = html.replace(/<body[^>]*>[\s\S]*?<\/body>/i, (m) => {
          const openTag = (m.match(/<body[^>]*>/i) || ['<body>'])[0];
          return `${openTag}\n${newBody}\n</body>`;
        });
      } else {
        finalHtml = `${html}\n<body>\n${newBody}\n</body>`;
      }
      fs.writeFileSync(sitePath, finalHtml, 'utf8');
      return res.json({ success: true, message: 'Site güncellendi. (fallback)' });
    } catch (e2) {
      console.error('Fallback da başarısız:', e2);
      return res.status(500).json({ error: 'AI ile düzenleme başarısız.' });
    }
  }
});

module.exports = router;
