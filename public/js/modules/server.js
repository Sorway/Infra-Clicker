const PROTECTED_FIELDS = [
  'version',
  'requests',
  'lifetimeRequests',
  'allTimeRequests',
  'manualClicks',
  'criticalClicks',
  'bestCombo',
  'combo',
  'lastManualClick',
  'overclockCharge',
  'overclockEndsAt',
  'totalBuildingsPurchased',
  'buildings',
  'upgrades',
  'certifications',
  'certificationPoints',
  'prestigeCount',
  'completedAt',
  'startedAt',
  'lastTick',
  'lastSaved',
  'antiCheatViolations'
];

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Action refusée par le serveur');
    error.state = payload.state;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export class ServerGame {
  merge(target, source) {
    if (!source) return;
    PROTECTED_FIELDS.forEach(field => {
      if (Object.hasOwn(source, field)) target[field] = source[field];
    });
  }

  async load(state) {
    const payload = await request('/api/game/state');
    this.merge(state, payload.state);
    return payload;
  }

  async presence() {
    return request('/api/game/presence');
  }

  async saveProfile(state, username) {
    const payload = await request('/api/game/profile', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
    this.merge(state, payload.state);
    return payload.profile;
  }

  async action(state, type, data = {}) {
    try {
      const payload = await request('/api/game/action', {
        method: 'POST',
        body: JSON.stringify({ type, ...data })
      });
      this.merge(state, payload.state);
      return payload.result || {};
    } catch (error) {
      this.merge(state, error.state);
      throw error;
    }
  }

  async reset(state) {
    const payload = await request('/api/game/reset', {
      method: 'POST',
      body: '{}'
    });
    this.merge(state, payload.state);
  }
}
