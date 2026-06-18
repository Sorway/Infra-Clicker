import { ACHIEVEMENTS, BUILDINGS } from './data.js';

const SAVE_KEY = 'infra-clicker-save-v1';
const SAVE_VERSION = 1;
const INTEGRITY_SALT = 'infra-clicker::integrity::2026';

function integrityPayload(state) {
  return {
    version: state.version,
    requests: state.requests,
    lifetimeRequests: state.lifetimeRequests,
    manualClicks: state.manualClicks,
    criticalClicks: state.criticalClicks,
    bestCombo: state.bestCombo,
    buildings: state.buildings,
    upgrades: state.upgrades,
    achievements: state.achievements,
    certifications: state.certifications,
    certificationPoints: state.certificationPoints,
    prestigeCount: state.prestigeCount,
    eventsCompleted: state.eventsCompleted,
    commandsUsed: state.commandsUsed,
    exported: state.exported,
    maxBuyUsed: state.maxBuyUsed,
    startedAt: state.startedAt,
    lastTick: state.lastTick,
    lastSaved: state.lastSaved,
    soundEnabled: state.soundEnabled,
    antiCheatViolations: state.antiCheatViolations
  };
}

function checksum(state) {
  const input = `${INTEGRITY_SALT}:${JSON.stringify(integrityPayload(state))}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function hasValidIntegrity(state) {
  return typeof state.integrity === 'string' && state.integrity === checksum(state);
}

function hasValidStructure(state) {
  const finiteNonNegative = value => Number.isFinite(value) && value >= 0;
  if (!finiteNonNegative(state.requests) || !finiteNonNegative(state.lifetimeRequests)) return false;
  if (!state.buildings || typeof state.buildings !== 'object' || Array.isArray(state.buildings)) return false;
  if (!Array.isArray(state.upgrades) || !Array.isArray(state.achievements) || !Array.isArray(state.certifications)) return false;
  if (state.upgrades.length > 100 || state.achievements.length > 200 || state.certifications.length > 50) return false;
  return Object.values(state.buildings).every(value => Number.isInteger(value) && value >= 0 && value <= 1000000);
}

export function createDefaultState() {
  return {
    version: SAVE_VERSION,
    requests: 0,
    lifetimeRequests: 0,
    manualClicks: 0,
    criticalClicks: 0,
    bestCombo: 0,
    combo: 0,
    lastManualClick: 0,
    overclockCharge: 0,
    overclockEndsAt: 0,
    buildings: Object.fromEntries(BUILDINGS.map(building => [building.id, 0])),
    upgrades: [],
    achievements: [],
    certifications: [],
    certificationPoints: 0,
    prestigeCount: 0,
    eventsCompleted: 0,
    commandsUsed: [],
    exported: false,
    maxBuyUsed: false,
    startedAt: Date.now(),
    lastTick: Date.now(),
    lastSaved: Date.now(),
    soundEnabled: true,
    activeEvent: null,
    temporaryBonus: null,
    antiCheatViolations: 0,
    lastAntiCheatWarning: 0,
    integrity: null
  };
}

export class SaveManager {
  constructor(onStatus) {
    this.onStatus = onStatus;
  }

  normalize(raw) {
    const defaults = createDefaultState();
    const state = {
      ...defaults,
      ...raw,
      buildings: { ...defaults.buildings, ...(raw?.buildings || {}) },
      upgrades: Array.isArray(raw?.upgrades) ? raw.upgrades : [],
      achievements: Array.isArray(raw?.achievements)
        ? raw.achievements.filter(id => typeof id === 'string' && ACHIEVEMENTS.some(achievement => achievement.id === id))
        : [],
      certifications: Array.isArray(raw?.certifications) ? raw.certifications : [],
      commandsUsed: Array.isArray(raw?.commandsUsed) ? raw.commandsUsed : [],
      activeEvent: null
    };
    state.combo = 0;
    state.lastManualClick = 0;
    return state;
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      if (parsed.integrity && !hasValidIntegrity(parsed)) {
        const clean = createDefaultState();
        clean.loadWarning = 'Sauvegarde modifiée détectée : progression réinitialisée.';
        return clean;
      }
      const state = this.normalize(parsed);
      const elapsed = Math.min(8 * 60 * 60, Math.max(0, (Date.now() - (state.lastTick || Date.now())) / 1000));
      state.offlineSeconds = elapsed;
      return state;
    } catch (error) {
      console.warn('Sauvegarde invalide, nouvelle partie.', error);
      return createDefaultState();
    }
  }

  save(state) {
    try {
      state.lastSaved = Date.now();
      state.lastTick = Date.now();
      state.integrity = checksum(state);
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      this.onStatus?.(`Sauvegardé à ${new Date().toLocaleTimeString('fr-FR')}`);
      return true;
    } catch (error) {
      this.onStatus?.('Échec de la sauvegarde');
      return false;
    }
  }

  import(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.requests !== 'number') {
      throw new Error('Format de sauvegarde invalide');
    }
    if (!hasValidStructure(parsed)) {
      throw new Error('Valeurs de sauvegarde invalides');
    }
    if (!parsed.integrity || !hasValidIntegrity(parsed)) {
      throw new Error('Sauvegarde non signée ou modifiée');
    }
    return this.normalize(parsed);
  }

  reset() {
    localStorage.removeItem(SAVE_KEY);
    return createDefaultState();
  }
}
