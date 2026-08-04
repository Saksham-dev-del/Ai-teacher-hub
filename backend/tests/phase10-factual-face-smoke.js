const assert=require('assert');
const fs=require('fs');const path=require('path');
const {sentenceClaims,factualVerification,safetyReview}=require('../services/platformIntelligence');
(async()=>{
 const text='Supervised learning uses labelled training data. K-means is a supervised algorithm. The current policy from 2021 is still the latest policy.';
 const claims=sentenceClaims(text);assert(claims.length>=3);
 const sources=[{id:'S1',sourceId:'1',sourceName:'ML Syllabus',sourceType:'syllabus',chunkIndex:0,text:'Supervised learning uses labelled data. K-means is an unsupervised clustering algorithm.'}];
 const report=await factualVerification(text,sources,{useAi:false});
 assert(report.claimCount>=3);assert(report.summary.unsupported+report.summary.conflicting>=1);assert(report.checks.potentiallyOutdatedInformation===true);
 const safety=safetyReview(text,{factualReport:report});assert(safety.checks.factualVerificationCompleted===true);
 const quizFrontend=fs.readFileSync(path.join(__dirname,'../../frontend/js/quizzes.js'),'utf8');
 const quizRoutes=fs.readFileSync(path.join(__dirname,'../routes/quizzes.js'),'utf8');
 assert(quizFrontend.includes('face_missing_timeout'));assert(quizFrontend.includes('loadStrictFaceEngine'));assert(quizRoutes.includes('cancelOnFaceMissing'));
 assert(quizFrontend.includes('faceAbsenceGraceSeconds: 2'));assert(quizRoutes.includes('faceAbsenceGraceSeconds: 2'));
 console.log('Factual verification and strict face-presence smoke tests passed.');
})().catch((e)=>{console.error(e);process.exit(1)});
