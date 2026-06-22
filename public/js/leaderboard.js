import { formatNumber } from './modules/utils.js';

function normalizedCountryCode(countryCode) {
  const code = String(countryCode || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) && code !== 'xx' ? code : null;
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

function row(player) {
  const article = document.createElement('article');
  article.className = `leaderboard-row rank-${player.rank}`;

  const rank = document.createElement('strong');
  rank.className = 'leaderboard-rank';
  rank.textContent = player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : `#${player.rank}`;

  const identity = document.createElement('div');
  identity.className = 'leaderboard-player';
  const flag = document.createElement('span');
  flag.className = 'leaderboard-flag';
  const countryCode = normalizedCountryCode(player.countryCode);
  if (countryCode) {
    const image = document.createElement('img');
    image.src = `/flags/${countryCode}.svg`;
    image.alt = `Drapeau ${countryCode.toUpperCase()}`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      flag.textContent = '🌐';
    }, { once: true });
    flag.appendChild(image);
  } else {
    flag.textContent = '🌐';
  }
  const name = document.createElement('strong');
  name.textContent = player.username;
  identity.append(flag, name);

  const prestige = document.createElement('span');
  prestige.className = 'leaderboard-prestige';
  prestige.textContent = `${player.prestigeCount} ◆`;

  const completion = document.createElement('span');
  completion.className = `leaderboard-completion ${player.completed ? 'complete' : ''}`;
  completion.textContent = player.completed
    ? `✓ ${formatDuration(player.completionTimeMs)}`
    : 'En cours';
  completion.title = player.completed
    ? `Jeu terminé en ${formatDuration(player.completionTimeMs)}`
    : 'Jeu non terminé';

  const requests = document.createElement('strong');
  requests.className = 'leaderboard-score';
  requests.textContent = formatNumber(player.requests);

  article.append(rank, identity, prestige, completion, requests);
  return article;
}

async function render() {
  const list = document.querySelector('#leaderboard-list');
  try {
    const response = await fetch('/api/game/leaderboard', { credentials: 'same-origin' });
    if (!response.ok) throw new Error();
    const { players } = await response.json();
    list.replaceChildren();
    if (!players.length) {
      list.innerHTML = '<p class="leaderboard-loading">Aucun joueur classé pour le moment.</p>';
      return;
    }
    players.forEach(player => list.appendChild(row(player)));
  } catch {
    list.innerHTML = '<p class="leaderboard-loading">Le classement est temporairement indisponible.</p>';
  }
}

render();
setInterval(render, 10000);
