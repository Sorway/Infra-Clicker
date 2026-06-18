const SUFFIXES = [
  [1e33, 'Dc'], [1e30, 'No'], [1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'],
  [1e18, 'Qi'], [1e15, 'Qa'], [1e12, 'T'], [1e9, 'Md'], [1e6, 'M'], [1e3, 'k']
];

export function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return '∞';
  const absolute = Math.abs(value);
  const suffix = SUFFIXES.find(([threshold]) => absolute >= threshold);
  if (suffix) {
    const scaled = value / suffix[0];
    return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : decimals).replace('.', ',')} ${suffix[1]}`;
  }
  if (absolute >= 100) return Math.floor(value).toLocaleString('fr-FR');
  if (absolute >= 10) return value.toFixed(1).replace('.', ',');
  return value.toFixed(decimals).replace('.', ',');
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

export function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
