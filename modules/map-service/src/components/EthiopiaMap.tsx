'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap, useMapEvent } from 'react-leaflet';
import ClusterLayer, { type ClusterColorMode, type ClusterNode, type LeafNode, weightToColor } from './ClusterLayer';
import EthopaiLayerRenderer from './EthopaiLayerRenderer';
import { buildEthiopiaExample, loadProjectPoints } from './ethiopiaExample';
import PriorityOverlays, { type PriorityZones } from './PriorityOverlays';
import ProjectMarkers, { type Project } from './ProjectMarkers';
import PriorityHeatmap from './PriorityHeatmap';
import RecommendationPanel from './RecommendationPanel';
import PriorityToggle from './PriorityToggle';
import ActionPointMarkers, { type ActionPoint } from './ActionPointMarkers';
import DetailLayer from './DetailLayer';
import RawLayerRenderer from './RawLayerRenderer';
import { ETHOPAI_LAYERS } from '../layers/ethopaiLayers';
import { RAW_LAYERS, type RawLayerConfig } from '../layers/rawLayers';

// ── Map modes ─────────────────────────────────────────────────────────────────

type MapMode =
  | 'standard'
  | 'restoration_priority_score'
  | 'carbon_recovery_potential'
  | 'water_erosion_benefit'
  | 'degraded_restorable_land'
  | 'biodiversity_livelihood_value';

function isEthopaiMode(m: MapMode): boolean {
  return m !== 'standard';
}

type ModeGroup = 'base' | 'ethopai';

