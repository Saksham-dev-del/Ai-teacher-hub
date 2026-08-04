const assert=require('assert');
const {workloadFromData,resourceSnapshot,shareCode}=require('../services/collaboration');
const Resource=require('../models/Resource');const Department=require('../models/Department');
const workload=workloadFromData([{type:'Lesson Plan',subject:'DBMS',topic:'Normalization'},{type:'Assignment',subject:'DBMS',topic:'Normalization'}],[{}],[{action:'question-paper',subject:'DBMS',topic:'SQL'}]);
assert.equal(workload.lessonPlansGenerated,1);assert(workload.quizzesCreated>=2);assert(workload.estimatedTimeSavedHours>0);assert.equal(workload.mostUsedSubject,'DBMS');
const sample=new Resource({owner:'64b000000000000000000001',type:'Notes',topic:'Test',subject:'DBMS'});assert.equal(resourceSnapshot(sample).topic,'Test');assert(shareCode().length>10);assert(Department.schema.path('members'));
console.log('Phase 9 smoke tests passed.');
