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
    return (45 + Math.random() * 55) * 1000;
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
    let multiplier = template.multiplier;
    if (template.type === 'danger') {
      const resistance = this.economy.getEventResistance();
      multiplier = 1 - (1 - multiplier) * (1 - resistance);
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
