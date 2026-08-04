// PPTX-generation libraries (pptxgenjs included) cannot author real PowerPoint
// slide transitions/animations — that XML is not exposed by the library. Rather
// than fake it, this suggests a sensible transition + entrance effect per slide
// based on its content type, which the teacher applies in PowerPoint's
// Transitions/Animations tab (2 clicks per slide, or "Apply to All").

function transitionFor(section, index, total) {
  if (index === 0) return { transition: 'Fade', entrance: 'Fade In (title)', reason: 'Calm opening transition for the title slide.' };
  if (index === total - 1) return { transition: 'Fade', entrance: 'Fade In', reason: 'Gentle close for the final/Q&A slide.' };

  const visualType = section.visual?.type || 'none';
  if (section.table) return { transition: 'Wipe', entrance: 'Wipe (row by row)', reason: 'Wipe helps the audience follow a table row by row.' };
  if (section.caseStudy) return { transition: 'Push', entrance: 'Fly In (from bottom)', reason: 'Push signals a shift into a concrete example/case study.' };
  if (visualType === 'concept-map' || visualType === 'timeline') return { transition: 'Zoom', entrance: 'Zoom', reason: 'Zoom emphasises structure in concept maps and timelines.' };
  if (visualType === 'process' || visualType === 'comparison') return { transition: 'Reveal', entrance: 'Appear (one bullet at a time)', reason: 'Reveal keeps focus on one step/point at a time in a process or comparison.' };
  if ((section.keyPoints || []).length >= 5) return { transition: 'Fade', entrance: 'Appear (one bullet at a time)', reason: 'Dense bullet list — reveal points one at a time so the audience isn\'t reading ahead.' };
  return { transition: 'Fade', entrance: 'Fade In', reason: 'Neutral, non-distracting default for standard content slides.' };
}

function suggestAnimations(draft) {
  const sections = Array.isArray(draft.reportSections) ? draft.reportSections : [];
  if (!sections.length) throw new Error('This presentation has no sections yet — generate it first.');
  // Mirror the pptx builder's slide count (title + roadmap + content-derived + summary + refs + qa)
  const total = sections.length + 2;
  const plan = [
    { heading: 'Title Slide', ...transitionFor({}, 0, total) },
    ...sections.map((s, i) => ({ heading: s.heading, ...transitionFor(s, i + 1, total) })),
    { heading: 'Summary / Q&A', ...transitionFor({}, total - 1, total) }
  ];
  return { plan, note: 'PowerPoint animation/transition data is authored inside PowerPoint itself — this generator can\'t write it into the .pptx file automatically. Select each slide in PowerPoint, open Transitions (or Animations for entrance effects), and apply the suggestion below — usually 2 clicks per slide.' };
}

module.exports = { suggestAnimations };
