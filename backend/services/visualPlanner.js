const VISUAL_TYPES = ['flowchart', 'concept-map', 'comparison', 'timeline', 'process', 'table', 'image', 'smart-cards', 'none'];

function chooseVisualType(section, index, inputs) {
  if (!inputs.includeDiagrams && !inputs.includeImages) return 'none';
  const hint = String(section.visual?.type || '').toLowerCase();
  if (VISUAL_TYPES.includes(hint) && hint !== 'none') return hint;
  const text = `${section.heading} ${section.summary}`.toLowerCase();
  if (/history|evolution|timeline|generation|milestone|roadmap/.test(text)) return 'timeline';
  if (/compare|difference|versus|classification|type/.test(text)) return 'comparison';
  if (/process|working|method|algorithm|steps|procedure|workflow/.test(text)) return 'flowchart';
  if (/data|metric|score|analysis|result|statistic/.test(text)) return 'table';
  if (/advantage|benefit|feature|highlight|key point|best practice|takeaway/.test(text)) return 'smart-cards';
  return index % 2 ? 'concept-map' : 'process';
}

function planVisuals(sections, inputs, mediaAssets = []) {
  const density = String(inputs.visualDensity || 'balanced').toLowerCase();
  const interval = density === 'visual-rich' ? 1 : density === 'text-focused' ? 4 : 2;
  let mediaIndex = 0;
  return sections.map((section, index) => {
    const showVisual = index % interval === 0 || section.table || section.caseStudy;
    const type = showVisual ? chooseVisualType(section, index, inputs) : 'none';
    const asset = inputs.includeImages && mediaAssets.length && showVisual ? mediaAssets[mediaIndex++ % mediaAssets.length] : null;
    const nodes = section.visual?.nodes?.length
      ? section.visual.nodes.slice(0, 8)
      : [inputs.topic, section.heading, ...(section.keyPoints || []).slice(0, 4)];
    return {
      ...section,
      visual: {
        ...(section.visual || {}),
        type: asset ? 'image' : type,
        title: section.visual?.title || `${section.heading} Visual`,
        description: section.visual?.description || `Visual explanation of ${section.heading} in the context of ${inputs.topic}.`,
        nodes,
        caption: section.visual?.caption || `Figure: ${section.heading}`,
        assetId: asset?._id || asset?.id || null,
        assetUrl: asset?.url || '',
        assetName: asset?.originalName || ''
      }
    };
  });
}

module.exports = { planVisuals, chooseVisualType };
