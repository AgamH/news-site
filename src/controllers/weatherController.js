const { httpError } = require('../utils/httpError');
const { logEvent } = require('../services/logService');

// The spec allows the weather widget to lag up to 15 minutes; caching for 5 minutes keeps it
// well inside that, while meaning thousands of readers only ever cause one upstream call per
// 5 minutes rather than one per page view.
const CACHE_TTL_MS = 5 * 60 * 1000;
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const WEATHER_DESCRIPTIONS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

let cache = null; // { data, fetchedAt } | null

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Weather provider responded ${response.status}`);
  return response.json();
}

function mapProviderResponse(city, payload) {
  const current = payload.current;
  return {
    city,
    tempC: Math.round(current.temperature_2m * 10) / 10,
    feelsLikeC: Math.round(current.apparent_temperature * 10) / 10,
    description: WEATHER_DESCRIPTIONS[current.weather_code] || 'Unknown conditions',
    humidity: current.relative_humidity_2m,
    windKph: Math.round(current.wind_speed_10m * 10) / 10,
  };
}

async function fetchFromProvider() {
  const city = process.env.WEATHER_CITY || 'New York';
  const searchName = city.split(',')[0].trim();
  const geocodingParams = new URLSearchParams({
    name: searchName,
    count: '1',
    language: 'en',
    format: 'json',
  });
  const geocoding = await fetchJson(`${GEOCODING_URL}?${geocodingParams}`);
  const place = geocoding.results && geocoding.results[0];
  if (!place) throw new Error(`Weather location not found: ${searchName}`);

  const forecastParams = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });
  const forecast = await fetchJson(`${FORECAST_URL}?${forecastParams}`);
  if (!forecast.current) throw new Error('Weather provider returned no current conditions.');
  return mapProviderResponse(place.name || searchName, forecast);
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