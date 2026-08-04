# Phase 3 Testing Checklist

## Setup
- [ ] MongoDB is running
- [ ] `backend/.env` contains a valid `MONGODB_URI`
- [ ] `JWT_SECRET` is not a placeholder
- [ ] Gemini API key is valid
- [ ] `npm install` completes
- [ ] `npm run test:phase3` passes

## Quiz Studio — Teacher
- [ ] Saved resources appear in Quiz Studio
- [ ] Quiz generation creates at least four valid questions
- [ ] Quiz can be published and unpublished
- [ ] Quiz can be deleted
- [ ] Attempt report opens

## Quiz Center — Student
- [ ] Only published quizzes appear
- [ ] Attempt starts successfully
- [ ] Timer counts down
- [ ] Answer progress updates
- [ ] Submission returns score immediately
- [ ] Correct/incorrect review appears
- [ ] Max-attempt rule is enforced

## Performance
- [ ] Summary cards load
- [ ] Score distribution loads
- [ ] Topic performance loads
- [ ] Bloom mastery loads
- [ ] Course Outcome mastery loads
- [ ] Weak-area alerts load
- [ ] Student sees only personal performance

## PowerPoint
- [ ] Saved resources appear in selector
- [ ] Slide preview changes with selected resource
- [ ] Theme selector changes preview
- [ ] `.pptx` downloads
- [ ] PowerPoint opens and slides remain editable

## Lesson Calendar
- [ ] Month navigation works
- [ ] Teacher can create event
- [ ] Teacher can update event
- [ ] Teacher can delete event
- [ ] Resource linking fills course/subject/topic
- [ ] Student can see shared events
- [ ] Student cannot edit events

## Motion UI
- [ ] Cards enter with staggered animation
- [ ] Hover spring works
- [ ] Buttons animate on press
- [ ] Analytics bars animate
- [ ] Calendar editor slides in
- [ ] Reduced-motion preference is respected
