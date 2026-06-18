(() => {
  const key = 'infra-clicker-privacy-notice-v1';
  const notice = document.getElementById('privacy-notice');
  const button = document.getElementById('privacy-notice-accept');
  if (!notice || !button) return;
  if (!localStorage.getItem(key)) notice.classList.remove('hidden');
  button.addEventListener('click', () => {
    localStorage.setItem(key, new Date().toISOString());
    notice.classList.add('hidden');
  });
})();
