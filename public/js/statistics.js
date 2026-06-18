import { BUILDINGS, CERTIFICATIONS, UPGRADES } from './modules/data.js';
import { Economy } from './modules/economy.js';
import { formatNumber } from './modules/utils.js';

const SAVE_KEY = 'infra-clicker-save-v1';

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
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || typeof state !== 'object' || !Number.isFinite(state.lifetimeRequests)) return null;
    state.buildings ||= {};
    state.upgrades = Array.isArray(state.upgrades) ? state.upgrades : [];
    state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
    state.certifications = Array.isArray(state.certifications) ? state.certifications : [];
    state.commandsUsed = Array.isArray(state.commandsUsed) ? state.commandsUsed : [];
    state.activeEvent = null;
    state.temporaryBonus = null;
    state.overclockEndsAt = 0;
    return state;
  } catch {
    return null;
  }
}

function renderBuildings(state, economy) {
  const maximum = Math.max(1, ...BUILDINGS.map(building => state.buildings[building.id] || 0));
  document.getElementById('building-stats').innerHTML = BUILDINGS.map(building => {
    const count = state.buildings[building.id] || 0;
    const production = count * building.baseProduction
      * economy.getBuildingMultiplier(building.id)
      * economy.getGlobalMultiplier();
    return `
      <div class="building-stat-row ${count ? '' : 'empty'}">
        <span class="building-stat-icon">${building.icon}</span>
        <div class="building-stat-info">
          <div><strong>${building.name}</strong><span>${count} possédé${count > 1 ? 's' : ''}</span></div>
          <div class="building-stat-bar"><span style="width:${count / maximum * 100}%"></span></div>
        </div>
        <strong class="building-stat-output">${formatNumber(production)}<small> req/s</small></strong>
      </div>
    `;
  }).join('');
}

function render() {
  const theme = localStorage.getItem('infra-clicker-theme') || 'ocean';
  document.documentElement.dataset.theme = theme;
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
  setText('stat-lifetime', formatNumber(state.lifetimeRequests));
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
  setText('stat-anticheat', state.antiCheatViolations || 0);
  setText('stat-upgrades', `${state.upgrades.length} / ${UPGRADES.length}`);
  setText('stat-achievements', `${state.achievements.length} / 80`);
  setText('stat-certifications', `${state.certifications.length} / ${CERTIFICATIONS.length}`);
  setProgress('stat-upgrades-bar', state.upgrades.length, UPGRADES.length);
  setProgress('stat-achievements-bar', state.achievements.length, 80);
  setProgress('stat-certifications-bar', state.certifications.length, CERTIFICATIONS.length);
  setText('stat-created', formatDate(state.startedAt));
  setText('stat-saved', formatDate(state.lastSaved));
  setText('stat-version', state.version || 1);
  setText('stat-cert-points', state.certificationPoints || 0);
  renderBuildings(state, economy);
}

render();
