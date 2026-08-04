const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

const DEPTH_CONFIG = {
  quick: { sectionCount: 6, wordsPerSection: 120, targetPages: 6, targetSlides: 10 },
  standard: { sectionCount: 8, wordsPerSection: 210, targetPages: 10, targetSlides: 16 },
  detailed: { sectionCount: 12, wordsPerSection: 340, targetPages: 20, targetSlides: 26 },
  research: { sectionCount: 15, wordsPerSection: 480, targetPages: 32, targetSlides: 36 }
};

const BASE_OUTLINES = {
  'Lesson Plan': ['Session Overview', 'Learning Objectives', 'Prerequisite Knowledge', 'Opening and Motivation', 'Core Concept Explanation', 'Guided Demonstration', 'Worked Examples', 'Classroom Activity', 'Differentiated Teaching Strategy', 'Assessment Strategy', 'Common Misconceptions', 'Closure and Reflection', 'Homework and Extension', 'Teacher Notes', 'References'],
  'Notes': ['Executive Overview', 'Background and Context', 'Key Definitions', 'Core Concepts', 'Detailed Working', 'Worked Examples', 'Comparison and Classification', 'Real-World Applications', 'Case Study', 'Advantages and Limitations', 'Common Mistakes', 'Exam-Oriented Revision', 'Important Questions', 'Conclusion', 'References'],
  'Study Material': ['Learning Guide', 'Background', 'Essential Vocabulary', 'Conceptual Foundation', 'Detailed Explanation', 'Step-by-Step Process', 'Illustrative Examples', 'Applied Case Study', 'Comparison Table', 'Practice Tasks', 'Common Errors', 'Revision Notes', 'Self-Assessment', 'Further Reading', 'References'],
  'Assignment': ['Assignment Overview', 'Learning Objectives', 'Background Reading', 'Task 1: Foundation', 'Task 2: Application', 'Task 3: Analysis', 'Task 4: Evaluation', 'Task 5: Creation', 'Case Study', 'Submission Instructions', 'Evaluation Rubric', 'Academic Integrity', 'Expected Outcomes', 'Extension Task', 'References'],
  'Classroom Activity': ['Activity Overview', 'Learning Objectives', 'Required Materials', 'Preparation', 'Warm-Up', 'Main Activity', 'Step-by-Step Facilitation', 'Group Roles', 'Example Output', 'Assessment', 'Adaptation and Inclusion', 'Reflection', 'Follow-Up', 'Teacher Checklist', 'References'],
  'Quiz': ['Quiz Overview', 'Instructions', 'Foundational Questions', 'Conceptual Questions', 'Application Questions', 'Analytical Questions', 'Evaluation Questions', 'Creation Prompt', 'Answer Key', 'Explanations', 'Bloom Distribution', 'Course Outcome Mapping', 'Common Errors', 'Remedial Guidance', 'References'],
  'Viva Questions': ['Viva Overview', 'Foundational Questions', 'Terminology', 'Conceptual Understanding', 'Process and Working', 'Application Questions', 'Analytical Questions', 'Evaluation Questions', 'Scenario Questions', 'Advanced Questions', 'Answer Guidance', 'Common Weak Responses', 'Assessment Rubric', 'Revision Tips', 'References'],
  'Presentation': ['Introduction and Context', 'Motivation and Problem Statement', 'Core Concept Overview', 'Key Definitions', 'Detailed Explanation', 'Step-by-Step Working', 'Real-World Applications', 'Worked Example', 'Case Study', 'Comparative Analysis', 'Advantages and Limitations', 'Current Trends', 'Challenges and Future Scope', 'Best Practices', 'References']
};

function cleanDepth(value) {
  const depth = String(value || 'standard').toLowerCase();
  return DEPTH_CONFIG[depth] ? depth : 'standard';
}

