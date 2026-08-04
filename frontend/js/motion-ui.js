(function initMotionEngine() {
  if (!window.Motion) {
    console.warn('Motion animation engine was not loaded. The UI will use CSS fallbacks.');
    window.runMotionEntrance = function () {};
    return;
  }
  const { animate, stagger, spring, inView } = window.Motion;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.runMotionEntrance = function runMotionEntrance(scope = document) {
    if (reduced) return;
    const root = scope instanceof Element || scope === document ? scope : document;
    const cards = [...root.querySelectorAll('.motion-card:not([data-motion-ready])')];
    cards.forEach((card) => { card.dataset.motionReady = 'true'; });
    if (cards.length) {
      animate(cards, { opacity: [0, 1], y: [14, 0] }, {
        duration: .38,
        delay: stagger(.032),
        easing: [0.22, 1, 0.36, 1]
      });
    }

    const bars = [...root.querySelectorAll('.performance-track i:not([data-motion-ready]),.attempt-progress i:not([data-motion-ready]),.histogram-column i:not([data-motion-ready])')];
    bars.forEach((bar) => { bar.dataset.motionReady = 'true'; });
    bars.forEach((bar, index) => animate(bar, { scaleX: [0, 1] }, { duration: .62, delay: index * .025, easing: [0.22,1,0.36,1] }));
  };

  document.querySelectorAll('.view').forEach((view) => inView(view, () => window.runMotionEntrance(view), { amount: .06 }));

  const livePills = document.querySelectorAll('.phase3-live-pill i,.phase2-live i,.phase4-status-pill i,.live-thinking span,.proctor-camera-mini span i,.sidebar-footer i');
  if (livePills.length && !reduced) {
    animate(livePills, { opacity: [.55, 1, .55], scale: [.9, 1.08, .9] }, { duration: 2.1, repeat: Infinity, easing: 'ease-in-out' });
  }

  const mutationObserver = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === 1) window.runMotionEntrance(node);
    }));
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  window.runMotionEntrance(document);
})();
