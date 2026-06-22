import { AchievementManager } from './modules/achievements.js';
import { AntiCheat } from './modules/anticheat.js';
import { AudioManager } from './modules/audio.js';
import { BUILDINGS, CERTIFICATIONS, UPGRADES } from './modules/data.js';
import { Economy } from './modules/economy.js';
import { EventManager } from './modules/events.js';
import { MissionManager } from './modules/missions.js';
import { consumeV2ResetNotice, SaveManager } from './modules/save.js';
import { ServerGame } from './modules/server.js';
import { Terminal } from './modules/terminal.js';
import { GameUI } from './modules/ui.js';
import { downloadJson } from './modules/utils.js';

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
    this.antiCheat = new AntiCheat(this.state, reason => {
      this.ui.showAntiCheat(reason);
    });
    this.achievements = new AchievementManager(this.state, this.economy, this.ui, this.audio);
    this.events = new EventManager(this.state, this.economy, this.ui, this.audio);
    this.missions = new MissionManager(this.state, this.ui);
    this.terminal = new Terminal(this.state, this.economy, this.ui, () => this.achievements.check());
    this.lastFrame = performance.now();
    this.lastAchievementCheck = 0;
    this.lastIntegrityCheck = 0;
    this.lastHistorySample = 0;
    this.init().catch(error => {
      console.error(error);
      this.ui.toast('Serveur indisponible', 'La progression est suspendue pour éviter un état non vérifié.', 'danger');
    });
  }

  async init() {
    this.initTheme();
    await this.server.load(this.state);
    this.ui.renderStatic();
    this.bindGameActions();
    this.bindNavigation();
    this.bindSaveControls();
    this.updateSoundButton();
    this.ui.update();
    if (this.showV2ResetNotice) this.openV2ResetNotice();
    if (this.state.loadWarning) {
      setTimeout(() => this.ui.toast('Protection anti-triche', this.state.loadWarning, 'danger'), 400);
      delete this.state.loadWarning;
    }
    this.loop(performance.now());
    this.autosaveTimer = setInterval(() => this.saveManager.save(this.state), 10000);
    this.serverSyncTimer = setInterval(() => {
      this.server.load(this.state).then(() => this.ui.update()).catch(() => {});
    }, 1000);
    window.addEventListener('beforeunload', () => this.saveManager.save(this.state));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveManager.save(this.state);
      this.lastFrame = performance.now();
    });
  }

  openV2ResetNotice() {
    const modal = document.querySelector('#v2-reset-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => modal.querySelector('[data-close="v2-reset-modal"]')?.focus(), 50);
  }

  bindGameActions() {
    const clickHandler = async event => {
      if (this.economy.isPrestigeRequired()) {
        this.openPrestigeConfirmation();
        return;
      }
      if (!this.antiCheat.canProcessClick()) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top + rect.height / 2;
      let result;
      try {
        result = await this.server.action(this.state, 'click');
      } catch (error) {
        this.ui.showAntiCheat(error.message);
        return;
      }
      const { critical, comboMultiplier, power } = result;
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
    document.querySelector('#prestige-lock-button').addEventListener('click', () => this.openPrestigeConfirmation());
    document.querySelector('#prestige-confirm-button').addEventListener('click', () => this.prestige());
    document.querySelector('#overclock-button').addEventListener('click', async () => {
      if (this.state.overclockCharge < 100 || this.state.overclockEndsAt > Date.now()) return;
      try {
        await this.server.action(this.state, 'overclock');
      } catch (error) {
        this.ui.showAntiCheat(error.message);
        return;
      }
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
      const action = event.target.closest('button, .file-button, .privacy-link');
      if (action && !action.classList.contains('modal-close')) {
        this.closeModal(document.querySelector('#settings-modal'));
      }
    });
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
      this.closeModal(document.querySelector(`#${button.dataset.close}`));
    }));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => {
      if (event.target === backdrop) this.closeModal(backdrop);
    }));
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(modal => this.closeModal(modal));
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
    if (this.state.certifications.length >= CERTIFICATIONS.length) {
      this.ui.toast('Prestige terminé', 'Toutes les certifications permanentes sont déjà acquises.', 'info');
      return;
    }
    if (!this.economy.isPrestigeRequired()) {
      this.ui.toast('Prestige indisponible', 'Atteignez 1 million de requêtes pour terminer ce cycle.', 'info');
      return;
    }
    const modal = document.querySelector('#prestige-confirm-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => document.querySelector('#prestige-confirm-button')?.focus(), 50);
  }

  bindSaveControls() {
    document.querySelector('#save-now').addEventListener('click', () => {
      this.saveManager.save(this.state);
      this.ui.toast('Sauvegarde effectuée', 'La progression est stockée dans ce navigateur.', 'info');
    });
    document.querySelector('#export-save').addEventListener('click', () => {
      this.state.exported = true;
      this.achievements.check();
      this.saveManager.save(this.state);
      downloadJson(`infra-clicker-${new Date().toISOString().slice(0, 10)}.json`, this.state);
      this.ui.toast('Sauvegarde exportée', 'Le fichier JSON est prêt.', 'info');
    });
    document.querySelector('#import-save').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        this.ui.toast('Import impossible', 'Le fichier dépasse la limite de 1 Mo.', 'danger');
        event.target.value = '';
        return;
      }
      try {
        this.saveManager.import(await file.text());
        this.ui.toast('Import refusé', 'La progression est désormais gérée par le serveur et ne peut plus être remplacée côté client.', 'danger');
      } catch (error) {
        this.ui.toast('Import impossible', error.message, 'danger');
      }
      event.target.value = '';
    });
    document.querySelector('#reset-game').addEventListener('click', async () => {
      if (!window.confirm('Réinitialiser définitivement toute la progression ?')) return;
      this.saveManager.reset();
      await this.server.reset(this.state);
      this.ui.refreshCollections();
      this.ui.update();
      this.ui.toast('Nouvelle infrastructure', 'La progression a été réinitialisée.', 'danger');
    });
    document.querySelector('#delete-local-data').addEventListener('click', () => {
      if (!window.confirm('Effacer définitivement la progression, le thème et toutes les préférences locales ?')) return;
      Object.keys(localStorage)
        .filter(key => key.startsWith('infra-clicker-'))
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

  async buyBuilding(id) {
    const building = BUILDINGS.find(item => item.id === id);
    if (!building) return;
    const purchase = this.economy.getBuildingCost(building, this.ui.buyAmount);
    if (purchase.amount < 1 || this.state.requests < purchase.cost) {
      this.ui.toast('Budget insuffisant', `Il manque des requêtes pour ${building.name}.`, 'danger');
      return;
    }
    try {
      const result = await this.server.action(this.state, 'buyBuilding', {
        id,
        amount: this.ui.buyAmount
      });
      purchase.amount = result.amount;
    } catch (error) {
      this.ui.toast('Achat refusé', error.message, 'danger');
      return;
    }
    this.audio.purchase();
    this.ui.toast('Infrastructure déployée', `${purchase.amount} × ${building.name}`, 'info');
    this.achievements.check();
  }

  async buyUpgrade(id) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade || !this.economy.canBuyUpgrade(upgrade)) return;
    try {
      await this.server.action(this.state, 'buyUpgrade', { id });
    } catch (error) {
      this.ui.toast('Upgrade refusé', error.message, 'danger');
      return;
    }
    this.audio.purchase();
    this.ui.renderUpgrades();
    this.ui.toast(`${upgrade.name} installé`, upgrade.description, 'bonus');
    this.achievements.check();
  }

  async buyCertification(id) {
    const certification = CERTIFICATIONS.find(item => item.id === id);
    if (!certification || this.state.certifications.includes(id) || this.state.certificationPoints < certification.cost) return;
    try {
      await this.server.action(this.state, 'buyCertification', { id });
    } catch (error) {
      this.ui.toast('Certification refusée', error.message, 'danger');
      return;
    }
    this.audio.achievement();
    this.ui.renderCertifications();
    this.ui.toast(`Certification ${certification.name}`, certification.description, 'achievement');
    this.achievements.check();
  }

  async prestige() {
    if (this.state.certifications.length >= CERTIFICATIONS.length) {
      this.ui.toast('Prestige terminé', 'Toutes les certifications permanentes sont déjà acquises.', 'info');
      return;
    }
    const gain = this.economy.prestigeGain();
    if (gain < 1) return;
    this.closeModal(document.querySelector('#prestige-confirm-modal'));
    try {
      await this.server.action(this.state, 'prestige');
    } catch (error) {
      this.ui.toast('Prestige refusé', error.message, 'danger');
      return;
    }
    this.ui.refreshCollections();
    this.ui.update();
    this.audio.prestige();
    this.ui.toast('Infrastructure reconstruite', `${gain} point(s) de certification obtenus.`, 'achievement');
    this.achievements.check();
    this.saveManager.save(this.state);
  }

  updateSoundButton() {
    const button = document.querySelector('#sound-toggle');
    button.textContent = this.state.soundEnabled ? '♪' : '×';
    button.classList.toggle('muted', !this.state.soundEnabled);
    button.title = this.state.soundEnabled ? 'Couper le son' : 'Activer le son';
  }

  loop(now) {
    this.lastFrame = now;
    const production = this.economy.getProduction();

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

    this.events.update();
    this.missions.update();
    this.ui.update();
    if (now - this.lastAchievementCheck > 1000) {
      const previousCount = this.state.achievements.length;
      this.achievements.check();
      if (this.state.achievements.length !== previousCount) this.ui.renderAchievements();
      this.lastAchievementCheck = now;
    }
    if (now - this.lastIntegrityCheck > 1000) {
      this.antiCheat.validateState();
      this.lastIntegrityCheck = now;
    }
    requestAnimationFrame(timestamp => this.loop(timestamp));
  }
}

new InfraClicker();
