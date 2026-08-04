const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('frontend/index.html');
const css = read('frontend/css/ui-clean-motion.css');
const ui = read('frontend/js/ui-clean-motion.js');
const nav = read('frontend/js/nav.js');
const sw = read('frontend/sw.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
[
  'css/ui-clean-motion.css', 'js/ui-clean-motion.js'
].forEach((marker) => assert(html.includes(marker), `${marker} not linked`));
[
  'ui-command-backdrop','ui-motion-progress','ui-dashboard-shortcuts','ui-nav-rail','ui-scroll-top'
].forEach((marker) => assert(css.includes(marker), `${marker} CSS missing`));
[
  'Ctrl K','trh:viewchange','__cleanMotionFetchWrapped','addDashboardShortcuts','updateNavRail'
].forEach((marker) => assert(ui.includes(marker) || nav.includes(marker), `${marker} JS missing`));
assert(sw.includes('ui-clean-motion.css') && sw.includes('ui-clean-motion.js'), 'PWA cache not updated');
assert(!css.includes('@import url('), 'Clean UI stylesheet must not import remote fonts');
console.log('[PASS] Clean Motion UI smoke test passed.');
