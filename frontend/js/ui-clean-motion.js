(function initCleanMotionUI() {
  'use strict';

  const Motion = window.Motion;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canAnimate = Boolean(Motion && !reduced);
  const { animate, stagger, spring, inView } = Motion || {};

  document.documentElement.classList.add('ui-clean-motion');

  const routeLabels = {
    dashboard: 'Dashboard', hub: 'Resource Hub', portal: 'Student Portal', generator: 'AI Resource Studio',
    presentations: 'PPT Studio', personalized: 'Personalized Learning', academic: 'Academic Planning',
    calendar: 'Lesson Calendar', quizzes: 'Quiz Center', analytics: 'Analytics', intelligence: 'Multimedia & Intelligence',
    collaboration: 'Collaboration', admin: 'Security Center'
  };

  function motionTo(element, keyframes, options = {}) {
    if (!element) return;
    if (!canAnimate) {
      const final = {};
      Object.entries(keyframes).forEach(([key, value]) => final[key] = Array.isArray(value) ? value[value.length - 1] : value);
      Object.assign(element.style, final);
      return;
    }
    return animate(element, keyframes, options);
  }

  // ---------- Global progress feedback for API activity ----------
  const progress = document.createElement('div');
  progress.className = 'ui-motion-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  let pendingFetches = 0;
  let progressValue = 0;
  let progressTimer = null;

  function paintProgress(value, opacity = 1, duration = .25) {
    progressValue = Math.max(0, Math.min(1, value));
    if (canAnimate) {
      animate(progress, { scaleX: progressValue, opacity }, { duration, easing: [0.22, 1, 0.36, 1] });
    } else {
      progress.style.transform = `scaleX(${progressValue})`;
      progress.style.opacity = String(opacity);
    }
  }

  function startProgress() {
    pendingFetches += 1;
    document.body.classList.add('ui-fetch-busy');
    if (pendingFetches > 1) return;
    clearInterval(progressTimer);
    paintProgress(.08, 1, .12);
    progressTimer = setInterval(() => {
      if (progressValue < .84) paintProgress(progressValue + Math.max(.015, (.86 - progressValue) * .08), 1, .22);
    }, 240);
  }

  function finishProgress() {
    pendingFetches = Math.max(0, pendingFetches - 1);
    if (pendingFetches > 0) return;
    document.body.classList.remove('ui-fetch-busy');
    clearInterval(progressTimer);
    paintProgress(1, 1, .16);
    setTimeout(() => paintProgress(1, 0, .28), 150);
    setTimeout(() => paintProgress(0, 0, 0), 500);
  }

  if (!window.__cleanMotionFetchWrapped && typeof window.fetch === 'function') {
    window.__cleanMotionFetchWrapped = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function cleanMotionFetch(...args) {
      startProgress();
      try { return await nativeFetch(...args); }
      finally { finishProgress(); }
    };
  }

  // ---------- Command palette ----------
  const commandButton = document.createElement('button');
  commandButton.type = 'button';
  commandButton.className = 'ui-command-button';
  commandButton.innerHTML = '<span>Quick navigation</span><kbd>Ctrl K</kbd>';
  commandButton.setAttribute('aria-label', 'Open quick navigation');
  const userBadge = document.querySelector('.topbar .user-badge');
  if (userBadge) userBadge.insertBefore(commandButton, userBadge.firstChild);

  const backdrop = document.createElement('div');
  backdrop.className = 'ui-command-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Quick navigation');
  backdrop.innerHTML = `
    <div class="ui-command-panel">
      <div class="ui-command-search"><span>⌕</span><input type="search" placeholder="Search tools and modules…" autocomplete="off"><kbd>Esc</kbd></div>
      <div class="ui-command-list"></div>
    </div>`;
  document.body.appendChild(backdrop);
  const commandPanel = backdrop.querySelector('.ui-command-panel');
  const commandInput = backdrop.querySelector('input');
  const commandList = backdrop.querySelector('.ui-command-list');
  let commandIndex = 0;
  let filteredCommands = [];

  function readCommands() {
    return [...document.querySelectorAll('.sidebar-nav .tab')]
      .filter((tab) => tab.style.display !== 'none')
      .map((tab) => {
        const group = tab.closest('.nav-group');
        return {
          tab,
          name: tab.querySelector('span')?.textContent?.trim() || tab.dataset.tab,
          group: group?.querySelector('.nav-group-toggle span')?.textContent?.trim() || 'Workspace',
          icon: tab.querySelector('b')?.textContent?.trim() || '•',
          key: tab.dataset.navKey || tab.dataset.tab
        };
      });
  }

  function renderCommands(filter = '') {
    const query = String(filter).trim().toLowerCase();
    filteredCommands = readCommands().filter((item) => `${item.name} ${item.group}`.toLowerCase().includes(query));
    commandIndex = Math.min(commandIndex, Math.max(0, filteredCommands.length - 1));
    if (!filteredCommands.length) {
      commandList.innerHTML = '<div class="ui-command-empty">No matching module found.</div>';
      return;
    }
    commandList.innerHTML = filteredCommands.map((item, index) => `
      <button type="button" class="ui-command-item ${index === commandIndex ? 'selected' : ''}" data-command-index="${index}">
        <span class="ui-command-icon">${item.icon}</span>
        <span><strong>${item.name}</strong><small>${item.group}</small></span>
        <em>Open</em>
      </button>`).join('');
    commandList.querySelectorAll('.ui-command-item').forEach((button) => {
      button.addEventListener('mouseenter', () => {
        commandIndex = Number(button.dataset.commandIndex || 0);
        commandList.querySelectorAll('.ui-command-item').forEach((node, i) => node.classList.toggle('selected', i === commandIndex));
      });
      button.addEventListener('click', () => runCommand(Number(button.dataset.commandIndex || 0)));
    });
  }

  function openPalette() {
    renderCommands('');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    commandInput.value = '';
    commandIndex = 0;
    requestAnimationFrame(() => {
      commandInput.focus();
      motionTo(backdrop, { opacity: [0, 1] }, { duration: .18 });
      motionTo(commandPanel, { opacity: [0, 1], y: [-14, 0], scale: [.975, 1] }, { duration: .34, easing: [0.22,1,0.36,1] });
      const items = [...commandList.querySelectorAll('.ui-command-item')];
      if (items.length && canAnimate) animate(items, { opacity: [0,1], y: [8,0] }, { duration: .26, delay: stagger(.025), easing: [0.22,1,0.36,1] });
    });
  }

  function closePalette() {
    if (!backdrop.classList.contains('open')) return;
    const done = () => {
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    };
    if (canAnimate) {
      Promise.all([
        animate(commandPanel, { opacity: 0, y: -8, scale: .985 }, { duration: .16 }),
        animate(backdrop, { opacity: 0 }, { duration: .18 })
      ]).then(done);
    } else done();
  }

  function runCommand(index) {
    const item = filteredCommands[index];
    if (!item) return;
    closePalette();
    setTimeout(() => item.tab.click(), 90);
  }

  commandButton.addEventListener('click', openPalette);
  commandInput.addEventListener('input', () => { commandIndex = 0; renderCommands(commandInput.value); });
  backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) closePalette(); });
  document.addEventListener('keydown', (event) => {
    const ctrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (ctrlK) { event.preventDefault(); backdrop.classList.contains('open') ? closePalette() : openPalette(); return; }
    if (!backdrop.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closePalette(); }
    if (event.key === 'ArrowDown') { event.preventDefault(); commandIndex = Math.min(filteredCommands.length - 1, commandIndex + 1); renderCommands(commandInput.value); }
    if (event.key === 'ArrowUp') { event.preventDefault(); commandIndex = Math.max(0, commandIndex - 1); renderCommands(commandInput.value); }
    if (event.key === 'Enter') { event.preventDefault(); runCommand(commandIndex); }
  });

  // ---------- Route feedback and active rail ----------
  const routeChip = document.createElement('div');
  routeChip.className = 'ui-route-chip';
  routeChip.innerHTML = '<i></i><span>Dashboard</span>';
  document.body.appendChild(routeChip);
  let routeTimer = null;

  function updateNavRail() {
    document.querySelectorAll('.ui-nav-rail').forEach((node) => node.remove());
    const active = document.querySelector('.sidebar-nav .tab.active');
    if (!active) return;
    const rail = document.createElement('span');
    rail.className = 'ui-nav-rail';
    active.prepend(rail);
    if (canAnimate) animate(rail, { scaleY: [0,1], opacity: [0,1] }, { duration: .34, easing: spring({ stiffness: 390, damping: 31 }) });
  }

  function showRouteFeedback(label) {
    clearTimeout(routeTimer);
    routeChip.querySelector('span').textContent = label;
    if (canAnimate) {
      animate(routeChip, { opacity: [0,1], y: [12,0], scale: [.96,1] }, { duration: .28, easing: spring({ stiffness: 390, damping: 30 }) });
    } else {
      routeChip.style.opacity = '1';
      routeChip.style.transform = 'translate(-50%, 0) scale(1)';
    }
    routeTimer = setTimeout(() => {
      if (canAnimate) animate(routeChip, { opacity: 0, y: 8, scale: .98 }, { duration: .22 });
      else routeChip.style.opacity = '0';
    }, 1050);
  }

  function animateActiveView(view) {
    if (!view) return;
    const candidates = [...view.children].filter((node) => node.nodeType === 1).slice(0, 16);
    if (!candidates.length || !canAnimate) return;
    animate(candidates, { opacity: [0,1], y: [16,0] }, { duration: .4, delay: stagger(.035), easing: [0.22,1,0.36,1] });
  }

  document.addEventListener('trh:viewchange', (event) => {
    const detail = event.detail || {};
    const label = detail.label || routeLabels[detail.name] || detail.name || 'Workspace';
    updateNavRail();
    showRouteFeedback(label);
    animateActiveView(document.getElementById(`view-${detail.name}`));
  });

  const classObserver = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'attributes' && record.attributeName === 'class')) updateNavRail();
  });
  document.querySelectorAll('.sidebar-nav .tab').forEach((tab) => classObserver.observe(tab, { attributes: true }));
  updateNavRail();

  // ---------- Dashboard shortcuts ----------
  function addDashboardShortcuts() {
    const dashboard = document.getElementById('view-dashboard');
    const hero = dashboard?.querySelector('.hero-row');
    if (!dashboard || !hero || dashboard.querySelector('.ui-dashboard-shortcuts')) return;
    const shortcuts = [
      ['✦','Create resource','AI notes, lesson plans and activities','ai-resource-studio'],
      ['?','Build question paper','Blueprint-validated assessment','question-paper'],
      ['⌕','Search knowledge','Semantic resource discovery','smart-search'],
      ['✓','Open quiz center','Secure assessments and grading','quiz-center']
    ];
    const shell = document.createElement('div');
    shell.className = 'ui-dashboard-shortcuts';
    shell.innerHTML = shortcuts.map(([icon,title,desc,key]) => `<button type="button" class="ui-shortcut" data-ui-target="${key}"><b>${icon}</b><span><strong>${title}</strong><small>${desc}</small></span></button>`).join('');
    hero.insertAdjacentElement('afterend', shell);
    shell.querySelectorAll('[data-ui-target]').forEach((button) => button.addEventListener('click', () => document.querySelector(`.tab[data-nav-key="${button.dataset.uiTarget}"]`)?.click()));
    if (canAnimate) animate([...shell.children], { opacity: [0,1], y: [12,0] }, { duration: .36, delay: stagger(.05), easing: [0.22,1,0.36,1] });
  }
  addDashboardShortcuts();

  // ---------- Scroll-to-top ----------
  const scrollTop = document.createElement('button');
  scrollTop.type = 'button';
  scrollTop.className = 'ui-scroll-top';
  scrollTop.setAttribute('aria-label', 'Scroll to top');
  scrollTop.textContent = '↑';
  document.body.appendChild(scrollTop);
  let scrollVisible = false;
  function syncScrollTop() {
    const next = window.scrollY > 520;
    if (next === scrollVisible) return;
    scrollVisible = next;
    scrollTop.classList.toggle('visible', next);
    if (canAnimate) animate(scrollTop, next ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: .94 }, { duration: .24, easing: [0.22,1,0.36,1] });
    else scrollTop.style.opacity = next ? '1' : '0';
  }
  window.addEventListener('scroll', syncScrollTop, { passive: true });
  scrollTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  syncScrollTop();

  // ---------- Clean, realistic motion for existing surfaces ----------
  function markCards(scope = document) {
    const selector = '.motion-card,.live-surface,.phase2-hub-card,.hub-card,.portal-card,.stat-card,.panel,.phase78-panel,.p10-tool-card,.identity-review-card';
    scope.querySelectorAll?.(selector).forEach((card) => card.classList.add('ui-motion-ready'));
  }
  markCards();

  if (canAnimate) {
    document.addEventListener('pointerenter', (event) => {
      const card = event.target.closest('.ui-motion-ready');
      if (!card || card.dataset.uiHover === 'true') return;
      card.dataset.uiHover = 'true';
      animate(card, { y: -3, boxShadow: '0 16px 38px rgba(15,23,42,.09)' }, { duration: .25, easing: spring({ stiffness: 420, damping: 34 }) });
    }, true);
    document.addEventListener('pointerleave', (event) => {
      const card = event.target.closest('.ui-motion-ready');
      if (!card) return;
      card.dataset.uiHover = 'false';
      animate(card, { y: 0, boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.045)' }, { duration: .3, easing: spring({ stiffness: 390, damping: 36 }) });
    }, true);

    document.addEventListener('pointerdown', (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      animate(button, { scale: .975 }, { duration: .08 });
    }, true);
    document.addEventListener('pointerup', (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      animate(button, { scale: 1 }, { duration: .24, easing: spring({ stiffness: 520, damping: 28 }) });
    }, true);
  }

  const domObserver = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      markCards(node);
      if (node.matches?.('.modal-backdrop.open,.modal-box') || node.querySelector?.('.modal-box')) {
        const modal = node.matches?.('.modal-box') ? node : node.querySelector?.('.modal-box');
        if (modal && canAnimate) animate(modal, { opacity: [0,1], y: [18,0], scale: [.975,1] }, { duration: .32, easing: [0.22,1,0.36,1] });
      }
    }));
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  // Auth card entrance is triggered when auth screen becomes visible.
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    const authObserver = new MutationObserver(() => {
      if (!authScreen.classList.contains('visible') || !canAnimate) return;
      const card = authScreen.querySelector('.auth-card');
      animate(card, { opacity: [0,1], y: [18,0], scale: [.975,1] }, { duration: .45, easing: [0.22,1,0.36,1] });
    });
    authObserver.observe(authScreen, { attributes: true, attributeFilter: ['class'] });
  }

  // Initial polish once the app is already visible.
  requestAnimationFrame(() => {
    updateNavRail();
    const activeView = document.querySelector('.view.active');
    animateActiveView(activeView);
  });
})();
