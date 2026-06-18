import { ACHIEVEMENTS, BUILDINGS, CERTIFICATIONS, UPGRADES } from './data.js';

export class AchievementManager {
  constructor(state, economy, ui, audio) {
    this.state = state;
    this.economy = economy;
    this.ui = ui;
    this.audio = audio;
  }

  isUnlocked(achievement) {
    const state = this.state;
    switch (achievement.type) {
      case 'requests': return state.lifetimeRequests >= achievement.value;
      case 'clicks': return state.manualClicks >= achievement.value;
      case 'rps': return this.economy.getProduction() >= achievement.value;
      case 'building': return (state.buildings[achievement.target] || 0) >= achievement.value;
      case 'buildingCount': return Object.values(state.buildings).reduce((sum, count) => sum + count, 0) >= achievement.value;
      case 'upgrade': return state.upgrades.includes(achievement.value);
      case 'upgradeCount': return state.upgrades.length >= achievement.value;
      case 'certification': return state.certifications.includes(achievement.value);
      case 'certCount': return state.certifications.length >= achievement.value;
      case 'prestige': return state.prestigeCount >= achievement.value;
      case 'event': return state.commandsUsed.includes(`event:${achievement.value}`);
      case 'eventCount': return state.eventsCompleted >= achievement.value;
      case 'command': return state.commandsUsed.includes(achievement.value);
      case 'terminal': return state.commandsUsed.includes('terminal-open');
      case 'export': return state.exported;
      case 'night': {
        const hour = new Date().getHours();
        return hour >= 0 && hour < 6;
      }
      case 'muted': return !state.soundEnabled;
      case 'maxBuy': return state.maxBuyUsed;
      case 'uptime': return (Date.now() - state.startedAt) / 1000 >= achievement.value;
      default: return false;
    }
  }

  check() {
    ACHIEVEMENTS.forEach(achievement => {
      if (!this.state.achievements.includes(achievement.id) && this.isUnlocked(achievement)) {
        this.state.achievements.push(achievement.id);
        this.audio.achievement();
        this.ui.toast(`Succès débloqué : ${achievement.name}`, achievement.description, 'achievement');
      }
    });
  }

  getDefinitions() {
    return ACHIEVEMENTS;
  }
}
