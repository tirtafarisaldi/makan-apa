const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");

// ---- minimal .env loader (no external deps) ----
(function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
})();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const HAS_AI_KEY = Boolean(OPENAI_API_KEY || GEMINI_API_KEY);
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || "";

const app = express();
const portNumber = 3000;
const sourceDir = "dist";

// ---- generic https helpers (Node 16 compatible) ----
function httpGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "makan-apa-app/1.0", ...headers } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (err) {
            reject(new Error(`Bad JSON from ${url}: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

function httpPostJson(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (err) {
            reject(new Error(`Bad JSON: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(25000, () => req.destroy(new Error("timeout")));
    req.write(body);
    req.end();
  });
}

// ---- static fallback dataset (used when API keys absent / fail) ----
const fallbackRestaurants = [
  {
    id: "1",
    name: "Nasi Padang Rasa Baru",
    category: "Padang",
    eta: "8 min",
    distance: 1.2,
    price: 25000,
    rating: 4.8,
    tag: "Favorit lokal",
    description:
      "Rendang, gulai, dan sambal dengan rasa kaya dan harga ramah kantong.",
    vibe: "Cocok untuk siang hari",
    color: "#ff9b54",
    lat: -6.2,
    lng: 106.816,
  },
  {
    id: "2",
    name: "Mie Ayam Bintang",
    category: "Mie",
    eta: "12 min",
    distance: 2.3,
    price: 18000,
    rating: 4.6,
    tag: "Paling laris",
    description:
      "Kaldu gurih, topping ayam suwir, dan mie kenyal yang sangat cocok untuk santai.",
    vibe: "Nyaman dan cepat",
    color: "#f87171",
    lat: -6.21,
    lng: 106.822,
  },
  {
    id: "3",
    name: "Sushi House Cozy",
    category: "Japan",
    eta: "18 min",
    distance: 3.1,
    price: 65000,
    rating: 4.9,
    tag: "Premium",
    description:
      "Pilihan modern dengan rasa premium dan atmosfer yang cocok untuk hangout.",
    vibe: "Date night",
    color: "#60a5fa",
    lat: -6.19,
    lng: 106.81,
  },
  {
    id: "4",
    name: "Kebab Kota",
    category: "Fast Casual",
    eta: "7 min",
    distance: 1.4,
    price: 22000,
    rating: 4.5,
    tag: "Cepat",
    description:
      "Kebab isi daging dan sayur yang pas untuk makan praktis dan mengenyangkan.",
    vibe: "Ringan dan mengenyangkan",
    color: "#34d399",
    lat: -6.205,
    lng: 106.819,
  },
];

const CATEGORY_ALIASES = {
  semua: [],
  all: [],
  jepang: ["japanese", "sushi", "ramen", "japan", "udon", "tempura", "izakaya"],
  japanese: [
    "japanese",
    "sushi",
    "ramen",
    "japan",
    "udon",
    "tempura",
    "izakaya",
  ],
  japan: ["japanese", "sushi", "ramen", "japan", "udon", "tempura", "izakaya"],
  korea: ["korean", "korea", "bbq"],
  korean: ["korean", "korea", "bbq"],
  indonesia: ["indonesian", "indonesia", "nusantara", "padang", "nasi"],
  indonesian: ["indonesian", "indonesia", "nusantara", "padang", "nasi"],
  nusantara: ["indonesian", "indonesia", "nusantara", "padang", "nasi"],
  padang: ["padang", "minang", "rendang"],
  mie: ["noodle", "ramen", "udon", "mie", "pasta"],
  noodle: ["noodle", "ramen", "udon", "mie", "pasta"],
  western: [
    "american",
    "burger",
    "pizza",
    "italian",
    "french",
    "western",
    "steak",
  ],
  barat: [
    "american",
    "burger",
    "pizza",
    "italian",
    "french",
    "western",
    "steak",
  ],
  burger: ["american", "burger", "western", "fast"],
  pizza: ["pizza", "italian", "western"],
  italian: ["italian", "pizza", "pasta", "western"],
  "fast food": ["fast food", "american", "burger", "quick", "street"],
  cepat: ["fast food", "american", "burger", "quick", "street"],
  kopi: ["coffee", "coffee shop", "cafe", "bistro"],
  coffee: ["coffee", "coffee shop", "cafe", "bistro"],
  dessert: ["dessert", "bakery", "cake", "ice cream", "gelato"],
  "dim sum": ["dim sum", "chinese", "cantonese", "asiatis"],
  chinese: ["chinese", "dim sum", "cantonese", "asian"],
  asian: ["asian", "vietnamese", "thai", "chinese", "indian"],
  seafood: ["seafood", "fish", "ocean", "shrimp", "crab"],
  indian: ["indian", "curry", "tandoori"],
  thai: ["thai", "pad thai", "tom yum"],
  vegetarian: ["vegetarian", "vegan", "veggie", "salad", "healthy"],
  brunch: ["brunch", "breakfast", "pancake", "smoothie", "hash"],
  jajanan: [
    "street food",
    "jajanan",
    "snack",
    "bakso",
    "sate",
    "martabak",
    "waffle",
  ],
};

