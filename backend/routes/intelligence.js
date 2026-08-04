const express=require('express');
const Resource=require('../models/Resource');
const Department=require('../models/Department');
const PhaseArtifact=require('../models/PhaseArtifact');
const Syllabus=require('../models/Syllabus');
const {requireAuth,requireRole}=require('../middleware/auth');
const {cleanText,writeAudit}=require('../services/security');
const {resourceToText,expandSearchQuery,similarityRisk,factualVerification,safetyReview,diagramPlan,renderDiagramSvg,chartPlan,renderChartSvg,smartTablePlan,infographicPlan,renderInfographicSvg,voiceScript,videoScript,geminiTts,lexicalScore,cosineSimilarity,embedDocuments,embedQuery}=require('../services/platformIntelligence');
const {wikipediaSearch}=require('../services/webSearch');
const {searchImages,searchIllustrations}=require('../services/mediaSearch');
const {explainConcept}=require('../services/conceptExplainer');
const {canAccessResource}=require('../services/collaboration');
const router=express.Router();
router.use(requireAuth);

async function accessibleResources(user){
  if(user.role==='admin')return Resource.find({}).limit(500);
  const depts=await Department.find({$or:[{owner:user._id},{'members.user':user._id}]}).select('_id');
  return Resource.find({$or:[{owner:user._id},{shared:true},{collaborators:user._id},{department:{$in:depts.map((d)=>d._id)}}]}).limit(500);
}
async function sourceText(req){if(req.body?.resourceId){const r=await Resource.findById(req.body.resourceId);if(!r||!(await canAccessResource(req.user,r)))throw Object.assign(new Error('Selected resource is not accessible.'),{status:404});return {text:resourceToText(r),resource:r};}return {text:cleanText(req.body?.text,30000),resource:null};}

async function verificationSources(req, resource=null){
  const ids=new Set();
  const requested=[req.body?.syllabusId,...(Array.isArray(req.body?.syllabusIds)?req.body.syllabusIds:[])].filter(Boolean).map(String);
  requested.forEach((id)=>ids.add(id));
  if(resource?.syllabus)ids.add(String(resource.syllabus));
  const query=ids.size?{_id:{$in:[...ids]}}:{_id:null};
  if(req.user.role!=='admin')query.owner=req.user._id;
  const syllabi=ids.size?await Syllabus.find(query).lean():[];
  const out=[];
  syllabi.forEach((doc)=>{
    (doc.chunks||[]).slice(0,100).forEach((chunk)=>out.push({
      id:`SYL:${doc._id}:${chunk.index}`,sourceId:String(doc._id),sourceName:doc.originalName,
      sourceType:'syllabus',chunkIndex:chunk.index,text:chunk.text,embedding:chunk.embedding
    }));
  });
  if(req.body?.includeInternalReferences===true){
    const docs=await accessibleResources(req.user);
    docs.filter((x)=>!resource||String(x._id)!==String(resource._id)).slice(0,80).forEach((doc,index)=>out.push({
      id:`RES:${doc._id}:${index}`,sourceId:String(doc._id),sourceName:`${doc.subject||''} — ${doc.topic||'Resource'}`,
      sourceType:'internal-resource',chunkIndex:index,text:resourceToText(doc)
    }));
  }
  return {sources:out,syllabi:syllabi.map((x)=>({_id:x._id,originalName:x.originalName,course:x.course,subject:x.subject}))};
}

