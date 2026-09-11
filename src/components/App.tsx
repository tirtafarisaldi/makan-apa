import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./../assets/scss/App.scss";

type Restaurant = {
  id: string;
  name: string;
  category: string;
  eta: string;
  distance: number;
  price: number;
  rating: number;
  tag: string;
  description: string;
  vibe: string;
  color: string;
  lat: number;
  lng: number;
};

type FormState = {
  budget: string;
  category: string;
  radius: string;
  mood: string;
  city: string;
  food: string;
};

type RecommendationResponse = {
  recommendations: Restaurant[];
  aiSummary: string;
  placeName?: string;
  offline?: boolean;
  offlineReason?: string;
};

const DEFAULT_COORDS = { lat: -6.2088, lng: 106.8456, label: "Jakarta" };

const fallbackRestaurants: Restaurant[] = [
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

const initialForm: FormState = {
  budget: "50000",
  category: "Semua",
  radius: "3 km",
  mood: "Makan santai",
  city: "Jakarta Selatan",
  food: "",
};

const fieldIcons: Record<string, string> = {
  budget: "💰",
  category: "🍴",
  radius: "📍",
  mood: "🎭",
  city: "🗺️",
  food: "🍲",
};

const emojiForCategory = (category: string) => {
  const c = ` ${category} `.toLowerCase();
  if (
    /indonesian|padang|nusantara|sumba|balinese|javanese|rice|ayam|nasi|rendang|bakso|indian|curry/.test(
      c,
    )
  )
    return "🍛";
  if (/japan|japanese|jepang|sushi|ramen|teppanyaki|yakitori/.test(c))
    return "🍣";
  if (/korea|korean/.test(c)) return "🥢";
  if (/noodle|noodles|mie|ramen|pasta|won ton/.test(c)) return "🍜";
  if (
    /burger|comfort food|fast food|american|kebab|sandwich|fried chicken/.test(
      c,
    )
  )
    return "🍔";
  if (/pizza|italian|western|steak/.test(c)) return "🍕";
  if (/seafood|fish|shrimp|ocean|sushi bar/.test(c)) return "🍤";
  if (/street|jajanan|snack|martabak/.test(c)) return "🥪";
  if (/vegan|vegetarian|healthy|salad/.test(c)) return "🥗";
  if (/brunch|breakfast|pancake/.test(c)) return "🍳";
  if (/coffee|cafe|caf|kopi|bakery|dessert|cake|tea house|cocktail|bar/.test(c))
    return "☕";
  if (/chinese|dim sum|asian|hotpot|taiwanese|thai/.test(c)) return "🥟";
  return "🍽️";
};

const BUDGET_PRESETS = [20000, 50000, 100000];

const formatIDR = (digits: string) => {
  const n = Number(digits || "0");
  return `Rp ${n.toLocaleString("id-ID")}`;
};

const App = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [pickedLocation, setPickedLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [locStatus, setLocStatus] = useState<string>("Mendeteksi lokasi...");
  const [searchQuery, setSearchQuery] = useState<string>(DEFAULT_COORDS.label);
  const searchQueryDirty = useRef<boolean>(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([]);
  const searchTimer = useRef<number | null>(null);

  const fetchRecommendations = async (
    nextForm: FormState,
    coords: { lat: number; lng: number; label: string },
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...nextForm,
          city: coords.label,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch recommendations");
      }

      const data: RecommendationResponse = await response.json();
      if (data.offline) {
        setError(
          data.offlineReason
            ? `Data langsung belum bisa dimuat (${data.offlineReason}) — menampilkan data cadangan.`
            : "Menampilkan data cadangan.",
        );
      }
      if (data.recommendations?.length) {
        setRestaurants(data.recommendations);
        setAiSummary(data.aiSummary || "");
        return;
      }

      throw new Error("Empty recommendation result");
    } catch (fetchError) {
      setError(
        "Gagal memuat rekomendasi, menampilkan data statis sebagai cadangan.",
      );
      const filteredFallback = fallbackRestaurants.filter((restaurant) => {
        const matchesBudget = restaurant.price <= Number(nextForm.budget);
        const radius = Number(nextForm.radius.replace(/[^0-9]/g, "")) || 3;
        const matchesRadius = restaurant.distance <= radius;

        return matchesBudget && matchesRadius;
      });

      const fallbackResult = filteredFallback.length
        ? filteredFallback
        : fallbackRestaurants;

      setRestaurants(fallbackResult);
      setAiSummary("");
    } finally {
      setLoading(false);
    }
  };

  const activeLocation = pickedLocation ?? userLocation ?? DEFAULT_COORDS;

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocStatus("Gunakan lokasi default Jakarta");
      setUserLocation(DEFAULT_COORDS);
      return;
    }

    let settled = false;
    const settle = (loc: typeof DEFAULT_COORDS) => {
      if (settled) return;
      settled = true;
      setUserLocation(loc);
      if (!searchQueryDirty.current) setSearchQuery(loc.label);
    };

    const timeoutId = window.setTimeout(() => {
      setLocStatus("Gunakan lokasi default Jakarta");
      settle(DEFAULT_COORDS);
    }, 6000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        setLocStatus("Lokasi ditemukan");
        settle({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Lokasi Anda saat ini",
        });
      },
      () => {
        window.clearTimeout(timeoutId);
        setLocStatus("Gunakan lokasi default Jakarta");
        settle(DEFAULT_COORDS);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    );
  }, []);

  const runLocationSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setLocStatus("Mencari lokasi...");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=id&limit=6&q=${encodeURIComponent(
          trimmed,
        )}`,
      );
      const results = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      const list = results
        .filter((r) => r && r.lat && r.lon)
        .map((r) => ({
          lat: Number(r.lat),
          lng: Number(r.lon),
          label:
            r.display_name.split(",").slice(0, 3).join(",").trim() ||
            r.display_name,
        }));
      setSearchResults(list);
      if (!list.length) setLocStatus("Lokasi tidak ditemukan. Coba kata lain.");
    } catch (err) {
      setSearchResults([]);
      setLocStatus("Pencarian gagal. Klik peta untuk memilih.");
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(
      () => void runLocationSearch(value),
      350,
    );
  };

  const applySearchResult = (result: {
    lat: number;
    lng: number;
    label: string;
  }) => {
    searchQueryDirty.current = true;
    setSearchQuery(result.label);
    setSearchResults([]);
    setPickedLocation(result);
    setLocStatus("Lokasi dipilih dari pencarian");
  };

  const pickMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocStatus("Geolokasi tidak didukung");
      return;
    }
    setLocStatus("Mendeteksi lokasi Anda...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const label = "Lokasi Anda saat ini";
        searchQueryDirty.current = true;
        setPickedLocation({ lat: latitude, lng: longitude, label });
        setSearchQuery(label);
        setLocStatus("Lokasi Anda dipilih");
      },
      () => {
        setLocStatus("Gagal mengambil lokasi. Coba ketik nama area.");
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    );
  };

  const filteredRestaurants = useMemo(() => {
    const radius = Number(form.radius.replace(/[^0-9]/g, "")) || 3;

    return restaurants.filter((restaurant) => {
      const matchesBudget = restaurant.price <= Number(form.budget);
      const matchesRadius = restaurant.distance <= radius;

      return matchesBudget && matchesRadius;
    });
  }, [restaurants, form]);

  const bestMatch = filteredRestaurants[0] ?? restaurants[0];

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetchRecommendations(form, activeLocation);
    document
      .getElementById("resultsAnchor")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      <span className="food-orn orn-ramen">🍜</span>
      <span className="food-orn orn-sushi">🍣</span>
      <span className="food-orn orn-pizza">🍕</span>
      <span className="food-orn orn-cake">🍰</span>
      <span className="food-orn orn-salad">🥗</span>
      <span className="food-orn orn-pan">🍳</span>
      <span className="food-orn orn-hotpot">🍲</span>
      <span className="food-orn orn-skewer">🍢</span>
      <span className="food-orn orn-burger">🍔</span>
      <span className="food-orn orn-fries">🍟</span>
      <span className="food-orn orn-chicken">🍗</span>
      <span className="food-orn orn-juice">🍹</span>
      <span className="food-orn orn-icecream">🍦</span>
      <span className="food-orn orn-dumpling">🥟</span>
      <span className="food-orn orn-rice">🍚</span>
      <span className="food-orn orn-donut">🍩</span>
      <span className="food-orn orn-steak">🥩</span>
      <span className="food-orn orn-shrimp">🍤</span>

      <header className="hero-header">
        <h1>Makan Apa</h1>
        <p className="hero-sub">
          Temukan rekomendasi makanan terbaik di sekitarmu
        </p>
        <div className="food-divider">🍴</div>
      </header>

      <form className="finder-form" onSubmit={handleSubmit}>
        <section className="location-block">
          <div className="location-block__head">
            <h3 className="location-block__title">📍 Lokasi Rekomendasi</h3>
            <span className="location-block__loc">
              {activeLocation.label} · {locStatus}
            </span>
          </div>
          <div className="location-block__search">
            <span className="location-block__search-icon">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              onBlur={() => setTimeout(() => setSearchResults([]), 180)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const first = searchResults[0];
                  if (first) applySearchResult(first);
                  else void runLocationSearch(searchQuery);
                } else if (event.key === "Escape") {
                  setSearchResults([]);
                }
              }}
              placeholder="Ketik nama kota / area, misal Bandung, Bekasi..."
              aria-label="Cari lokasi"
            />
            <button
              type="button"
              onClick={() =>
                searchResults[0]
                  ? applySearchResult(searchResults[0])
                  : void runLocationSearch(searchQuery)
              }
            >
              Lokasi
            </button>
          </div>
          <button
            type="button"
            className="location-block__current"
            onClick={pickMyLocation}
          >
            📍 Gunakan lokasi saya saat ini
          </button>
          {searchResults.length > 0 ? (
            <ul className="location-block__search-results">
              {searchResults.map((result, index) => (
                <li key={`${result.lat}-${result.lng}-${index}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applySearchResult(result)}
                  >
                    <span className="search-result-pin">📍</span>
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="location-block__hint">
            Temukan lokasimu dari daftar rekomendasi — rekomendasi makanan akan
            dicari di sekitar area ini.
          </p>
        </section>

        <div className="finder-grid">
          <div className="glass-field">
            <span className="label">
              <span className="field-icon">{fieldIcons.budget}</span> Budget
            </span>
            <input
              type="text"
              inputMode="numeric"
              name="budget"
              value={formatIDR(form.budget)}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  budget: event.target.value.replace(/\D/g, ""),
                }))
              }
              aria-label="Budget"
              placeholder="Rp 20.000"
            />
            <div className="preset-chips">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={Number(form.budget) === preset ? "active" : ""}
                  onClick={() =>
                    setForm((prev) => ({ ...prev, budget: String(preset) }))
                  }
                >
                  {preset / 1000}rb
                </button>
              ))}
            </div>
          </div>

          <label className="glass-field">
            <span className="label">
              <span className="field-icon">{fieldIcons.category}</span> Kategori
            </span>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              aria-label="Kategori makanan"
            >
              <option value="Semua">Semua</option>
              <optgroup label="Nusantara">
                <option value="indonesia">Indonesia / Padang</option>
                <option value="seafood">Seafood</option>
              </optgroup>
              <optgroup label="Asia">
                <option value="jepang">Jepang / Sushi / Ramen</option>
                <option value="korea">Korea / BBQ</option>
                <option value="chinese">Tionghoa / Dim Sum</option>
                <option value="mie">Mie &amp; Noodle</option>
                <option value="asian">Asian Fusion</option>
                <option value="indian">India / Curry</option>
                <option value="thai">Thai</option>
              </optgroup>
              <optgroup label="Barat">
                <option value="western">Western / Steak</option>
                <option value="italian">Pizza &amp; Italian</option>
                <option value="burger">Burger</option>
              </optgroup>
              <optgroup label="Lainnya">
                <option value="fast food">Cepat Saji</option>
                <option value="jajanan">Street Food / Jajanan</option>
                <option value="vegetarian">Vegan &amp; Sehat</option>
                <option value="brunch">Brunch &amp; Kafe</option>
                <option value="kopi">Kopi &amp; Bakery</option>
                <option value="dessert">Dessert &amp; Manis</option>
              </optgroup>
            </select>
          </label>

          <label className="glass-field">
            <span className="label">
              <span className="field-icon">{fieldIcons.radius}</span> Radius
            </span>
            <select name="radius" value={form.radius} onChange={handleChange}>
              <option value="1 km">1 km</option>
              <option value="3 km">3 km</option>
              <option value="5 km">5 km</option>
              <option value="10 km">10 km</option>
            </select>
          </label>

          <label className="glass-field">
            <span className="label">
              <span className="field-icon">{fieldIcons.mood}</span> Mood
            </span>
            <select name="mood" value={form.mood} onChange={handleChange}>
              <option value="Makan santai">Makan santai</option>
              <option value="Nongkrong">Nongkrong</option>
              <option value="Date night">Date night</option>
              <option value="Cepat dan praktis">Cepat dan praktis</option>
            </select>
          </label>

          <div className="glass-field field-food">
            <span className="label">
              <span className="field-icon">{fieldIcons.food}</span> Makanan
            </span>
            <input
              type="text"
              name="food"
              value={form.food}
              onChange={handleChange}
              aria-label="Makanan"
              placeholder="cth: nasi goreng, ramen, sate (opsional)"
            />
            <span className="field-hint">Kosongkan untuk memakai kategori</span>
          </div>
        </div>

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Sedang Mencari Rekomendasi..." : "Cari rekomendasi"}
        </button>

        {error ? <div className="status-banner error">{error}</div> : null}
      </form>

      <section className="results-block" id="resultsAnchor">
        {restaurants.length === 0 && !loading ? (
          <div className="results-empty">
            <span className="results-empty__emoji">🍽️</span>
            <p className="results-empty__title">Belum ada rekomendasi.</p>
            <p className="results-empty__hint">
              Pilih lokasi di atas, lalu klik tombol “Cari rekomendasi”.
            </p>
          </div>
        ) : (
          <>
            <div className="results-head">
              <div className="result-chips">
                <span>{form.mood}</span>
                <span>{form.category}</span>
                <span>{form.radius}</span>
                <span>
                  Budget Rp {Number(form.budget).toLocaleString("id-ID")}
                </span>
                {form.food ? <span>🍲 {form.food}</span> : null}
              </div>

              <h2>{loading ? "AI sedang menganalisis..." : bestMatch.name}</h2>

              <p className="result-summary">
                {loading
                  ? "Mencocokkan preferensimu dengan restoran terdekat..."
                  : aiSummary}
              </p>
            </div>

            <div className="card-grid">
              {filteredRestaurants.map((restaurant) => (
                <article className="restaurant-card" key={restaurant.id}>
                  <div
                    className="restaurant-card__cover"
                    style={{
                      background: `linear-gradient(135deg, ${restaurant.color}33, ${restaurant.color}0d 55%, transparent 90%)`,
                    }}
                  >
                    <span className="ai-badge">🤖 Rekomendasi AI</span>
                    <span className="restaurant-card__emoji">
                      {emojiForCategory(restaurant.category)}
                    </span>
                  </div>

                  <div className="restaurant-card__body">
                    <div className="restaurant-card__header">
                      <h3>{restaurant.name}</h3>
                      <strong>{restaurant.rating}★</strong>
                    </div>

                    <div className="restaurant-meta">
                      <span>{restaurant.category}</span>
                      <span>{restaurant.distance.toFixed(1)} km</span>
                      <span>{restaurant.eta}</span>
                    </div>

                    <p>{restaurant.description}</p>

                    <div className="restaurant-card__footer">
                      <span>Rp {restaurant.price.toLocaleString("id-ID")}</span>
                      <a
                        className="maps-link"
                        href={`https://www.google.com/maps?q=${restaurant.lat},${restaurant.lng}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Buka di Maps
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default App;
