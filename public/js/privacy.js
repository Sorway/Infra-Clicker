const button = document.getElementById('privacy-delete-data');

button?.addEventListener('click', () => {
  if (!window.confirm('Supprimer définitivement la progression et toutes les préférences locales ?')) return;
  Object.keys(localStorage)
    .filter(key => key.startsWith('infra-clicker-'))
    .forEach(key => localStorage.removeItem(key));
  window.location.href = '/';
});
