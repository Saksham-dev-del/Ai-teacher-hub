# Phase 3 Implementation Guide

## 1. Student Quiz Attempt

Published quizzes appear automatically for student accounts. Starting a quiz creates a MongoDB `QuizAttempt` record. The student receives question text, options and marks, but never receives the answer key before submission.

The timer is calculated from the backend `startedAt` value, so refreshing the page does not create extra time. An in-progress attempt is resumed instead of duplicated.

## 2. Automatic Grading

The backend grades each question:

- MCQ: exact normalized answer match
- True/False: normalized boolean match
- Short answer: accepted-answer and keyword coverage

The stored attempt includes score, total marks, percentage, pass/fail, duration, Bloom level and Course Outcome.

## 3. Performance Analytics

The `/api/performance` endpoint calculates:

- Total attempts
- Average score
- Pass rate
- Active students
- Score distribution
- Quiz performance
- Topic performance
- Bloom mastery
- Course Outcome mastery
- Weak-area alerts
- Recent attempts

Students see only their own performance. Teachers see attempts for quizzes they own. Admins can request platform-wide scope.

## 4. PowerPoint Generator

PptxGenJS creates an editable presentation directly on the backend. Teachers can generate a deck from a current draft or a saved MongoDB resource.

The deck includes content, Bloom questions, outcomes and quality review. It does not flatten slides into images.

## 5. Lesson Calendar

Teacher/admin accounts can create, update and delete calendar events. Students can only view events marked as shared.

Supported event types:
- Lecture
- Lab
- Quiz
- Assignment
- Revision
- Meeting
- Other

## 6. Motion Animations

Motion One is included locally in `frontend/vendor/motion-umd.js` so the UI animations do not depend on a CDN.

Motion is used for:
- View entrances
- Staggered cards
- Hover springs
- Button press feedback
- Animated performance bars
- Histogram growth
- Calendar editor entrance
- Live status indicators

Users with `prefers-reduced-motion` receive reduced animation automatically.