const matchesCategory = (restaurant, input) => {
  const raw = (input || "").toLowerCase().trim();
  if (!raw || raw === "semua" || raw === "all") return true;

  const hay = `${restaurant.category} ${restaurant.name}`.toLowerCase();
  if (hay.includes(raw)) return true;

  const exact = CATEGORY_ALIASES[raw];
  if (exact && exact.some((k) => hay.includes(k))) return true;

  return Object.entries(CATEGORY_ALIASES).some(
    ([key, kws]) =>
      raw.split(/\s+/).some((word) => key === word || key.includes(word)) &&
      kws.some((k) => hay.includes(k)),
  );
};

const PRICE_TO_IDR = { 1: 20000, 2: 40000, 3: 90000, 4: 200000 };
const PALETTE = [
  "#ff9b54",
  "#f87171",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#c084fc",
  "#f472b6",
  "#22d3ee",
];

const moodProfiles = {
  "Makan santai": {
    keyword: "rileks",
    expectation: "suasana tenang dan tidak terburu-buru",
  },
  Nongkrong: {
    keyword: "nongkrong",
    expectation: "tempat nyaman untuk ngobrol lama",
  },
  "Date night": {
    keyword: "spesial",
    expectation: "atmosfer romantis dan kesan premium",
  },
  "Cepat dan praktis": {
    keyword: "cepat",
    expectation: "waktu tunggu singkat dan praktis",
  },
};

const scoreRestaurant = (restaurant, form, radiusNumber) => {
  let score = restaurant.rating * 10;
  const budget = Number(form.budget) || 50000;
  const priceFit = Math.max(
    0,
    1 - Math.abs(restaurant.price - budget) / budget,
  );
  score += priceFit * 28;
  score += Math.max(0, 1 - restaurant.distance / radiusNumber) * 16;
  return score;
};

const buildStaticRecommendations = (form, radiusNumber) => {
  return fallbackRestaurants
    .filter((r) => {
      const okBudget = r.price <= Number(form.budget);
      const okRadius = r.distance <= radiusNumber;
      const okCat = matchesCategory(r, form.category);
      return okBudget && okRadius && okCat;
    })
    .sort(
      (a, b) =>
        scoreRestaurant(b, form, radiusNumber) -
        scoreRestaurant(a, form, radiusNumber),
    );
};

const fallbackAiSummary = (form, restaurant) => {
  if (!restaurant) return "Belum ada rekomendasi yang cocok.";
  const mood = moodProfiles[form.mood] || moodProfiles["Makan santai"];
  return `Untuk mood ${form.mood}, ${restaurant.name} paling cocok di area ${
    form.city
  } — ${
    mood.expectation
  }, harganya sekitar Rp ${restaurant.price.toLocaleString(
    "id-ID",
  )} dan berjarak ${restaurant.distance.toFixed(1)} km dari lokasimu.`;
};

// ---- real integrations ----
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const { status, body } = await httpGetJson(url);
  if (status !== 200 || !body) throw new Error("reverse geocode failed");
  const parts = [
    body.address?.quarter,
    body.address?.suburb,
    body.address?.city_district,
    body.address?.municipality,
    body.address?.city,
    body.address?.state,
  ].filter(Boolean);
  return parts[0] || body.name || "Lokasi Anda";
}

