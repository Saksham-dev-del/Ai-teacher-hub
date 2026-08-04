function buildNarrationScript(draft) {
  const sections = draft.reportSections || [];
  if (!sections.length) throw new Error('This presentation has no sections yet — generate it first.');

  const segments = [
    { heading: 'Title', text: `Welcome. Today we're covering ${draft.topic}${draft.subject ? `, part of ${draft.subject}` : ''}.` },
    ...sections.map((s) => ({ heading: s.heading, text: s.speakerNotes || s.summary || `Let's look at ${s.heading}.` })),
    { heading: 'Close', text: 'That brings us to the end of this presentation. Thank you, and let\'s move to questions.' }
  ];

  const fullScript = segments.map((s, i) => `[Slide ${i + 1} — ${s.heading}]\n${s.text}`).join('\n\n');
  const estimatedSeconds = Math.round(segments.reduce((a, s) => a + s.text.trim().split(/\s+/).length, 0) / 2.5); // ~150 wpm

  return { segments, fullScript, estimatedSeconds };
}

module.exports = { buildNarrationScript };
