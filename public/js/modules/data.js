import { getActiveDlc } from '../dlcs/registry.js';

export const ACTIVE_DLC = getActiveDlc();
export const BUILDINGS = ACTIVE_DLC.buildings;
export const UPGRADES = ACTIVE_DLC.upgrades;
export const EVENTS = ACTIVE_DLC.events;
export const CERTIFICATIONS = ACTIVE_DLC.certifications;
export const ACHIEVEMENTS = ACTIVE_DLC.achievements;
export const INFRA_LEVELS = ACTIVE_DLC.levels;
