'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap, useMapEvent } from 'react-leaflet';
import ClusterLayer, { type ClusterColorMode, type ClusterNode, type LeafNode, weightToColor } from './ClusterLayer';
import { buildEthiopiaExample } from './ethiopiaExample';
import PriorityOverlays, { type PriorityZones } from './PriorityOverlays';
import ProjectMarkers, { type Project } from './ProjectMarkers';

// ── Map modes ─────────────────────────────────────────────────────────────────

type MapMode = 'standard' | 'satellite' | 'biodiversity' | 'livelihood';

const MODES: { id: MapMode; icon: string }[] = [
  { id: 'standard',     icon: '🗺️' },
  { id: 'satellite',    icon: '🛰️' },
  { id: 'biodiversity', icon: '🌿' },
  { id: 'livelihood',   icon: '🌾' },
];

// ── Location modes ────────────────────────────────────────────────────────────

type LocationMode = 'none' | 'points' | 'clustered';

// ── Language / i18n ───────────────────────────────────────────────────────────

type Language = 'en' | 'es' | 'am' | 'de';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'de', label: 'Deutsch' },
  { id: 'am', label: 'አማርኛ' },
];

const TRANSLATIONS = {
  en: {
    settings: 'Settings',
    location: 'Location',
    locNone: 'None',          locNoneDesc: 'No location data shown',
    locPoints: 'Points',      locPointsDesc: 'Individual markers, visible at zoom ≥ 9',
    locClustered: 'Clustered', locClusteredDesc: 'Hierarchical region clusters',
    regionFiltering: 'Region Filtering',
    regionFilteringDesc: 'Show region selector panel',
    clusterColoring: 'Cluster Colouring',
    clusterUniform: 'Uniform',     clusterUniformDesc: 'All clusters one colour',
    clusterAverage: 'Average',     clusterAverageDesc: 'Colour reflects mean score',
    clusterPeak:    'Peak',        clusterPeakDesc:    'Colour reflects highest score',
    language: 'Language',
    regions: 'Regions',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    modeStandard: 'Standard',
    modeSatellite: 'Satellite',
    modeBiodiversity: 'Biodiversity',
    modeLivelihood: 'Livelihood',
  },
  es: {
    settings: 'Configuración',
    location: 'Ubicación',
    locNone: 'Ninguno',       locNoneDesc: 'Sin datos de ubicación',
    locPoints: 'Puntos',      locPointsDesc: 'Marcadores individuales al acercar',
    locClustered: 'Agrupado', locClusteredDesc: 'Grupos jerárquicos por región',
    regionFiltering: 'Filtro de Región',
    regionFilteringDesc: 'Mostrar panel de selección de regiones',
    clusterColoring: 'Color de Grupos',
    clusterUniform: 'Uniforme',    clusterUniformDesc: 'Todos los grupos en un color',
    clusterAverage: 'Promedio',    clusterAverageDesc: 'Color según puntuación media',
    clusterPeak:    'Máximo',      clusterPeakDesc:    'Color según mayor puntuación',
    language: 'Idioma',
    regions: 'Regiones',
    selectAll: 'Seleccionar todo',
    deselectAll: 'Deseleccionar todo',
    modeStandard: 'Estándar',
    modeSatellite: 'Satélite',
    modeBiodiversity: 'Biodiversidad',
    modeLivelihood: 'Sustento',
  },
  de: {
    settings: 'Einstellungen',
    location: 'Standort',
    locNone: 'Keine',          locNoneDesc: 'Keine Standortdaten',
    locPoints: 'Punkte',       locPointsDesc: 'Einzelne Marker beim Hineinzoomen',
    locClustered: 'Gruppiert', locClusteredDesc: 'Hierarchische Gebietsgruppen',
    regionFiltering: 'Gebietsfilter',
    regionFilteringDesc: 'Gebietsauswahl anzeigen',
    clusterColoring: 'Gruppenfarbe',
    clusterUniform: 'Einheitlich', clusterUniformDesc: 'Alle Gruppen eine Farbe',
    clusterAverage: 'Durchschnitt', clusterAverageDesc: 'Farbe nach Durchschnittswert',
    clusterPeak:    'Maximum',     clusterPeakDesc:    'Farbe nach Höchstwert',
    language: 'Sprache',
    regions: 'Regionen',
    selectAll: 'Alle auswählen',
    deselectAll: 'Alle abwählen',
    modeStandard: 'Standard',
    modeSatellite: 'Satellit',
    modeBiodiversity: 'Artenvielfalt',
    modeLivelihood: 'Lebensunterhalt',
  },
  am: {
    settings: 'ቅንብሮች',
    location: 'አካባቢ',
    locNone: 'ምንም',           locNoneDesc: 'ምንም አካባቢ አይታይም',
    locPoints: 'ነጥቦች',       locPointsDesc: 'ሲቃረቡ ነጠላ ምልክቶች ይታያሉ',
    locClustered: 'ቡድን',     locClusteredDesc: 'ተዋረዳዊ ክልላዊ ቡድኖች',
    regionFiltering: 'ክልል ማጣሪያ',
    regionFilteringDesc: 'የክልል ምርጫ ፓኔል አሳይ',
    clusterColoring: 'የቡድን ቀለም',
    clusterUniform: 'አንድ ቀለም',    clusterUniformDesc: 'ሁሉም ቡድን አንድ ቀለም',
    clusterAverage: 'አማካይ',        clusterAverageDesc: 'አማካይ ክብደት ቀለም',
    clusterPeak:    'ከፍተኛ',       clusterPeakDesc:    'ከፍተኛ ነጥብ ቀለም',
    language: 'ቋንቋ',
    regions: 'ክልሎች',
    selectAll: 'ሁሉንም ምረጥ',
    deselectAll: 'ሁሉንም አቋርጥ',
    modeStandard: 'መደበኛ',
    modeSatellite: 'ሳተላይት',
    modeBiodiversity: 'ብዝሃ ሕይወት',
    modeLivelihood: 'ኑሮ',
  },
} as const;

