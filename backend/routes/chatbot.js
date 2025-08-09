const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/chatbot
router.post('/', async (req, res) => {
  const { siteId, command } = req.body;
  console.log("siteId",siteId);
  if (!siteId || !command) {
    return res.status(400).json({ error: 'siteId ve command gereklidir.' });
  }
  const sitePath = path.join(__dirname, '..', '..', 'frontend', 'sites', siteId, 'index.html');
  console.log("sitePath",sitePath);
  if (!fs.existsSync(sitePath)) {
    return res.status(404).json({ error: 'Site bulunamadı.' });
  }
  try {
    const html = fs.readFileSync(sitePath, 'utf8');
    console.log("html",html);
    const prompt = `Aşağıdaki HTML dosyasında kullanıcıdan gelen komutu uygula. Sadece güncellenmiş TAM HTML döndür. Komut: "${command}"\n\nHTML:\n${html}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: 'Sen bir web sitesi düzenleyici botsun. Sadece geçerli ve çalışır TAM HTML döndür.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4096
    });
    let newHtml = completion.choices[0].message.content.trim();
    if (newHtml.startsWith('```')) {
      newHtml = newHtml.replace(/```[a-zA-Z]*\n?|```$/g, '').trim();
    }
    fs.writeFileSync(sitePath, newHtml, 'utf8');
    return res.json({ success: true, message: 'Site güncellendi.' });
  } catch (err) {
    console.error('Chatbot düzenleme hatası:', err);
    return res.status(500).json({ error: 'AI ile düzenleme başarısız.' });
  }
});

module.exports = router;