async function searchRestaurants(
  lat,
  lng,
  radiusMeters,
  limit = 15,
  food = "",
) {
  if (!FOURSQUARE_API_KEY) throw new Error("FOURSQUARE_API_KEY missing");
  const fields = [
    "fsq_place_id",
    "name",
    "categories",
    "distance",
    "rating",
    "price",
    "latitude",
    "longitude",
    "location",
  ].join(",");
  const query = food ? `&query=${encodeURIComponent(food)}` : "";
  const url = `https://places-api.foursquare.com/places/search?ll=${lat},${lng}&radius=${radiusMeters}&limit=${limit}&sort=POPULARITY&fields=${fields}${query}`;
  const { status, body } = await httpGetJson(url, {
    Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
    "X-Places-Api-Version": "2025-06-17",
  });
  if (status !== 200)
    throw new Error(
      `Foursquare error ${status}: ${JSON.stringify(body).slice(0, 200)}`,
    );
  return (body.results || []).map(mapFoursquarePlace);
}

function mapFoursquarePlace(place, index) {
  const distM = place.distance ?? 0;
  const priceTier = place.price ?? 2;
  const category =
    place.categories?.[0]?.short_name ||
    place.categories?.[0]?.name ||
    "Restoran";

  return {
    id: place.fsq_place_id || place.fsq_id || `fsq-${index}`,
    name: place.name,
    category,
    eta: `${Math.max(3, Math.round(distM / 70))} min`,
    distance: Math.round((distM / 1000) * 100) / 100,
    price: PRICE_TO_IDR[priceTier] ?? 45000,
    rating: place.rating ?? 4.0,
    tag: "Restoran terdekat",
    description:
      place.location?.formatted_address ||
      place.location?.locality ||
      "Terdekat dari lokasimu",
    vibe: category,
    color: PALETTE[index % PALETTE.length],
    lat: place.latitude ?? place.geocodes?.main?.latitude ?? 0,
    lng: place.longitude ?? place.geocodes?.main?.longitude ?? 0,
  };
}

function parseJsonText(text) {
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Gagal membaca JSON dari AI: ${cleaned.slice(0, 120)}`);
  }
}

async function chatJSON(
  system,
  user,
  { temperature = 0.7, maxTokens = 800 } = {},
) {
  if (GEMINI_API_KEY) {
    const model = GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY,
    )}`;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { status, body } = await httpPostJson(
        url,
        {},
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        },
      );
      if (status === 200) {
        const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        try {
          return parseJsonText(text);
        } catch (parseError) {
          if (attempt < 3) {
            console.warn(
              `[Gemini] respons JSON tidak valid (percobaan ${attempt}) — coba lagi dengan budget lebih besar`,
            );
            await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
            continue;
          }
          throw new Error(`Gagal membaca respons AI: ${text.slice(0, 200)}`);
        }
      }
      if ((status === 429 || status === 500 || status === 503) && attempt < 3) {
        const message = body?.error?.message || "";
        console.warn(
          `[Gemini] ${
            message || `status ${status}`
          } (percobaan ${attempt}) — coba lagi dalam ${attempt * 1200}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }
      throw new Error(
        `Gemini error ${status}: ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
  }

  if (OPENAI_API_KEY) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { status, body } = await httpPostJson(
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${OPENAI_API_KEY}` },
        {
          model: OPENAI_MODEL,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
      );
      if (status === 200) {
        const content = body.choices?.[0]?.message?.content || "{}";
        return parseJsonText(content);
      }
      if ((status === 429 || status === 500 || status === 503) && attempt < 3) {
        console.warn(
          `[OpenAI] status ${status} (percobaan ${attempt}) — coba lagi dalam ${
            attempt * 1200
          }ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }
      throw new Error(
        `OpenAI error ${status}: ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
  }

  throw new Error(
    "Tidak ada API key AI — isi GEMINI_API_KEY (gratis) atau OPENAI_API_KEY",
  );
}

async function aiRecommend(form, restaurants) {
  const listText = restaurants
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} (${r.category}) — ~Rp ${r.price.toLocaleString(
          "id-ID",
        )}, ${r.distance.toFixed(1)} km, rating ${r.rating}.`,
    )
    .join("\n");

  const system = [
    "Kamu adalah asisten rekomendasi kuliner di Indonesia.",
    "Pengguna memberimu preferensi dan daftar restoran NYATA di dekat lokasinya.",
    "Pilih rekomendasi yang paling cocok. Jawab HANYA dengan JSON:",
    '{"best":"nama persis restoran","picks":["nama1","nama2","nama3"],"reasoning":"penjelasan 1-2 kalimat dalam Bahasa Indonesia"}',
    'Pastikan "best" dan "picks" memakai NAMA PERSIS yang ada di daftar.',
  ].join("\n");

  const user = `Preferensi saya: budget Rp ${Number(form.budget).toLocaleString(
    "id-ID",
  )}, mood ${form.mood}, kategori ${form.category}, radius ${
    form.radius
  }, area ${form.city}${
    form.food ? `, fokus makanan yang diminta: ${form.food}` : ""
  }.\n\nDaftar restoran terdekat:\n${listText}`;

  const json = await chatJSON(system, user, {
    temperature: 0.6,
    maxTokens: 600,
  });

  const byName = new Map(restaurants.map((r) => [r.name, r]));
  const picked = [json.best, ...(json.picks || [])]
    .filter(Boolean)
    .map((name) => byName.get(name))
    .filter(Boolean);

  const keep = [...picked, ...restaurants];
  const unique = [...new Map(keep.map((r) => [r.id, r])).values()];

  return {
    recommendations: unique.slice(0, 9),
    summary:
      json.reasoning ||
      `Berdasarkan preferensimu, ${json.best} adalah pilihan terbaik di daftar restoran terdekat.`,
  };
}

