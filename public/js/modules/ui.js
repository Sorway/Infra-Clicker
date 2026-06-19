import { ACHIEVEMENTS, BUILDINGS, CERTIFICATIONS, INFRA_LEVELS, PERMANENT_SKILLS, UPGRADES } from './data.js';
import { clamp, formatNumber, randomBetween } from './utils.js';

export class GameUI {
  constructor(state, economy) {
    this.state = state;
    this.economy = economy;
    this.buyAmount = 1;
    this.activeUpgradeCategory = 'Tous';
    this.rpsHistory = Array(20).fill(0);
    this.lastTelemetryUpdate = 0;
    this.cacheElements();
  }

  cacheElements() {
    this.el = {};
    [
      'header-rps', 'requests-stat', 'rps-stat', 'users-stat', 'main-counter', 'main-rps',
      'click-power-label', 'cpu-label', 'ram-label', 'bandwidth-label', 'infra-level',
      'infra-title', 'level-progress-label', 'achievement-count', 'shop-production',
      'cert-points', 'prestige-gain', 'save-status', 'upgrade-badge', 'combo-label',
      'combo-hint', 'overclock-status', 'shop-owned', 'skill-points', 'missions-badge'
    ].forEach(id => { this.el[id] = document.getElementById(id); });
  }

  renderStatic() {
    this.renderUpgradeFilters();
    this.renderBuildings();
    this.renderUpgrades();
    this.renderCertifications();
    this.renderSkillTree();
    this.renderAchievements();
  }

  renderUpgradeFilters() {
    const categories = ['Tous', ...new Set(UPGRADES.map(upgrade => upgrade.category))];
    document.querySelector('#upgrade-filters').innerHTML = categories.map(category => (
      `<button class="filter-button ${category === this.activeUpgradeCategory ? 'active' : ''}" data-category="${category}">${category}</button>`
    )).join('');
  }

  renderBuildings() {
    const container = document.querySelector('#building-list');
    container.innerHTML = BUILDINGS.map((building, index) => `
      <button class="building-card" data-building="${building.id}" style="--delay:${index * 35}ms">
        <span class="building-icon">${building.icon}</span>
        <span class="building-info">
          <span class="building-name">${building.name}</span>
          <span class="building-output">
            <span data-unit-output="${building.id}">${formatNumber(building.baseProduction)} req/s</span>
            <small data-total-output="${building.id}">0 au total</small>
          </span>
        </span>
        <span class="building-buy">
          <strong class="building-owned" data-owned="${building.id}">0</strong>
          <span class="building-price" data-price="${building.id}">15</span>
        </span>
        <span class="building-affordability"><i data-affordability="${building.id}"></i></span>
      </button>
    `).join('');
  }

  renderUpgrades() {
    const filtered = UPGRADES.filter(upgrade => this.activeUpgradeCategory === 'Tous' || upgrade.category === this.activeUpgradeCategory);
    document.querySelector('#upgrade-grid').innerHTML = filtered.map(upgrade => {
      const owned = this.state.upgrades.includes(upgrade.id);
      const locked = upgrade.requires && !this.state.upgrades.includes(upgrade.requires);
      const requirement = locked ? UPGRADES.find(item => item.id === upgrade.requires)?.name : '';
      return `
        <button class="upgrade-card ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}" data-upgrade="${upgrade.id}" title="${upgrade.description}">
          <span class="upgrade-icon ${upgrade.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}">${upgrade.icon}</span>
          <span><strong>${upgrade.name}</strong><small>${owned ? 'INSTALLÉ' : locked ? `REQUIS : ${requirement}` : formatNumber(upgrade.cost)}</small></span>
        </button>
      `;
    }).join('');
  }

  renderCertifications() {
    document.querySelector('#certification-grid').innerHTML = CERTIFICATIONS.map(certification => {
      const owned = this.state.certifications.includes(certification.id);
      return `
        <button class="cert-card ${owned ? 'owned' : ''}" data-certification="${certification.id}">
          <span class="cert-icon">${certification.icon}</span>
          <span><strong>${certification.name}</strong><small>${certification.description}</small></span>
          <em>${owned ? 'ACQUISE' : `${certification.cost} CP`}</em>
        </button>
      `;
    }).join('');
  }

