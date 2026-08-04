async function p10json(url,options={},fallback='Request failed.'){const resp=await authFetch(url,options);const data=await resp.json().catch(()=>({}));if(!resp.ok)throw new Error(data.error||fallback);return data;}
const apiP10VoiceScript=(p)=>p10json('/api/intelligence/voice/script',{method:'POST',body:JSON.stringify(p)});
async function apiP10Audio(p){const resp=await authFetch('/api/intelligence/voice/audio',{method:'POST',body:JSON.stringify(p)});if(!resp.ok){const d=await resp.json().catch(()=>({}));throw new Error(d.error||'Audio generation failed.')}return resp.blob();}
const apiP10Video=(p)=>p10json('/api/intelligence/video-script',{method:'POST',body:JSON.stringify(p)});
const apiP10Diagram=(p)=>p10json('/api/intelligence/diagram',{method:'POST',body:JSON.stringify(p)});
const apiP10Chart=(p)=>p10json('/api/intelligence/chart',{method:'POST',body:JSON.stringify(p)});
const apiP10SmartTable=(p)=>p10json('/api/intelligence/smart-table',{method:'POST',body:JSON.stringify(p)});
const apiLiveEditPresentation=(p)=>p10json('/api/presentations/live-edit',{method:'POST',body:JSON.stringify(p)});
const apiTranslatePresentation=(p)=>p10json('/api/presentations/translate',{method:'POST',body:JSON.stringify(p)});
const apiReviewPresentation=(p)=>p10json('/api/presentations/review',{method:'POST',body:JSON.stringify(p)});
const apiGenerateExamNotes=(p)=>p10json('/api/presentations/exam-notes',{method:'POST',body:JSON.stringify(p)});
const apiOptimizeLayout=(p)=>p10json('/api/presentations/optimize-layout',{method:'POST',body:JSON.stringify(p)});
const apiBeautifyContent=(p)=>p10json('/api/presentations/beautify',{method:'POST',body:JSON.stringify(p)});
const apiAnimationPlan=(p)=>p10json('/api/presentations/animation-plan',{method:'POST',body:JSON.stringify(p)});
const apiGenerateWebsite=(p)=>p10json('/api/presentations/website',{method:'POST',body:JSON.stringify(p)});
const apiRepurposeContent=(p)=>p10json('/api/presentations/repurpose',{method:'POST',body:JSON.stringify(p)});
const apiGenerateNarration=(p)=>p10json('/api/presentations/narration',{method:'POST',body:JSON.stringify(p)});
const apiWebSearch=(p)=>p10json('/api/intelligence/web-search',{method:'POST',body:JSON.stringify(p)});
const apiImageSearch=(p)=>p10json('/api/intelligence/image-search',{method:'POST',body:JSON.stringify(p)});
const apiIllustrationSearch=(p)=>p10json('/api/intelligence/illustration-search',{method:'POST',body:JSON.stringify(p)});
const apiGenerateInfographic=(p)=>p10json('/api/intelligence/infographic',{method:'POST',body:JSON.stringify(p)});
const apiConceptExplain=(p)=>p10json('/api/intelligence/concept-explain',{method:'POST',body:JSON.stringify(p)});
const apiP10Similarity=(p)=>p10json('/api/intelligence/similarity-risk',{method:'POST',body:JSON.stringify(p)});
const apiP10Factual=(p)=>p10json('/api/intelligence/factual-verification',{method:'POST',body:JSON.stringify(p)});
const apiP10Safety=(p)=>p10json('/api/intelligence/safety-review',{method:'POST',body:JSON.stringify(p)});
const apiP10Search=(q)=>p10json(`/api/intelligence/search?q=${encodeURIComponent(q)}`);