async function aiKnowledge(form, areaLabel) {
  if (!HAS_AI_KEY)
    throw new Error(
      "Tidak ada API key AI — isi GEMINI_API_KEY (gratis) atau OPENAI_API_KEY",
    );

  const budget = Number(form.budget) || 50000;

  const system = [
    "Kamu adalah asisten rekomendasi kuliner di Indonesia.",
    "Data live tidak tersedia, jadi kamu menyarankan tempat makan langsung dari pengetahuanmu.",
    'Jawab HANYA dengan JSON: {"reasoning":"...","places":[{"name":"...","category":"...","price":30000,"rating":4.5,"distance_km":1.2,"description":"..."}]}',
    "Berikan 4-6 tempat makan yang masuk akal ada di area tersebut (boleh restoran terkenal asli bila kamu tahu).",
    "price = estimasi biaya per orang dalam Rupiah. rating = desimal 3.5-5.0. distance_km = angka perkiraan.",
    "description = 1 kalimat singkat (maks 15 kata).",
    "Semua penjelasan dalam Bahasa Indonesia.",
  ].join("\n");

  const user = `Area: ${areaLabel}.\nPreferensi saya: budget Rp ${budget.toLocaleString(
    "id-ID",
  )}, mood ${form.mood}, kategori ${form.category}, radius ${form.radius}${
    form.food ? `, fokus makanan yang diminta: ${form.food}` : ""
  }.`;

  const json = await chatJSON(system, user, {
    temperature: 0.7,
    maxTokens: 2000,
  });
  const places = (json.places || []).slice(0, 8);

  const spread = (index) => {
    const radiusKm = 0.6;
    const angle = index * 0.7;
    const dLat = (radiusKm * Math.cos(angle)) / 111;
    const cosLng = Math.cos(((form.lat || 0) * Math.PI) / 180) || 0.5;
    const dLng = (radiusKm * Math.sin(angle)) / (111 * cosLng);
    return {
      lat: (form.lat || 0) + dLat,
      lng: (form.lng || 0) + dLng,
    };
  };

  const recommendations = places
    .filter((p) => p && p.name)
    .map((p, index) => {
      const distanceKm = Math.max(0.3, Number(p.distance_km) || 1);
      return {
        id: `ai-${index + 1}`,
        name: p.name,
        category: p.category || "Restoran",
        eta: `${Math.max(3, Math.round((distanceKm * 1000) / 70))} min`,
        distance: Math.round(distanceKm * 100) / 100,
        price: Number(p.price) > 0 ? Number(p.price) : 30000,
        rating: Math.min(5, Math.max(3.5, Number(p.rating) || 4)),
        tag: "Rekomendasi AI",
        description:
          p.description || "Direkomendasikan AI berdasarkan preferensimu.",
        vibe: p.category || "Rekomendasi AI",
        color: PALETTE[index % PALETTE.length],
        ...spread(index),
      };
    });

  return {
    recommendations,
    summary:
      json.reasoning ||
      `Berdasarkan preferensimu, ${
        recommendations[0]?.name || "berikut"
      } adalah pilihan terbaik.`,
  };
}

