export type EthopaiLayerConfig = {
  id: string;
  name: string;
  subtitle: string;
  scoreProperty: string;
  maxScore: number;
};

export const ETHOPAI_LAYERS: EthopaiLayerConfig[] = [
  {
    id: 'restoration_priority_score',
    name: 'Restoration Priority Score',
    subtitle: 'Overall restoration opportunity',
    scoreProperty: 'restoration_priority_score',
    maxScore: 14,
  },
  {
    id: 'degraded_restorable_land',
    name: 'Degraded Restorable Land',
    subtitle: 'Restorable land condition score',
    scoreProperty: 'degraded_restorable_land_score',
    maxScore: 56,
  },
  {
    id: 'carbon_recovery_potential',
    name: 'Carbon Recovery Potential',
    subtitle: 'Carbon opportunity score',
    scoreProperty: 'carbon_recovery_score',
    maxScore: 100,
  },
  {
    id: 'water_erosion_benefit',
    name: 'Water Erosion Benefit',
    subtitle: 'Water retention and erosion benefit',
    scoreProperty: 'water_erosion_score',
    maxScore: 100,
  },
  {
    id: 'biodiversity_livelihood_value',
    name: 'Biodiversity Livelihood Value',
    subtitle: 'Biodiversity and livelihood co-benefit',
    scoreProperty: 'biodiversity_livelihood_score',
    maxScore: 80,
  },
];

export const DEFAULT_ETHOPAI_LAYER_ID = 'restoration_priority_score';
