# Phase 4 Testing Checklist

## Environment

- [ ] Node.js 18+
- [ ] MongoDB service running or Atlas URI configured
- [ ] `backend/.env` exists
- [ ] JWT secret is not a placeholder
- [ ] Gemini API key is valid
- [ ] Configured Gemini models are available to the project
- [ ] `npm install` completed
- [ ] Phase 2, 3 and 4 tests pass

## Detailed Generator

- [ ] Quick mode creates a concise report
- [ ] Standard mode creates at least seven sections
- [ ] Detailed mode creates at least ten sections
- [ ] Research mode creates at least twelve sections
- [ ] Live progress changes through real backend stages
- [ ] Failed AI section batch produces fallback content instead of losing the entire report
- [ ] Teacher can edit summary and explanation paragraphs
- [ ] Edits are reflected in downloaded files

## Multi-Source RAG

- [ ] Multiple PDFs can be selected
- [ ] RAG evidence displays document name and source ID
- [ ] Citations appear in relevant sections
- [ ] References appear in PDF and PPT
- [ ] General AI mode works without a selected PDF
- [ ] Scanned/image-only PDF gives selectable-text/OCR warning

## Visual Assets

- [ ] PNG upload works
- [ ] JPG upload works
- [ ] Unsupported file type is rejected
- [ ] Oversized image is rejected
- [ ] Uploaded image appears in media grid
- [ ] Image can be selected/deselected
- [ ] Image can be deleted by its owner
- [ ] Selected image appears in PDF
- [ ] Selected image appears in PPTX

## Detailed PDF

- [ ] Cover page is present
- [ ] Table of contents is present
- [ ] Section text is not clipped
- [ ] Examples and case studies render
- [ ] Tables render across page boundaries correctly
- [ ] Vector diagrams render
- [ ] Uploaded images keep readable proportions
- [ ] Bloom questions render
- [ ] CO mapping renders
- [ ] Quality and validation render
- [ ] References render
- [ ] Footer and page numbers render

## Visual PowerPoint

- [ ] PPTX opens in Microsoft PowerPoint
- [ ] PPTX opens in Google Slides or LibreOffice Impress
- [ ] Slides remain editable
- [ ] Slide count follows target approximately
- [ ] Uploaded images render
- [ ] Vector diagrams render
- [ ] Tables remain inside slide bounds
- [ ] Speaker notes exist when enabled
- [ ] Speaker notes are absent when disabled
- [ ] Quality/validation slide is present
- [ ] Reference slide is present when sources exist

## Motion UI

- [ ] Phase 4 pipeline animates
- [ ] Progress bar updates
- [ ] Rich sections reveal progressively
- [ ] Diagram nodes animate
- [ ] Image cards animate
- [ ] Validation cards animate
- [ ] Mobile layout remains usable
- [ ] Reduced-motion system setting is respected

## Persistence

- [ ] Phase 4 resource saves to MongoDB
- [ ] Phase 4 fields reload from Resource Hub
- [ ] Saved resource can generate PDF/PPT
- [ ] Shared resource remains visible to students