  renderSkillTree() {
    this.el['skill-points'].textContent = this.state.certificationPoints;
    document.querySelector('#skill-tree').innerHTML = PERMANENT_SKILLS.map((skill, index) => {
      const owned = this.state.permanentSkills?.includes(skill.id);
      const required = !skill.requires || this.state.permanentSkills?.includes(skill.requires);
      const anyRequired = !skill.requiresAny || skill.requiresAny.some(id => this.state.permanentSkills?.includes(id));
      const locked = !required || !anyRequired;
      const affordable = this.state.certificationPoints >= skill.cost;
      return `
        <button class="skill-node ${owned ? 'owned' : ''} ${locked ? 'locked' : ''} ${affordable ? 'affordable' : ''}"
          data-skill="${skill.id}" style="--skill-index:${index}">
          <span class="skill-node-icon">${skill.icon}</span>
          <span><strong>${skill.name}</strong><small>${skill.description}</small></span>
          <em>${owned ? 'ACQUISE' : `${skill.cost} CP`}</em>
        </button>
      `;
    }).join('');
  }

  renderMissions(manager) {
    if (!manager || !document.querySelector('#missions-grid')) return;
    manager.ensureToday();
    const missions = this.state.dailyMissions.missions;
    const ready = missions.filter(mission => !mission.claimed && manager.progress(mission) >= mission.target).length;
    const remaining = missions.filter(mission => !mission.claimed).length;
    this.el['missions-badge'].textContent = ready > 0 ? ready : remaining;
    this.el['missions-badge'].classList.toggle('complete', remaining === 0);
    document.querySelector('#missions-grid').innerHTML = missions.map(mission => {
      const progress = Math.min(mission.target, manager.progress(mission));
      const complete = progress >= mission.target;
      const reward = mission.reward.certificationPoints
        ? `+${mission.reward.certificationPoints} CP`
        : `+${formatNumber(mission.reward.requests)} requêtes`;
      return `
        <article class="mission-card ${complete ? 'complete' : ''} ${mission.claimed ? 'claimed' : ''}">
          <div class="mission-card-heading"><span>${mission.id === 'requests' ? '↯' : mission.id === 'buildings' ? '▦' : '!'}</span><div><strong>${mission.name}</strong><small>${mission.description}</small></div></div>
          <div class="mission-progress-label"><span>${formatNumber(progress)} / ${formatNumber(mission.target)}</span><em>${reward}</em></div>
          <div class="mission-progress"><span style="width:${progress / mission.target * 100}%"></span></div>
          <button data-mission-claim="${mission.id}" ${!complete || mission.claimed ? 'disabled' : ''}>${mission.claimed ? 'RÉCUPÉRÉE' : complete ? 'RÉCUPÉRER' : 'EN COURS'}</button>
        </article>
      `;
    }).join('');
  }

  renderAchievements() {
    const html = ACHIEVEMENTS.map(achievement => {
      const unlocked = this.state.achievements.includes(achievement.id);
      return `
        <article class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
          <span class="achievement-medal">${unlocked ? '◆' : '?'}</span>
          <div><strong>${unlocked ? achievement.name : 'Succès verrouillé'}</strong><small>${unlocked ? achievement.description : achievement.description}</small></div>
        </article>
      `;
    }).join('');
    document.querySelector('#achievement-grid').innerHTML = html;
    const recent = ACHIEVEMENTS.filter(achievement => this.state.achievements.includes(achievement.id)).slice(-3).reverse();
    document.querySelector('#achievement-preview').innerHTML = recent.length
      ? recent.map(achievement => `<div class="mini-achievement"><span>◆</span><div><strong>${achievement.name}</strong><small>${achievement.description}</small></div></div>`).join('')
      : '<p class="empty-state">Traitez votre première requête pour commencer.</p>';
  }

