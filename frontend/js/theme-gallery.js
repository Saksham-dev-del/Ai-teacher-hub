// Phase 11.2: Multiple Themes — visual gallery + instant redesign.
// Colors here mirror backend/services/presentation.js THEMES exactly, so the
// live in-app preview matches the exported PPTX/PDF colors.

const THEME_GALLERY_META = [
  { key: 'academic', label: 'Academic', bg: '#F7F2E6', primary: '#2F5D50', secondary: '#E0A93A', text: '#1E2A28', card: '#FFFEFA' },
  { key: 'modern', label: 'Modern', bg: '#F4F5F7', primary: '#4F46E5', secondary: '#EC4899', text: '#111827', card: '#FFFFFF' },
  { key: 'corporate', label: 'Corporate', bg: '#FFFFFF', primary: '#1D4ED8', secondary: '#0EA5E9', text: '#0F172A', card: '#F1F5F9' },
  { key: 'startup', label: 'Startup', bg: '#0B1220', primary: '#22C55E', secondary: '#A78BFA', text: '#F8FAFC', card: '#111827' },
  { key: 'glass', label: 'Glassmorphism', bg: '#E8ECF3', primary: '#6366F1', secondary: '#38BDF8', text: '#1E293B', card: '#FFFFFF' },
  { key: 'darkmode', label: 'Dark Mode', bg: '#0F1115', primary: '#8B5CF6', secondary: '#34D399', text: '#F1F5F9', card: '#1A1D23' },
  { key: 'apple', label: 'Apple Style', bg: '#FFFFFF', primary: '#1D1D1F', secondary: '#0071E3', text: '#1D1D1F', card: '#F5F5F7' },
  { key: 'material', label: 'Google Material', bg: '#FAFAFA', primary: '#6200EE', secondary: '#03DAC6', text: '#1C1B1F', card: '#FFFFFF' },
  { key: 'minimal', label: 'Minimal', bg: '#FFFFFF', primary: '#111111', secondary: '#999999', text: '#111111', card: '#FAFAFA' },
  { key: 'gradient', label: 'Gradient', bg: '#6D28D9', primary: '#FDE047', secondary: '#F472B6', text: '#FFFFFF', card: '#7C3AED' },
  { key: 'ocean', label: 'Ocean Blue', bg: '#EFF8FF', primary: '#075985', secondary: '#06B6D4', text: '#0F172A', card: '#FFFFFF' },
  { key: 'sunrise', label: 'Sunrise', bg: '#FFF7ED', primary: '#9A3412', secondary: '#F59E0B', text: '#431407', card: '#FFFBEB' },
  { key: 'midnight', label: 'Midnight AI', bg: '#111827', primary: '#7C3AED', secondary: '#22D3EE', text: '#F8FAFC', card: '#1F2937' }
];

function themeGalleryMeta(key) {
  return THEME_GALLERY_META.find((t) => t.key === key) || THEME_GALLERY_META[0];
}

function renderThemeGallery(containerId, selectId, onPick) {
  const container = document.getElementById(containerId);
  const select = document.getElementById(selectId);
  if (!container || !select) return;

  container.innerHTML = THEME_GALLERY_META.map((theme) => `
    <button type="button" class="theme-swatch${select.value === theme.key ? ' active' : ''}" data-theme-key="${theme.key}" title="${theme.label}">
      <span class="theme-swatch-preview"><i style="background:${theme.bg}"></i><i style="background:${theme.primary}"></i><i style="background:${theme.secondary}"></i></span>
      <span class="theme-swatch-label">${theme.label}</span>
    </button>`).join('');

  container.querySelectorAll('.theme-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.themeKey;
      select.value = key;
      container.querySelectorAll('.theme-swatch').forEach((b) => b.classList.toggle('active', b === btn));
      select.dispatchEvent(new Event('change'));
      if (onPick) onPick(key);
    });
  });
}

// Instantly restyle the live slide-stack preview to match the chosen theme,
// without regenerating any content — this is the "click a theme, deck
// redesigns instantly" behaviour from Phase 11.2.
function applyThemePreviewColors(shell, themeKey) {
  if (!shell) return;
  const theme = themeGalleryMeta(themeKey);
  shell.dataset.theme = themeKey;
  shell.style.background = `linear-gradient(135deg, ${theme.bg}, ${theme.card})`;
  shell.style.color = theme.text;
  shell.querySelectorAll('.ppt-mini-slide').forEach((slide) => {
    slide.style.background = theme.card;
    slide.style.borderColor = theme.primary;
    slide.style.color = theme.text;
  });
  shell.querySelectorAll('.ppt-mini-slide > span').forEach((badge) => { badge.style.background = theme.primary; });
  shell.querySelectorAll('.ppt-preview-head strong').forEach((el) => { el.style.color = theme.primary; });
  shell.querySelectorAll('.ppt-preview-head em').forEach((el) => { el.style.borderColor = theme.primary; el.style.color = theme.primary; });
}

renderThemeGallery('ppt-theme-gallery', 'ppt-theme', () => applyThemePreviewColors(document.getElementById('ppt-preview'), document.getElementById('ppt-theme').value));
renderThemeGallery('qpg-theme-gallery', 'qpg-theme');

// Phase 11.15: AI Icons — mirrors backend/services/presentation.js iconForHeading()
// so the live in-app preview shows the same auto-picked icon as the exported PPTX.
const SLIDE_ICON_KEYWORDS = [
  [/\b(intro|overview|foundation|basics)/i, '📘'],
  [/\b(definition|terminology|glossary|meaning)/i, '📖'],
  [/\b(problem|motivation|challenge|issue)/i, '❗'],
  [/\b(example|worked|illustration|demo)/i, '✏️'],
  [/\b(case study|real.?world|application)/i, '🧩'],
  [/\b(compar|versus|vs\.?|trade.?off)/i, '⚖️'],
  [/\b(advantage|benefit|pro)/i, '✅'],
  [/\b(limitation|disadvantage|con|risk)/i, '⚠️'],
  [/\b(trend|future|emerging|scope)/i, '🚀'],
  [/\b(best practice|guideline|standard)/i, '⭐'],
  [/\b(process|workflow|step|procedure)/i, '🔄'],
  [/\b(architecture|system|design|structure)/i, '🏗️'],
  [/\b(data|database|storage)/i, '🗄️'],
  [/\b(security|privacy|safety)/i, '🔒'],
  [/\b(network|connect|communication)/i, '🌐'],
  [/\b(algorithm|logic|code|program)/i, '💻'],
  [/\b(test|assessment|evaluat|quiz|exam)/i, '📝'],
  [/\b(summary|conclusion|takeaway|recap)/i, '🎯'],
  [/\b(reference|citation|source|bibliograph)/i, '🔖'],
  [/\b(question|q&a|discuss)/i, '❓'],
  [/\b(table|comparison chart|matrix)/i, '📊']
];
function iconForSlideHeading(heading) {
  const h = String(heading || '');
  for (const [pattern, icon] of SLIDE_ICON_KEYWORDS) if (pattern.test(h)) return icon;
  return '';
}
