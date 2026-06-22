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
  'lastSaved'
];

async function request(path, options = {}) {
  const { silent = false, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(fetchOptions.headers || {}) },
      ...fetchOptions
    });
  } catch (error) {
    if (!silent) {
      window.dispatchEvent(new CustomEvent('infra:server-disconnected', {
        detail: { message: 'Le serveur ne répond plus.' }
      }));
    }
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Action refusée par le serveur');
    error.state = payload.state;
    error.status = response.status;
    if (!silent && response.status >= 500) {
      window.dispatchEvent(new CustomEvent('infra:server-disconnected', {
        detail: { message: error.message }
      }));
    }
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

  async sync(state, keepalive = false) {
    const snapshot = Object.fromEntries(PROTECTED_FIELDS
      .filter(field => Object.hasOwn(state, field))
      .map(field => [field, state[field]]));
    return request('/api/game/sync', {
      method: 'POST',
      body: JSON.stringify({ state: snapshot }),
      keepalive,
      silent: true
    });
  }

  async reset(state) {
    const payload = await request('/api/game/reset', {
      method: 'POST',
      body: '{}'
    });
    this.merge(state, payload.state);
  }
}
