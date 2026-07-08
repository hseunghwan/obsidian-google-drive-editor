export interface GraphForceSettings {
  centerStrength: number;
  repelStrength: number;
  linkStrength: number;
  linkDistance: number;
}

export const defaultGraphForceSettings: GraphForceSettings = {
  centerStrength: 0.5,
  repelStrength: 10,
  linkStrength: 1,
  linkDistance: 250
};

export function parseGraphForceSettings(raw: unknown): GraphForceSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    centerStrength: finiteOr(source.centerStrength, defaultGraphForceSettings.centerStrength),
    repelStrength: finiteOr(source.repelStrength, defaultGraphForceSettings.repelStrength),
    linkStrength: finiteOr(source.linkStrength, defaultGraphForceSettings.linkStrength),
    linkDistance: finiteOr(source.linkDistance, defaultGraphForceSettings.linkDistance)
  };
}

function finiteOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
