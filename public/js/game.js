import { AchievementManager } from './modules/achievements.js';
import { AudioManager } from './modules/audio.js';
import { BUILDINGS, CERTIFICATIONS, UPGRADES } from './modules/data.js';
import { Economy } from './modules/economy.js';
import { EventManager } from './modules/events.js';
import { SaveManager, createDefaultState } from './modules/save.js';
import { Terminal } from './modules/terminal.js';
import { GameUI } from './modules/ui.js';
import { downloadJson, formatNumber } from './modules/utils.js';

class InfraClicker {
  constructor() {
    this.saveManager = new SaveManager(status => {
      const element = document.querySelector('#save-status');
      if (element) element.textContent = status;
    });
    this.state = this.saveManager.load();
    this.economy = new Economy(this.state);
    this.audio = new AudioManager(this.state.soundEnabled);
    this.ui = new GameUI(this.state, this.economy);
    this.achievements = new AchievementManager(this.state, this.economy, this.ui, this.audio);
    this.events = new EventManager(this.state, this.economy, this.ui, this.audio);
    this.terminal = new Terminal(this.state, this.economy, this.ui, () => this.achievements.check());
    this.lastFrame = performance.now();
    this.lastAchievementCheck = 0;
    this.init();
  }

  init() {
    this.initTheme();
    this.applyOfflineProgress();
    this.ui.renderStatic();
    this.bindGameActions();
    this.bindNavigation();
    this.bindSaveControls();
    this.updateSoundButton();
    this.ui.update();
    this.loop(performance.now());
    this.autosaveTimer = setInterval(() => this.saveManager.save(this.state), 10000);
    window.addEventListener('beforeunload', () => this.saveManager.save(this.state));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveManager.save(this.state);
      this.lastFrame = performance.now();
    });
  }

  applyOfflineProgress() {
    const seconds = this.state.offlineSeconds || 0;
    delete this.state.offlineSeconds;
    if (seconds < 10) return;
    const gain = this.economy.getBaseProduction() * seconds * 0.5;
    if (gain > 0) {
      this.state.requests += gain;
      this.state.lifetimeRequests += gain;
      setTimeout(() => this.ui.toast('Production hors ligne', `${formatNumber(gain)} requêtes traitées en votre absence.`, 'bonus'), 500);
    }
  }

  bindGameActions() {
    const clickHandler = event => {
      const power = this.economy.getClickPower();
      this.state.requests += power;
      this.state.lifetimeRequests += power;
      this.state.manualClicks += 1;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top + rect.height / 2;
      this.ui.clickEffect(x, y, power);
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

    document.querySelectorAll('.buy-mode').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('.buy-mode').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      this.ui.buyAmount = button.dataset.amount === 'max' ? 'max' : Number(button.dataset.amount);
      if (this.ui.buyAmount === 'max') this.state.maxBuyUsed = true;
      this.ui.updateBuildings();
    }));

    document.querySelector('#prestige-button').addEventListener('click', () => this.prestige());
    document.querySelector('#sound-toggle').addEventListener('click', () => {
      this.state.soundEnabled = !this.state.soundEnabled;
      this.audio.setEnabled(this.state.soundEnabled);
      this.updateSoundButton();
      this.achievements.check();
    });
  }

  bindNavigation() {
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
    document.querySelector(triggerSelector).addEventListener('click', () => {
      const modal = document.querySelector(modalSelector);
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      callback?.();
    });
  }

  closeModal(modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  bindSaveControls() {
    document.querySelector('#save-now').addEventListener('click', () => {
      this.saveManager.save(this.state);
      this.ui.toast('Sauvegarde effectuée', 'La progression est stockée dans ce navigateur.', 'info');
    });
    document.querySelector('#export-save').addEventListener('click', () => {
      this.state.exported = true;
      this.achievements.check();
      downloadJson(`infra-clicker-${new Date().toISOString().slice(0, 10)}.json`, this.state);
      this.ui.toast('Sauvegarde exportée', 'Le fichier JSON est prêt.', 'info');
    });
    document.querySelector('#import-save').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const imported = this.saveManager.import(await file.text());
        this.replaceState(imported);
        this.saveManager.save(this.state);
        this.ui.toast('Sauvegarde importée', 'La progression a été restaurée.', 'bonus');
      } catch (error) {
        this.ui.toast('Import impossible', error.message, 'danger');
      }
      event.target.value = '';
    });
    document.querySelector('#reset-game').addEventListener('click', () => {
      if (!window.confirm('Réinitialiser définitivement toute la progression ?')) return;
      this.replaceState(this.saveManager.reset());
      this.ui.toast('Nouvelle infrastructure', 'La progression a été réinitialisée.', 'danger');
    });
  }

  initTheme() {
    const themes = ['ruby', 'sunset', 'lavender', 'mint', 'ocean'];
    const savedTheme = localStorage.getItem('infra-clicker-theme');
    const initialTheme = themes.includes(savedTheme) ? savedTheme : 'ruby';
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
    this.audio.purchase();
    this.ui.toast('Infrastructure déployée', `${purchase.amount} × ${building.name}`, 'info');
    this.achievements.check();
  }

  buyUpgrade(id) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade || !this.economy.canBuyUpgrade(upgrade)) return;
    this.state.requests -= upgrade.cost;
    this.state.upgrades.push(id);
    this.audio.purchase();
    this.ui.renderUpgrades();
    this.ui.toast(`${upgrade.name} installé`, upgrade.description, 'bonus');
    this.achievements.check();
  }

  buyCertification(id) {
    const certification = CERTIFICATIONS.find(item => item.id === id);
    if (!certification || this.state.certifications.includes(id) || this.state.certificationPoints < certification.cost) return;
    this.state.certificationPoints -= certification.cost;
    this.state.certifications.push(id);
    this.audio.achievement();
    this.ui.renderCertifications();
    this.ui.toast(`Certification ${certification.name}`, certification.description, 'achievement');
    this.achievements.check();
  }

  prestige() {
    const gain = this.economy.prestigeGain();
    if (gain < 1 || !window.confirm(`Réinitialiser cette infrastructure et gagner ${gain} point(s) de certification ?`)) return;
    const persistent = {
      certifications: [...this.state.certifications],
      certificationPoints: this.state.certificationPoints + gain,
      prestigeCount: this.state.prestigeCount + 1,
      achievements: [...this.state.achievements],
      commandsUsed: [...this.state.commandsUsed],
      soundEnabled: this.state.soundEnabled
    };
    const fresh = createDefaultState();
    Object.assign(fresh, persistent);
    this.replaceState(fresh);
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
    const delta = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const production = this.economy.getProduction();
    const gain = production * delta;
    this.state.requests += gain;
    this.state.lifetimeRequests += gain;
    this.state.lastTick = Date.now();

    if (this.state.temporaryBonus && this.state.temporaryBonus.expiresAt <= Date.now()) {
      this.state.temporaryBonus = null;
    }

    this.events.update();
    this.ui.update();
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
