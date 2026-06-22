import { formatNumber } from './modules/utils.js';

function normalizedCountryCode(countryCode) {
  const code = String(countryCode || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) && code !== 'xx' ? code : null;
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
    image.src = `/flags/4x3/${countryCode}.svg`;
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

  const requests = document.createElement('strong');
  requests.className = 'leaderboard-score';
  requests.textContent = formatNumber(player.requests);

  article.append(rank, identity, prestige, requests);
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