  update() {
    const production = this.economy.getProduction();
    const clickPower = this.economy.getClickPower();
    this.el['header-rps'].textContent = `${formatNumber(production)} req/s`;
    this.el['requests-stat'].textContent = formatNumber(this.state.requests);
    this.el['rps-stat'].textContent = formatNumber(production);
    this.el['users-stat'].textContent = formatNumber(Math.max(1, Math.sqrt(this.state.lifetimeRequests) * 0.7));
    this.el['main-counter'].textContent = formatNumber(this.state.requests);
    this.el['main-rps'].textContent = formatNumber(production);
    this.el['click-power-label'].textContent = `+${formatNumber(clickPower)}`;
    this.el['shop-production'].textContent = `${formatNumber(production)} req/s`;
    this.el['cert-points'].textContent = this.state.certificationPoints;
    this.el['skill-points'].textContent = this.state.certificationPoints;
    this.el['achievement-count'].textContent = this.state.achievements.length;
    this.updateActiveGameplay();
    this.updatePrestigeLock();

    const availableUpgrades = UPGRADES.filter(upgrade => this.economy.canBuyUpgrade(upgrade)).length;
    const ownedUpgrades = this.state.upgrades.length;
    this.el['upgrade-badge'].textContent = `${ownedUpgrades}/${UPGRADES.length}`;
    this.el['upgrade-badge'].classList.add('visible');
    this.el['upgrade-badge'].classList.toggle('complete', ownedUpgrades >= UPGRADES.length);
    this.el['upgrade-badge'].title = availableUpgrades > 0
      ? `${availableUpgrades} amélioration(s) disponible(s)`
      : ownedUpgrades >= UPGRADES.length
        ? 'Toutes les améliorations sont installées'
        : 'Aucune amélioration disponible actuellement';

    const level = this.economy.getInfraLevel();
    this.el['infra-level'].textContent = level.level;
    this.el['infra-title'].textContent = level.title;
    this.el['level-progress-label'].textContent = level.next
      ? `${formatNumber(this.state.lifetimeRequests)} / ${formatNumber(level.next)}`
      : 'MAX';
    document.querySelector('#level-progress').style.width = `${clamp(level.progress * 100, 0, 100)}%`;

    const prestigeGain = this.economy.prestigeGain();
    const allCertificationsOwned = this.state.certifications.length >= CERTIFICATIONS.length;
    const prestigePreview = document.querySelector('#prestige-points-preview');
    const prestigePreviewLabel = document.querySelector('#prestige-preview-label');
    if (prestigePreview) {
      prestigePreview.textContent = allCertificationsOwned
        ? this.state.prestigeCount
        : `+${prestigeGain}`;
    }
    if (prestigePreviewLabel) {
      prestigePreviewLabel.textContent = allCertificationsOwned
        ? 'PRESTIGES EFFECTUÉS'
        : 'GAIN DU PROCHAIN PRESTIGE';
    }
    const prestigeButton = document.querySelector('#prestige-button');
    prestigeButton.disabled = prestigeGain < 1 || allCertificationsOwned;
    prestigeButton.textContent = allCertificationsOwned ? 'TOUTES LES CERTIFICATIONS ACQUISES' : 'PASSER LA CERTIFICATION';
    this.el['prestige-gain'].textContent = allCertificationsOwned
      ? 'Progression maximale atteinte : aucun prestige supplémentaire nécessaire.'
      : prestigeGain > 0
        ? `Gain estimé : ${prestigeGain} point${prestigeGain > 1 ? 's' : ''} de certification.`
        : 'Atteignez 1 million de requêtes cumulées.';

    this.updateBuildings();
    if (performance.now() - this.lastTelemetryUpdate > 700) {
      this.updateTelemetry(production);
      this.lastTelemetryUpdate = performance.now();
    }
  }

  updatePrestigeLock() {
    const locked = this.economy.isPrestigeRequired();
    const banner = document.querySelector('#prestige-lock-banner');
    banner.classList.toggle('hidden', !locked);
    document.querySelector('#server-zone').classList.toggle('prestige-locked', locked);
    document.querySelector('#process-button').classList.toggle('prestige-locked', locked);
    document.querySelector('#process-button').disabled = locked;
  }

  updateActiveGameplay() {
    const combo = this.state.combo || 0;
    const comboMultiplier = Math.min(3, 1 + Math.floor(Math.max(0, combo - 1) / 10) * 0.25);
    const comboProgress = combo > 0 ? ((combo - 1) % 10 + 1) * 10 : 0;
    this.el['combo-label'].textContent = `x${comboMultiplier.toFixed(comboMultiplier % 1 ? 2 : 0)}`;
    this.el['combo-hint'].textContent = combo > 1 ? `${combo} requêtes enchaînées` : 'Enchaînez les requêtes';
    document.querySelector('#combo-bar').style.width = `${comboProgress}%`;
    document.querySelector('#combo-meter').classList.toggle('active', combo > 1);

    const button = document.querySelector('#overclock-button');
    const activeRemaining = Math.max(0, this.state.overclockEndsAt - Date.now());
    const isActive = activeRemaining > 0;
    const charge = clamp(this.state.overclockCharge || 0, 0, 100);
    button.disabled = charge < 100 || isActive;
    button.classList.toggle('active', isActive);
    document.querySelector('#overclock-ring').style.setProperty('--charge', `${isActive ? 100 : charge * 3.6}deg`);
    this.el['overclock-status'].textContent = isActive
      ? `Production x2 · ${Math.ceil(activeRemaining / 1000)}s`
      : charge >= 100 ? 'Prête' : `Charge ${Math.floor(charge)}%`;
  }

