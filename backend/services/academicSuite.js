const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

const ACTIONS = ['course-planner', 'question-paper', 'rubric', 'revision-plan', 'case-study', 'coding-lab'];
const EXAM_TYPES = ['Unit Test', 'Internal Exam', 'Mid-Term', 'End-Semester'];
const QUESTION_TYPES = ['MCQ', '2 marks', '5 marks', '10 marks', 'Case study', 'Numerical', 'Coding question'];

function clean(value, max = 300) { return String(value || '').trim().slice(0, max); }
function cleanList(value, max = 20) { return Array.isArray(value) ? value.map((x) => clean(x, 200)).filter(Boolean).slice(0, max) : []; }
function parseUnits(value) {
  if (Array.isArray(value)) return cleanList(value, 20);
  return String(value || '').split(/\n|,/).map((x) => clean(x, 200)).filter(Boolean).slice(0, 20);
}

function normalizeBlueprint(value, totalMarks = 50) {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.map((row, index) => ({
    unit: clean(row.unit || `Unit ${index + 1}`, 80),
    marks: Math.max(1, Math.min(100, Math.round(Number(row.marks || 0)))),
    difficulty: ['Easy', 'Medium', 'Advanced'].includes(row.difficulty) ? row.difficulty : 'Medium',
    topic: clean(row.topic || row.unit || `Unit ${index + 1}`, 180)
  })).filter((row) => row.marks > 0).slice(0, 12);
  if (!normalized.length) return [
    { unit: 'Unit 1', marks: Math.round(totalMarks * 0.4), difficulty: 'Easy', topic: 'Unit 1' },
    { unit: 'Unit 2', marks: Math.round(totalMarks * 0.3), difficulty: 'Medium', topic: 'Unit 2' },
    { unit: 'Unit 3', marks: totalMarks - Math.round(totalMarks * 0.4) - Math.round(totalMarks * 0.3), difficulty: 'Advanced', topic: 'Unit 3' }
  ];
  return normalized;
}

function validateBlueprint(blueprint, totalMarks) {
  const rows = normalizeBlueprint(blueprint, totalMarks);
  const sum = rows.reduce((s, x) => s + x.marks, 0);
  return {
    valid: sum === Number(totalMarks),
    totalMarks: Number(totalMarks),
    allocatedMarks: sum,
    difference: Number(totalMarks) - sum,
    rows,
    message: sum === Number(totalMarks) ? 'Blueprint marks match the question-paper total.' : `Blueprint allocates ${sum} marks, but the paper total is ${totalMarks}.`
  };
}

function markType(mark, allowed, index = 0) {
  let candidates = [];
  if (mark === 10) candidates = ['10 marks', 'Case study', 'Coding question'];
  else if (mark === 5) candidates = ['5 marks', 'Numerical'];
  else if (mark === 2) candidates = ['2 marks'];
  else if (mark === 1) candidates = ['MCQ'];
  candidates = candidates.filter((type) => allowed.includes(type));
  if (!candidates.length) return mark === 1 ? 'MCQ' : `${mark} marks`;
  return candidates[index % candidates.length];
}

function typeMarks(type) {
  if (type === 'MCQ') return 1;
  if (type === '2 marks') return 2;
  if (type === '5 marks' || type === 'Numerical') return 5;
  if (type === '10 marks' || type === 'Case study' || type === 'Coding question') return 10;
  return 1;
}

function allocateQuestionSpecs(total, questionTypes, offset = 0) {
  const allowed = cleanList(questionTypes, 10).filter((x) => QUESTION_TYPES.includes(x));
  if (!allowed.length) allowed.push('MCQ', '2 marks', '5 marks', '10 marks');
  const byMark = {
    1: allowed.filter((x) => typeMarks(x) === 1),
    2: allowed.filter((x) => typeMarks(x) === 2),
    5: allowed.filter((x) => typeMarks(x) === 5),
    10: allowed.filter((x) => typeMarks(x) === 10)
  };
  const specs = [];
  let remaining = Number(total);
  let cursor = Number(offset || 0);
  const add = (mark) => {
    const choices = byMark[mark] || [];
    const type = choices.length ? choices[cursor % choices.length] : mark === 1 ? 'MCQ' : `${mark} marks`;
    specs.push({ marks: mark, type });
    remaining -= mark;
    cursor += 1;
  };

  // Build a varied paper first, then use larger questions for the remaining marks.
  if (remaining >= 1 && byMark[1].length) add(1);
  if (remaining >= 2 && byMark[2].length) add(2);
  if (remaining >= 5 && byMark[5].length) add(5);
  while (remaining > 0) {
    if (remaining >= 10 && byMark[10].length) add(10);
    else if (remaining >= 5 && byMark[5].length) add(5);
    else if (remaining >= 2 && byMark[2].length) add(2);
    else if (remaining >= 1 && byMark[1].length) add(1);
    else if (remaining >= 5) { specs.push({ marks: 5, type: '5 marks' }); remaining -= 5; }
    else if (remaining >= 2) { specs.push({ marks: 2, type: '2 marks' }); remaining -= 2; }
    else { specs.push({ marks: 1, type: 'MCQ' }); remaining -= 1; }
  }
  return specs;
}

