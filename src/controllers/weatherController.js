const CACHE_TTL_MS = 15 * 60 * 1000;
let cache = { city: null, fetchedAt: 0, data: null };

async function fetchFromProvider(city) {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  const response = await fetch(url, { headers: { 'User-Agent': 'the-daily-web-weather-widget' } });
  if (!response.ok) throw Object.assign(new Error('Weather provider request failed.'), { statusCode: 502 });
  const payload = await response.json();
  const current = payload.current_condition?.[0];
  if (!current) throw Object.assign(new Error('Weather provider returned no data.'), { statusCode: 502 });
  return {
    city,
    temperatureC: Number(current.temp_C),
    feelsLikeC: Number(current.FeelsLikeC),
    description: current.weatherDesc?.[0]?.value || '',
    humidity: Number(current.humidity),
    fetchedAt: new Date().toISOString(),
  };
}

async function getWeather(req, res) {
  const city = String(req.query.city || process.env.WEATHER_CITY || 'Tel Aviv').trim().slice(0, 100);
  const isFresh = cache.data && cache.city === city && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

  if (isFresh) return res.json(cache.data);

  try {
    const data = await fetchFromProvider(city);
    cache = { city, fetchedAt: Date.now(), data };
    return res.json(data);
  } catch (error) {
    if (cache.data && cache.city === city) {
      return res.json({ ...cache.data, stale: true });
    }
    throw error;
  }
}

module.exports = { getWeather };