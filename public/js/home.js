const SESSION_CHOICE_KEY = 'infra-clicker-session-choice';

document.querySelector('#home-local-session')?.addEventListener('click', () => {
  localStorage.setItem(SESSION_CHOICE_KEY, 'local');
  window.location.href = '/game';
});

document.querySelector('#home-discord-session')?.addEventListener('click', () => {
  localStorage.setItem(SESSION_CHOICE_KEY, 'discord');
});
