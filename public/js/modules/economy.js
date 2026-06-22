import { BUILDINGS, CERTIFICATIONS, INFRA_LEVELS, UPGRADES } from './data.js';

const SATURATION_START = 100e6;
const MIN_CAPACITY_EFFICIENCY = 0.35;

export class Economy {
  constructor(state) {
    this.state = state;
  }

  getUpgrade(id) {
    return UPGRADES.find(upgrade => upgrade.id === id);
  }

  hasUpgrade(id) {
    return this.state.upgrades.includes(id);
  }

  buildingCostReduction() {
    const upgrades = UPGRADES
      .filter(upgrade => this.hasUpgrade(upgrade.id))
      .reduce((reduction, upgrade) => reduction + (upgrade.effect.costReduction || 0), 0);
    return upgrades;
  }

  getBuildingUnitCost(building, ownedOffset = 0) {
    const owned = this.state.buildings[building.id] || 0;
    const reduction = Math.min(0.35, this.buildingCostReduction());
    return building.baseCost * Math.pow(1.15, owned + ownedOffset) * (1 - reduction);
  }

  getBuildingCost(building, amount = 1) {
    if (amount === 'max') {
      let count = 0;
      let cost = 0;
      while (count < 10000) {
        const next = this.getBuildingUnitCost(building, count);
        if (cost + next > this.state.requests) break;
        cost += next;
        count += 1;
      }
      return { cost, amount: count };
    }
    let cost = 0;
    for (let index = 0; index < amount; index += 1) {
      cost += this.getBuildingUnitCost(building, index);
    }
    return { cost, amount };
  }

  getGlobalMultiplier() {
    const upgradeMultiplier = UPGRADES
      .filter(upgrade => this.hasUpgrade(upgrade.id))
      .reduce((multiplier, upgrade) => multiplier * (upgrade.effect.production || 1), 1);
    const certificationMultiplier = CERTIFICATIONS
      .filter(certification => this.state.certifications.includes(certification.id))
      .reduce((total, certification) => total + certification.bonus, 1);
    return upgradeMultiplier * certificationMultiplier;
  }

  getBuildingMultiplier(buildingId) {
    return UPGRADES
      .filter(upgrade => this.hasUpgrade(upgrade.id) && upgrade.effect.building === buildingId)
      .reduce((multiplier, upgrade) => multiplier * upgrade.effect.multiplier, 1);
  }

  getBaseProduction() {
    return BUILDINGS.reduce((total, building) => {
      const owned = this.state.buildings[building.id] || 0;
      return total + owned * building.baseProduction * this.getBuildingMultiplier(building.id);
    }, 0) * this.getGlobalMultiplier();
  }

  getProduction() {
    const eventMultiplier = this.state.activeEvent?.multiplier || 1;
    const temporaryMultiplier = this.state.temporaryBonus?.expiresAt > Date.now()
      ? this.state.temporaryBonus.multiplier
      : 1;
    const overclockMultiplier = this.state.overclockEndsAt > Date.now() ? 2 : 1;
    return this.getBaseProduction()
      * this.getCapacityEfficiency()
      * eventMultiplier
      * temporaryMultiplier
      * overclockMultiplier;
  }

  getCapacityEfficiency() {
    if (this.state.lifetimeRequests <= SATURATION_START) return 1;
    const decades = Math.log10(this.state.lifetimeRequests / SATURATION_START);
    return Math.max(MIN_CAPACITY_EFFICIENCY, 1 / (1 + 0.5 * decades));
  }

  getCapacityStatus() {
    const efficiency = this.getCapacityEfficiency();
    if (this.state.lifetimeRequests < SATURATION_START) {
      return {
        label: 'CAPACITÉ',
        percent: Math.min(100, this.state.lifetimeRequests / SATURATION_START * 100),
        saturated: false,
        efficiency
      };
    }
    return {
      label: 'SATURATION',
      percent: (1 - efficiency) * 100,
      saturated: true,
      efficiency
    };
  }

  getClickPower() {
    const clickMultiplier = UPGRADES
      .filter(upgrade => this.hasUpgrade(upgrade.id))
      .reduce((multiplier, upgrade) => multiplier * (upgrade.effect.click || 1), 1);
    const eventClickMultiplier = this.state.activeEvent?.clickMultiplier || 1;
    return Math.max(1, clickMultiplier * eventClickMultiplier * (1 + this.getProduction() * 0.01));
  }

  getEventResistance() {
    const upgrades = UPGRADES
      .filter(upgrade => this.hasUpgrade(upgrade.id))
      .reduce((total, upgrade) => total + (upgrade.effect.eventResistance || 0), 0);
    return Math.min(0.85, upgrades);
  }

  canBuyUpgrade(upgrade) {
    return !this.hasUpgrade(upgrade.id)
      && (!upgrade.requires || this.hasUpgrade(upgrade.requires))
      && this.state.requests >= upgrade.cost;
  }

  prestigeGain() {
    if (this.state.lifetimeRequests < this.getPrestigeTarget()) return 0;
    return Math.floor(Math.log10(this.state.lifetimeRequests / this.getPrestigeTarget())) + 1;
  }

  nextPrestigeThreshold() {
    const gain = this.prestigeGain();
    return this.getPrestigeTarget() * Math.pow(10, Math.max(0, gain));
  }

  getPrestigeTarget() {
    return 1e6;
  }

  getInfraLevel() {
    let index = 0;
    INFRA_LEVELS.forEach(([threshold], levelIndex) => {
      if (this.state.lifetimeRequests >= threshold) index = levelIndex;
    });
    const current = INFRA_LEVELS[index];
    const next = INFRA_LEVELS[index + 1];
    const progress = next
      ? (this.state.lifetimeRequests - current[0]) / (next[0] - current[0])
      : 1;
    return { level: index + 1, title: current[1], progress, current: current[0], next: next?.[0] };
  }
}
