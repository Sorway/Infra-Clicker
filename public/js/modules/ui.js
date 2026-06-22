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
    this.lastKnownLevel = null;
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
    const images = {
      bash: 'bash_script', pi: 'raspberry_pi', mini: 'mini_server', nas: 'nas', serverroom: 'salle_server',
      switch: 'switch', firewall: 'firewall', rack: 'rack_42u', datacenter: 'datacenter',
      kubernetes: 'cluster_kubernetes', privatecloud: 'cloud_private', worldcloud: 'cloud_mondial'
    };
    container.innerHTML = BUILDINGS.map((building, index) => `
      <button class="building-card" data-building="${building.id}" style="--delay:${index * 35}ms">
        <span class="building-icon${images[building.id] ? ' has-img' : ''}">${images[building.id]
          ? `<img src="/img/buildings/${images[building.id]}.png" alt="" loading="lazy" draggable="false">`
          : building.icon}</span>
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
    this.updateNocTopstats(production);
    this.updateYnovFigures();
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
    const avatar = document.querySelector('.server-avatar');
    if (avatar) avatar.style.setProperty('--avatar-img', `url("/img/buildings/level${clamp(level.level, 1, 9)}.png")`);
    // Célébration de montée de niveau (thème Ynov). Le garde !== null évite
    // tout déclenchement au premier rendu (chargement / rechargement).
    if (this.lastKnownLevel !== null && level.level > this.lastKnownLevel) {
      this.ynovLevelUp(level.level, level.title);
    }
    this.lastKnownLevel = level.level;
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
    const comboMeter = this.el['combo-meter'];
    this.setStyle(this.el['combo-bar'], 'width', `${comboProgress}%`);
    comboMeter.style.setProperty('--combo-fill', `${comboProgress}%`);
    // Couleur qui « monte » avec le multiplicateur (teal → cyber → orange → rouge)
    const comboColor = comboMultiplier >= 2.5 ? '#e6172d'
      : comboMultiplier >= 1.75 ? '#f5822b'
        : comboMultiplier >= 1.25 ? '#5affb6'
          : '#1f9e91';
    comboMeter.style.setProperty('--combo-color', comboColor);
    comboMeter.classList.toggle('active', combo > 1);
    this.renderYnovComboGauge(comboMultiplier, comboColor);

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
    const bwPercent = clamp(Math.log10(bandwidth + 1) * 12, 1, 95);
    this.renderYnovGauges(cpu, ramPercent, bwPercent);
    this.setStyle(this.el['cpu-bar'], 'width', `${cpu}%`);
    this.setStyle(this.el['ram-bar'], 'width', `${ramPercent}%`);
    this.setStyle(this.el['bandwidth-bar'], 'width', `${bwPercent}%`);
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
    this.renderNocGraph();
  }

  // Graphe "DÉBIT EN DIRECT" du thème NOC : vraie série temporelle tracée
  // à partir de rpsHistory, avec axe Y en req/s et une ligne de seuil
  // CAPACITÉ pointillée qui descend vers la courbe à mesure qu'on sature.
  renderNocGraph() {
    const host = document.querySelector('#noc-graph');
    if (!host || document.documentElement.dataset.theme !== 'noc') return;
    const W = 1000;
    const H = 300;
    const padT = 16;
    const padB = 18;
    const usable = H - padT - padB;
    const max = Math.max(...this.rpsHistory, 1);
    const n = this.rpsHistory.length;
    const coords = this.rpsHistory.map((value, index) => {
      const x = index / (n - 1) * W;
      const y = padT + usable - Math.max(0, value / max * usable);
      return [x, y];
    });
    const points = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const areaPath = `M 0 ${padT + usable} L ${coords.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} L ${W} ${padT + usable} Z`;
    const last = coords[coords.length - 1];
    const gridY = [0, 0.25, 0.5, 0.75, 1].map(r => padT + usable * r);
    const axis = [1, 0.75, 0.5, 0.25, 0].map(r => formatNumber(max * r));

    const capacity = this.economy.getCapacityStatus();
    const headroom = clamp(capacity.efficiency ?? 1, 0, 1);
    const capY = padT + (1 - headroom) * usable;
    const capLabel = capacity.saturated ? `SATURATION ${Math.round(capacity.percent)}%` : 'CAPACITÉ';
    const capColor = capacity.saturated ? 'var(--crit)' : 'var(--warn)';

    host.innerHTML = `
      <div class="noc-graph-axis" aria-hidden="true">${axis.map(v => `<span>${v}</span>`).join('')}</div>
      <svg class="noc-graph-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Débit en direct">
        <defs>
          <linearGradient id="noc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--signal)" stop-opacity=".18"/>
            <stop offset="100%" stop-color="var(--signal)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <g class="noc-graph-grid">${gridY.map(y => `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`).join('')}</g>
        <line class="noc-graph-cap" x1="0" y1="${capY.toFixed(1)}" x2="${W}" y2="${capY.toFixed(1)}" stroke="${capColor}"/>
        <text class="noc-graph-cap-label" x="${W - 6}" y="${(capY - 5).toFixed(1)}" fill="${capColor}">${capLabel}</text>
        <path class="noc-graph-area" d="${areaPath}" fill="url(#noc-area)"/>
        <polyline class="noc-graph-line" points="${points}"/>
        <circle class="noc-graph-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4"/>
      </svg>
    `;
  }

  // Cluster de statut NOC en haut : DÉBIT · SATURATION · UPTIME · INCIDENTS.
  // Remplace la lecture isolée "PRODUCTION 0,0 req/s". Inactif hors NOC.
  updateNocTopstats(production) {
    const rps = document.querySelector('#noc-ts-rps');
    if (!rps || document.documentElement.dataset.theme !== 'noc') return;
    rps.textContent = `${formatNumber(production)} req/s`;

    const capacity = this.economy.getCapacityStatus();
    const sat = Math.round(capacity.saturated ? capacity.percent : 0);
    const satCell = document.querySelector('#noc-ts-sat');
    satCell.textContent = `${sat}%`;
    const satWrap = satCell.closest('.noc-ts');
    if (satWrap) {
      satWrap.classList.toggle('warn', sat >= 40 && sat < 70);
      satWrap.classList.toggle('crit', sat >= 70);
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - (this.state.startedAt || Date.now())) / 1000));
    const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    document.querySelector('#noc-ts-uptime').textContent = `${hh}:${mm}:${ss}`;

    document.querySelector('#noc-ts-incidents').textContent = String(this.state.eventsCompleted || 0);
  }

  // Jauges CPU/RAM/BANDE façon Grafana (thème Ynov) : demi-cercle avec
  // dégradé vert→jaune→rouge, valeur + label centrés, mini-sparkline de
  // tendance + point coloré en bout. Inactif hors Ynov.
  renderYnovGauges(cpu, ram, bw) {
    const host = document.querySelector('#ynov-gauges');
    if (!host || document.documentElement.dataset.theme !== 'ynov') return;
    this.ynovMetricHistory ||= { cpu: Array(26).fill(0), ram: Array(26).fill(0), bp: Array(26).fill(0) };
    const R = 42, L = Math.PI * R;                 // longueur du demi-cercle
    const arc = r => `M ${50 - r} 50 A ${r} ${r} 0 0 1 ${50 + r} 50`;
    const stateColor = p => (p >= 80 ? '#f2495c' : p >= 55 ? '#f2cc0c' : '#73bf69');
    // Tout est dans le SVG → valeur, label et sparkline À L'INTÉRIEUR de l'arc.
    const gauge = (key, pct, valueText, name) => {
      const p = Math.max(0, Math.min(100, pct));
      const dash = (p / 100 * L).toFixed(1);
      const col = stateColor(p);
      const hist = this.ynovMetricHistory[key];
      hist.push(p); hist.shift();
      const min = Math.min(...hist), max = Math.max(...hist), range = Math.max(1, max - min);
      const sx = i => (26 + i / (hist.length - 1) * 48).toFixed(1);
      const sy = v => (50.5 - (v - min) / range * 6).toFixed(1);   // dans le bas de l'arc
      const pts = hist.map((v, i) => `${sx(i)},${sy(v)}`).join(' ');
      const lx = sx(hist.length - 1), ly = sy(hist[hist.length - 1]);
      // Taille de la valeur adaptée à sa longueur pour ne jamais toucher l'arc.
      const n = (valueText || '').length;
      const fs = n <= 2 ? 18 : n <= 3 ? 16.5 : n <= 4 ? 14.5 : n <= 6 ? 12 : 10;
      return `
        <svg class="yg2-svg" viewBox="0 0 100 58" aria-hidden="true">
          <defs><linearGradient id="yggrad-${key}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#73bf69"/><stop offset="48%" stop-color="#f2cc0c"/>
            <stop offset="78%" stop-color="#ff9830"/><stop offset="100%" stop-color="#f2495c"/>
          </linearGradient></defs>
          <path class="yg2-thin" d="${arc(48)}" stroke="url(#yggrad-${key})"/>
          <path class="yg2-track" d="${arc(R)}"/>
          <path class="yg2-val" d="${arc(R)}" stroke="url(#yggrad-${key})" stroke-dasharray="${dash} ${L.toFixed(1)}"/>
          <text class="yg2-num" x="50" y="34" style="font-size:${fs}px">${valueText}</text>
          <text class="yg2-lbl" x="50" y="44">${name}</text>
          <polyline class="yg2-spark" points="${pts}" style="stroke:${col}"/>
          <circle class="yg2-dot" cx="${lx}" cy="${ly}" r="1.7" style="fill:${col}"/>
        </svg>`;
    };
    // CPU + RAM en grandes jauges (pleine largeur, 2 colonnes)
    host.innerHTML =
      gauge('cpu', cpu, this.el['cpu-label'].textContent, 'CPU')
      + gauge('ram', ram, this.el['ram-label'].textContent, 'RAM');
    // BANDE PASSANTE déplacée en stat compacte à côté d'UTILISATEURS
    const bpValue = document.querySelector('#ynov-bp-value');
    if (bpValue) bpValue.textContent = this.el['bandwidth-label'].textContent;
  }

  // Combo en gauge radiale (thème Ynov), même style que les jauges CPU.
  // Affiche le MULTIPLICATEUR atteint ; ne se met à jour que lorsqu'il change
  // (donc ne bouge pas à chaque clic dans un même palier).
  renderYnovComboGauge(multiplier, color) {
    const meter = document.querySelector('#combo-meter');
    if (!meter || document.documentElement.dataset.theme !== 'ynov') return;
    let arc = meter.querySelector('#ynov-combo-arc');
    if (!arc) {
      arc = document.createElement('div');
      arc.id = 'ynov-combo-arc';
      arc.className = 'yg';
      arc.innerHTML = '<svg viewBox="0 0 100 100" class="yg-svg" aria-hidden="true">'
        + '<circle class="yg-track" cx="50" cy="50" r="40" transform="rotate(135 50 50)" stroke-dasharray="188.5 251.3"></circle>'
        + '<circle class="yg-value" cx="50" cy="50" r="40" transform="rotate(135 50 50)" stroke-dasharray="0 251.3"></circle>'
        + '</svg><div class="yg-center"><strong>x1</strong><span>COMBO</span></div>';
      meter.appendChild(arc);
    }
    if (multiplier === this._comboGaugeMult) return;
    this._comboGaugeMult = multiplier;
    const ARC = 188.5;
    const pct = clamp((multiplier - 1) / 2, 0, 1);
    arc.querySelector('.yg-value').setAttribute('stroke-dasharray', `${(pct * ARC).toFixed(1)} 251.3`);
    arc.querySelector('.yg-value').style.stroke = color;
    arc.querySelector('.yg-center strong').textContent = `x${multiplier.toFixed(multiplier % 1 ? 2 : 0)}`;
  }

  // Bande chiffres-clés du thème Ynov GRAND FORMAT : miroir des stats
  // déjà calculées (zéro recalcul, aucune duplication). Inactif hors Ynov.
  updateYnovFigures() {
    const probe = document.querySelector('#yf-req');
    if (!probe || document.documentElement.dataset.theme !== 'ynov') return;
    const map = {
      'yf-req': 'requests-stat', 'yf-rps': 'rps-stat', 'yf-users': 'users-stat',
      'yf-cpu': 'cpu-label', 'yf-ram': 'ram-label', 'yf-bp': 'bandwidth-label'
    };
    for (const dst in map) {
      const src = document.getElementById(map[dst]);
      const cell = document.getElementById(dst);
      if (src && cell) cell.textContent = src.textContent;
    }
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

  // Effet plein écran "éclair" à l'activation de la Surcharge (thème Ynov).
  ynovLightningStrike() {
    if (document.documentElement.dataset.theme !== 'ynov') return;
    document.querySelector('.ynov-strike')?.remove();
    const el = document.createElement('div');
    el.className = 'ynov-strike';
    el.innerHTML = '<svg viewBox="0 0 200 400" class="ynov-strike-bolt" aria-hidden="true"><path d="M116 8 44 214 100 214 84 392 168 168 110 168 132 8Z"/></svg>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  // Célébration plein écran à chaque montée de niveau (thème Ynov) :
  // bandeau « LEVEL UP! » + badge du niveau atteint + gerbe d'étoiles.
  // Gated Ynov + performanceMode (pas d'étoiles), pointer-events:none, auto-nettoyée.
  ynovLevelUp(level, title) {
    if (document.documentElement.dataset.theme !== 'ynov') return;
    document.querySelector('.ynov-levelup')?.remove();
    const n = clamp(level, 1, 9);
    const el = document.createElement('div');
    el.className = 'ynov-levelup';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="ynov-levelup-stars"></div>
      <div class="ynov-levelup-stack">
        <img class="ynov-levelup-tag" src="/img/buildings/level_up.png" alt="">
        <img class="ynov-levelup-badge" src="/img/buildings/level${n}.png" alt="">
        <div class="ynov-levelup-cap"><strong>NIVEAU ${level}</strong><span>${title || ''}</span></div>
      </div>`;
    if (!this.performanceMode) {
      const stars = el.querySelector('.ynov-levelup-stars');
      for (let i = 0; i < 16; i += 1) {
        const star = document.createElement('i');
        star.className = 'ynov-star' + (i % 3 === 0 ? ' alt' : '');
        const angle = randomBetween(0, Math.PI * 2);
        const distance = randomBetween(120, 260);
        star.style.setProperty('--tx', `${Math.round(Math.cos(angle) * distance)}px`);
        star.style.setProperty('--ty', `${Math.round(Math.sin(angle) * distance)}px`);
        star.style.setProperty('--spin', `${Math.round(randomBetween(180, 540))}deg`);
        star.style.setProperty('--delay', `${Math.round(randomBetween(0, 120))}ms`);
        stars.appendChild(star);
      }
    }
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('leaving'), 1700);
    setTimeout(() => el.remove(), 2400);
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
