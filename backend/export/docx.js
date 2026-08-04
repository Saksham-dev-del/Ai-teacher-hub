const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType } = require('docx');

function scoreText(score) {
  return Number.isFinite(Number(score)) ? `${Math.round(Number(score))}/100` : 'Not available';
}

async function exportDocx(draft) {
  const children = [];
  children.push(new Paragraph({ text: draft.topic || 'Untitled Resource', heading: HeadingLevel.TITLE }));

  const langPart = draft.language && draft.language !== 'English' ? ` | ${draft.language}` : '';
  children.push(new Paragraph({
    children: [new TextRun({
      text: `${draft.type} | ${draft.course} | ${draft.subject} | ${draft.difficulty} | ${draft.duration} | Style: ${draft.style}${langPart}`,
      color: '666666', size: 20
    })],
    spacing: { after: 160 }
  }));

  if (draft.syllabusName) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `RAG source: ${draft.syllabusName}`, bold: true, color: '2F5D50' })],
      spacing: { after: 220 }
    }));
  }

  if (draft.sections && draft.sections.length) {
    for (const section of draft.sections) {
      children.push(new Paragraph({ text: section.h || '', heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } }));
      children.push(new Paragraph({ text: section.b || '', spacing: { after: 120 } }));
    }
  } else if (draft.qa && draft.qa.length) {
    for (const item of draft.qa) {
      children.push(new Paragraph({ children: [new TextRun({ text: item.q || '', bold: true })], spacing: { before: 200 } }));
      children.push(new Paragraph({ text: item.a || '', spacing: { after: 80 } }));
    }
  }

  if (draft.qualityScore) {
    children.push(new Paragraph({ text: 'AI Quality Score', heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 100 } }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${scoreText(draft.qualityScore.overall)} · ${draft.qualityScore.grade || ''}`, bold: true, size: 28, color: '2F5D50' }),
        new TextRun({ text: '  (Teacher review required)', italics: true, color: '777777' })
      ]
    }));
    const metrics = draft.qualityScore.metrics || {};
    children.push(new Paragraph({
      text: `Completeness ${metrics.completeness || 0}% | Clarity ${metrics.clarity || 0}% | Bloom alignment ${metrics.bloomAlignment || 0}% | CO alignment ${metrics.outcomeAlignment || 0}% | Syllabus grounding ${metrics.syllabusGrounding || 0}%`,
      spacing: { after: 120 }
    }));
  }

  if (draft.bloomQuestions && draft.bloomQuestions.length) {
    children.push(new Paragraph({ text: "Bloom's Taxonomy Questions", heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 120 } }));
    draft.bloomQuestions.forEach((item, index) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${index + 1}. [${item.level || 'Bloom'}] ${item.question || ''}`, bold: true })],
        spacing: { before: 160 }
      }));
      children.push(new Paragraph({ text: `Suggested answer: ${item.answer || ''}`, spacing: { after: 70 } }));
      if (item.rationale) children.push(new Paragraph({ children: [new TextRun({ text: `Pedagogical rationale: ${item.rationale}`, italics: true, color: '666666' })] }));
    });
  }

  if (draft.courseOutcomes && draft.courseOutcomes.length) {
    children.push(new Paragraph({ text: 'Course Outcomes', heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 100 } }));
    draft.courseOutcomes.forEach((item) => children.push(new Paragraph({ text: `${item.code || 'CO'}: ${item.text || ''}`, bullet: { level: 0 } })));
  }

  if (draft.coMapping && draft.coMapping.length) {
    children.push(new Paragraph({ text: 'Course Outcome Mapping', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 } }));
    const rows = [
      new TableRow({ children: ['Outcome', 'Mapped content', 'Bloom levels', 'Alignment'].map((text) => new TableCell({
        shading: { fill: 'DCEDE7', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
      })) }),
      ...draft.coMapping.map((item) => new TableRow({ children: [
        item.courseOutcome || '',
        (item.matchedSections || []).join(', '),
        (item.bloomLevels || []).join(', '),
        `${Number(item.alignmentScore || 0)}%`
      ].map((text) => new TableCell({ children: [new Paragraph(String(text))] })) }))
    ];
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  }

  if (draft.grounding && draft.grounding.retrievedChunks && draft.grounding.retrievedChunks.length) {
    children.push(new Paragraph({ text: 'Syllabus Evidence Used', heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 100 } }));
    draft.grounding.retrievedChunks.forEach((source) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `[${source.sourceId || 'S'}] `, bold: true, color: '2F5D50' }),
          new TextRun({ text: source.preview || '' })
        ],
        spacing: { after: 80 }
      }));
    });
  }

  children.push(new Paragraph({
    children: [new TextRun({ text: 'Generated by AI Teacher Resource Hub - AI-assisted, teacher-reviewed draft', italics: true, color: '999999', size: 16 })],
    spacing: { before: 400 }
  }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = { exportDocx };
