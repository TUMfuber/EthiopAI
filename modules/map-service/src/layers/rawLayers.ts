export type RawLayerKind = 'raster' | 'mixed';

export type RawLayerLegendItem = {
  label: string;
  color: string;
};

export type RawLayerConfig = {
  id: string;
  name: string;
  kind: RawLayerKind;
  group: 'raw';
  defaultVisible: false;
  showInLayerControls: false;
  subtitle: string;
  source: string;
  tileUrl?: string;
  attribution?: string;
  opacity?: number;
  minZoom?: number;
  minNativeZoom?: number;
  maxNativeZoom?: number;
  legend?: RawLayerLegendItem[];
};

export const RAW_LAYERS: RawLayerConfig[] = [
  {
    id: 'key_biodiversity_areas',
    name: 'Key Biodiversity Areas',
    kind: 'mixed',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'KBA - 2026',
    source: 'KBA Global Dataset',
  },
  {
    id: 'rgb',
    name: 'Sentinel-2 True Color',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'Sentinel-2 - 2026 Q1',
    source: 'Sentinel-2 quarterly least-cloud mosaic',
    tileUrl: '/api/tiles/rgb/{z}/{x}/{y}',
    attribution: 'Sentinel-2 L2A via Copernicus Data Space Sentinel Hub',
    opacity: 1,
    minZoom: 6,
    minNativeZoom: 6,
  },
  {
    id: 'ndvi',
    name: 'Sentinel-2 NDVI',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'Sentinel-2 NDVI - 2026 Q1',
    source: 'Sentinel-2 quarterly least-cloud mosaic',
    tileUrl: '/api/tiles/ndvi/{z}/{x}/{y}',
    attribution: 'Sentinel-2 L2A via Copernicus Data Space Sentinel Hub',
    opacity: 0.72,
    minZoom: 6,
    minNativeZoom: 6,
  },
  {
    id: 'forest_loss',
    name: 'Global Forest Watch Tree Cover Loss',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'GFW / UMD - 2001-2024',
    source: 'Global Forest Watch / UMD tree cover loss',
    tileUrl: 'https://tiles.globalforestwatch.org/umd_tree_cover_loss/latest/dynamic/{z}/{x}/{y}.png?start_year=2001&end_year=2024',
    attribution: 'UMD/GLAD tree cover loss via Global Forest Watch',
    opacity: 0.82,
  },
  {
    id: 'rainfall',
    name: 'CHIRP Rainfall',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'CHIRP v3 - Sep 2025-Feb 2026',
    source: 'CHC CHIRP v3 six-month rainfall accumulation',
    tileUrl: '/api/tiles/chirp-rainfall/{z}/{x}/{y}',
    attribution: 'Climate Hazards Center CHIRP v3',
    opacity: 0.72,
  },
  {
    id: 'srtm_slope',
    name: 'SRTM Slope',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'SRTM / Mapzen - static',
    source: 'Mapzen terrain tiles derived from SRTM and other open elevation sources',
    tileUrl: '/api/tiles/srtm-slope/{z}/{x}/{y}',
    attribution: 'Mapzen terrain tiles',
    opacity: 0.72,
  },
  {
    id: 'dynamic_world_coverage',
    name: 'Dynamic World Land Cover',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'IO / Esri - 2023',
    source: 'Impact Observatory / Esri 10m annual LULC 2023 via Microsoft Planetary Computer',
    tileUrl: 'https://planetarycomputer.microsoft.com/api/data/v1/mosaic/5e9321fcce88b105d9523c3889722d44/tiles/WebMercatorQuad/{z}/{x}/{y}?collection=io-lulc-annual-v02&assets=data&colormap_name=io-lulc-9-class&format=png',
    attribution: 'Impact Observatory, Esri, Microsoft; CC BY 4.0; tiles via Microsoft Planetary Computer',
    opacity: 0.82,
    legend: [
      { label: 'Water', color: '#419bdf' },
      { label: 'Trees', color: '#397d49' },
      { label: 'Flooded vegetation', color: '#7a87c6' },
      { label: 'Crops', color: '#e49635' },
      { label: 'Built area', color: '#c4281b' },
      { label: 'Bare ground', color: '#a59b8f' },
      { label: 'Snow / ice', color: '#a8ebff' },
      { label: 'Clouds', color: '#616161' },
      { label: 'Rangeland', color: '#e3e2c3' },
    ],
  },
  {
    id: 'gsocseq_soil_carbon',
    name: 'FAO Soil Organic Carbon',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'FAO GSOCseq - 2021',
    source: 'FAO GSOCseq WMTS',
    tileUrl: 'https://data.apps.fao.org/map/wmts/wmts?layer=fao-gismgr/GSOCSEQ/mapsets/RSR&style=default&tilematrixset=WebMercatorQuad&Service=WMTS&request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}&layertype=Image',
    attribution: 'FAO GSOCseq',
    opacity: 0.78,
  },
  {
    id: 'roads_settlements',
    name: 'OpenStreetMap Roads & Settlements',
    kind: 'raster',
    group: 'raw',
    defaultVisible: false,
    showInLayerControls: false,
    subtitle: 'OSM HOT - current',
    source: 'OpenStreetMap Humanitarian tiles',
    tileUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: 'OpenStreetMap contributors, HOT style',
    opacity: 0.62,
  },
];

export const RAW_LAYER_QUERY_PARAM = 'rawLayers';

export function parseRawLayerIds(value: string | null, layers: RawLayerConfig[] = RAW_LAYERS) {
  if (!value) return [];

  const availableIds = new Set(layers.map((layer) => layer.id));
  const requestedIds = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (requestedIds.includes('all')) {
    return layers.map((layer) => layer.id);
  }

  return requestedIds.filter((id) => availableIds.has(id));
}