function fallbackOutline(inputs) {
  const depth = cleanDepth(inputs.contentDepth);
  const cfg = { ...DEPTH_CONFIG[depth] };
  cfg.sectionCount = scaledSectionCount(cfg, inputs);
  const source = BASE_OUTLINES[inputs.type] || BASE_OUTLINES.Notes;
  return {
    title: `${inputs.topic} - ${inputs.type}`,
    executiveSummary: `A ${depth} academic resource for ${inputs.course} ${inputs.subject}, designed for teacher review and classroom use.`,
    outline: source.slice(0, cfg.sectionCount).map((heading, index) => ({
      heading,
      purpose: `Explain ${heading.toLowerCase()} in relation to ${inputs.topic}, with suitable examples and academic context.`,
      visualHint: index % 3 === 1 ? 'process' : index % 3 === 2 ? 'comparison' : 'concept-map'
    })),
    fallbackUsed: true
  };
}

function scaledSectionCount(cfg, inputs) {
  const requestedSlides = Number(inputs.targetSlides || 0);
  if (!requestedSlides) return cfg.sectionCount;
  // Each outline section typically expands into 1-4 slides (content + example/case/table).
  // Scale the outline up for large slide targets (e.g. 60-100 slide decks) but cap it so
  // sections stay meaningfully distinct rather than repetitive filler.
  const suggested = Math.ceil(requestedSlides / 4);
  return Math.max(cfg.sectionCount, Math.min(24, suggested));
}

async function planDetailedContent(inputs, ragContext = {}) {
  const depth = cleanDepth(inputs.contentDepth);
  const cfg = { ...DEPTH_CONFIG[depth] };
  cfg.sectionCount = scaledSectionCount(cfg, inputs);
  const sourceSummary = (ragContext.chunks || []).slice(0, 6).map((c) => `[${c.sourceId}] ${c.text}`).join('\n');
  const system = [
    'You are an expert instructional designer and academic report architect.',
    'Plan a detailed, non-repetitive, college-level teaching resource.',
    'Return strictly valid JSON only.', UNTRUSTED_REFERENCE_RULES
  ].join(' ');
  const prompt = `
Create the content architecture for a ${depth} ${inputs.type}.
Course: ${inputs.course}
Subject: ${inputs.subject}
Topic: ${inputs.topic}
Difficulty: ${inputs.difficulty}
Duration: ${inputs.duration}
Target sections: exactly ${cfg.sectionCount}
Target words per section later: approximately ${cfg.wordsPerSection}
Visual density: ${inputs.visualDensity || 'balanced'}
Include diagrams: ${Boolean(inputs.includeDiagrams)}
Include case studies: ${Boolean(inputs.includeCaseStudies)}
Include references: ${Boolean(inputs.includeReferences)}

${sourceSummary ? `RAG sources available:\n${sourceSummary}` : 'No syllabus source is available; keep the plan general and do not invent syllabus claims.'}

Return this shape:
{
  "title":"string",
  "executiveSummary":"80-140 word overview",
  "outline":[
    {"heading":"string","purpose":"string","visualHint":"flowchart|concept-map|comparison|timeline|process|table|image|none"}
  ]
}
The outline must be logically ordered, avoid duplicate sections, and include examples, applications, limitations, summary and references where appropriate.
`;
  try {
    const parsed = await callJson(system, prompt);
    const outline = Array.isArray(parsed.outline) ? parsed.outline.slice(0, cfg.sectionCount).map((item, i) => ({
      heading: String(item.heading || `Section ${i + 1}`).trim(),
      purpose: String(item.purpose || '').trim(),
      visualHint: String(item.visualHint || 'none').trim().toLowerCase()
    })) : [];
    if (outline.length < Math.max(4, Math.floor(cfg.sectionCount * 0.7))) return fallbackOutline(inputs);
    return {
      title: String(parsed.title || `${inputs.topic} - ${inputs.type}`).trim(),
      executiveSummary: String(parsed.executiveSummary || '').trim(),
      outline,
      fallbackUsed: false
    };
  } catch (error) {
    console.warn('[phase4/planner] AI outline unavailable; using deterministic plan:', error.message);
    return { ...fallbackOutline(inputs), plannerWarning: error.message };
  }
}

module.exports = { DEPTH_CONFIG, cleanDepth, fallbackOutline, planDetailedContent };
