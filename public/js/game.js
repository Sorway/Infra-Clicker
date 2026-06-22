import { AchievementManager } from './modules/achievements.js';
import { AudioManager } from './modules/audio.js';
import { ACTIVE_DLC, BUILDINGS, CERTIFICATIONS, UPGRADES } from './modules/data.js';
import { Economy } from './modules/economy.js';
import { EventManager } from './modules/events.js';
import { MissionManager } from './modules/missions.js';
import { consumeV2ResetNotice, SaveManager } from './modules/save.js';
import { ServerGame } from './modules/server.js';
import { Terminal } from './modules/terminal.js';
import { GameUI } from './modules/ui.js';

class InfraClicker {
  constructor() {
    this.showV2ResetNotice = consumeV2ResetNotice();
    this.saveManager = new SaveManager(status => {
      const element = document.querySelector('#save-status');
      if (element) element.textContent = status;
    });
    this.state = this.saveManager.load();
    this.server = new ServerGame();
    this.economy = new Economy(this.state);
    this.audio = new AudioManager(this.state.soundEnabled);
    this.ui = new GameUI(this.state, this.economy);
    this.achievements = new AchievementManager(this.state, this.economy, this.ui, this.audio);
    this.events = new EventManager(this.state, this.economy, this.ui, this.audio);
    this.missions = new MissionManager(this.state, this.ui);
    this.terminal = new Terminal(this.state, this.economy, this.ui, () => this.achievements.check());
    this.lastFrame = performance.now();
    this.lastProductionAt = Date.now();
    this.lastAchievementCheck = 0;
    this.lastMissionUpdate = 0;
    this.lastHistorySample = 0;
    this.lastUiUpdate = 0;
    this.isDesynced = false;
    this.syncInProgress = false;
    this.initialized = false;
    this.bindDesyncScreen();
    this.init().catch(error => {
      console.error(error);
      this.showDesyncScreen(error.message);
      this.startInitialReconnect();
    });
  }

