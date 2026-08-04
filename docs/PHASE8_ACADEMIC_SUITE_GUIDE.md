# Phase 8 — Academic Planning and Assessment Suite

## Purpose
Phase 8 provides practical faculty tools for planning courses, constructing balanced assessments and supporting absent students.

## Question Paper Workflow
1. Select exam type: Unit Test, Internal Exam, Mid-Term or End-Semester.
2. Enter total marks and duration.
3. Select question types.
4. Create a unit-wise blueprint with marks and difficulty.
5. The browser provides live mark feedback.
6. The backend validates the blueprint again.
7. Generation is blocked if allocated marks do not equal total marks.
8. The paper, blueprint and answer-key guidance are saved as a Phase 8 artifact.

## Supported Question Types
- MCQ
- 2 marks
- 5 marks
- 10 marks
- Case study
- Numerical
- Coding question

## Other Tools
- Unit-Wise Course Planner
- AI Rubric Generator
- Smart Revision Plan
- AI Case Study Generator
- Coding Lab Assistant
- Attendance-Based Reminder

## API
- `GET /api/academic-suite/config`
- `POST /api/academic-suite/blueprint/validate`
- `POST /api/academic-suite/generate`
- `GET /api/academic-suite/artifacts`
- `GET /api/academic-suite/students`
- `POST /api/academic-suite/attendance`
- `GET /api/academic-suite/attendance`

## Teacher Review
Generated questions, model answers, rubrics and reminders are drafts. Faculty must verify marks, institutional policy, syllabus coverage and factual accuracy before use.
