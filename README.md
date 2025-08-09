# Proje Yapısı

Bu proje iki ana klasöre ayrılmıştır:

- `backend/`: Node.js tabanlı API ve sunucu kodları burada bulunur.
- `frontend/`: Statik dosyalar (HTML, CSS, JS) burada bulunur. Önceden `public` klasörüydü.

## Çalıştırma

1. `backend` klasöründe sunucuyu başlatın.
2. `frontend` klasöründeki dosyalar, backend tarafından statik olarak sunulur.

---

# AI Site Builder - Minimal Prototype

Bu arşiv, Node.js + Express tabanlı, minimal bir "AI destekli site oluşturma" prototipini içerir.
- Backend: `backend/`
- Frontend (statik): `public/`

## Gereksinimler
- Node.js 16+ ve npm

## Kurulum
1. `cd backend`
2. `npm install`
3. `.env` dosyasını oluşturun (`backend/.env.example` dosyasına bakabilirsiniz). OpenAI anahtarı opsiyoneldir; bu prototip offline deterministic çıktılar verir.
4. `npm start`
5. Tarayıcı: `http://localhost:3000`

## Özellikler
- "Yeni Site Oluştur" butonu ile `public/sites/{siteId}/index.html` dosyası oluşturulur.
- Chatbot endpoint (`/api/chatbot`) şimdilik stub olarak bırakıldı (çalışmaz).

## Notlar / Geliştirilecekler
- OpenAI entegrasyonu için `backend/routes/site.js` içine API çağrısı eklenebilir.
- Chatbot'ın site dosyalarını düzenlemesi için backend tarafında HTML parsing ve değişiklik uygulama mekanizması eklenecek.