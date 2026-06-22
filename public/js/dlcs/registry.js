import { DLC as infra } from './infra.js';

export const DLC_STORAGE_KEY = 'clicker-active-dlc';
export const DEFAULT_DLC_ID = 'infra';
const REMOVED_DLC_STORAGE_KEYS = ['clicker-save-space-v1'];

REMOVED_DLC_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
if (localStorage.getItem(DLC_STORAGE_KEY) !== DEFAULT_DLC_ID) {
  localStorage.removeItem(DLC_STORAGE_KEY);
}
function validateDlc(dlc) {
  const collections = ['buildings', 'upgrades', 'events', 'certifications', 'achievements', 'levels'];
  if (!dlc?.id || !dlc.name) throw new Error('Un DLC doit définir id et name.');
  collections.forEach(key => {
    if (!Array.isArray(dlc[key]) || !dlc[key].length) {
      throw new Error(`Le DLC "${dlc.id}" doit définir une collection ${key} non vide.`);
    }
  });
  ['buildings', 'upgrades', 'events', 'certifications', 'achievements'].forEach(key => {
    const ids = dlc[key].map(item => item.id);
    if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      throw new Error(`Le DLC "${dlc.id}" contient des identifiants ${key} invalides ou dupliqués.`);
    }
  });
  return Object.freeze(dlc);
}

export const DLC_REGISTRY = Object.freeze({
  infra: validateDlc(infra)
});
export const DLCS = Object.freeze(Object.values(DLC_REGISTRY));

export function getDlc(id) {
  return DLC_REGISTRY[id] || DLC_REGISTRY[DEFAULT_DLC_ID];
}

export function getActiveDlcId() {
  const id = localStorage.getItem(DLC_STORAGE_KEY) || DEFAULT_DLC_ID;
  return Object.hasOwn(DLC_REGISTRY, id) ? id : DEFAULT_DLC_ID;
}

export function getActiveDlc() {
  return getDlc(getActiveDlcId());
}

export function selectDlc(id) {
  if (!Object.hasOwn(DLC_REGISTRY, id)) return false;
  localStorage.setItem(DLC_STORAGE_KEY, id);
  return true;
}
