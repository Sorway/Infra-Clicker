import { BUILDINGS, CERTIFICATIONS, UPGRADES } from './data.js';

const MAX_CLICKS_PER_SECOND = 32;

export class AntiCheat {
  constructor(state, onViolation) {
    this.state = state;
    this.onViolation = onViolation;
    this.clickTimestamps = [];
    this.lastWallClock = Date.now();
  }

  canProcessClick() {
    const now = performance.now();
    this.clickTimestamps = this.clickTimestamps.filter(timestamp => now - timestamp < 1000);
    if (this.clickTimestamps.length >= MAX_CLICKS_PER_SECOND) {
      this.report('Autoclick détecté');
      return false;
    }
    this.clickTimestamps.push(now);
    return true;
  }

  validateState() {
    const violations = [];
    const numericFields = [
      'requests', 'lifetimeRequests', 'allTimeRequests', 'manualClicks', 'criticalClicks', 'bestCombo',
      'certificationPoints', 'prestigeCount', 'eventsCompleted', 'overclockCharge', 'totalBuildingsPurchased'
    ];

    numericFields.forEach(field => {
      const value = this.state[field];
      if (!Number.isFinite(value) || value < 0) {
        this.state[field] = 0;
        violations.push(`Valeur invalide : ${field}`);
      }
    });

    this.state.overclockCharge = Math.min(100, this.state.overclockCharge);
    this.state.manualClicks = Math.floor(this.state.manualClicks);
    this.state.criticalClicks = Math.min(Math.floor(this.state.criticalClicks), this.state.manualClicks);
    this.state.bestCombo = Math.floor(this.state.bestCombo);
    this.state.certificationPoints = Math.floor(this.state.certificationPoints);
    this.state.prestigeCount = Math.floor(this.state.prestigeCount);

    const buildingIds = new Set(BUILDINGS.map(building => building.id));
    Object.entries(this.state.buildings).forEach(([id, count]) => {
      if (!buildingIds.has(id) || !Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
        delete this.state.buildings[id];
        violations.push(`Bâtiment invalide : ${id}`);
      }
    });

    const upgradeIds = new Set(UPGRADES.map(upgrade => upgrade.id));
    const certificationIds = new Set(CERTIFICATIONS.map(certification => certification.id));
    this.state.upgrades = [...new Set(this.state.upgrades.filter(id => upgradeIds.has(id)))];
    this.state.certifications = [...new Set(this.state.certifications.filter(id => certificationIds.has(id)))];

    const now = Date.now();
    if (now < this.lastWallClock - 60000) {
      this.state.temporaryBonus = null;
      this.state.overclockEndsAt = 0;
      violations.push('Manipulation de l’horloge détectée');
    }
    this.lastWallClock = now;

    if (this.state.overclockEndsAt > now + 30000) {
      this.state.overclockEndsAt = 0;
      violations.push('Durée de surcharge invalide');
    }

    if (violations.length) this.report(violations[0]);
    return violations.length === 0;
  }

  report(reason) {
    const now = Date.now();
    if (now - (this.state.lastAntiCheatWarning || 0) < 4000) return;
    this.state.lastAntiCheatWarning = now;
    this.state.antiCheatViolations = (this.state.antiCheatViolations || 0) + 1;
    this.onViolation?.(reason);
  }
}
