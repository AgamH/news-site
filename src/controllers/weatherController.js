const { httpError } = require('../utils/httpError');
const { logEvent } = require('../services/logService');

// The spec allows the weather widget to lag up to 15 minutes; caching for 5 minutes keeps it
// well inside that, while meaning thousands of readers only ever cause one upstream call per
// 5 minutes rather than one per page view.
const CACHE_TTL_MS = 5 * 60 * 1000;
const PROVIDER_URL = 'https://api.openweathermap.org/data/2.5/weather';

let cache = null; // { data, fetchedAt } | null

function mapProviderResponse(payload) {
  return {
    city: payload.name || '',
    tempC: Math.round(payload.main.temp * 10) / 10,
    feelsLikeC: Math.round(payload.main.feels_like * 10) / 10,
    description: (payload.weather && payload.weather[0] && payload.weather[0].description) || '',
    humidity: payload.main.humidity,
    windKph: Math.round(payload.wind.speed * 3.6 * 10) / 10, // provider gives m/s; the UI wants km/h
  };
}

async function fetchFromProvider() {
  const apiKey = process.env.WEATHER_API_KEY;
  const city = process.env.WEATHER_CITY || 'Tel Aviv,IL';
  if (!apiKey) throw new Error('WEATHER_API_KEY is not configured.');

  const url = `${PROVIDER_URL}?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather provider responded ${response.status}`);
  return mapProviderResponse(await response.json());
}

async function getWeather(req, res) {
  const isFresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) {
    res.json({ ...cache.data, updatedAt: new Date(cache.fetchedAt).toISOString() });
    return;
  }

  try {
    const data = await fetchFromProvider();
    cache = { data, fetchedAt: Date.now() };
    res.json({ ...data, updatedAt: new Date(cache.fetchedAt).toISOString() });
  } catch (error) {
    logEvent({ level: 'warn', message: 'Weather provider request failed', source: 'weather', req, stack: error.stack }).catch(() => {});

    // Serve a stale reading rather than nothing, if one exists — the home page already
    // treats anything over 15 minutes old as unavailable, so this degrades gracefully.
    if (cache) {
      res.json({ ...cache.data, updatedAt: new Date(cache.fetchedAt).toISOString() });
      return;
    }
    throw httpError(502, 'Weather is temporarily unavailable.');
  }
}

module.exports = { getWeather };
