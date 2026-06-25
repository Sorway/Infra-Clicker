import { ACHIEVEMENTS, ACTIVE_DLC, BUILDINGS, CERTIFICATIONS, UPGRADES } from './modules/data.js';
import { Economy } from './modules/economy.js';
import { formatNumber } from './modules/utils.js';

const SAVE_KEY = `clicker-save-${ACTIVE_DLC.id}-v1`;

function formatDuration(milliseconds) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setProgress(id, current, total) {
  document.getElementById(id).style.width = `${Math.min(100, current / total * 100)}%`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
      || (ACTIVE_DLC.id === 'infra' ? localStorage.getItem('infra-clicker-save-v1') : null);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || typeof state !== 'object' || !Number.isFinite(state.lifetimeRequests)) return null;
    state.buildings ||= {};
    state.upgrades = Array.isArray(state.upgrades) ? state.upgrades : [];
    state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
    state.certifications = Array.isArray(state.certifications) ? state.certifications : [];
    state.commandsUsed = Array.isArray(state.commandsUsed) ? state.commandsUsed : [];
    state.productionHistory = Array.isArray(state.productionHistory) ? state.productionHistory : [];
    state.activeEvent = null;
    state.temporaryBonus = null;
    state.overclockEndsAt = 0;
    return state;
  } catch {
    return null;
  }
}