function allocateMarks(total, questionTypes) {
  return allocateQuestionSpecs(total, questionTypes).map((x) => x.marks);
}

function buildQuestionPaper(input) {
  const totalMarks = Math.max(10, Math.min(200, Math.round(Number(input.totalMarks || 50))));
  const validation = validateBlueprint(input.blueprint, totalMarks);
  if (!validation.valid) {
    const error = new Error(validation.message);
    error.code = 'BLUEPRINT_MISMATCH';
    error.validation = validation;
    throw error;
  }
  const allowed = cleanList(input.questionTypes, 10).filter((x) => QUESTION_TYPES.includes(x));
  const questions = [];
  let number = 1;
  validation.rows.forEach((row, rowIndex) => {
    const allocations = allocateQuestionSpecs(row.marks, allowed, number - 1);
    allocations.forEach((spec, index) => {
      const marks = spec.marks;
      const type = spec.type;
      let prompt = `Explain ${row.topic} with a suitable example.`;
      if (type === 'MCQ') prompt = `Which statement best describes ${row.topic}?`;
      else if (type === '2 marks') prompt = `Define ${row.topic} and state one important point.`;
      else if (type === '5 marks') prompt = `Explain the key concepts of ${row.topic} with an example.`;
      else if (type === '10 marks') prompt = `Discuss ${row.topic} in detail, including process, applications, advantages and limitations.`;
      else if (type === 'Case study') prompt = `Analyse a realistic case involving ${row.topic} and justify the recommended decision.`;
      else if (type === 'Numerical') prompt = `Solve a course-appropriate numerical problem based on ${row.topic}. Show all steps and assumptions.`;
      else if (type === 'Coding question') prompt = `Design and implement a program for ${row.topic}. Include algorithm, code, test input and expected output.`;
      questions.push({
        number: number++, unit: row.unit, topic: row.topic, type, marks, difficulty: row.difficulty,
        prompt,
        answer: type === 'MCQ'
          ? `Correct option: the statement that accurately defines ${row.topic}. Teacher should replace distractors and verify the final key.`
          : `Answer key should cover the definition, core steps, relevant example/application, and marking points proportional to ${marks} marks.`,
        options: type === 'MCQ' ? [`Correct definition of ${row.topic}`, 'An unrelated concept', 'A common misconception', 'None of these'] : []
      });
    });
  });
  return {
    title: `${input.examType || 'Internal Exam'} — ${input.subject || 'Subject'}`,
    examType: EXAM_TYPES.includes(input.examType) ? input.examType : 'Internal Exam',
    course: input.course || '', subject: input.subject || '', durationMinutes: Number(input.durationMinutes || 90), totalMarks,
    instructions: ['Attempt all questions unless an internal choice is explicitly added by the teacher.', 'Write clear steps, assumptions and diagrams where applicable.', 'Figures in the right margin indicate marks.'],
    blueprint: validation.rows,
    blueprintValidation: validation,
    questions,
    answerKey: questions.map((q) => ({ number: q.number, marks: q.marks, answer: q.answer })),
    totals: {
      questions: questions.length,
      marks: questions.reduce((s, q) => s + q.marks, 0),
      byUnit: validation.rows.map((row) => ({ unit: row.unit, marks: questions.filter((q) => q.unit === row.unit).reduce((s, q) => s + q.marks, 0) }))
    }
  };
}

function dateOnly(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 14 * 86400000);
  return Number.isNaN(date.getTime()) ? new Date(Date.now() + 14 * 86400000) : date;
}

