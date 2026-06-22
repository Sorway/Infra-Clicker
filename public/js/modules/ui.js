import { ACHIEVEMENTS, BUILDINGS, CERTIFICATIONS, INFRA_LEVELS, UPGRADES } from './data.js';
import { clamp, formatNumber, randomBetween } from './utils.js';

export class GameUI {
  constructor(state, economy) {
    this.state = state;
    this.economy = economy;
    this.buyAmount = 1;
    this.activeUpgradeCategory = 'Tous';
    this.rpsHistory = Array(20).fill(0);
    this.lastTelemetryUpdate = 0;
    this.lastBuildingsUpdate = 0;
    this.lastSecondaryUpdate = 0;
    this.lastCompletedAt = Number(state.completedAt) || 0;
    this.renderCache = new Map();
    this.styleCache = new Map();
    this.buildingElements = new Map();
    this.recommendedBuilding = null;
    this.serverAnimation = null;
    this.performanceMode = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
      || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    document.documentElement.classList.toggle('performance-mode', this.performanceMode);
    this.cacheElements();
  }

  setText(element, value) {
    if (!element || this.renderCache.get(element) === value) return;
    element.textContent = value;
    this.renderCache.set(element, value);
  }

  setStyle(element, property, value) {
    if (!element) return;
    const key = `${property}:${value}`;
    if (this.styleCache.get(element) === key) return;
    element.style.setProperty(property, value);
    this.styleCache.set(element, key);
  }

  cacheElements() {
    this.el = {};
    [
      'header-rps', 'requests-stat', 'rps-stat', 'users-stat', 'main-counter', 'main-rps',
      'click-power-label', 'cpu-label', 'ram-label', 'bandwidth-label', 'infra-level',
      'infra-title', 'level-progress-label', 'achievement-count', 'shop-production',
      'cert-points', 'prestige-gain', 'save-status', 'upgrade-badge', 'combo-label',
      'combo-hint', 'overclock-status', 'shop-owned', 'missions-badge', 'achievement-total',
      'upgrade-filters', 'building-list', 'upgrade-grid', 'certification-grid',
      'missions-grid', 'tomorrow-missions-list', 'tomorrow-missions-date',
      'achievement-grid', 'achievement-preview', 'level-progress', 'prestige-points-preview',
      'prestige-preview-label', 'prestige-button', 'header-prestige-button',
      'header-prestige-gain', 'header-capacity-label', 'header-saturation',
      'header-capacity-bar', 'prestige-capacity', 'combo-bar', 'combo-meter',
      'overclock-button', 'overclock-ring', 'shop-guidance', 'cpu-bar', 'ram-bar',
      'bandwidth-bar', 'rps-sparkline', 'server-button', 'toast-container',
      'event-banner', 'event-title', 'event-description', 'event-effect', 'event-timer-bar'
    ].forEach(id => { this.el[id] = document.getElementById(id); });
    this.el.headerCapacity = document.querySelector('.header-capacity');
  }

  renderStatic() {
    this.setText(this.el['achievement-total'], String(ACHIEVEMENTS.length));
    this.renderUpgradeFilters();
    this.renderBuildings();
    this.renderUpgrades();
    this.renderCertifications();
    this.renderAchievements();
  }

  renderUpgradeFilters() {
    const categories = ['Tous', ...new Set(UPGRADES.map(upgrade => upgrade.category))];
    this.el['upgrade-filters'].innerHTML = categories.map(category => (
      `<button class="filter-button ${category === this.activeUpgradeCategory ? 'active' : ''}" data-category="${category}">${category}</button>`
    )).join('');
  }