router.post('/voice/script', async(req,res,next)=>{try{const src=await sourceText(req);if(!src.text)return res.status(400).json({error:'Select a resource or provide text.'});const output=await voiceScript(src.text,{title:req.body?.title,topic:req.body?.topic||src.resource?.topic,language:req.body?.language,style:req.body?.style});const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'multimedia',action:'voice-script',title:cleanText(output.title,260),course:src.resource?.course||'',subject:src.resource?.subject||'',topic:src.resource?.topic||cleanText(req.body?.topic,220),sourceResource:src.resource?._id||null,inputs:{language:req.body?.language,style:req.body?.style},output,generationMode:output.generationMode||'fallback'});res.status(201).json({output,artifact});}catch(err){next(err)}});
router.post('/voice/audio', async(req,res,next)=>{try{const text=cleanText(req.body?.text,7000);if(!text)return res.status(400).json({error:'Narration text is required.'});const wav=await geminiTts(text,{voice:cleanText(req.body?.voice,60)});res.setHeader('Content-Type','audio/wav');res.setHeader('Content-Disposition',`attachment; filename="${cleanText(req.body?.filename||'ai-voice-note',80).replace(/[^a-z0-9_-]/gi,'-')}.wav"`);res.send(wav);}catch(err){next(err)}});
router.post('/video-script', requireRole('teacher','admin'), async(req,res,next)=>{try{const output=await videoScript({topic:cleanText(req.body?.topic,220),subject:cleanText(req.body?.subject,160),format:cleanText(req.body?.format,100),language:cleanText(req.body?.language,50),context:cleanText(req.body?.context,5000)});const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'multimedia',action:'video-script',title:cleanText(output.title,260),subject:cleanText(req.body?.subject,160),topic:cleanText(req.body?.topic,220),inputs:req.body,output,generationMode:output.generationMode||'fallback'});res.status(201).json({output,artifact});}catch(err){next(err)}});
router.post('/diagram', async(req,res,next)=>{try{const type=['flowchart','mind-map','er','architecture','process','comparison','timeline','uml','sequence','state'].includes(req.body?.type)?req.body.type:'flowchart';const plan=await diagramPlan(type,cleanText(req.body?.topic,220),cleanText(req.body?.context,3000));const svg=renderDiagramSvg(plan,type);const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'diagram',action:type,title:cleanText(plan.title,260),topic:cleanText(req.body?.topic,220),inputs:{type,context:req.body?.context},output:{plan,svg},generationMode:plan.generationMode||'fallback'});res.status(201).json({plan,svg,artifact});}catch(err){next(err)}});
router.post('/chart', async(req,res,next)=>{try{const type=['pie','line','area','bar','histogram','scatter','sankey','gantt','timeline'].includes(req.body?.type)?req.body.type:'bar';const plan=await chartPlan(type,cleanText(req.body?.topic,220),cleanText(req.body?.context,3000));const svg=renderChartSvg(plan,type);const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'chart',action:type,title:cleanText(plan.title,260),topic:cleanText(req.body?.topic,220),inputs:{type,context:req.body?.context},output:{plan,svg},generationMode:plan.generationMode||'fallback'});res.status(201).json({plan,svg,artifact});}catch(err){next(err)}});
router.post('/smart-table', async(req,res,next)=>{try{const rawText=cleanText(req.body?.rawText,8000);if(!rawText)return res.status(400).json({error:'Paste some table text or data first.'});const plan=await smartTablePlan(rawText,cleanText(req.body?.context,1500));const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'smart-table',action:'clean',title:cleanText(plan.title,260),topic:cleanText(req.body?.context,220),inputs:{rawText},output:{plan},generationMode:plan.generationMode||'fallback'});res.status(201).json({plan,artifact});}catch(err){next(err)}});
router.post('/web-search', async(req,res,next)=>{try{const topic=cleanText(req.body?.topic,200);if(!topic)return res.status(400).json({error:'Enter a topic to search.'});const data=await wikipediaSearch(topic);res.json(data);}catch(err){res.status(502).json({error:err.message||'Web search failed. The server may not have internet access to Wikipedia right now.'})}});
router.post('/image-search', async(req,res,next)=>{try{const topic=cleanText(req.body?.topic,200);if(!topic)return res.status(400).json({error:'Enter a topic to search.'});const data=await searchImages(topic);res.json(data);}catch(err){res.status(502).json({error:err.message||'Image search failed. The server may not have internet access right now.'})}});
router.post('/illustration-search', async(req,res,next)=>{try{const topic=cleanText(req.body?.topic,200);if(!topic)return res.status(400).json({error:'Enter a topic to search.'});const data=await searchIllustrations(topic);res.json(data);}catch(err){res.status(502).json({error:err.message||'Illustration search failed. The server may not have internet access right now.'})}});
router.post('/infographic', async(req,res,next)=>{try{const topic=cleanText(req.body?.topic,220);if(!topic)return res.status(400).json({error:'Enter a topic first.'});const plan=await infographicPlan(topic,cleanText(req.body?.context,2000));const svg=renderInfographicSvg(plan);const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'infographic',action:'generate',title:cleanText(plan.title,260),topic,inputs:{topic},output:{plan,svg},generationMode:plan.generationMode||'fallback'});res.status(201).json({plan,svg,artifact});}catch(err){next(err)}});
router.post('/concept-explain', async(req,res,next)=>{try{const topic=cleanText(req.body?.topic,220);if(!topic)return res.status(400).json({error:'Enter a topic to explain.'});const result=await explainConcept(topic);const artifact=await PhaseArtifact.create({owner:req.user._id,phase:11,category:'concept-explainer',action:'explain',title:topic,topic,inputs:{topic},output:result,generationMode:result.analysis.generationMode||'fallback'});res.status(201).json({...result,artifact});}catch(err){next(err)}});

