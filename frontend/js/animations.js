(function initLiveAnimations() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glow = document.getElementById('cursor-glow');
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let glowX = mouseX;
  let glowY = mouseY;

  if (!reduced && glow && window.matchMedia('(pointer:fine)').matches) {
    window.addEventListener('pointermove', (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      document.documentElement.style.setProperty('--pointer-x', `${mouseX}px`);
      document.documentElement.style.setProperty('--pointer-y', `${mouseY}px`);
    }, { passive: true });
    (function animateGlow() {
      glowX += (mouseX - glowX) * 0.075;
      glowY += (mouseY - glowY) * 0.075;
      glow.style.transform = `translate3d(${glowX - 150}px, ${glowY - 150}px, 0)`;
      requestAnimationFrame(animateGlow);
    })();
  }

  // Ripple is intentionally subtle and skipped for keyboard activation.
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('button');
    if (!button || reduced || button.disabled) return;
    const ripple = document.createElement('span');
    ripple.className = 'button-ripple';
    const rect = button.getBoundingClientRect();
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
  });

  const observer = new MutationObserver(() => {
    document.querySelectorAll('.reveal-section:not([data-observed])').forEach((element) => {
      element.dataset.observed = 'true';
      element.classList.add('is-revealed');
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
