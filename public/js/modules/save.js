import { BUILDINGS } from './data.js';

const SAVE_KEY = 'infra-clicker-save-v1';
const SAVE_VERSION = 1;

export function createDefaultState() {
  return {
    version: SAVE_VERSION,
    requests: 0,
    lifetimeRequests: 0,
    manualClicks: 0,
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
    temporaryBonus: null
  };
}

export class SaveManager {
  constructor(onStatus) {
    this.onStatus = onStatus;
  }

  normalize(raw) {
    const defaults = createDefaultState();
    return {
      ...defaults,
      ...raw,
      buildings: { ...defaults.buildings, ...(raw?.buildings || {}) },
      upgrades: Array.isArray(raw?.upgrades) ? raw.upgrades : [],
      achievements: Array.isArray(raw?.achievements) ? raw.achievements : [],
      certifications: Array.isArray(raw?.certifications) ? raw.certifications : [],
      commandsUsed: Array.isArray(raw?.commandsUsed) ? raw.commandsUsed : [],
      activeEvent: null
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
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
    return this.normalize(parsed);
  }

  reset() {
    localStorage.removeItem(SAVE_KEY);
    return createDefaultState();
  }
}
