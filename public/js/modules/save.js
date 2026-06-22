import { ACHIEVEMENTS, ACTIVE_DLC, BUILDINGS } from './data.js';

const LEGACY_SAVE_KEY = 'infra-clicker-save-v1';
const SAVE_KEY = `clicker-save-${ACTIVE_DLC.id}-v1`;
const SAVE_VERSION = 2;
const V2_RESET_NOTICE_KEY = 'infra-clicker-v2-reset-notice-seen';

const LEGACY_SKILL_COSTS = {
  automation: 1,
  capacity: 2,
  finops: 2,
  sre: 3,
  edge: 3,
  platform: 4,
  resilience: 5,
  architect: 8
};

export function consumeV2ResetNotice() {
  if (localStorage.getItem(V2_RESET_NOTICE_KEY)) return false;

  try {
    const raw = localStorage.getItem(SAVE_KEY) || (ACTIVE_DLC.id === 'infra' ? localStorage.getItem(LEGACY_SAVE_KEY) : null);
    if (!raw || JSON.parse(raw)?.version !== 1) return false;
    localStorage.setItem(V2_RESET_NOTICE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function createDefaultState() {
  return {
    version: SAVE_VERSION,
    dlcId: ACTIVE_DLC.id,
    requests: 0,
    lifetimeRequests: 0,
    allTimeRequests: 0,
    manualClicks: 0,
    criticalClicks: 0,
    bestCombo: 0,
    combo: 0,
    lastManualClick: 0,
    overclockCharge: 0,
    overclockEndsAt: 0,
    productionHistory: [],
    dailyMissions: null,
    totalBuildingsPurchased: 0,
    buildings: Object.fromEntries(BUILDINGS.map(building => [building.id, 0])),
    upgrades: [],
    achievements: [],
    certifications: [],
    certificationPoints: 0,
    prestigeCount: 0,
    completedAt: 0,
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
    const legacySkills = Array.isArray(raw?.permanentSkills)
      ? [...new Set(raw.permanentSkills.filter(id => Object.hasOwn(LEGACY_SKILL_COSTS, id)))]
      : [];
    const refundedPoints = legacySkills.reduce((total, id) => total + LEGACY_SKILL_COSTS[id], 0);
    const state = {
      ...defaults,
      ...raw,
      buildings: Object.fromEntries(BUILDINGS.map(building => [
        building.id,
        Math.max(0, Number(raw?.buildings?.[building.id]) || 0)
      ])),
      upgrades: Array.isArray(raw?.upgrades) ? raw.upgrades : [],
      achievements: Array.isArray(raw?.achievements)
        ? raw.achievements.filter(id => typeof id === 'string' && ACHIEVEMENTS.some(achievement => achievement.id === id))
        : [],
      certifications: Array.isArray(raw?.certifications) ? raw.certifications : [],
      commandsUsed: Array.isArray(raw?.commandsUsed) ? raw.commandsUsed : [],
      productionHistory: Array.isArray(raw?.productionHistory)
        ? raw.productionHistory
          .filter(point => Number.isFinite(point?.time) && Number.isFinite(point?.value) && point.value >= 0)
          .filter((point, index, history) => {
            if (history.length <= 20) return true;
            const slot = Math.round(index / (history.length - 1) * 19);
            return index === Math.round(slot / 19 * (history.length - 1));
          })
        : [],
      certificationPoints: Math.max(0, Number(raw?.certificationPoints) || 0) + refundedPoints,
      dailyMissions: raw?.dailyMissions && typeof raw.dailyMissions === 'object' ? raw.dailyMissions : null,
      activeEvent: null
    };
    delete state.permanentSkills;
    delete state.antiCheatViolations;
    delete state.lastAntiCheatWarning;
    delete state.clickWindow;
    delete state.integrity;
    state.combo = 0;
    state.lastManualClick = 0;
    state.allTimeRequests = Number.isFinite(raw?.allTimeRequests) ? raw.allTimeRequests : state.lifetimeRequests;
    state.totalBuildingsPurchased = Number.isFinite(raw?.totalBuildingsPurchased)
      ? raw.totalBuildingsPurchased
      : Object.values(state.buildings).reduce((sum, count) => sum + count, 0);
    return state;
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || (ACTIVE_DLC.id === 'infra' ? localStorage.getItem(LEGACY_SAVE_KEY) : null);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      const state = this.normalize(parsed);
      state.dlcId = ACTIVE_DLC.id;
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
      this.onStatus?.(`Miroir local actualisé à ${new Date().toLocaleTimeString('fr-FR')}`);
      return true;
    } catch (error) {
      this.onStatus?.('Échec de la sauvegarde');
      return false;
    }
  }

  reset() {
    localStorage.removeItem(SAVE_KEY);
    return createDefaultState();
  }
}