router.post('/whiteboard/save', async(req,res,next)=>{try{const title=cleanText(req.body?.title,140)||'Untitled board';const nodes=Array.isArray(req.body?.nodes)?req.body.nodes.slice(0,300):[];const id=req.body?.id;if(id){const board=await PhaseArtifact.findOne({_id:id,owner:req.user._id,category:'whiteboard'});if(!board)return res.status(404).json({error:'Board not found.'});board.title=title;board.output={nodes};board.updatedAt=new Date();await board.save();return res.json({board});}const board=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'whiteboard',action:'save',title,topic:title,inputs:{},output:{nodes},generationMode:'manual'});res.status(201).json({board});}catch(err){next(err)}});
router.get('/whiteboard/list', async(req,res,next)=>{try{const boards=await PhaseArtifact.find({owner:req.user._id,category:'whiteboard'}).select('title updatedAt createdAt').sort({updatedAt:-1}).limit(50);res.json({boards});}catch(err){next(err)}});
router.get('/whiteboard/:id', async(req,res,next)=>{try{const board=await PhaseArtifact.findOne({_id:req.params.id,owner:req.user._id,category:'whiteboard'});if(!board)return res.status(404).json({error:'Board not found.'});res.json({board});}catch(err){next(err)}});
router.delete('/whiteboard/:id', async(req,res,next)=>{try{const board=await PhaseArtifact.findOneAndDelete({_id:req.params.id,owner:req.user._id,category:'whiteboard'});if(!board)return res.status(404).json({error:'Board not found.'});res.json({deleted:true});}catch(err){next(err)}});
router.post('/similarity-risk', requireRole('teacher','admin'), async(req,res,next)=>{try{const text=cleanText(req.body?.text,40000);if(text.length<80)return res.status(400).json({error:'Paste at least 80 characters for a meaningful analysis.'});const corpus=await accessibleResources(req.user);const report=similarityRisk(text,corpus);await writeAudit({req,actor:req.user,action:'SIMILARITY_RISK_ANALYSED',targetType:'Content',metadata:{riskLevel:report.riskLevel,riskScore:report.riskScore}});res.json({report});}catch(err){next(err)}});
router.post('/factual-verification', async(req,res,next)=>{try{
  const src=await sourceText(req);if(!src.text)return res.status(400).json({error:'Select a resource or provide text.'});
  const evidence=await verificationSources(req,src.resource);
  if(!evidence.sources.length)return res.status(400).json({error:'Select an indexed syllabus/reference source before factual verification.'});
  const report=await factualVerification(src.text,evidence.sources,{maxClaims:req.body?.maxClaims||30,useAi:req.body?.useAi!==false});
  const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'factual-verification',action:'claim-level-verification',title:`Factual Verification — ${src.resource?.topic||'Custom Content'}`,topic:src.resource?.topic||'',sourceResource:src.resource?._id||null,inputs:{syllabusIds:evidence.syllabi.map((x)=>x._id),maxClaims:req.body?.maxClaims||30},output:report,generationMode:'hybrid'});
  await writeAudit({req,actor:req.user,action:'FACTUAL_VERIFICATION_RUN',targetType:src.resource?'Resource':'Content',targetId:src.resource?._id,metadata:{score:report.overallScore,coverage:report.coverage,unsupported:report.summary.unsupported,conflicting:report.summary.conflicting}});
  res.json({report,sources:evidence.syllabi,artifact});
}catch(err){next(err)}});

