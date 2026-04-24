import { Router } from "express";

const router = Router();

router.get("/forecast", async (req, res) => {
  const lat = Number.parseFloat(String(req.query.lat ?? ""));
  const lon = Number.parseFloat(String(req.query.lon ?? ""));
  const daysRaw = Number.parseInt(String(req.query.days ?? "4"), 10);
  const days = Number.isFinite(daysRaw) ? Math.max(3, Math.min(7, daysRaw)) : 4;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat/lon obbligatori" });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(days));

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return res.status(502).json({ error: "Meteo temporaneamente non disponibile" });
    }
    const data = await response.json();
    const out = (data?.daily?.time || []).map((day, i) => ({
      date: day,
      weather_code: data.daily.weather_code?.[i] ?? null,
      temp_max_c: data.daily.temperature_2m_max?.[i] ?? null,
      temp_min_c: data.daily.temperature_2m_min?.[i] ?? null,
      rain_prob_pct: data.daily.precipitation_probability_max?.[i] ?? null,
    }));
    return res.json({
      provider: "open-meteo",
      latitude: data?.latitude ?? lat,
      longitude: data?.longitude ?? lon,
      days: out,
    });
  } catch {
    return res.status(502).json({ error: "Errore nel recupero meteo" });
  }
});

export default router;
