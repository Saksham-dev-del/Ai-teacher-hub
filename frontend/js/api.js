async function generateContentAI(inputs) {
  const style = nextStyle(inputs);
  const resp = await authFetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ ...inputs, style })
  });

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    throw new Error('The server sent back something that was not valid JSON.');
  }
  if (!resp.ok) throw new Error(data.error || `Server error (${resp.status})`);

  return {
    style: data.style || style,
    sections: data.sections || null,
    qa: data.qa || null,
    bloomQuestions: data.bloomQuestions || [],
    courseOutcomes: data.courseOutcomes || [],
    coMapping: data.coMapping || [],
    qualityScore: data.qualityScore || null,
    syllabusId: data.syllabusId || null,
    syllabusName: data.syllabusName || '',
    grounding: data.grounding || null
  };
}