// ---- express app ----
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/recommendations", async (req, res) => {
  const form = {
    budget: String(req.body?.budget || "50000"),
    category: req.body?.category || "Semua",
    radius: req.body?.radius || "3 km",
    mood: req.body?.mood || "Makan santai",
    city: req.body?.city || "area sekitarmu",
    food: String(req.body?.food || "").trim(),
    lat: Number(req.body?.lat),
    lng: Number(req.body?.lng),
  };

  const hasCoords = Number.isFinite(form.lat) && Number.isFinite(form.lng);
  const radiusNumber =
    Number((form.radius || "3 km").replace(/[^0-9]/g, "")) || 3;
  const radiusMeters = radiusNumber * 1000;

  let placeName = "";
  let directError = null;

  if (hasCoords) {
    try {
      placeName = await reverseGeocode(form.lat, form.lng);
    } catch (err) {
      placeName = "";
    }
  }

  // Path 1: data live dari Foursquare
  if (hasCoords && FOURSQUARE_API_KEY) {
    try {
      const live = await searchRestaurants(
        form.lat,
        form.lng,
        radiusMeters,
        15,
        form.food,
      );

      const pool = live.filter((r) => {
        const okBudget = r.price <= Number(form.budget);
        const okRadius = r.distance <= radiusNumber;
        return okBudget && okRadius && matchesCategory(r, form.category);
      });

      if (pool.length) {
        try {
          const ai = await aiRecommend(form, pool);
          return res.json({
            recommendations: ai.recommendations,
            aiSummary: ai.summary,
            placeName,
            offline: false,
            source: "live-ai",
          });
        } catch (aiError) {
          console.error("[OpenAI-reorder] ", aiError.message);
          const sorted = [...pool].sort(
            (a, b) =>
              scoreRestaurant(b, form, radiusNumber) -
              scoreRestaurant(a, form, radiusNumber),
          );
          return res.json({
            recommendations: sorted,
            aiSummary: fallbackAiSummary(form, sorted[0]),
            placeName,
            offline: false,
            source: "live-score",
          });
        }
      }
    } catch (err) {
      console.error("[Foursquare] ", err.message);
      if (err.message && !/timeout/i.test(err.message)) {
        directError = err.message.slice(0, 200);
      }
    }
  } else if (!FOURSQUARE_API_KEY) {
    directError = "FOURSQUARE_API_KEY tidak valid / tidak terisi";
  }

  // Path 2: rekomendasi AI dari pengetahuan (kalau Foursquare gagal / kosong)
  if (HAS_AI_KEY) {
    try {
      const ai = await aiKnowledge(form, placeName || form.city);
      if (ai.recommendations.length) {
        return res.json({
          recommendations: ai.recommendations,
          aiSummary: ai.summary,
          placeName,
          offline: false,
          source: "ai-knowledge",
        });
      }
      directError = "AI tidak menghasilkan rekomendasi.";
    } catch (aiErr) {
      console.error("[AI-knowledge] ", aiErr.message);
      directError = aiErr.message.slice(0, 200);
    }
  } else {
    directError = directError || "GEMINI_API_KEY / OPENAI_API_KEY kosong";
  }

  // Path 3: cadangan statis
  const staticPool = buildStaticRecommendations(form, radiusNumber);
  const fromStatic = staticPool.length ? staticPool : fallbackRestaurants;
  return res.json({
    recommendations: fromStatic,
    aiSummary: fallbackAiSummary(form, fromStatic[0]),
    placeName,
    offline: true,
    offlineReason: directError,
  });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(sourceDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    return res.sendFile(path.join(__dirname, sourceDir, "index.html"));
  });
}

app.listen(portNumber, () => {
  console.log(`Express web server started: http://localhost:${portNumber}`);
  if (process.env.NODE_ENV === "production") {
    console.log(`Serving content from /${sourceDir}/`);
  }
  if (!FOURSQUARE_API_KEY) {
    console.warn(
      "⚠  FOURSQUARE_API_KEY belum diset — rekomendasi memakai data statis.",
    );
  }
  if (!HAS_AI_KEY) {
    console.warn(
      "⚠  GEMINI_API_KEY / OPENAI_API_KEY belum diset — AI rekomendasi memakai heuristik.",
    );
  }
});