const MODES: { id: MapMode; icon: string; group: ModeGroup; labelKey: string }[] = [
  { id: 'standard',                      icon: '🗺️', group: 'base',    labelKey: 'modeStandard' },
  { id: 'restoration_priority_score',    icon: '⭐', group: 'ethopai', labelKey: 'modeOverall' },
  { id: 'carbon_recovery_potential',     icon: '🌳', group: 'ethopai', labelKey: 'modeCarbon' },
  { id: 'water_erosion_benefit',         icon: '💧', group: 'ethopai', labelKey: 'modeWater' },
  { id: 'degraded_restorable_land',      icon: '🏔️', group: 'ethopai', labelKey: 'modeLand' },
  { id: 'biodiversity_livelihood_value', icon: '🦋', group: 'ethopai', labelKey: 'modeBiodiv' },
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
    ethopaiLayers: 'EthopAI Layers',
    ethopaiLayersDesc: 'Show precomputed restoration layers',
    rawLayers: 'Raw Layers',
    rawLayersDesc: 'Show raw layer selector panel',
    clusterColoring: 'Cluster Colouring',
    clusterUniform: 'Uniform',     clusterUniformDesc: 'All clusters one colour',
    clusterAverage: 'Average',     clusterAverageDesc: 'Colour reflects mean score',
    clusterPeak:    'Peak',        clusterPeakDesc:    'Colour reflects highest score',
    language: 'Language',
    regions: 'Regions',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    modeStandard: 'Standard',
    modeOverall: 'Overall',
    modeCarbon: 'Carbon',
    modeWater: 'Water',
    modeLand: 'Land',
    modeBiodiv: 'Biodiversity',
  },
  es: {
    settings: 'Configuración',
    location: 'Ubicación',
    locNone: 'Ninguno',       locNoneDesc: 'Sin datos de ubicación',
    locPoints: 'Puntos',      locPointsDesc: 'Marcadores individuales al acercar',
    locClustered: 'Agrupado', locClusteredDesc: 'Grupos jerárquicos por región',
    regionFiltering: 'Filtro de Región',
    regionFilteringDesc: 'Mostrar panel de selección de regiones',
    ethopaiLayers: 'Capas EthopAI',
    ethopaiLayersDesc: 'Mostrar capas de restauración precalculadas',
    rawLayers: 'Capas sin procesar',
    rawLayersDesc: 'Mostrar panel de selección de capas',
    clusterColoring: 'Color de Grupos',
    clusterUniform: 'Uniforme',    clusterUniformDesc: 'Todos los grupos en un color',
    clusterAverage: 'Promedio',    clusterAverageDesc: 'Color según puntuación media',
    clusterPeak:    'Máximo',      clusterPeakDesc:    'Color según mayor puntuación',
    language: 'Idioma',
    regions: 'Regiones',
    selectAll: 'Seleccionar todo',
    deselectAll: 'Deseleccionar todo',
    modeStandard: 'Estándar',
    modeOverall: 'General',
    modeCarbon: 'Carbono',
    modeWater: 'Agua',
    modeLand: 'Tierra',
    modeBiodiv: 'Biodiversidad',
  },
  de: {
    settings: 'Einstellungen',
    location: 'Standort',
    locNone: 'Keine',          locNoneDesc: 'Keine Standortdaten',
    locPoints: 'Punkte',       locPointsDesc: 'Einzelne Marker beim Hineinzoomen',
    locClustered: 'Gruppiert', locClusteredDesc: 'Hierarchische Gebietsgruppen',
    regionFiltering: 'Gebietsfilter',
    regionFilteringDesc: 'Gebietsauswahl anzeigen',
    ethopaiLayers: 'EthopAI-Ebenen',
    ethopaiLayersDesc: 'Vorausberechnete Wiederherstellungsebenen anzeigen',
    rawLayers: 'Rohdatenebenen',
    rawLayersDesc: 'Auswahl für Rohdatenebenen anzeigen',
    clusterColoring: 'Gruppenfarbe',
    clusterUniform: 'Einheitlich', clusterUniformDesc: 'Alle Gruppen eine Farbe',
    clusterAverage: 'Durchschnitt', clusterAverageDesc: 'Farbe nach Durchschnittswert',
    clusterPeak:    'Maximum',     clusterPeakDesc:    'Farbe nach Höchstwert',
    language: 'Sprache',
    regions: 'Regionen',
    selectAll: 'Alle auswählen',
    deselectAll: 'Alle abwählen',
    modeStandard: 'Standard',
    modeOverall: 'Gesamt',
    modeCarbon: 'Kohlenstoff',
    modeWater: 'Wasser',
    modeLand: 'Boden',
    modeBiodiv: 'Artenvielfalt',
  },
  am: {
    settings: 'ቅንብሮች',
    location: 'አካባቢ',
    locNone: 'ምንም',           locNoneDesc: 'ምንም አካባቢ አይታይም',
    locPoints: 'ነጥቦች',       locPointsDesc: 'ሲቃረቡ ነጠላ ምልክቶች ይታያሉ',
    locClustered: 'ቡድን',     locClusteredDesc: 'ተዋረዳዊ ክልላዊ ቡድኖች',
    regionFiltering: 'ክልል ማጣሪያ',
    regionFilteringDesc: 'የክልል ምርጫ ፓኔል አሳይ',
    ethopaiLayers: 'EthopAI ንብርብሮች',
    ethopaiLayersDesc: 'ቀድሞ የተሰሉ የመልሶ ማቋቋም ንብርብሮችን አሳይ',
    rawLayers: 'ጥሬ ንብርብሮች',
    rawLayersDesc: 'የጥሬ ንብርብር ምርጫ ፓኔል አሳይ',
    clusterColoring: 'የቡድን ቀለም',
    clusterUniform: 'አንድ ቀለም',    clusterUniformDesc: 'ሁሉም ቡድን አንድ ቀለም',
    clusterAverage: 'አማካይ',        clusterAverageDesc: 'አማካይ ክብደት ቀለም',
    clusterPeak:    'ከፍተኛ',       clusterPeakDesc:    'ከፍተኛ ነጥብ ቀለም',
    language: 'ቋንቋ',
    regions: 'ክልሎች',
    selectAll: 'ሁሉንም ምረጥ',
    deselectAll: 'ሁሉንም አቋርጥ',
    modeStandard: 'መደበኛ',
    modeOverall: 'አጠቃላይ',
    modeCarbon: 'ካርቦን',
    modeWater: 'ውሃ',
    modeLand: 'ምድር',
    modeBiodiv: 'ብዝሃ ሕይወት',
  },
} as const;

type TKey = keyof typeof TRANSLATIONS.en;

// ── Tile layers ───────────────────────────────────────────────────────────────

const BASE_TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
};

// ── Geo helpers ───────────────────────────────────────────────────────────────

const ETHIOPIA_CENTER: [number, number] = [9.145, 40.4897];
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
  apiBaseUrl?: string;
  rawLayers?: RawLayerConfig[];
  rawLayerData?: Record<string, any>;
  visibleRawLayerIds?: string[];
}

