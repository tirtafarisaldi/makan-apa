# Makan Apa 🍜

Aplikasi pencarian **rekomendasi makanan terdekat** dengan tema gelap (glassmorphism). User memilih lokasi, budget, kategori, radius, mood, dan (opsional) jenis makanan — lalu AI (Gemini) merangkum dan memilih restoran yang paling cocok di sekitar area tersebut.

## Fitur

- **Lokasi** — cari berdasarkan ketikan (autocomplete dari Nominatim/OpenStreetMap, 6 saran) atau satu klik tombol **📍 Gunakan lokasi saya saat ini** (geolocation).
- **Budget** — preset cepat (20rb / 50rb / 100rb) + input bebas, diformat otomatis `Rp`.
- **Kategori makanan** — ~20 kategori terkelompok (Nusantara, Asia, Barat, Lainnya).
- **Makanan** — field opsional untuk mengetik hidangan spesifik (cth: nasi goreng, ramen, sate). Jika kosong, pencarian memakai kategori.
- **Radius & Mood** — batas jarak dan suasana makan.
- **Rekomendasi AI** — kartu rekomendasi berlabel *Rekomendasi AI* (nama, rating, kategori, jarak, estimasi waktu, harga) + ringkasan AI di bagian atas hasil. Setiap kartu punya tombol **Buka di Maps**.
- **Data langsung** — ketika Foursquare Service Key tersedia, rekomendasi memakai restoran nyata di sekitar koordinat; bila gagal/kuota habis, otomatis fallback ke mode *AI-knowledge* (Gemini) lalu cadangan statis.

## Tech Stack

- **React 18 + TypeScript** (Webpack 5 + HMR/Fast Refresh)
- **SASS** (design system glassmorphism gelap)
- **Jest + React Testing Library**
- **Express** (backend & proxy API)
- **Gemini API** (default, gratis) / **OpenAI** (cadangan)
- **Foursquare Places API** (data restoran langsung)
- **Nominatim / OpenStreetMap** (geocoding lokasi)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Buat file `.env` dari contoh:

   ```bash
   cp .env.example .env
   ```

3. Isi minimal `GEMINI_API_KEY` (buat gratis di [Google AI Studio](https://aistudio.google.com)):

   ```dotenv
   GEMINI_API_KEY=...
   GEMINI_MODEL=gemini-3.6-flash
   FOURSQUARE_API_KEY=...
   ```

   - **Gemini**: `-image` models (mis. `gemini-3.1-flash-lite-image`) tidak didukung (kuota gratis 0) dan model `2.x` sudah obsolete — pakai `gemini-3.6-flash`.
   - **Foursquare**: wajib *Service Key* (dashboard → Settings → Service API Keys → Generate). Key lama `fsq3...` dan endpoint `/v3/places/search` sudah tidak berfungsi. Tanpa key ini aplikasi tetap jalan via AI-knowledge.

## Menjalankan

```bash
npm start
```

- Backend (Express): `http://localhost:3000`
- Frontend (Webpack Dev Server, proxy `/api` → 3000): `http://localhost:8080`

Setiap perubahan server (`express.js`) perlu restart, sedangkan frontend hot-reload otomatis.

## Scripts

| Command | Deskripsi |
| --- | --- |
| `npm start` | Jalankan dev (Express + Webpack, HMR) |
| `npm run build` | Build produksi ke `/dist/` |
| `npm run lint` | Jalankan ESLint |
| `npm run lint -- --fix` | Lint + perbaiki otomatis |
| `npm test` | Jalankan Jest (watch) |
| `npx jest --config=configs/jest.json` | Jalankan Jest sekali |
| `npx tsc --noEmit` | Cek tipe TypeScript |

## API

**`POST /api/recommendations`**

```json
{
  "budget": "50000",
  "category": "seafood",
  "radius": "3 km",
  "mood": "Makan santai",
  "city": "Jakarta Selatan",
  "food": "",
  "lat": -6.2088,
  "lng": 106.8456
}
```

Respon berisi `recommendations` (array restoran), `aiSummary`, `source` (`live-ai` | `live-score` | `ai-knowledge`), `offline`, dan `offlineReason`.