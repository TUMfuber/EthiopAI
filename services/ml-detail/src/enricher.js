const TIMEOUT = 3000;

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(timer); }
}

export async function fetchNDVI(lat, lng) {
  const url = `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=${lat}&longitude=${lng}&kmAboveBelow=0&kmLeftRight=0`;
  const data = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!data?.subset?.length) return null;
  const last = data.subset[data.subset.length - 1];
  const val = last.data?.[0];
  return val != null ? val * 0.0001 : null; // MODIS scale factor
}

export async function fetchPrecipitation(lat, lng) {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=precipitation_sum&timezone=auto`;
  const data = await fetchWithTimeout(url);
  if (!data?.daily?.precipitation_sum) return null;
  const vals = data.daily.precipitation_sum.filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export async function fetchSoilCarbon(lat, lng) {
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&property=soc&depth=0-30cm&value=mean`;
  const data = await fetchWithTimeout(url);
  const layer = data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;
  return layer != null ? layer / 10 : null; // dg/kg -> g/kg
}

export async function fetchElevation(lat, lng) {
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
  const data = await fetchWithTimeout(url);
  return data?.results?.[0]?.elevation ?? null;
}

export async function enrichCell(lat, lng) {
  const [ndvi, precipitation, soil_carbon, elevation] = await Promise.all([
    fetchNDVI(lat, lng),
    fetchPrecipitation(lat, lng),
    fetchSoilCarbon(lat, lng),
    fetchElevation(lat, lng),
  ]);
  return { ndvi, precipitation, soil_carbon, elevation };
}