function fallbackAcademic(action, input) {
  const topic = clean(input.topic || 'Selected Topic', 220);
  const subject = clean(input.subject || 'General Subject', 160);
  const course = clean(input.course || 'College Course', 100);
  const units = parseUnits(input.units).length ? parseUnits(input.units) : ['Unit 1 — Foundations', 'Unit 2 — Applications', 'Unit 3 — Advanced Topics'];

  if (action === 'question-paper') return buildQuestionPaper(input);

  if (action === 'course-planner') {
    return {
      title: `${subject} — Unit-wise Course Planner`, course, subject,
      units: units.map((unit, index) => ({
        unit, sequence: index + 1,
        notesPlan: [`Concept overview and prerequisite recap`, `Detailed notes for ${unit}`, 'Worked examples and common mistakes'],
        assignment: `Assignment ${index + 1}: Explain and apply the central concepts of ${unit}.`,
        quiz: [`5 MCQs`, `2 short-answer questions`, `1 application question`],
        weeklyPlan: [
          { session: 1, focus: `Introduction and definitions`, activity: 'Diagnostic questions' },
          { session: 2, focus: `Detailed explanation and examples`, activity: 'Guided practice' },
          { session: 3, focus: `Application and assessment`, activity: 'Quiz + reflection' }
        ],
        revisionPlan: `One-page summary, flashcards and a 15-minute practice quiz for ${unit}.`
      })),
      semesterPlan: units.flatMap((unit, index) => [
        { week: index * 2 + 1, unit, focus: 'Concept teaching and notes' },
        { week: index * 2 + 2, unit, focus: 'Practice, assignment and quiz' }
      ]),
      finalRevision: ['Revise weak units using analytics.', 'Conduct one cumulative mock test.', 'Use CO and Bloom mapping to check balanced coverage.']
    };
  }

  if (action === 'rubric') {
    const total = Math.max(10, Math.min(200, Number(input.totalMarks || 100)));
    const weights = [30, 20, 20, 20, 10];
    const labels = ['Content and conceptual accuracy', 'Presentation and organisation', 'Originality and independent thinking', 'Practical implementation / evidence', 'Viva and reflection'];
    let used = 0;
    const criteria = labels.map((label, i) => {
      const marks = i === labels.length - 1 ? total - used : Math.round(total * weights[i] / 100);
      used += marks;
      return {
        criterion: label, marks,
        levels: {
          excellent: `Complete, accurate and insightful performance (${Math.round(marks * 0.85)}–${marks}).`,
          good: `Mostly accurate with minor gaps (${Math.round(marks * 0.65)}–${Math.round(marks * 0.84)}).`,
          developing: `Partial understanding and limited evidence (${Math.round(marks * 0.4)}–${Math.round(marks * 0.64)}).`,
          needsImprovement: `Major gaps, unclear evidence or incomplete work (0–${Math.round(marks * 0.39)}).`
        }
      };
    });
    return { title: `${input.assignmentTitle || topic} — Evaluation Rubric`, totalMarks: total, criteria, teacherChecklist: ['Check originality evidence.', 'Record brief justification for each score.', 'Use the same criteria consistently for all students.'] };
  }

  if (action === 'revision-plan') {
    const examDate = dateOnly(input.examDate);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.ceil((examDate - start) / 86400000));
    const topics = units;
    const schedule = [];
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start.getTime() + i * 86400000);
      const unit = topics[i % topics.length];
      const cycle = i % 4;
      schedule.push({
        day: i + 1, date: date.toISOString().slice(0, 10), unit,
        focus: cycle === 0 ? 'Concept revision and quick notes' : cycle === 1 ? 'Important questions and worked examples' : cycle === 2 ? 'Practice quiz and error review' : 'Weak-topic revision and flashcards',
        duration: input.dailyMinutes || 60,
        tasks: [`Revise ${unit}`, 'Answer five retrieval questions', 'Record one unclear point for teacher review']
      });
    }
    return { title: `${subject} Smart Revision Plan`, examDate: examDate.toISOString().slice(0, 10), daysAvailable: days, schedule, examBooster: ['Complete one mock test 2–3 days before the exam.', 'Revise errors instead of rereading everything.', 'Use the last day only for summaries, formulas and rest.'] };
  }

  if (action === 'case-study') {
    return {
      title: `${topic} — Applied Case Study`, context: input.context || `A realistic organisation or classroom scenario related to ${subject}.`,
      scenario: `An organisation must make a decision involving ${topic}. Available information is incomplete, stakeholders have different priorities, and the chosen approach must be justified using concepts from ${subject}.`,
      facts: ['Current process has measurable limitations.', 'Stakeholders require an evidence-based recommendation.', 'Time, quality and ethical constraints must be considered.'],
      questions: [
        { q: 'Identify the central problem and relevant concepts.', marks: 5 },
        { q: 'Analyse two possible approaches.', marks: 10 },
        { q: 'Recommend one approach and justify it.', marks: 10 },
        { q: 'State limitations and implementation risks.', marks: 5 }
      ],
      modelAnswer: `A strong answer defines ${topic}, applies it to the facts, compares alternatives, justifies a recommendation and acknowledges limitations.`,
      teacherGuide: ['Accept multiple defensible solutions.', 'Award marks for evidence and reasoning, not only the final choice.']
    };
  }

  if (action === 'coding-lab') {
    const count = Math.max(3, Math.min(20, Number(input.programCount || 10)));
    const language = clean(input.programmingLanguage || 'Python', 40);
    const labs = Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      title: `${language} Lab ${i + 1}: ${topic}`,
      problem: i % 3 === 0 ? `Write a ${language} program that demonstrates the basic operation of ${topic}.` : i % 3 === 1 ? `Debug a faulty ${language} implementation related to ${topic} and explain each correction.` : `Predict the output and then modify a ${language} program based on ${topic}.`,
      objectives: [`Apply ${topic}`, `Write readable ${language} code`, 'Test normal and edge cases'],
      algorithm: ['Read/define the required input.', 'Apply the core logic.', 'Display the result.', 'Test with at least two inputs.'],
      starterCode: language.toLowerCase().includes('python') ? '# Write your solution here\n' : '// Write your solution here\n',
      expectedEvidence: ['Source code', 'Test cases', 'Output screenshot', 'Short explanation'],
      viva: [`What is the time/space cost?`, `What edge case did you test?`, `How would you improve the program?`]
    }));
    return { title: `${subject} Coding Lab Assistant`, language, topic, labs, practicalFileFormat: ['Aim', 'Theory', 'Algorithm', 'Source Code', 'Test Cases', 'Output', 'Conclusion', 'Viva Questions'] };
  }

  throw new Error('Unsupported academic-suite action.');
}