export default function EthiopiaMap({
  priorityZones,
  projects,
  apiBaseUrl,
  rawLayers = RAW_LAYERS,
  rawLayerData,
  visibleRawLayerIds = [],
}: EthiopiaMapProps) {
  const [boundary, setBoundary] = useState<any>(null);
  const [adminBoundary, setAdminBoundary] = useState<any>(null);
  const [mode, setMode] = useState<MapMode>('standard');
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [clusterNodes, setClusterNodes] = useState<Array<ClusterNode | LeafNode>>([]);
  const [locationMode, setLocationMode] = useState<LocationMode>('clustered');
  const [clusterColorMode, setClusterColorMode] = useState<ClusterColorMode>('average');
  const [regionFilterEnabled, setRegionFilterEnabled] = useState(true);
  const [loadedEthopaiLayerData, setLoadedEthopaiLayerData] = useState<Record<string, any>>({});
  const [rawLayerSelectorEnabled, setRawLayerSelectorEnabled] = useState(false);
  const [selectedRawLayerIds, setSelectedRawLayerIds] = useState<string[]>(visibleRawLayerIds);
  const [loadedRawLayerData, setLoadedRawLayerData] = useState<Record<string, any>>(rawLayerData ?? {});
  const [language, setLanguage] = useState<Language>('en');
  const [showSettings, setShowSettings] = useState(false);
  const [priorityActive, setPriorityActive] = useState(false);
  const [actionPoints, setActionPoints] = useState<ActionPoint[]>([]);

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
    fetch('/api/layers/admin_boundaries')
      .then((r) => r.json())
      .then(async (data) => {
        setAdminBoundary(data);
        const names: string[] = data.features.map((f: any) => f.properties?.shapeName ?? '');
        setSelectedRegions(new Set(names));
        await loadProjectPoints();
        setClusterNodes(buildEthiopiaExample(data.features));
      })
      .catch((e) => console.error('Failed to load admin boundary:', e));
  }, [adminBoundary]);

  useEffect(() => {
    setSelectedRawLayerIds(visibleRawLayerIds);
  }, [visibleRawLayerIds]);

  useEffect(() => {
    if (!rawLayerData) return;
    setLoadedRawLayerData((current) => ({ ...current, ...rawLayerData }));
  }, [rawLayerData]);

  const activeEthopaiLayer = useMemo(
    () => isEthopaiMode(mode) ? ETHOPAI_LAYERS.find((l) => l.id === mode) : undefined,
    [mode],
  );

  useEffect(() => {
    if (!activeEthopaiLayer || loadedEthopaiLayerData[activeEthopaiLayer.id]) return;

    let active = true;

    fetch(`/api/layers/${activeEthopaiLayer.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setLoadedEthopaiLayerData((current) => ({ ...current, [activeEthopaiLayer.id]: data }));
      })
      .catch((e) => console.error(`Failed to load EthopAI layer ${activeEthopaiLayer.id}:`, e));

    return () => {
      active = false;
    };
  }, [activeEthopaiLayer, loadedEthopaiLayerData]);

  useEffect(() => {
    const vectorLayerIds = rawLayers
      .filter((layer) => layer.kind !== 'raster' && selectedRawLayerIds.includes(layer.id) && !loadedRawLayerData[layer.id])
      .map((layer) => layer.id);

    if (vectorLayerIds.length === 0) return;

    let active = true;

    Promise.all(
      vectorLayerIds.map(async (layerId) => {
        try {
          const response = await fetch(`/api/layers/${layerId}`);
          if (!response.ok) return null;
          return [layerId, await response.json()] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setLoadedRawLayerData((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, any]>),
      }));
    });

    return () => {
      active = false;
    };
  }, [loadedRawLayerData, rawLayers, selectedRawLayerIds]);

  const outsideMask = useMemo(
    () => (boundary ? createOutsideMask(boundary) : null),
    [boundary],
  );

  const regionNames: string[] = useMemo(
    () => adminBoundary?.features.map((f: any) => f.properties?.shapeName ?? '') ?? [],
    [adminBoundary],
  );

  const allSelected = regionNames.length > 0 && regionNames.every((n) => selectedRegions.has(n));
  const allRawLayersSelected = rawLayers.length > 0 && rawLayers.every((layer) => selectedRawLayerIds.includes(layer.id));

  // Region panel visible when the setting is on and regions are loaded
  const showRegionPanel = regionFilterEnabled && regionNames.length > 0;
  const showRawLayerPanel = rawLayerSelectorEnabled && rawLayers.length > 0;
  const rawPanelLeft = 16 + (showRegionPanel ? 194 : 0);

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

  function toggleRawLayer(layerId: string) {
    setSelectedRawLayerIds((current) =>
      current.includes(layerId)
        ? current.filter((id) => id !== layerId)
        : [...current, layerId],
    );
  }

  function toggleAllRawLayers() {
    setSelectedRawLayerIds(allRawLayersSelected ? [] : rawLayers.map((layer) => layer.id));
  }

  const tile = BASE_TILE;

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
        {MODES.map((m, idx) => {
          const label = t(m.labelKey as TKey);
          const showDivider = idx > 0 && m.group !== MODES[idx - 1].group;
          return (
            <Fragment key={m.id}>
              {showDivider && (
                <div style={{ height: 1, background: '#e5e7eb', margin: '2px 0' }} />
              )}
              <button
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
            </Fragment>
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

          {/* Raw layer selection */}
          <div style={SECTION_HEADER}>{t('rawLayers')}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={rawLayerSelectorEnabled}
              onChange={(e) => setRawLayerSelectorEnabled(e.target.checked)}
              style={{ accentColor: '#16a34a', cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: '#374151' }}>{t('rawLayersDesc')}</span>
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

      {/* ── Raw layer selector — hidden until enabled in settings ─────────── */}
      {showRawLayerPanel && (
        <div style={{
          position: 'absolute', top: 16, left: rawPanelLeft, zIndex: 1000,
          background: 'white', borderRadius: 10, padding: '10px 12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', width: 230,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'system-ui,sans-serif', fontWeight: 600, fontSize: 13, color: '#111827' }}>
              {t('rawLayers')}
            </span>
            <button
              onClick={toggleAllRawLayers}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#16a34a', fontFamily: 'system-ui,sans-serif', padding: '2px 4px' }}
            >
              {allRawLayersSelected ? t('deselectAll') : t('selectAll')}
            </button>
          </div>
          {rawLayers.map((layer) => (
            <label key={layer.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', cursor: 'pointer', fontFamily: 'system-ui,sans-serif', fontSize: 12, color: '#374151', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={selectedRawLayerIds.includes(layer.id)}
                onChange={() => toggleRawLayer(layer.id)}
                style={{ accentColor: '#16a34a', cursor: 'pointer', marginTop: 1, flexShrink: 0 }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: '#111827', fontWeight: 600, lineHeight: 1.25 }}>{layer.name}</span>
                <span style={{ display: 'block', color: '#9ca3af', fontSize: 11, lineHeight: 1.25, marginTop: 2 }}>{layer.subtitle}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <MapContainer
        center={ETHIOPIA_CENTER}
        zoom={6}
        minZoom={2}
        maxZoom={18}
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

        {/* Outside-Ethiopia context mask keeps Ethiopia visually highlighted. */}
        {outsideMask && (
          <GeoJSON
            data={outsideMask as any}
            interactive={false}
            style={{ color: '#111827', weight: 0, fillColor: '#111827', fillOpacity: 0.65, fillRule: 'evenodd' }}
          />
        )}

        <RawLayerRenderer
          layers={rawLayers}
          apiBaseUrl={apiBaseUrl}
          visibleLayerIds={selectedRawLayerIds}
          vectorData={loadedRawLayerData}
        />

        {activeEthopaiLayer && (
          <EthopaiLayerRenderer
            layer={activeEthopaiLayer}
            data={loadedEthopaiLayerData[activeEthopaiLayer.id]}
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

        {/* Projects shown via cluster/points system */}

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

        <PriorityHeatmap visible={priorityActive} />
        <DetailLayer visible={priorityActive} />
        <ActionPointMarkers points={actionPoints} />
      </MapContainer>

      <PriorityToggle active={priorityActive} onToggle={() => setPriorityActive((v) => !v)} />
      <RecommendationPanel visible={priorityActive} onClose={() => setPriorityActive(false)} onResults={setActionPoints} />
    </section>
  );
}
