const button = document.getElementById('privacy-delete-data');

button?.addEventListener('click', async () => {
  if (!window.confirm('Supprimer définitivement la progression serveur et toutes les préférences locales ?')) return;
  await fetch('/api/game/reset', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  Object.keys(localStorage)
    .filter(key => key.startsWith('infra-clicker-'))
    .forEach(key => localStorage.removeItem(key));
  window.location.href = '/';
});