function renderProductionChart(state) {
  const container = document.getElementById('production-chart');
  let history = state.productionHistory
    .filter(point => Number.isFinite(point?.time) && Number.isFinite(point?.value))
    .sort((first, second) => first.time - second.time);

  if (history.length < 2) {
    const fallbackValue = new Economy(state).getBaseProduction();
    history = [
      { time: (state.startedAt || Date.now()) , value: 0 },
      { time: Date.now(), value: fallbackValue }
    ];
    container.classList.add('estimated');
  } else {
    const startedAt = Number.isFinite(state.startedAt) ? state.startedAt : history[0].time;
    if (history[0].time > startedAt) {
      history.unshift({ time: startedAt, value: history[0].value });
    }
    history.push({ time: Date.now(), value: new Economy(state).getBaseProduction() });
  }

  if (history.length > 20) {
    const sampled = [];
    for (let index = 0; index < 20; index += 1) {
      const sourceIndex = Math.round(index / 19 * (history.length - 1));
      sampled.push(history[sourceIndex]);
    }
    history = sampled;
  }

  const values = history.map(point => point.value);
  const maximum = Math.max(1, ...values);
  const minimum = Math.min(...values);
  const range = Math.max(1, maximum - minimum);
  const points = history.map((point, index) => {
    const x = index / (history.length - 1) * 1000;
    const normalized = (point.value - minimum) / range;
    const y = 250 - normalized * 205;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  const areaPath = `M 0 280 L ${points.replaceAll(' ', ' L ')} L 1000 280 Z`;
  const last = points.split(' ').at(-1).split(',');
  const scaleValues = [1, 0.75, 0.5, 0.25, 0].map(ratio => minimum + range * ratio);

  container.innerHTML = `
    <div class="chart-y-axis" aria-hidden="true">
      ${scaleValues.map(value => `<span>${formatNumber(value)} req/s</span>`).join('')}
    </div>
    <svg viewBox="0 0 1000 280" preserveAspectRatio="none" role="img" aria-label="Évolution de la production">
      <defs>
        <linearGradient id="history-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--cyan)" stop-opacity=".32"/>
          <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g class="history-grid">
        <line x1="0" y1="45" x2="1000" y2="45"/><line x1="0" y1="95" x2="1000" y2="95"/>
        <line x1="0" y1="145" x2="1000" y2="145"/><line x1="0" y1="195" x2="1000" y2="195"/>
        <line x1="0" y1="245" x2="1000" y2="245"/>
      </g>
      <path class="history-area" d="${areaPath}"/>
      <polyline class="history-line" points="${points}"/>
      <circle class="history-point" cx="${last[0]}" cy="${last[1]}" r="6"/>
    </svg>
    ${container.classList.contains('estimated') ? '<span class="chart-estimated">ESTIMATION — les données réelles arrivent après une minute</span>' : ''}
  `;
  setText('chart-peak', `${formatNumber(maximum)} req/s`);
  setText('chart-start', formatDate(history[0].time));
  setText('chart-end', formatDate(history.at(-1).time));
}

const BUILDING_IMAGES = {
  bash: 'bash_script', pi: 'raspberry_pi', mini: 'mini_server', nas: 'nas', serverroom: 'salle_server',
  switch: 'switch', firewall: 'firewall', rack: 'rack_42u', datacenter: 'datacenter',
  kubernetes: 'cluster_kubernetes', privatecloud: 'cloud_private', worldcloud: 'cloud_mondial'
};

function renderBuildings(state, economy) {
  const maximum = Math.max(1, ...BUILDINGS.map(building => state.buildings[building.id] || 0));
  document.getElementById('building-stats').innerHTML = BUILDINGS.map(building => {
    const count = state.buildings[building.id] || 0;
    const production = count * building.baseProduction
      * economy.getBuildingMultiplier(building.id)
      * economy.getGlobalMultiplier();
    const img = BUILDING_IMAGES[building.id];
    const icon = img
      ? `<img src="/img/buildings/${img}.png" alt="" loading="lazy" draggable="false" onerror="this.closest('.building-stat-icon').classList.remove('has-img');this.replaceWith(document.createTextNode('${building.icon}'))">`
      : building.icon;
    return `
      <div class="building-stat-row ${count ? '' : 'empty'}" data-building="${building.id}">
        <span class="building-stat-icon${img ? ' has-img' : ''}">${icon}</span>
        <div class="building-stat-info">
          <div><strong>${building.name}</strong><span>${count} déployé${count > 1 ? 's' : ''}</span></div>
          <div class="building-stat-bar"><span style="width:${count / maximum * 100}%"></span></div>
        </div>
        <strong class="building-stat-output">${formatNumber(production)}<small> req/s</small></strong>
      </div>
    `;
  }).join('');
}

function render() {
  // Un DLC à skin (Ynov/Linear/NOC) impose son thème ; sinon palette du DLC de base.
  const palettes = ['ruby', 'sunset', 'lavender', 'mint', 'ocean'];
  const saved = localStorage.getItem('infra-clicker-theme');
  const theme = ACTIVE_DLC.theme || (palettes.includes(saved) ? saved : 'ocean');
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.dlc = ACTIVE_DLC.id;
  const state = loadState();
  const empty = document.getElementById('stats-empty');
  const content = document.getElementById('stats-content');

  if (!state) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    setText('stats-status', 'Aucune sauvegarde');
    setText('stats-last-save', 'Jouez pour générer des données');
    return;
  }

  empty.classList.add('hidden');
  content.classList.remove('hidden');
  const economy = new Economy(state);
  const production = economy.getBaseProduction();
  const totalBuildings = Object.values(state.buildings).reduce((sum, count) => sum + count, 0);
  const elapsed = Date.now() - (state.startedAt || Date.now());
  const clickShare = state.lifetimeRequests > 0
    ? Math.min(100, state.manualClicks / state.lifetimeRequests * 100)
    : 0;

  setText('stats-period', `Partie active depuis ${formatDuration(elapsed)}`);
  setText('stats-last-save', `Sauvegardé ${formatDate(state.lastSaved)}`);
  setText('stat-lifetime', formatNumber(state.allTimeRequests || state.lifetimeRequests));
  setText('stat-production', formatNumber(production));
  setText('stat-clicks', formatNumber(state.manualClicks || 0));
  setText('stat-click-share', `${clickShare.toFixed(2).replace('.', ',')}% du trafic cumulé`);
  setText('stat-playtime', formatDuration(elapsed));
  setText('stat-buildings-total', formatNumber(totalBuildings, 0));
  setText('stat-best-combo', state.bestCombo || 0);
  setText('stat-criticals', formatNumber(state.criticalClicks || 0, 0));
  setText('stat-events', state.eventsCompleted || 0);
  setText('stat-prestiges', state.prestigeCount || 0);
  setText('stat-commands', new Set(state.commandsUsed).size);
  setText('stat-upgrades', `${state.upgrades.length} / ${UPGRADES.length}`);
  setText('stat-achievements', `${state.achievements.length} / ${ACHIEVEMENTS.length}`);
  setText('stat-certifications', `${state.certifications.length} / ${CERTIFICATIONS.length}`);
  setProgress('stat-upgrades-bar', state.upgrades.length, UPGRADES.length);
  setProgress('stat-achievements-bar', state.achievements.length, ACHIEVEMENTS.length);
  setProgress('stat-certifications-bar', state.certifications.length, CERTIFICATIONS.length);
  setText('stat-created', formatDate(state.startedAt));
  setText('stat-saved', formatDate(state.lastSaved));
  setText('stat-version', state.version || 1);
  setText('stat-cert-points', state.certificationPoints || 0);
  renderBuildings(state, economy);
  renderProductionChart(state);
}

render();