router.post('/safety-review', async(req,res,next)=>{try{
  const src=await sourceText(req);if(!src.text)return res.status(400).json({error:'Select a resource or provide text.'});
  const evidence=await verificationSources(req,src.resource);
  const factualReport=evidence.sources.length?await factualVerification(src.text,evidence.sources,{maxClaims:req.body?.maxClaims||30,useAi:req.body?.useAi!==false}):null;
  const report=safetyReview(src.text,{grounded:Boolean(src.resource?.grounding?.retrievedChunks?.length),factualReport});
  if(src.resource&&await canAccessResource(req.user,src.resource,{write:true})){src.resource.lastSafetyReview={...report,reviewedAt:new Date(),reviewedBy:req.user._id};src.resource.updatedAt=new Date();await src.resource.save();}
  const artifact=await PhaseArtifact.create({owner:req.user._id,phase:10,category:'safety-review',action:'content-safety',title:`Safety Review — ${src.resource?.topic||'Custom Content'}`,topic:src.resource?.topic||'',sourceResource:src.resource?._id||null,inputs:{syllabusIds:evidence.syllabi.map((x)=>x._id)},output:report,generationMode:factualReport?'hybrid-claim-verification':'rule-based'});
  res.json({report,sources:evidence.syllabi,artifact});
}catch(err){next(err)}});
router.get('/search', async(req,res,next)=>{try{const query=cleanText(req.query.q,500);if(!query)return res.json({query:'',mode:'none',results:[]});const expanded=expandSearchQuery(query);const docs=await accessibleResources(req.user);let qEmbed=null;try{qEmbed=await embedQuery(expanded);}catch(_){}
    const lexicalRank=docs.map((r)=>({r,text:resourceToText(r),lexical:lexicalScore(expanded,resourceToText(r))})).sort((a,b)=>b.lexical-a.lexical).slice(0,40);
    if(qEmbed){const missing=lexicalRank.filter((x)=>!Array.isArray(x.r.searchEmbedding)||!x.r.searchEmbedding.length).slice(0,16);if(missing.length){try{const embedded=await embedDocuments(missing.map((x,i)=>({index:i,text:x.text.slice(0,10000)})),'Academic resource semantic search');await Resource.bulkWrite(missing.map((x,i)=>({updateOne:{filter:{_id:x.r._id},update:{$set:{searchEmbedding:embedded.vectors[i],searchEmbeddingModel:embedded.model,searchText:x.text.slice(0,32000)}}}})));missing.forEach((x,i)=>{x.r.searchEmbedding=embedded.vectors[i]})}catch(_){}}
    }
    const maxLex=Math.max(...lexicalRank.map((x)=>x.lexical),0.0001);const results=lexicalRank.map((x)=>{const lex=x.lexical/maxLex;const sem=qEmbed&&x.r.searchEmbedding?.length?Math.max(0,cosineSimilarity(qEmbed.vector,x.r.searchEmbedding)):0;const score=qEmbed?sem*.72+lex*.28:lex;const excerpt=x.text.toLowerCase().includes(query.toLowerCase())?x.text.slice(Math.max(0,x.text.toLowerCase().indexOf(query.toLowerCase())-80),Math.max(0,x.text.toLowerCase().indexOf(query.toLowerCase())-80)+340):x.text.slice(0,340);return {id:x.r._id,type:x.r.type,topic:x.r.topic,course:x.r.course,subject:x.r.subject,workflowStatus:x.r.workflowStatus,ratingAverage:x.r.ratingAverage,score:Math.round(score*1000)/10,excerpt};}).filter((x)=>x.score>1).sort((a,b)=>b.score-a.score).slice(0,20);res.json({query,expandedQuery:expanded,mode:qEmbed?'semantic-hybrid':'lexical-expanded',results});}catch(err){next(err)}});
module.exports=router;