async function generateAcademic(action, input) {
  if (!ACTIONS.includes(action)) throw new Error('Unsupported academic-suite action.');
  const fallback = fallbackAcademic(action, input);
  if (action === 'question-paper') {
    // Deterministic construction guarantees exact blueprint marks. AI may enrich only textual prompts in future.
    return { output: fallback, generationMode: 'hybrid', warning: 'The blueprint and marks were generated deterministically to guarantee an exact total; teacher review is still required.' };
  }
  const system = [
    'You are the Phase 8 Academic Planning and Assessment Suite for a secure college platform.',
    'Create practical faculty-ready outputs and preserve all numerical constraints.',
    UNTRUSTED_REFERENCE_RULES,
    'Return strictly valid JSON only, matching the provided fallback shape.'
  ].join(' ');
  const prompt = `Action: ${action}\nInputs: ${JSON.stringify(input)}\nReturn JSON matching this shape: ${JSON.stringify(fallback)}. Keep the output detailed, measurable and directly usable by college faculty.`;
  try {
    const ai = await callJson(system, prompt);
    return { output: { ...fallback, ...ai }, generationMode: 'ai', warning: '' };
  } catch (error) {
    return { output: fallback, generationMode: 'fallback', warning: `AI service unavailable; deterministic academic output generated. ${error.message || ''}`.trim() };
  }
}

function attendanceReminder(input, studentName) {
  const topic = clean(input.topic || 'the missed lesson', 220);
  return {
    title: `Catch-up reminder: ${topic}`,
    message: `${studentName || 'Student'} missed ${topic} in ${input.subject || 'the scheduled class'}. Review the short notes and complete a five-question catch-up quiz before the next session.`,
    suggestedActions: [`Send easy explanation notes for ${topic}`, `Assign a 5-question catch-up quiz`, 'Schedule a 10-minute doubt-clearing check']
  };
}

module.exports = { ACTIONS, EXAM_TYPES, QUESTION_TYPES, parseUnits, normalizeBlueprint, validateBlueprint, allocateMarks, allocateQuestionSpecs, buildQuestionPaper, fallbackAcademic, generateAcademic, attendanceReminder };
