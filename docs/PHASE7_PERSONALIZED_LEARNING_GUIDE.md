# Phase 7 — Personalized AI Learning Engine

## Purpose
Phase 7 adapts academic content to learner performance and teaching preferences while keeping faculty review mandatory.

## Main Workflow
1. Teacher opens **Personalized AI**.
2. Teacher may select a saved resource and a student whose quiz attempts are accessible.
3. The system calculates the student learning profile on the backend.
4. Teacher chooses class performance, teaching style, language and an action.
5. Gemini is used when available. A deterministic fallback keeps the feature usable if the AI service is unavailable.
6. Output is stored as a Phase 7 artifact in MongoDB.

## Learning-Level Rules
- Needs revision: no completed attempt, extremely low recent performance, or weighted score below 40.
- Beginner: weighted score 40–59.
- Intermediate: weighted score 60–79.
- Advanced: weighted score 80 or above.

The profile also includes weak topics, weak Bloom levels, pass rate, recent average and recommended notes mode.

## Available Actions
- AI Lesson Plan Personalization
- Adaptive Notes
- AI Content Feedback
- Difficulty / Format Converter
- Explain Like I’m 5
- Exam Booster
- Auto Summary
- Flashcards

## API
- `GET /api/personalized/students`
- `GET /api/personalized/profile?studentId=...`
- `POST /api/personalized/profile/refresh`
- `POST /api/personalized/generate`
- `GET /api/personalized/artifacts`

## Security
Teachers can only inspect students who have attempted quizzes owned by that teacher. Admins can inspect all active students. Students can inspect only their own profile.