  updateBuildings() {
    const totalOwned = Object.values(this.state.buildings).reduce((sum, count) => sum + count, 0);
    this.el['shop-owned'].textContent = formatNumber(totalOwned, 0);
    const visibleBuildings = [];

    BUILDINGS.forEach(building => {
      const card = document.querySelector(`[data-building="${building.id}"]`);
      const purchase = this.economy.getBuildingCost(building, this.buyAmount);
      const isVisible = this.state.lifetimeRequests >= building.baseCost * 0.25 || building.id === 'bash';
      const affordable = purchase.amount > 0 && this.state.requests >= purchase.cost;
      card.classList.toggle('unaffordable', !affordable);
      card.classList.toggle('affordable', affordable);
      card.classList.toggle('revealed', isVisible);
      card.setAttribute('aria-disabled', String(!affordable));
      card.querySelector(`[data-owned="${building.id}"]`).textContent = this.state.buildings[building.id];
      card.querySelector(`[data-price="${building.id}"]`).textContent = purchase.amount
        ? `${formatNumber(purchase.cost)} ⚡`
        : '—';
      const ownedProduction = (this.state.buildings[building.id] || 0)
        * building.baseProduction
        * this.economy.getBuildingMultiplier(building.id)
        * this.economy.getGlobalMultiplier();
      card.querySelector(`[data-total-output="${building.id}"]`).textContent = `${formatNumber(ownedProduction)} total`;
      const progress = purchase.cost > 0 ? clamp(this.state.requests / purchase.cost * 100, 0, 100) : 0;
      card.querySelector(`[data-affordability="${building.id}"]`).style.width = `${progress}%`;
      card.title = affordable
        ? `Acheter ${purchase.amount} × ${building.name}`
        : `Il manque ${formatNumber(Math.max(0, purchase.cost - this.state.requests))} requêtes`;
      if (isVisible) visibleBuildings.push({ building, card, affordable, purchase });
    });

    document.querySelectorAll('.building-card.recommended').forEach(card => card.classList.remove('recommended'));
    const recommended = visibleBuildings.filter(item => item.affordable).at(-1);
    if (recommended) recommended.card.classList.add('recommended');

    const next = visibleBuildings.find(item => !item.affordable && item.purchase.amount > 0);
    const guidance = document.querySelector('#shop-guidance');
    if (recommended) {
      guidance.innerHTML = `<span>Conseillé</span> ${recommended.building.name} est disponible`;
    } else if (next) {
      guidance.innerHTML = `<span>Prochain</span> ${next.building.name} dans ${formatNumber(next.purchase.cost - this.state.requests)} requêtes`;
    } else {
      guidance.textContent = 'Toute l’infrastructure visible est disponible.';
    }
  }

