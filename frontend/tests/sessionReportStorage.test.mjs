import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {loadWorkspace,MemoryStorage} from './helpers/workspaceTest.mjs';
globalThis.localStorage=new MemoryStorage();
const {saveAnalysisReports,loadAnalysisReports}=await loadWorkspace("export {saveAnalysisReports,loadAnalysisReports} from './src/utils/storage';",{alias:{'@':resolve('src')}});
test('session report persistence does not send a report without ownership to the legacy backend',()=>{
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=()=>{calls++;throw new Error('unexpected remote write');};
  try {
    const reports=[{id:'report-session',name:'构型报告',status:'generated'}];
    saveAnalysisReports(reports,{localOnly:true});
    assert.deepEqual(loadAnalysisReports(),reports);
    assert.equal(calls,0);
  } finally {globalThis.fetch=original;}
});