  renderBuildings() {
    const container = this.el['building-list'];
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
    this.buildingElements = new Map(BUILDINGS.map(building => {
      const card = container.querySelector(`[data-building="${building.id}"]`);
      return [building.id, {
        card,
        owned: card.querySelector(`[data-owned="${building.id}"]`),
        price: card.querySelector(`[data-price="${building.id}"]`),
        totalOutput: card.querySelector(`[data-total-output="${building.id}"]`),
        affordability: card.querySelector(`[data-affordability="${building.id}"]`)
      }];
    }));
  }

  renderUpgrades() {
    const filtered = UPGRADES.filter(upgrade => this.activeUpgradeCategory === 'Tous' || upgrade.category === this.activeUpgradeCategory);
    this.el['upgrade-grid'].innerHTML = filtered.map(upgrade => {
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
    this.el['certification-grid'].innerHTML = CERTIFICATIONS.map(certification => {
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

  renderMissions(manager) {
    if (!manager || !this.el['missions-grid']) return;
    manager.ensureToday();
    const missions = this.state.dailyMissions.missions;
    const ready = missions.filter(mission => !mission.claimed && manager.progress(mission) >= mission.target).length;
    const remaining = missions.filter(mission => !mission.claimed).length;
    this.el['missions-badge'].textContent = ready > 0 ? ready : remaining;
    this.el['missions-badge'].classList.toggle('complete', remaining === 0);
    this.el['missions-grid'].innerHTML = missions.map(mission => {
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
    const tomorrow = this.state.dailyMissions.next;
    const tomorrowList = this.el['tomorrow-missions-list'];
    if (tomorrow && tomorrowList) {
      const date = new Date(`${tomorrow.date}T12:00:00`);
      this.el['tomorrow-missions-date'].textContent = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      tomorrowList.innerHTML = tomorrow.missions.map(mission => {
        const reward = mission.reward.certificationPoints
          ? `+${mission.reward.certificationPoints} CP`
          : `+${formatNumber(mission.reward.requests)} requêtes`;
        return `
          <article>
            <span>${mission.id === 'requests' ? '↯' : mission.id === 'buildings' ? '▦' : '!'}</span>
            <div><strong>${mission.name}</strong><small>${mission.description} · ${formatNumber(mission.target)}</small></div>
            <em>${reward}</em>
          </article>
        `;
      }).join('');
    }
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
    this.el['achievement-grid'].innerHTML = html;
    const recent = ACHIEVEMENTS.filter(achievement => this.state.achievements.includes(achievement.id)).slice(-3).reverse();
    this.el['achievement-preview'].innerHTML = recent.length
      ? recent.map(achievement => `<div class="mini-achievement"><span>◆</span><div><strong>${achievement.name}</strong><small>${achievement.description}</small></div></div>`).join('')
      : '<p class="empty-state">Traitez votre première requête pour commencer.</p>';
  }

  update() {
    const completedAt = Number(this.state.completedAt) || 0;
    if (completedAt && completedAt !== this.lastCompletedAt) {
      const celebrationKey = `infra-clicker-completion-${completedAt}`;
      if (!sessionStorage.getItem(celebrationKey)) {
        sessionStorage.setItem(celebrationKey, '1');
        this.celebrateMaxProgress();
      }
    }
    this.lastCompletedAt = completedAt;

    const production = this.economy.getProduction();
    const clickPower = this.economy.getClickPower();
    this.setText(this.el['header-rps'], `${formatNumber(production)} req/s`);
    this.setText(this.el['requests-stat'], formatNumber(this.state.requests));
    this.setText(this.el['rps-stat'], formatNumber(production));
    this.setText(this.el['users-stat'], formatNumber(Math.max(1, Math.sqrt(this.state.lifetimeRequests) * 0.7)));
    this.setText(this.el['main-counter'], formatNumber(this.state.requests));
    this.setText(this.el['main-rps'], formatNumber(production));
    this.setText(this.el['click-power-label'], `+${formatNumber(clickPower)}`);
    this.setText(this.el['shop-production'], `${formatNumber(production)} req/s`);
    this.setText(this.el['cert-points'], String(this.state.certificationPoints));
    this.setText(this.el['achievement-count'], String(this.state.achievements.length));
    this.updateActiveGameplay();

    const currentTime = performance.now();
    if (currentTime - this.lastSecondaryUpdate > (this.performanceMode ? 1000 : 500)) {
      this.updateSecondary();
      this.lastSecondaryUpdate = currentTime;
    }
    if (currentTime - this.lastBuildingsUpdate > (this.performanceMode ? 1500 : 750)) {
      this.updateBuildings();
      this.lastBuildingsUpdate = currentTime;
    }
    if (currentTime - this.lastTelemetryUpdate > (this.performanceMode ? 2500 : 1500)) {
      this.updateTelemetry(production);
      this.lastTelemetryUpdate = currentTime;
    }
  }

  updateSecondary() {
    const availableUpgrades = UPGRADES.filter(upgrade => this.economy.canBuyUpgrade(upgrade)).length;
    const ownedUpgrades = this.state.upgrades.length;
    this.setText(this.el['upgrade-badge'], `${ownedUpgrades}/${UPGRADES.length}`);
    this.el['upgrade-badge'].classList.add('visible');
    this.el['upgrade-badge'].classList.toggle('complete', ownedUpgrades >= UPGRADES.length);
    this.el['upgrade-badge'].title = availableUpgrades > 0
      ? `${availableUpgrades} amélioration(s) disponible(s)`
      : ownedUpgrades >= UPGRADES.length
        ? 'Toutes les améliorations sont installées'
        : 'Aucune amélioration disponible actuellement';

    const level = this.economy.getInfraLevel();
    this.setText(this.el['infra-level'], String(level.level));
    this.setText(this.el['infra-title'], level.title);
    this.setText(this.el['level-progress-label'], level.next
      ? `${formatNumber(this.state.lifetimeRequests)} / ${formatNumber(level.next)}`
      : 'MAX');
    this.setStyle(this.el['level-progress'], 'width', `${clamp(level.progress * 100, 0, 100)}%`);

    const prestigeGain = this.economy.prestigeGain();
    const allCertificationsOwned = this.state.certifications.length >= CERTIFICATIONS.length;
    const canPrestige = prestigeGain >= 1;
    const prestigePreview = this.el['prestige-points-preview'];
    const prestigePreviewLabel = this.el['prestige-preview-label'];
    if (prestigePreview) {
      this.setText(prestigePreview, allCertificationsOwned
        ? this.state.prestigeCount
        : `+${prestigeGain}`);
    }
    if (prestigePreviewLabel) {
      this.setText(prestigePreviewLabel, allCertificationsOwned
        ? 'PRESTIGES EFFECTUÉS'
        : 'GAIN DU PROCHAIN PRESTIGE');
    }
    const prestigeButton = this.el['prestige-button'];
    prestigeButton.disabled = !canPrestige;
    this.setText(prestigeButton, allCertificationsOwned ? 'RECONSTRUIRE LA CAPACITÉ' : 'RECONSTRUIRE ET PRESTIGER');
    const headerPrestigeButton = this.el['header-prestige-button'];
    headerPrestigeButton.disabled = !canPrestige;
    this.setText(this.el['header-prestige-gain'], allCertificationsOwned ? 'MAX' : `+${prestigeGain}`);
    this.setText(this.el['prestige-gain'], allCertificationsOwned
      ? canPrestige
        ? 'Progression maximale atteinte. Une reconstruction restaure la capacité sans ajouter de points.'
        : 'Progression maximale atteinte. La reconstruction sera disponible à 1 million de requêtes.'
      : prestigeGain > 0
        ? `Gain actuel : ${prestigeGain} point${prestigeGain > 1 ? 's' : ''}. Prochain palier à ${formatNumber(this.economy.nextPrestigeThreshold())}.`
        : 'Prestige disponible à partir de 1 million de requêtes sur ce cycle.');
    const capacity = this.economy.getCapacityStatus();
    const capacityPercent = Math.round(capacity.efficiency * 100);
    const displayPercent = Math.round(capacity.percent);
    this.setText(this.el['header-capacity-label'], capacity.label);
    this.setText(this.el['header-saturation'], `${displayPercent}%`);
    this.setStyle(this.el['header-capacity-bar'], 'width', `${displayPercent}%`);
    this.el.headerCapacity.classList.toggle('saturated', capacity.saturated);
    this.el.headerCapacity.title = capacity.saturated
      ? `Saturation ${displayPercent}% · efficacité ${capacityPercent}%`
      : `Charge de capacité ${displayPercent}% · saturation à ${formatNumber(100e6)} requêtes`;
    this.setText(this.el['prestige-capacity'], capacity.efficiency >= 0.999
      ? 'Capacité disponible : 100 %. La saturation commence à 100 millions de requêtes.'
      : `Capacité saturée : efficacité ${capacityPercent} %. Un prestige restaure 100 %.`);
  }

  updateActiveGameplay() {
    const combo = this.state.combo || 0;
    const comboMultiplier = Math.min(3, 1 + Math.floor(Math.max(0, combo - 1) / 10) * 0.25);
    const comboProgress = combo > 0 ? ((combo - 1) % 10 + 1) * 10 : 0;
    this.setText(this.el['combo-label'], `x${comboMultiplier.toFixed(comboMultiplier % 1 ? 2 : 0)}`);
    this.setText(this.el['combo-hint'], combo > 1 ? `${combo} requêtes enchaînées` : 'Enchaînez les requêtes');
    this.setStyle(this.el['combo-bar'], 'width', `${comboProgress}%`);
    this.el['combo-meter'].classList.toggle('active', combo > 1);

    const button = this.el['overclock-button'];
    const activeRemaining = Math.max(0, this.state.overclockEndsAt - Date.now());
    const isActive = activeRemaining > 0;
    const charge = clamp(this.state.overclockCharge || 0, 0, 100);
    button.disabled = charge < 100 || isActive;
    button.classList.toggle('active', isActive);
    this.setStyle(this.el['overclock-ring'], '--charge', `${isActive ? 100 : charge * 3.6}deg`);
    this.setText(this.el['overclock-status'], isActive
      ? `Production x2 · ${Math.ceil(activeRemaining / 1000)}s`
      : charge >= 100 ? 'Prête' : `Charge ${Math.floor(charge)}%`);
  }

  updateBuildings() {
    const totalOwned = Object.values(this.state.buildings).reduce((sum, count) => sum + count, 0);
    this.setText(this.el['shop-owned'], formatNumber(totalOwned, 0));
    const visibleBuildings = [];
    const globalMultiplier = this.economy.getGlobalMultiplier();

    BUILDINGS.forEach(building => {
      const elements = this.buildingElements.get(building.id);
      const { card } = elements;
      const purchase = this.economy.getBuildingCost(building, this.buyAmount);
      const isVisible = this.state.lifetimeRequests >= building.baseCost * 0.25 || building.id === 'bash';
      const affordable = purchase.amount > 0 && this.state.requests >= purchase.cost;
      card.classList.toggle('unaffordable', !affordable);
      card.classList.toggle('affordable', affordable);
      card.classList.toggle('revealed', isVisible);
      card.setAttribute('aria-disabled', String(!affordable));
      this.setText(elements.owned, String(this.state.buildings[building.id]));
      this.setText(elements.price, purchase.amount
        ? `${formatNumber(purchase.cost)} ⚡`
        : '—');
      const ownedProduction = (this.state.buildings[building.id] || 0)
        * building.baseProduction
        * this.economy.getBuildingMultiplier(building.id)
        * globalMultiplier;
      this.setText(elements.totalOutput, `${formatNumber(ownedProduction)} total`);
      const progress = purchase.cost > 0 ? clamp(this.state.requests / purchase.cost * 100, 0, 100) : 0;
      this.setStyle(elements.affordability, 'width', `${progress}%`);
      card.title = affordable
        ? `Acheter ${purchase.amount} × ${building.name}`
        : `Il manque ${formatNumber(Math.max(0, purchase.cost - this.state.requests))} requêtes`;
      if (isVisible) visibleBuildings.push({ building, card, affordable, purchase });
    });

    const recommended = visibleBuildings.filter(item => item.affordable).at(-1);
    if (this.recommendedBuilding !== recommended?.card) {
      this.recommendedBuilding?.classList.remove('recommended');
      recommended?.card.classList.add('recommended');
      this.recommendedBuilding = recommended?.card || null;
    }

    const next = visibleBuildings.find(item => !item.affordable && item.purchase.amount > 0);
    const guidance = this.el['shop-guidance'];
    let guidanceHtml;
    if (recommended) {
      guidanceHtml = `<span>Conseillé</span> ${recommended.building.name} est disponible`;
    } else if (next) {
      guidanceHtml = `<span>Prochain</span> ${next.building.name} dans ${formatNumber(next.purchase.cost - this.state.requests)} requêtes`;
    } else {
      guidanceHtml = 'Toute l’infrastructure visible est disponible.';
    }
    if (this.renderCache.get(guidance) !== guidanceHtml) {
      guidance.innerHTML = guidanceHtml;
      this.renderCache.set(guidance, guidanceHtml);
    }
  }

  updateTelemetry(production) {
    const cpu = clamp(4 + Math.log10(production + 1) * 9 + randomBetween(-2, 2), 2, 98);
    const ramMb = 128 + Object.values(this.state.buildings).reduce((sum, value) => sum + value, 0) * 16;
    const ramPercent = clamp(Math.log10(ramMb) * 14, 6, 94);
    const bandwidth = production * 8;
    this.setText(this.el['cpu-label'], `${Math.round(cpu)}%`);
    this.setText(this.el['ram-label'], ramMb >= 1024 ? `${formatNumber(ramMb / 1024)} GB` : `${Math.round(ramMb)} MB`);
    this.setText(this.el['bandwidth-label'], `${formatNumber(bandwidth)}b/s`);
    this.setStyle(this.el['cpu-bar'], 'width', `${cpu}%`);
    this.setStyle(this.el['ram-bar'], 'width', `${ramPercent}%`);
    this.setStyle(this.el['bandwidth-bar'], 'width', `${clamp(Math.log10(bandwidth + 1) * 12, 1, 95)}%`);
    this.rpsHistory.push(production);
    this.rpsHistory.shift();
    const max = Math.max(...this.rpsHistory, 1);
    const points = this.rpsHistory.map((value, index) => {
      const x = index / (this.rpsHistory.length - 1) * 100;
      const y = 34 - Math.max(2, value / max * 30);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    const lastPoint = points.split(' ').at(-1).split(',');
    this.el['rps-sparkline'].innerHTML = `
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
    const server = this.el['server-button'];
    this.serverAnimation?.cancel();
    if (server.animate) {
      this.serverAnimation = server.animate([
        { transform: 'scale(1) translateY(0)' },
        { transform: 'scale(.91) translateY(7px)', offset: .4 },
        { transform: 'scale(1.04) translateY(-3px)', offset: .75 },
        { transform: 'scale(1) translateY(0)' }
      ], { duration: 320, easing: 'cubic-bezier(.2, .9, .3, 1.4)' });
    }

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
    const particleCount = this.performanceMode ? (options.critical ? 3 : 0) : (options.critical ? 8 : 3);
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement('i');
      particle.className = 'particle';
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--tx', `${randomBetween(-75, 75)}px`);
      particle.style.setProperty('--ty', `${randomBetween(-95, -25)}px`);
      particle.style.background = colors[index % colors.length];
      fragment.appendChild(particle);
      setTimeout(() => particle.remove(), 700);
    }
    document.body.appendChild(fragment);
  }

  celebrateMaxProgress() {
    document.querySelector('.max-progress-celebration')?.remove();
    const elapsed = Math.max(0, (Number(this.state.completedAt) || Date.now()) - this.state.startedAt);
    const totalSeconds = Math.floor(elapsed / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds % 86400 / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    const duration = days > 0
      ? `${days}j ${hours}h ${minutes}min`
      : hours > 0
        ? `${hours}h ${minutes}min`
        : minutes > 0
          ? `${minutes}min ${seconds}s`
          : `${seconds}s`;

    const celebration = document.createElement('div');
    celebration.className = 'max-progress-celebration';
    celebration.setAttribute('aria-hidden', 'true');
    celebration.innerHTML = `
      <div class="max-progress-halo"></div>
      <div class="max-progress-rays"></div>
      <div class="max-progress-message">
        <div class="max-progress-trophy">✓</div>
        <span>◆ INFRASTRUCTURE ULTIME ◆</span>
        <strong>Jeu terminé !</strong>
        <small>Toutes les certifications et améliorations sont actives</small>
        <em>Terminé en ${duration}</em>
      </div>
    `;

    if (!this.performanceMode) {
      for (let index = 0; index < 30; index += 1) {
        const particle = document.createElement('i');
        particle.style.setProperty('--x', `${randomBetween(4, 96)}vw`);
        particle.style.setProperty('--delay', `${randomBetween(0, 0.8)}s`);
        particle.style.setProperty('--duration', `${randomBetween(2.2, 4)}s`);
        particle.style.setProperty('--drift', `${randomBetween(-110, 110)}px`);
        particle.style.setProperty('--spin', `${randomBetween(180, 720)}deg`);
        celebration.appendChild(particle);
      }
    }

    document.body.appendChild(celebration);
    setTimeout(() => celebration.classList.add('leaving'), 4300);
    setTimeout(() => celebration.remove(), 5200);
  }

  toast(title, message, type = 'info') {
    const container = this.el['toast-container'];
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

  showEvent(event) {
    const banner = this.el['event-banner'];
    banner.classList.remove('hidden', 'danger', 'bonus');
    banner.classList.add(event.type);
    this.setText(this.el['event-title'], event.title);
    this.setText(this.el['event-description'], event.description);
    const effects = [];
    if (event.multiplier > 1) effects.push(`Production x${event.multiplier}`);
    if (event.multiplier < 1) effects.push(`Production ${Math.round((event.multiplier - 1) * 100)}%`);
    if (event.clickMultiplier > 1) effects.push(`Clic x${event.clickMultiplier}`);
    if (event.clickMultiplier < 1) effects.push(`Clic ${Math.round((event.clickMultiplier - 1) * 100)}%`);
    if (event.instantSeconds) effects.push(`+${Math.round(event.instantSeconds / 60)} min`);
    if (event.overclockCharge) effects.push(`+${event.overclockCharge}% surcharge`);
    this.setText(this.el['event-effect'], effects.join(' · '));
    this.toast(event.title, event.description, event.type);
  }

  updateEvent(event) {
    const remaining = Math.max(0, event.endsAt - Date.now());
    const percent = remaining / (event.duration * 1000) * 100;
    this.setStyle(this.el['event-timer-bar'], 'width', `${percent}%`);
  }

  hideEvent(event) {
    this.el['event-banner'].classList.add('hidden');
    if (!this.state.commandsUsed.includes(`event:${event.id}`)) this.state.commandsUsed.push(`event:${event.id}`);
    this.toast('Incident résolu', `${event.title} est terminé.`, 'info');
  }

  refreshCollections() {
    this.renderUpgrades();
    this.renderCertifications();
    this.renderAchievements();
  }
}
