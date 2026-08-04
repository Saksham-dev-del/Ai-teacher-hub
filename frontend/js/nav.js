const tabs = Array.from(document.querySelectorAll('.tab'));
const views = Array.from(document.querySelectorAll('.view'));
const sidebar = document.getElementById('app-sidebar');
const sidebarToggle = document.getElementById('sidebar-menu-btn');
const sidebarClose = document.getElementById('sidebar-close-btn');
const sidebarScrim = document.getElementById('sidebar-scrim');
let activeNavKey = 'dashboard';

function openSidebar() {
  sidebar?.classList.add('open');
  sidebarScrim?.classList.add('visible');
  document.body.classList.add('sidebar-open');
  sidebarToggle?.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  sidebar?.classList.remove('open');
  sidebarScrim?.classList.remove('visible');
  document.body.classList.remove('sidebar-open');
  sidebarToggle?.setAttribute('aria-expanded', 'false');
}

function pulseFocusTarget(element) {
  if (!element) return;
  element.classList.remove('nav-focus-pulse');
  element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  requestAnimationFrame(() => element.classList.add('nav-focus-pulse'));
  window.setTimeout(() => element.classList.remove('nav-focus-pulse'), 1900);
}

function applyToolFocus(name, focus) {
  if (!focus) return;
  if (name === 'personalized') {
    const action = document.getElementById('p7-action');
    const map = { 'adaptive-notes': 'adaptive-notes', 'flashcards': 'flashcards' };
    if (action && map[focus]) {
      action.value = map[focus];
      action.dispatchEvent(new Event('change', { bubbles: true }));
      pulseFocusTarget(action.closest('.phase78-panel') || action);
    }
  }
  if (name === 'academic') {
    const action = document.getElementById('p8-action');
    const map = {
      'question-paper': 'question-paper',
      'course-planner': 'course-planner',
      'revision-plan': 'revision-plan',
      'coding-lab': 'coding-lab',
      'case-study': 'case-study'
    };
    if (action && map[focus]) {
      action.value = map[focus];
      action.dispatchEvent(new Event('change', { bubbles: true }));
      pulseFocusTarget(action.closest('.phase78-panel') || action);
    }
  }
  if (name === 'intelligence') {
    const targets = {
      voice: document.getElementById('btn-p10-voice'),
      video: document.getElementById('btn-p10-video'),
      diagram: document.getElementById('btn-p10-diagram'),
      chart: document.getElementById('btn-p10-chart'),
      'smart-table': document.getElementById('btn-p10-smart-table'),
      'web-search': document.getElementById('btn-p10-web-search'),
      'image-search': document.getElementById('btn-p10-image-search'),
      'illustration-search': document.getElementById('btn-p10-illustration-search'),
      infographic: document.getElementById('btn-p10-infographic'),
      whiteboard: document.getElementById('btn-p10-whiteboard'),
      search: document.getElementById('p10-search')
    };
    pulseFocusTarget(targets[focus]);
    if (focus === 'search') window.setTimeout(() => targets.search?.focus(), 350);
  }
  if (name === 'collaboration') {
    const targets = {
      department: document.getElementById('p9-dept-name'),
      'resource-collaboration': document.getElementById('p9-resource')
    };
    pulseFocusTarget(targets[focus]?.closest('.phase78-panel') || targets[focus]);
    window.setTimeout(() => targets[focus]?.focus(), 350);
  }
}

function defaultNavKeyForTab(name) {
  const preferred = tabs.find((tab) => tab.dataset.tab === name && tab.style.display !== 'none');
  return preferred?.dataset.navKey || name;
}

function showTab(name, focus = '', navKey = '') {
  activeNavKey = navKey || defaultNavKeyForTab(name);
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.navKey === activeNavKey));
  views.forEach((view) => view.classList.toggle('active', view.id === 'view-' + name));
  if (name === 'hub') renderHub();
  if (name === 'dashboard') renderDashboard();
  if (name === 'portal') renderPortal();
  if (name === 'quizzes') renderQuizzes();
  if (name === 'analytics') renderAnalytics();
  if (name === 'presentations') renderPresentations();
  if (name === 'calendar') renderCalendar();
  if (name === 'personalized') renderPersonalized();
  if (name === 'academic') renderAcademic();
  if (name === 'collaboration') renderCollaboration();
  if (name === 'intelligence') renderIntelligence();
  if (name === 'explainer') renderConceptExplainer && renderConceptExplainer();
  if (name === 'admin') renderAdmin();
  requestAnimationFrame(() => {
    const activeView = document.getElementById('view-' + name);
    window.runMotionEntrance && window.runMotionEntrance(activeView);
    window.setTimeout(() => applyToolFocus(name, focus), 120);
  });
  const activeTab = tabs.find((tab) => tab.dataset.navKey === activeNavKey);
  document.dispatchEvent(new CustomEvent('trh:viewchange', {
    detail: {
      name,
      focus,
      navKey: activeNavKey,
      label: activeTab?.querySelector('span')?.textContent?.trim() || name
    }
  }));
  if (window.innerWidth <= 980) closeSidebar();
}

function applyRoleVisibility(role) {
  let firstVisible = null;
  tabs.forEach((tab) => {
    const allowed = !tab.dataset.roles || tab.dataset.roles.split(',').includes(role);
    tab.style.display = allowed ? '' : 'none';
    if (allowed && !firstVisible) firstVisible = tab.dataset.tab;
  });
  document.querySelectorAll('.nav-group').forEach((group) => {
    const visibleItems = Array.from(group.querySelectorAll('.tab')).some((tab) => tab.style.display !== 'none');
    group.style.display = visibleItems ? '' : 'none';
  });
  return firstVisible || 'portal';
}

tabs.forEach((tab) => tab.addEventListener('click', () => {
  showTab(tab.dataset.tab, tab.dataset.focus || '', tab.dataset.navKey || '');
}));

document.querySelectorAll('[data-goto]').forEach((element) => {
  element.addEventListener('click', () => showTab(element.dataset.goto));
});

document.querySelectorAll('.nav-group-toggle').forEach((button) => {
  const group = button.closest('.nav-group');
  const storageKey = `trh-nav-${group?.dataset.group || 'group'}`;
  const collapsed = localStorage.getItem(storageKey) === 'collapsed';
  if (collapsed) {
    group.classList.add('collapsed');
    button.setAttribute('aria-expanded', 'false');
  }
  button.addEventListener('click', () => {
    const isCollapsed = group.classList.toggle('collapsed');
    button.setAttribute('aria-expanded', String(!isCollapsed));
    localStorage.setItem(storageKey, isCollapsed ? 'collapsed' : 'expanded');
  });
});

sidebarToggle?.addEventListener('click', () => sidebar?.classList.contains('open') ? closeSidebar() : openSidebar());
sidebarClose?.addEventListener('click', closeSidebar);
sidebarScrim?.addEventListener('click', closeSidebar);
window.addEventListener('resize', () => { if (window.innerWidth > 980) closeSidebar(); });
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSidebar(); });
