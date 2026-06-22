import { DLCS, getActiveDlcId } from './dlcs/registry.js';
import { formatNumber } from './modules/utils.js';

let selectedDlcId = getActiveDlcId();

function normalizedCountryCode(countryCode) {
  const code = String(countryCode || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) && code !== 'xx' ? code : null;
}

function flagElement(player) {
  const flag = document.createElement('span');
  flag.className = 'leaderboard-flag';
  const countryCode = normalizedCountryCode(player.countryCode);
  if (!countryCode) {
    flag.textContent = '🌐';
    return flag;
  }
  const image = document.createElement('img');
  image.src = `/flags/${countryCode}.svg`;
  image.alt = `Drapeau ${countryCode.toUpperCase()}`;
  image.loading = 'lazy';
  image.addEventListener('error', () => { flag.textContent = '🌐'; }, { once: true });
  flag.appendChild(image);
  return flag;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds % 86400 / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}j ${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

function completionText(player) {
  return player.completed ? `✓ ${formatDuration(player.completionTimeMs)}` : 'En cours';
}

function podiumCard(player, place) {
  const article = document.createElement('article');
  article.className = `podium-card podium-place-${place}`;
  if (!player) {
    article.classList.add('empty');
    article.innerHTML = `<span class="podium-medal">${['🥇', '🥈', '🥉'][place - 1]}</span><strong>Place libre</strong><small>Aucun joueur</small>`;
    return article;
  }

  const identity = document.createElement('div');
  identity.className = 'podium-player';
  identity.append(flagElement(player));
  const name = document.createElement('strong');
  name.textContent = player.username;
  identity.appendChild(name);

  const medal = document.createElement('span');
  medal.className = 'podium-medal';
  medal.textContent = ['🥇', '🥈', '🥉'][place - 1];
  const score = document.createElement('strong');
  score.className = 'podium-score';
  score.textContent = formatNumber(player.requests);
  const details = document.createElement('small');
  details.textContent = `${player.prestigeCount} prestige${player.prestigeCount > 1 ? 's' : ''} · ${completionText(player)}`;
  article.append(medal, identity, score, details);
  return article;
}

function row(player) {
  const article = document.createElement('article');
  article.className = 'leaderboard-row';
  const rank = document.createElement('strong');
  rank.className = 'leaderboard-rank';
  rank.textContent = `#${player.rank}`;
  const identity = document.createElement('div');
  identity.className = 'leaderboard-player';
  const name = document.createElement('strong');
  name.textContent = player.username;
  identity.append(flagElement(player), name);
  const prestige = document.createElement('span');
  prestige.className = 'leaderboard-prestige';
  prestige.textContent = `${player.prestigeCount} ◆`;
  const completion = document.createElement('span');
  completion.className = `leaderboard-completion ${player.completed ? 'complete' : ''}`;
  completion.textContent = completionText(player);
  const requests = document.createElement('strong');
  requests.className = 'leaderboard-score';
  requests.textContent = formatNumber(player.requests);
  article.append(rank, identity, prestige, completion, requests);
  return article;
}

function renderTabs() {
  const tabs = document.querySelector('#leaderboard-dlc-tabs');
  tabs.replaceChildren(...DLCS.map(dlc => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = dlc.id === selectedDlcId ? 'active' : '';
    button.textContent = dlc.name;
    button.addEventListener('click', () => {
      if (selectedDlcId === dlc.id) return;
      selectedDlcId = dlc.id;
      renderTabs();
      render();
    });
    return button;
  }));
  const activeDlc = DLCS.find(dlc => dlc.id === selectedDlcId);
  document.querySelector('#leaderboard-score-label').textContent = activeDlc.currency.toUpperCase();
}

async function render() {
  const requestedDlcId = selectedDlcId;
  const podium = document.querySelector('#leaderboard-podium');
  const list = document.querySelector('#leaderboard-list');
  podium.innerHTML = '<p class="leaderboard-loading">Chargement du podium…</p>';
  list.innerHTML = '<p class="leaderboard-loading">Chargement du classement…</p>';
  try {
    const response = await fetch(`/api/game/leaderboard?dlc=${encodeURIComponent(requestedDlcId)}`, {
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error();
    const { players } = await response.json();
    if (requestedDlcId !== selectedDlcId) return;
    podium.replaceChildren(podiumCard(players[1], 2), podiumCard(players[0], 1), podiumCard(players[2], 3));
    list.replaceChildren();
    const remaining = players.slice(3, 23);
    if (!remaining.length) {
      list.innerHTML = '<p class="leaderboard-loading">Aucun autre joueur classé pour le moment.</p>';
      return;
    }
    remaining.forEach(player => list.appendChild(row(player)));
  } catch {
    podium.innerHTML = '<p class="leaderboard-loading">Le podium est temporairement indisponible.</p>';
    list.innerHTML = '<p class="leaderboard-loading">Le classement est temporairement indisponible.</p>';
  }
}

renderTabs();
render();
setInterval(render, 10000);