  updateTelemetry(production) {
    const cpu = clamp(4 + Math.log10(production + 1) * 9 + randomBetween(-2, 2), 2, 98);
    const ramMb = 128 + Object.values(this.state.buildings).reduce((sum, value) => sum + value, 0) * 16;
    const ramPercent = clamp(Math.log10(ramMb) * 14, 6, 94);
    const bandwidth = production * 8;
    this.el['cpu-label'].textContent = `${Math.round(cpu)}%`;
    this.el['ram-label'].textContent = ramMb >= 1024 ? `${formatNumber(ramMb / 1024)} GB` : `${Math.round(ramMb)} MB`;
    this.el['bandwidth-label'].textContent = `${formatNumber(bandwidth)}b/s`;
    document.querySelector('#cpu-bar').style.width = `${cpu}%`;
    document.querySelector('#ram-bar').style.width = `${ramPercent}%`;
    document.querySelector('#bandwidth-bar').style.width = `${clamp(Math.log10(bandwidth + 1) * 12, 1, 95)}%`;
    this.rpsHistory.push(production);
    this.rpsHistory.shift();
    const max = Math.max(...this.rpsHistory, 1);
    const points = this.rpsHistory.map((value, index) => {
      const x = index / (this.rpsHistory.length - 1) * 100;
      const y = 34 - Math.max(2, value / max * 30);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    const lastPoint = points.split(' ').at(-1).split(',');
    document.querySelector('#rps-sparkline').innerHTML = `
      <svg viewBox="0 0 100 36" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--cyan)" stop-opacity=".34"/>
            <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="spark-area" d="M 0 36 L ${points.replaceAll(' ', ' L ')} L 100 36 Z"/>
        <polyline class="spark-line" points="${points}"/>
        <circle class="spark-point" cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="1.7"/>
      </svg>
    `;
  }

  clickEffect(x, y, amount, options = {}) {
    const server = document.querySelector('#server-button');
    server.classList.remove('clicked');
    void server.offsetWidth;
    server.classList.add('clicked');

    const floating = document.createElement('span');
    floating.className = `floating-number ${options.critical ? 'critical' : ''}`;
    floating.textContent = options.critical ? `CRIT +${formatNumber(amount)}` : `+${formatNumber(amount)}`;
    floating.style.left = `${x}px`;
    floating.style.top = `${y}px`;
    document.body.appendChild(floating);
    setTimeout(() => floating.remove(), 900);

    const colors = options.critical
      ? ['#fff0bd', '#fb7185', '#fbbf24']
      : ['var(--cyan)', 'var(--green)', 'var(--purple)'];
    const particleCount = options.critical ? 14 : 7;
    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement('i');
      particle.className = 'particle';
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--tx', `${randomBetween(-75, 75)}px`);
      particle.style.setProperty('--ty', `${randomBetween(-95, -25)}px`);
      particle.style.background = colors[index % colors.length];
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 700);
    }
  }

  toast(title, message, type = 'info') {
    const container = document.querySelector('#toast-container');
    const visibleToasts = container.querySelectorAll('.toast');
    if (visibleToasts.length >= 3) {
      visibleToasts[0].remove();
    }

    const toast = document.createElement('article');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'achievement' ? '◆' : type === 'danger' ? '!' : '●'}</span><div><strong>${title}</strong><small>${message}</small></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('leaving'), 4200);
    setTimeout(() => toast.remove(), 4700);
  }

  showAntiCheat(reason) {
    const modal = document.querySelector('#anti-cheat-modal');
    document.querySelector('#anti-cheat-message').textContent = `${reason}. Cette action a été ignorée ou corrigée.`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => modal.querySelector('.anti-cheat-acknowledge')?.focus(), 50);
  }

  showEvent(event) {
    const banner = document.querySelector('#event-banner');
    banner.classList.remove('hidden', 'danger', 'bonus');
    banner.classList.add(event.type);
    document.querySelector('#event-title').textContent = event.title;
    document.querySelector('#event-description').textContent = event.description;
    const effects = [];
    if (event.multiplier > 1) effects.push(`Production x${event.multiplier}`);
    if (event.multiplier < 1) effects.push(`Production ${Math.round((event.multiplier - 1) * 100)}%`);
    if (event.clickMultiplier > 1) effects.push(`Clic x${event.clickMultiplier}`);
    if (event.clickMultiplier < 1) effects.push(`Clic ${Math.round((event.clickMultiplier - 1) * 100)}%`);
    if (event.instantSeconds) effects.push(`+${Math.round(event.instantSeconds / 60)} min`);
    if (event.overclockCharge) effects.push(`+${event.overclockCharge}% surcharge`);
    document.querySelector('#event-effect').textContent = effects.join(' · ');
    this.toast(event.title, event.description, event.type);
  }

  updateEvent(event) {
    const remaining = Math.max(0, event.endsAt - Date.now());
    const percent = remaining / (event.duration * 1000) * 100;
    document.querySelector('#event-timer-bar').style.width = `${percent}%`;
  }

  hideEvent(event) {
    document.querySelector('#event-banner').classList.add('hidden');
    if (!this.state.commandsUsed.includes(`event:${event.id}`)) this.state.commandsUsed.push(`event:${event.id}`);
    this.toast('Incident résolu', `${event.title} est terminé.`, 'info');
  }

  refreshCollections() {
    this.renderUpgrades();
    this.renderCertifications();
    this.renderSkillTree();
    this.renderAchievements();
  }
}
