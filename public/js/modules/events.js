import { EVENTS } from './data.js';

export class EventManager {
  constructor(state, economy, ui, audio) {
    this.state = state;
    this.economy = economy;
    this.ui = ui;
    this.audio = audio;
    this.nextEventAt = Date.now() + this.randomDelay();
  }

  randomDelay() {
    return (38 + Math.random() * 50) * 1000;
  }

  update() {
    const now = Date.now();
    if (this.state.activeEvent) {
      if (now >= this.state.activeEvent.endsAt) {
        const completed = this.state.activeEvent;
        this.state.activeEvent = null;
        this.state.eventsCompleted += 1;
        this.nextEventAt = now + this.randomDelay();
        this.ui.hideEvent(completed);
      } else {
        this.ui.updateEvent(this.state.activeEvent);
      }
      return;
    }
    if (now >= this.nextEventAt && this.state.lifetimeRequests >= 100) this.startRandomEvent();
  }

  startRandomEvent() {
    const template = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    let multiplier = template.multiplier ?? 1;
    const resistance = template.type === 'danger' ? this.economy.getEventResistance() : 0;
    if (template.type === 'danger') {
      multiplier = 1 - (1 - multiplier) * (1 - resistance);
    }

    if (template.instantSeconds) {
      const reward = Math.max(1, this.economy.getBaseProduction()) * template.instantSeconds;
      this.state.requests += reward;
      this.state.lifetimeRequests += reward;
      this.ui.toast('Récompense immédiate', `${Math.round(template.instantSeconds / 60)} minute(s) de production reçue(s).`, 'bonus');
    }

    if (template.overclockCharge) {
      this.state.overclockCharge = Math.min(100, (this.state.overclockCharge || 0) + template.overclockCharge);
    }

    if (template.requestLossPercent) {
      const effectiveLoss = template.requestLossPercent * (1 - resistance);
      const lost = this.state.requests * effectiveLoss;
      this.state.requests = Math.max(0, this.state.requests - lost);
    }

    this.state.activeEvent = {
      ...template,
      multiplier,
      startedAt: Date.now(),
      endsAt: Date.now() + template.duration * 1000
    };
    this.audio.event(template.type === 'danger');
    this.ui.showEvent(this.state.activeEvent);
  }
}
