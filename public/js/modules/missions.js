function dateKey(offset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function endOfDay(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function totalBuildings(state) {
  return Object.values(state.buildings || {}).reduce((sum, count) => sum + count, 0);
}

function seedFor(key) {
  return [...key].reduce((seed, character) => seed + character.charCodeAt(0), 0);
}

const TITLES = {
  requests: [
    ['Trafic quotidien', 'Traiter des requêtes'],
    ['Montée en charge', 'Absorber le trafic entrant'],
    ['File d’attente', 'Vider le backlog réseau']
  ],
  buildings: [
    ['Extension du parc', 'Acheter des bâtiments'],
    ['Capacity planning', 'Ajouter des ressources'],
    ['Nouveaux équipements', 'Étendre l’infrastructure']
  ],
  events: [
    ['Service d’astreinte', 'Résoudre des événements'],
    ['Cellule de crise', 'Maîtriser les incidents'],
    ['SLA sous surveillance', 'Rétablir les services']
  ]
};

function missionPlan(key, state) {
  const scale = Math.max(1, Math.floor(Math.log10((state.lifetimeRequests || 0) + 10)));
  const seed = seedFor(key);
  const title = type => TITLES[type][seed % TITLES[type].length];
  const requests = title('requests');
  const buildings = title('buildings');
  const events = title('events');

  return {
    date: key,
    missions: [
      {
        id: 'requests',
        name: requests[0],
        description: requests[1],
        target: 2500 * scale,
        reward: { requests: 1500 * scale }
      },
      {
        id: 'buildings',
        name: buildings[0],
        description: buildings[1],
        target: 5 + scale,
        reward: { requests: 3000 * scale }
      },
      {
        id: 'events',
        name: events[0],
        description: events[1],
        target: 2,
        reward: { certificationPoints: 1 }
      }
    ]
  };
}

function activatePlan(plan, state) {
  return {
    date: plan.date,
    expiresAt: endOfDay(plan.date),
    missions: plan.missions.map(mission => ({
      ...mission,
      baseline: mission.id === 'requests'
        ? state.allTimeRequests || state.lifetimeRequests || 0
        : mission.id === 'buildings'
          ? state.totalBuildingsPurchased || totalBuildings(state)
          : state.eventsCompleted || 0,
      claimed: false
    }))
  };
}

export class MissionManager {
  constructor(state, ui) {
    this.state = state;
    this.ui = ui;
    this.lastRender = 0;
    this.ensureToday();
  }

  ensureToday() {
    const today = dateKey();
    const tomorrow = dateKey(1);
    const current = this.state.dailyMissions;

    if (current?.date !== today) {
      const prepared = current?.next?.date === today
        ? current.next
        : missionPlan(today, this.state);
      this.state.dailyMissions = activatePlan(prepared, this.state);
    }

    if (this.state.dailyMissions.next?.date !== tomorrow) {
      this.state.dailyMissions.next = missionPlan(tomorrow, this.state);
    }
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
    const modalOpen = document.querySelector('#missions-modal')?.classList.contains('open');
    if (modalOpen && Date.now() - this.lastRender >= 1000) {
      this.ui.renderMissions?.(this);
      this.lastRender = Date.now();
    }
  }
}
