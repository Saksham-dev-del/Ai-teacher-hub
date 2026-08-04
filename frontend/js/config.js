// Shared constants used across the frontend modules.
// (No imports/exports - these files are loaded as plain <script> tags in order,
// so everything here becomes available as a global for the files loaded after it.)

const TYPE_COLORS = {
  'Lesson Plan': '#2F5D50',
  'Notes': '#E0A93A',
  'Quiz': '#3A5A78',
  'Assignment': '#B5573F',
  'Classroom Activity': '#5B6B62',
  'Viva Questions': '#6B4C6E',
  'Study Material': '#2F5D50'
};

const STYLES = ['Concept-First', 'Example-Led', 'Analogy-Driven', 'Problem-Based', 'Question-Led'];

// In-memory rotation counter so repeated "Generate a different explanation"
// clicks for the same brief cycle through a new style each time.
const styleCounter = {};

function styleKeyFor(inputs) {
  return [inputs.course, inputs.subject, inputs.topic, inputs.type].join('|').toLowerCase();
}

function nextStyle(inputs) {
  const key = styleKeyFor(inputs);
  const n = styleCounter[key] || 0;
  styleCounter[key] = n + 1;
  return STYLES[n % STYLES.length];
}
