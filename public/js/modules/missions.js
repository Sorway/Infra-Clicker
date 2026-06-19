const DAY = 86400000;

function dayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function totalBuildings(state) {
  return Object.values(state.buildings || {}).reduce((sum, count) => sum + count, 0);
}

export class MissionManager {
  constructor(state, ui) {
    this.state = state;
    this.ui = ui;
    this.lastRender = 0;
    this.ensureToday();
  }

  ensureToday() {
    const key = dayKey();
    if (this.state.dailyMissions?.date === key) return;
    const scale = Math.max(1, Math.floor(Math.log10((this.state.lifetimeRequests || 0) + 10)));
    this.state.dailyMissions = {
      date: key,
      expiresAt: new Date(`${key}T23:59:59.999`).getTime(),
      missions: [
        { id: 'requests', name: 'Trafic quotidien', description: 'Traiter des requêtes', target: 2500 * scale, baseline: this.state.allTimeRequests || this.state.lifetimeRequests || 0, reward: { requests: 1500 * scale }, claimed: false },
        { id: 'buildings', name: 'Extension du parc', description: 'Acheter des bâtiments', target: 5 + scale, baseline: this.state.totalBuildingsPurchased || totalBuildings(this.state), reward: { requests: 3000 * scale }, claimed: false },
        { id: 'events', name: 'Service d’astreinte', description: 'Résoudre des événements', target: 2, baseline: this.state.eventsCompleted || 0, reward: { certificationPoints: 1 }, claimed: false }
      ]
    };
  }

  progress(mission) {
    if (mission.id === 'requests') return Math.max(0, (this.state.allTimeRequests || this.state.lifetimeRequests) - mission.baseline);
    if (mission.id === 'buildings') return Math.max(0, (this.state.totalBuildingsPurchased || 0) - mission.baseline);
    if (mission.id === 'events') return Math.max(0, this.state.eventsCompleted - mission.baseline);
    return 0;
  }

  claim(id) {
    this.ensureToday();
    const mission = this.state.dailyMissions.missions.find(item => item.id === id);
    if (!mission || mission.claimed || this.progress(mission) < mission.target) return false;
    mission.claimed = true;
    this.state.requests += mission.reward.requests || 0;
    this.state.lifetimeRequests += mission.reward.requests || 0;
    this.state.allTimeRequests = (this.state.allTimeRequests || 0) + (mission.reward.requests || 0);
    this.state.certificationPoints += mission.reward.certificationPoints || 0;
    return true;
  }

  update() {
    this.ensureToday();
    if (Date.now() - this.lastRender >= 1000) {
      this.ui.renderMissions?.(this);
      this.lastRender = Date.now();
    }
  }
}