type TKey = keyof typeof TRANSLATIONS.en;

// ── Tile layers ───────────────────────────────────────────────────────────────

const TILE_LAYERS: Record<MapMode, { url: string; attribution: string }> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
  satellite: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
  biodiversity: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
  livelihood: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
};

// ── Geo helpers ───────────────────────────────────────────────────────────────

const ETHIOPIA_CENTER: [number, number] = [9.145, 40.4897];
const ETHIOPIA_BOUNDS: [[number, number], [number, number]] = [[2.8, 32.7], [15.3, 48.4]];
const WORLD_RING = [[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]];

function extractExteriorRings(geojson: any) {
  const rings: any[] = [];
  const read = (geometry: any) => {
    if (!geometry) return;
    if (geometry.type === 'Polygon') rings.push(geometry.coordinates[0]);
    if (geometry.type === 'MultiPolygon')
      geometry.coordinates.forEach((p: any) => rings.push(p[0]));
  };
  if (geojson.type === 'FeatureCollection') geojson.features.forEach((f: any) => read(f.geometry));
  else if (geojson.type === 'Feature') read(geojson.geometry);
  else read(geojson);
  return rings;
}

function createOutsideMask(boundary: any) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [WORLD_RING, ...extractExteriorRings(boundary)],
    },
  };
}

// ── Cluster helpers ───────────────────────────────────────────────────────────

function extractLeaves(nodes: Array<ClusterNode | LeafNode>): LeafNode[] {
  return nodes.flatMap((n) => (n.type === 'leaf' ? [n] : extractLeaves(n.children)));
}

// ── Raw points layer (Points mode) ────────────────────────────────────────────