  async init() {
    this.initTheme();
    this.applyDlcTheme();
    const initialPayload = await this.server.load(this.state);
    this.ui.renderStatic();
    this.bindGameActions();
    this.bindNavigation();
    this.bindSaveControls();
    this.updateSoundButton();
    this.ui.update();
    this.applyProfile(initialPayload.profile);
    if (initialPayload.serverBehind) await this.server.sync(this.state);
    if (!initialPayload.profile?.username) await this.requireProfile();
    if (this.showV2ResetNotice) this.openV2ResetNotice();
    this.initialized = true;
    this.hideDesyncScreen();
    this.loop(performance.now());
    this.autosaveTimer = setInterval(() => this.saveManager.save(this.state), 30000);
    this.serverSyncTimer = setInterval(() => this.synchronize(), 5000);
    this.updateOnlinePlayers();
    this.presenceTimer = setInterval(() => this.updateOnlinePlayers(), 20000);
    window.addEventListener('beforeunload', () => {
      this.saveManager.save(this.state);
      this.server.sync(this.state, true).catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveManager.save(this.state);
        this.synchronize();
      }
      this.lastFrame = performance.now();
    });
  }

  bindDesyncScreen() {
    window.addEventListener('infra:server-disconnected', event => {
      this.showDesyncScreen(event.detail?.message);
    });
    document.querySelector('#desync-retry')?.addEventListener('click', () => {
      if (this.initialized) this.synchronize(true);
      else this.retryInitialConnection();
    });
    document.querySelector('#desync-reload')?.addEventListener('click', () => window.location.reload());
  }

  showDesyncScreen(message = '') {
    this.isDesynced = true;
    const screen = document.querySelector('#desync-screen');
    if (!screen) return;
    if (message) document.querySelector('#desync-message').textContent =
      `${message} Le jeu est suspendu pour protéger votre progression.`;
    document.querySelector('#desync-status-text').textContent = 'Tentative de reconnexion en cours…';
    screen.classList.add('visible');
    screen.setAttribute('aria-hidden', 'false');
    document.querySelectorAll('body > header, body > main, body > .modal-backdrop')
      .forEach(element => { element.inert = true; });
    document.body.classList.add('server-desynced');
  }

  hideDesyncScreen() {
    this.isDesynced = false;
    const screen = document.querySelector('#desync-screen');
    if (!screen) return;
    screen.classList.remove('visible');
    screen.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('body > header, body > main, body > .modal-backdrop')
      .forEach(element => { element.inert = false; });
    document.body.classList.remove('server-desynced');
  }

  async synchronize(manual = false) {
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    const status = document.querySelector('#desync-status-text');
    if (manual && status) status.textContent = 'Connexion au serveur…';
    try {
      this.state.lastSaved = Date.now();
      this.state.lastTick = Date.now();
      await this.server.sync(this.state);
      this.saveManager.save(this.state);
      if (manual) this.ui.toast('Progression synchronisée', 'La sauvegarde serveur est à jour.', 'info');
    } catch (error) {
      if (manual) this.ui.toast('Synchronisation impossible', error.message, 'danger');
    } finally {
      this.syncInProgress = false;
    }
  }

  startInitialReconnect() {
    if (this.initialReconnectTimer) return;
    this.initialReconnectTimer = setInterval(() => this.retryInitialConnection(), 3000);
  }

  async retryInitialConnection() {
    if (this.syncInProgress || this.initialized) return;
    this.syncInProgress = true;
    const status = document.querySelector('#desync-status-text');
    if (status) status.textContent = 'Vérification du serveur…';
    try {
      await this.server.load(this.state);
      if (this.initialReconnectTimer) clearInterval(this.initialReconnectTimer);
      window.location.reload();
    } catch (error) {
      if (status) status.textContent = 'Serveur toujours inaccessible · nouvelle tentative automatique';
    } finally {
      this.syncInProgress = false;
    }
  }

  applyProfile(profile) {
    if (!profile?.username) return;
    document.querySelector('#profile-name').textContent = profile.username;
  }

  requireProfile() {
    const modal = document.querySelector('#profile-modal');
    const form = document.querySelector('#profile-form');
    const input = document.querySelector('#profile-input');
    const errorElement = document.querySelector('#profile-error');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => input.focus(), 50);

    return new Promise(resolve => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        errorElement.textContent = '';
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          const profile = await this.server.saveProfile(this.state, input.value);
          this.applyProfile(profile);
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('modal-open');
          resolve();
        } catch (error) {
          errorElement.textContent = error.message;
          input.focus();
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  async updateOnlinePlayers() {
    try {
      const { online } = await this.server.presence();
      const count = Math.max(0, Number(online) || 0);
      document.querySelector('#online-count').textContent = count;
      document.querySelector('#online-label').textContent = count > 1
        ? 'joueurs en ligne'
        : 'joueur en ligne';
    } catch {
      // La présence est informative et ne doit pas interrompre la partie.
    }
  }

  openV2ResetNotice() {
    const modal = document.querySelector('#v2-reset-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => modal.querySelector('[data-close="v2-reset-modal"]')?.focus(), 50);
  }

  bindGameActions() {
    const clickHandler = event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top + rect.height / 2;
      const now = Date.now();
      this.state.combo = now - this.state.lastManualClick <= 900 ? this.state.combo + 1 : 1;
      this.state.lastManualClick = now;
      this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
      const comboMultiplier = Math.min(3, 1 + Math.floor((this.state.combo - 1) / 10) * 0.25);
      const critical = Math.random() < 0.05;
      const power = this.economy.getClickPower() * comboMultiplier * (critical ? 10 : 1);
      this.state.requests += power;
      this.state.lifetimeRequests += power;
      this.state.allTimeRequests += power;
      this.state.manualClicks += 1;
      if (critical) this.state.criticalClicks += 1;
      if (this.state.overclockEndsAt <= now) {
        this.state.overclockCharge = Math.min(100, this.state.overclockCharge + (critical ? 8 : 1));
      }
      this.ui.clickEffect(x, y, power, { critical, comboMultiplier });
      this.audio.click();
    };
    document.querySelector('#server-button').addEventListener('click', clickHandler);
    document.querySelector('#process-button').addEventListener('click', clickHandler);
    window.addEventListener('keydown', event => {
      const terminalOpen = document.querySelector('#terminal-window').classList.contains('open');
      if (event.code === 'Space' && !terminalOpen && !['INPUT', 'BUTTON'].includes(document.activeElement.tagName)) {
        event.preventDefault();
        document.querySelector('#server-button').click();
      }
    });

    document.querySelector('#building-list').addEventListener('click', event => {
      const card = event.target.closest('[data-building]');
      if (!card) return;
      this.buyBuilding(card.dataset.building);
    });

    document.querySelector('#upgrade-grid').addEventListener('click', event => {
      const card = event.target.closest('[data-upgrade]');
      if (card) this.buyUpgrade(card.dataset.upgrade);
    });

    document.querySelector('#certification-grid').addEventListener('click', event => {
      const card = event.target.closest('[data-certification]');
      if (card) this.buyCertification(card.dataset.certification);
    });
    document.querySelector('#missions-grid').addEventListener('click', event => {
      const button = event.target.closest('[data-mission-claim]');
      if (!button) return;
      if (this.missions.claim(button.dataset.missionClaim)) {
        this.audio.achievement();
        this.ui.toast('Mission terminée', 'La récompense a été ajoutée.', 'achievement');
        this.ui.renderMissions(this.missions);
      }
    });

    document.querySelectorAll('.buy-mode').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('.buy-mode').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      this.ui.buyAmount = button.dataset.amount === 'max' ? 'max' : Number(button.dataset.amount);
      if (this.ui.buyAmount === 'max') this.state.maxBuyUsed = true;
      this.ui.updateBuildings();
    }));

    document.querySelector('#prestige-button').addEventListener('click', () => this.openPrestigeConfirmation());
    document.querySelector('#header-prestige-button').addEventListener('click', () => this.openPrestigeConfirmation());
    document.querySelector('#prestige-confirm-button').addEventListener('click', () => this.prestige());
    document.querySelector('#overclock-button').addEventListener('click', () => {
      if (this.state.overclockCharge < 100 || this.state.overclockEndsAt > Date.now()) return;
      this.state.overclockCharge = 0;
      this.state.overclockEndsAt = Date.now() + 30000;
      this.audio.event(false);
      this.ui.toast('Surcharge activée', 'Production doublée pendant 30 secondes.', 'bonus');
    });
    document.querySelector('#sound-toggle').addEventListener('click', () => {
      this.state.soundEnabled = !this.state.soundEnabled;
      this.audio.setEnabled(this.state.soundEnabled);
      this.updateSoundButton();
      this.achievements.check();
    });
  }

  bindNavigation() {
    document.querySelector('#statistics-link').addEventListener('click', () => {
      this.saveManager.save(this.state);
    });

    document.querySelectorAll('.center-tab').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('.center-tab').forEach(item => item.classList.toggle('active', item === tab));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      document.querySelector(`#${tab.dataset.tab}-panel`).classList.add('active');
    }));

    document.querySelector('#upgrade-filters').addEventListener('click', event => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      this.ui.activeUpgradeCategory = button.dataset.category;
      this.ui.renderUpgradeFilters();
      this.ui.renderUpgrades();
    });

    this.bindModal('#settings-toggle', '#settings-modal');
    this.bindModal('#achievements-open', '#achievements-modal', () => this.ui.renderAchievements());
    this.bindModal('#upgrades-open', '#upgrades-modal', () => this.ui.renderUpgrades());
    this.bindModal('#certifications-open', '#certifications-modal', () => this.ui.renderCertifications());
    this.bindModal('#missions-open', '#missions-modal', () => this.ui.renderMissions(this.missions));
    document.querySelector('#settings-modal').addEventListener('click', event => {
      const action = event.target.closest('button, .privacy-link');
      if (action && !action.classList.contains('modal-close')) {
        this.closeModal(document.querySelector('#settings-modal'));
      }
    });
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
      this.closeModal(document.querySelector(`#${button.dataset.close}`));
    }));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => {
      if (event.target === backdrop && backdrop.id !== 'profile-modal') this.closeModal(backdrop);
    }));
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open:not(#profile-modal)').forEach(modal => this.closeModal(modal));
        this.terminal.close();
      }
    });
  }

  bindModal(triggerSelector, modalSelector, callback) {
    const trigger = document.querySelector(triggerSelector);
    trigger.addEventListener('click', () => {
      const modal = document.querySelector(modalSelector);
      modal._opener = trigger;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      callback?.();
      setTimeout(() => modal.querySelector('.modal-close')?.focus(), 50);
    });
  }

  closeModal(modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal-backdrop.open')) document.body.classList.remove('modal-open');
    modal._opener?.focus();
  }

  openPrestigeConfirmation() {
    if (this.economy.prestigeGain() < 1) {
      this.ui.toast('Prestige indisponible', 'Atteignez 1 million de requêtes sur ce cycle.', 'info');
      return;
    }
    const maintenance = this.state.certifications.length >= CERTIFICATIONS.length;
    const gain = this.economy.prestigeGain();
    document.querySelector('#prestige-confirm-gain').textContent =
      maintenance
        ? 'Capacité restaurée à 100 %'
        : `+${gain} point${gain > 1 ? 's' : ''} de certification`;
    document.querySelector('#prestige-confirm-title').textContent = maintenance
      ? 'Reconstruire cette infrastructure ?'
      : 'Convertir cette progression ?';
    document.querySelector('#prestige-confirm-button').textContent = maintenance
      ? 'Restaurer la capacité'
      : 'Reconstruire maintenant';
    const modal = document.querySelector('#prestige-confirm-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => document.querySelector('#prestige-confirm-button')?.focus(), 50);
  }

  bindSaveControls() {
    document.querySelector('#save-now').addEventListener('click', async () => {
      await this.synchronize(true);
    });
    document.querySelector('#reset-game').addEventListener('click', async () => {
      if (!window.confirm('Réinitialiser définitivement toute la progression ?')) return;
      this.replaceState(this.saveManager.reset());
      await this.server.reset(this.state);
      this.ui.refreshCollections();
      this.ui.update();
      this.ui.toast('Nouvelle infrastructure', 'La progression a été réinitialisée.', 'danger');
    });
    document.querySelector('#delete-local-data').addEventListener('click', () => {
      if (!window.confirm('Réinitialiser le thème, le son et les préférences de ce navigateur ? La progression serveur sera conservée.')) return;
      Object.keys(localStorage)
        .filter(key => key.startsWith('infra-clicker-') || key.startsWith('clicker-'))
        .forEach(key => localStorage.removeItem(key));
      window.location.reload();
    });
  }

  initTheme() {
    const themes = ['ruby', 'sunset', 'lavender', 'mint', 'ocean'];
    const savedTheme = localStorage.getItem('infra-clicker-theme');
    const initialTheme = themes.includes(savedTheme) ? savedTheme : 'ocean';
    this.applyTheme(initialTheme);

    document.querySelector('#theme-picker').addEventListener('click', event => {
      const option = event.target.closest('[data-theme]');
      if (!option) return;
      this.applyTheme(option.dataset.theme);
      localStorage.setItem('infra-clicker-theme', option.dataset.theme);
    });
  }

  applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('.theme-option').forEach(option => {
      option.classList.toggle('active', option.dataset.theme === theme);
    });
  }

  replaceState(nextState) {
    Object.keys(this.state).forEach(key => delete this.state[key]);
    Object.assign(this.state, nextState);
    this.audio.setEnabled(this.state.soundEnabled);
    this.events.nextEventAt = Date.now() + this.events.randomDelay();
    this.ui.refreshCollections();
    this.updateSoundButton();
    this.ui.update();
  }

  buyBuilding(id) {
    const building = BUILDINGS.find(item => item.id === id);
    if (!building) return;
    const purchase = this.economy.getBuildingCost(building, this.ui.buyAmount);
    if (purchase.amount < 1 || this.state.requests < purchase.cost) {
      this.ui.toast('Budget insuffisant', `Il manque des requêtes pour ${building.name}.`, 'danger');
      return;
    }
    this.state.requests -= purchase.cost;
    this.state.buildings[id] += purchase.amount;
    this.state.totalBuildingsPurchased += purchase.amount;
    this.ui.updateBuildings();
    this.ui.lastBuildingsUpdate = performance.now();
    this.ui.update();
    this.audio.purchase();
    this.ui.toast('Infrastructure déployée', `${purchase.amount} × ${building.name}`, 'info');
    this.achievements.check();
  }

  buyUpgrade(id) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade || !this.economy.canBuyUpgrade(upgrade)) return;
    this.state.requests -= upgrade.cost;
    this.state.upgrades.push(id);
    this.markCompletion();
    this.audio.purchase();
    this.ui.renderUpgrades();
    this.ui.toast(`${upgrade.name} installé`, upgrade.description, 'bonus');
    this.ui.update();
    this.achievements.check();
  }

  buyCertification(id) {
    const certification = CERTIFICATIONS.find(item => item.id === id);
    if (!certification || this.state.certifications.includes(id) || this.state.certificationPoints < certification.cost) return;
    this.state.certificationPoints -= certification.cost;
    this.state.certifications.push(id);
    this.markCompletion();
    this.audio.achievement();
    this.ui.renderCertifications();
    this.ui.toast(`Certification ${certification.name}`, certification.description, 'achievement');
    this.ui.update();
    this.achievements.check();
  }

  prestige() {
    const maintenance = this.state.certifications.length >= CERTIFICATIONS.length;
    const gain = this.economy.prestigeGain();
    if (gain < 1) return;
    this.closeModal(document.querySelector('#prestige-confirm-modal'));
    this.lastPrestigeGain = maintenance ? 0 : gain;
    this.state.certificationPoints += this.lastPrestigeGain;
    this.state.prestigeCount += 1;
    this.state.requests = 0;
    this.state.lifetimeRequests = 0;
    this.state.combo = 0;
    this.state.lastManualClick = 0;
    this.state.overclockCharge = 0;
    this.state.overclockEndsAt = 0;
    this.state.totalBuildingsPurchased = this.state.totalBuildingsPurchased || 0;
    this.state.buildings = Object.fromEntries(BUILDINGS.map(building => [building.id, 0]));
    this.state.upgrades = [];
    this.state.activeEvent = null;
    this.state.temporaryBonus = null;
    this.ui.refreshCollections();
    this.ui.update();
    this.audio.prestige();
    this.ui.toast(
      maintenance ? 'Capacité restaurée' : 'Infrastructure reconstruite',
      maintenance
        ? 'La saturation est revenue à 0 %. Vos certifications restent actives.'
        : `${this.lastPrestigeGain || gain} point(s) de certification obtenus.`,
      'achievement'
    );
    this.achievements.check();
    this.saveManager.save(this.state);
  }

  applyDlcTheme() {
    document.documentElement.dataset.dlc = ACTIVE_DLC.id;
    document.title = `${ACTIVE_DLC.name} — Clicker`;
    document.querySelector('#brand-name').textContent = ACTIVE_DLC.name.toUpperCase();
    document.querySelector('#process-button span').textContent = ACTIVE_DLC.clickVerb;
    const clickerImage = document.querySelector('#server-button img');
    const clickerIcon = document.querySelector('#dlc-clicker-icon');
    clickerImage.hidden = Boolean(ACTIVE_DLC.clickerIcon);
    clickerIcon.textContent = ACTIVE_DLC.clickerIcon || '';
    clickerIcon.hidden = !ACTIVE_DLC.clickerIcon;
    document.querySelectorAll('[data-currency-label]').forEach(element => {
      element.textContent = ACTIVE_DLC.currency.toUpperCase();
    });
  }

  markCompletion() {
    if (!this.state.completedAt
      && this.state.upgrades.length >= UPGRADES.length
      && this.state.certifications.length >= CERTIFICATIONS.length) {
      this.state.completedAt = Date.now();
    }
  }

  updateSoundButton() {
    const button = document.querySelector('#sound-toggle');
    button.textContent = this.state.soundEnabled ? '♪' : '×';
    button.classList.toggle('muted', !this.state.soundEnabled);
    button.title = this.state.soundEnabled ? 'Couper le son' : 'Activer le son';
  }

  loop(now) {
    const wallNow = Date.now();
    const elapsed = Math.min(8 * 60 * 60, Math.max(0, (wallNow - this.lastProductionAt) / 1000));
    this.lastProductionAt = wallNow;
    this.lastFrame = now;
    const production = this.economy.getProduction();
    const produced = production * elapsed;
    this.state.requests += produced;
    this.state.lifetimeRequests += produced;
    this.state.allTimeRequests += produced;

    if (Date.now() - this.lastHistorySample >= 60000) {
      this.state.productionHistory ||= [];
      this.state.productionHistory.push({
        time: Date.now(),
        value: production,
        requests: this.state.allTimeRequests || this.state.lifetimeRequests,
        purchases: this.state.totalBuildingsPurchased || 0,
        events: this.state.eventsCompleted || 0
      });
      if (this.state.productionHistory.length > 20) {
        const history = this.state.productionHistory;
        const compacted = [];
        const targetSize = 20;
        for (let index = 0; index < targetSize; index += 1) {
          const sourceIndex = Math.round(index / (targetSize - 1) * (history.length - 1));
          compacted.push(history[sourceIndex]);
        }
        this.state.productionHistory = compacted;
      }
      this.lastHistorySample = Date.now();
    }

    if (this.state.temporaryBonus && this.state.temporaryBonus.expiresAt <= Date.now()) {
      this.state.temporaryBonus = null;
    }
    if (this.state.combo > 0 && Date.now() - this.state.lastManualClick > 1200) {
      this.state.combo = 0;
    }

    const uiInterval = this.ui.performanceMode ? 250 : 100;
    if (now - this.lastUiUpdate >= uiInterval) {
      this.events.update();
      this.ui.update();
      this.lastUiUpdate = now;
    }
    if (now - this.lastMissionUpdate >= 1000) {
      this.missions.update();
      this.lastMissionUpdate = now;
    }
    if (now - this.lastAchievementCheck > 1000) {
      const previousCount = this.state.achievements.length;
      this.achievements.check();
      if (this.state.achievements.length !== previousCount) this.ui.renderAchievements();
      this.lastAchievementCheck = now;
    }
    requestAnimationFrame(timestamp => this.loop(timestamp));
  }
}

new InfraClicker();