function RawPointsLayer({ leaves, color = '#1d4ed8', radius = 5, minZoom = 9 }: {
  leaves: LeafNode[];
  color?: string;
  radius?: number;
  /** Minimum map zoom at which individual points are rendered. */
  minZoom?: number;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvent('zoomend', () => setZoom(map.getZoom()));
  if (zoom < minZoom) return null;
  return (
    <>
      {leaves.map((node) => (
        <CircleMarker
          key={node.id}
          center={[node.lat, node.lng]}
          radius={radius}
          pathOptions={{
            color: 'white',
            weight: 1,
            fillColor: node.weight != null ? weightToColor(node.weight) : color,
            fillOpacity: 0.9,
          }}
        >
          {node.label && (
            <Popup>
              <div style={{ fontFamily: 'system-ui,sans-serif', fontSize: 12, minWidth: 110 }}>
                <strong>{node.label}</strong>
                {node.weight != null && (
                  <div style={{ marginTop: 4, color: '#374151' }}>
                    Weight:{' '}
                    <span style={{ color: weightToColor(node.weight), fontWeight: 700 }}>
                      {node.weight.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </Popup>
          )}
        </CircleMarker>
      ))}
    </>
  );
}

// ── Shared UI styles ──────────────────────────────────────────────────────────

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 10,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
  fontFamily: 'system-ui,sans-serif',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface EthiopiaMapProps {
  priorityZones?: PriorityZones;
  projects?: Project[];
}

export default function EthiopiaMap({ priorityZones, projects }: EthiopiaMapProps) {
  const [boundary, setBoundary] = useState<any>(null);
  const [adminBoundary, setAdminBoundary] = useState<any>(null);
  const [mode, setMode] = useState<MapMode>('standard');
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [clusterNodes, setClusterNodes] = useState<Array<ClusterNode | LeafNode>>([]);
  const [locationMode, setLocationMode] = useState<LocationMode>('clustered');
  const [clusterColorMode, setClusterColorMode] = useState<ClusterColorMode>('average');
  const [regionFilterEnabled, setRegionFilterEnabled] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [showSettings, setShowSettings] = useState(false);

  const t = (key: TKey) => TRANSLATIONS[language][key];

  // Load country outline
  useEffect(() => {
    fetch('/data/ethiopia-boundary.geojson')
      .then((r) => r.json())
      .then(setBoundary)
      .catch((e) => console.error('Failed to load Ethiopia boundary:', e));
  }, []);

  // Load admin regions eagerly — needed for region selector and clustering
  useEffect(() => {
    if (adminBoundary) return;
    fetch('/data/ethiopia-admin.geojson')
      .then((r) => r.json())
      .then((data) => {
        setAdminBoundary(data);
        const names: string[] = data.features.map((f: any) => f.properties?.shapeName ?? '');
        setSelectedRegions(new Set(names));
        setClusterNodes(buildEthiopiaExample(data.features));
      })
      .catch((e) => console.error('Failed to load admin boundary:', e));
  }, [adminBoundary]);

  const outsideMask = useMemo(
    () => (boundary ? createOutsideMask(boundary) : null),
    [boundary],
  );

  const regionNames: string[] = useMemo(
    () => adminBoundary?.features.map((f: any) => f.properties?.shapeName ?? '') ?? [],
    [adminBoundary],
  );

  const allSelected = regionNames.length > 0 && regionNames.every((n) => selectedRegions.has(n));

  // Region panel visible when the setting is on and regions are loaded
  const showRegionPanel = regionFilterEnabled && regionNames.length > 0;

  // Filter cluster nodes whose region is deselected (when panel is active)
  const filteredClusterNodes = useMemo(() => {
    if (!showRegionPanel) return clusterNodes;
    return clusterNodes.filter(
      (node) => node.type === 'leaf' || selectedRegions.has(node.label ?? ''),
    );
  }, [clusterNodes, selectedRegions, showRegionPanel]);

  // Flat leaves for Points mode (inherits region filtering from filteredClusterNodes)
  const flatLeaves = useMemo(() => extractLeaves(filteredClusterNodes), [filteredClusterNodes]);

  function toggleRegion(name: string) {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelectedRegions(allSelected ? new Set() : new Set(regionNames));
  }

  const tile = TILE_LAYERS[mode];

  const locationModeOptions: { id: LocationMode; label: string; desc: string }[] = [
    { id: 'none',      label: t('locNone'),      desc: t('locNoneDesc') },
    { id: 'points',    label: t('locPoints'),     desc: t('locPointsDesc') },
    { id: 'clustered', label: t('locClustered'),  desc: t('locClusteredDesc') },
  ];

  return (
    <section className="map-shell" aria-label="Map of Ethiopia" style={{ position: 'relative' }}>

      {/* ── Mode switcher — top-right ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'white', borderRadius: 10, padding: 5,
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      }}>
        {MODES.map((m) => {
          const label = t(`mode${m.id.charAt(0).toUpperCase()}${m.id.slice(1)}` as TKey);
          return (
            <button
              key={m.id}
              title={label}
              onClick={() => setMode(m.id)}
              aria-label={label}
              aria-pressed={mode === m.id}
              style={{
                width: 38, height: 38, border: 'none', borderRadius: 7,
                cursor: 'pointer', fontSize: 20, lineHeight: 1,
                background: mode === m.id ? '#dcfce7' : 'transparent',
                outline: mode === m.id ? '2px solid #16a34a' : '2px solid transparent',
                transition: 'background 0.15s, outline 0.15s',
              }}
            >
              {m.icon}
            </button>
          );
        })}
      </div>

      {/* ── Settings button — bottom-right ────────────────────────────────── */}
      <button
        title={t('settings')}
        onClick={() => setShowSettings((v) => !v)}
        aria-label={t('settings')}
        aria-pressed={showSettings}
        style={{
          position: 'absolute', bottom: 32, right: 16, zIndex: 1000,
          width: 42, height: 42, border: 'none', borderRadius: 10,
          cursor: 'pointer', fontSize: 20, lineHeight: 1,
          background: showSettings ? '#dcfce7' : 'white',
          outline: showSettings ? '2px solid #16a34a' : '2px solid transparent',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          transition: 'background 0.15s, outline 0.15s',
        }}
      >
        ⚙️
      </button>

      {/* ── Settings panel ────────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{
          position: 'absolute', bottom: 32, right: 66, zIndex: 1000,
          background: 'white', borderRadius: 10, padding: '14px 16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)', minWidth: 220,
          fontFamily: 'system-ui,sans-serif',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 14 }}>
            {t('settings')}
          </div>

          {/* Location */}
          <div style={SECTION_HEADER}>{t('location')}</div>
          {locationModeOptions.map((lm) => (
            <label
              key={lm.id}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="radio"
                name="locationMode"
                value={lm.id}
                checked={locationMode === lm.id}
                onChange={() => setLocationMode(lm.id)}
                style={{ accentColor: '#16a34a', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
              />
              <span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{lm.label}</span>
                <br />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{lm.desc}</span>
              </span>
            </label>
          ))}

          {/* Cluster colouring sub-option — visible only when Clustered is selected */}
          {locationMode === 'clustered' && (() => {
            const opts: { id: ClusterColorMode; label: string; desc: string }[] = [
              { id: 'uniform', label: t('clusterUniform'), desc: t('clusterUniformDesc') },
              { id: 'average', label: t('clusterAverage'), desc: t('clusterAverageDesc') },
              { id: 'peak',    label: t('clusterPeak'),    desc: t('clusterPeakDesc') },
            ];
            return (
              <div style={{ marginLeft: 18, marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #e5e7eb' }}>
                <div style={{ ...SECTION_HEADER, marginBottom: 4 }}>{t('clusterColoring')}</div>
                {opts.map((o) => (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="radio"
                      name="clusterColorMode"
                      value={o.id}
                      checked={clusterColorMode === o.id}
                      onChange={() => setClusterColorMode(o.id)}
                      style={{ accentColor: '#16a34a', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
                    />
                    <span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{o.label}</span>
                      <br />
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{o.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            );
          })()}

          <div style={{ height: 1, background: '#f3f4f6', margin: '12px 0' }} />

          {/* Region filtering */}
          <div style={SECTION_HEADER}>{t('regionFiltering')}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={regionFilterEnabled}
              onChange={(e) => setRegionFilterEnabled(e.target.checked)}
              style={{ accentColor: '#16a34a', cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: '#374151' }}>{t('regionFilteringDesc')}</span>
          </label>

          <div style={{ height: 1, background: '#f3f4f6', margin: '12px 0' }} />

          {/* Language */}
          <div style={SECTION_HEADER}>{t('language')}</div>
          {LANGUAGES.map((lang) => (
            <label
              key={lang.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="radio"
                name="language"
                value={lang.id}
                checked={language === lang.id}
                onChange={() => setLanguage(lang.id)}
                style={{ accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: '#374151' }}>{lang.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* ── Region selector — top-left ────────────────────────────────────── */}
      {showRegionPanel && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 1000,
          background: 'white', borderRadius: 10, padding: '10px 12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', minWidth: 170,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'system-ui,sans-serif', fontWeight: 600, fontSize: 13, color: '#111827' }}>
              {t('regions')}
            </span>
            <button
              onClick={toggleAll}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#16a34a', fontFamily: 'system-ui,sans-serif', padding: '2px 4px' }}
            >
              {allSelected ? t('deselectAll') : t('selectAll')}
            </button>
          </div>
          {regionNames.map((name) => (
            <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer', fontFamily: 'system-ui,sans-serif', fontSize: 12, color: '#374151', userSelect: 'none' }}>
              <input type="checkbox" checked={selectedRegions.has(name)} onChange={() => toggleRegion(name)} style={{ accentColor: '#16a34a', cursor: 'pointer' }} />
              {name}
            </label>
          ))}
        </div>
      )}

      <MapContainer
        center={ETHIOPIA_CENTER}
        zoom={6}
        minZoom={6}
        maxZoom={18}
        maxBounds={ETHIOPIA_BOUNDS}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        className="ethiopia-map"
      >
        <TileLayer key={mode} attribution={tile.attribution} url={tile.url} />

        {/* Region borders — visible in all modes when region filtering is enabled */}
        {regionFilterEnabled && adminBoundary &&
          adminBoundary.features.map((feature: any) => {
            const name: string = feature.properties?.shapeName ?? '';
            const active = !showRegionPanel || selectedRegions.has(name);
            return (
              <GeoJSON
                key={`${name}-${active}`}
                data={feature}
                interactive={true}
                style={{
                  color: '#374151',
                  weight: 1.5,
                  fillColor: active ? '#ffffff' : '#111827',
                  fillOpacity: active ? 0.05 : 0.75,
                }}
                onEachFeature={(_, layer) => {
                  layer.bindTooltip(name, { permanent: false, direction: 'center' });
                }}
              />
            );
          })
        }

        {/* Outside-Ethiopia dark mask */}
        {outsideMask && (
          <GeoJSON
            data={outsideMask as any}
            interactive={false}
            style={{ color: '#111827', weight: 0, fillColor: '#111827', fillOpacity: 0.65, fillRule: 'evenodd' }}
          />
        )}

        {/* Country border — fallback when region borders are hidden */}
        {boundary && !regionFilterEnabled && (
          <GeoJSON
            data={boundary}
            interactive={false}
            style={{ color: '#111827', weight: 2, fillOpacity: 0 }}
          />
        )}

        {priorityZones && <PriorityOverlays zones={priorityZones} />}
        {projects && <ProjectMarkers projects={projects} />}

        {/* Location layer */}
        {locationMode === 'clustered' && filteredClusterNodes.length > 0 && (
          <ClusterLayer
            nodes={filteredClusterNodes}
            clusterColor="#2563eb"
            leafColor="#1d4ed8"
            leafRadius={5}
            clusterColorMode={clusterColorMode}
          />
        )}
        {locationMode === 'points' && flatLeaves.length > 0 && (
          <RawPointsLayer leaves={flatLeaves} />
        )}
      </MapContainer>
    </section>
  );
}
