const express = require('express');
const multer = require('multer');
const initSqlJs = require('sql.js');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const KINDS = ['physical', 'projects', 'tasks', 'sessions'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message, status = 400, code) => { const error = new Error(message); error.status = status; if (code) error.code = code; throw error; };
const requireObject = (value, label) => { if (!object(value)) fail(`${label} 必须是对象`); return value; };
const list = (value, label) => { if (!Array.isArray(value)) fail(`${label} 必须是数组`); return value; };
const identifier = (value, label = 'ID') => { if (typeof value !== 'string' || !value.trim() || value.length > 512) fail(`${label} 无效`); return value; };
const nameKey = name => { if (typeof name !== 'string' || !name.trim()) fail('请填写成果名称'); return name.trim().normalize('NFC').toLocaleLowerCase(); };
const stable = value => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const stateOf = value => value?.state;
// Browsers send UTF-8 filenames in multipart headers; busboy defaults to latin1.
// Decode valid UTF-8 bytes while retaining genuine latin1 or Unicode filenames.
function uploadName(name) {
  if ([...name].some(character => character.codePointAt(0) > 255)) return name;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(name, 'latin1')); }
  catch { return name; }
}

function defaultPhysical() {
  const makeConfiguration = (objectIndex, setupIndex) => ({ id:`fan-${objectIndex}-setup-${setupIndex}`, name:`试验构型 ${String.fromCharCode(64 + setupIndex)}`, parameters:[], trials:[] });
  const fans = [1, 2].map(objectIndex => ({
    id:`ducted-fan-${String(objectIndex).padStart(2,'0')}`, name:`涵道风扇 ${String(objectIndex).padStart(2,'0')}`, description:'系统预置对象；技术定义待按实际设备补充。',
    parameters:[], materials:[], children:[], designs:[], models:[], experiments:[makeConfiguration(objectIndex,1),makeConfiguration(objectIndex,2)],
  }));
  return { state: { objects: [['category-fan','涵道风扇'],['category-motor','电机'],['category-propulsion','电推进']].map(([id, name]) => ({ id, name, type: name, description: '', configurations: id === 'category-fan' ? fans : [], legacyCategories: [], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] })) }, version: 6 };
}

// These are the category, object and experiment-configuration metadata. Trials,
// records and their results are writable by experimenters; their ancestors are not.
function metadata(value) {
  const strip = node => object(node) ? Object.fromEntries(Object.entries(node).map(([key, item]) => [key, key === 'trials' ? undefined : Array.isArray(item) ? item.map(strip) : strip(item)]).filter(([, item]) => item !== undefined)) : node;
  return stable(strip(stateOf(value)));
}

function canAppendPhysicalMetadata(previous, next) {
  const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
  const nextFamilies = new Map((stateOf(next)?.objects ?? []).map(item => [item.id,item]));
  for (const oldFamily of stateOf(previous)?.objects ?? []) {
    const family = nextFamilies.get(oldFamily.id);
    if (!family || stable(without(oldFamily,['configurations'])) !== stable(without(family,['configurations']))) return false;
    const nextObjects = new Map((family.configurations ?? []).map(item => [item.id,item]));
    for (const oldObject of oldFamily.configurations ?? []) {
      const physicalObject = nextObjects.get(oldObject.id);
      if (!physicalObject || stable(without(oldObject,['experiments'])) !== stable(without(physicalObject,['experiments']))) return false;
      const nextSetups = new Map((physicalObject.experiments ?? []).map(item => [item.id,item]));
      for (const oldSetup of oldObject.experiments ?? []) {
        const setup = nextSetups.get(oldSetup.id);
        if (!setup || stable(metadata({state:{objects:[{...oldFamily,configurations:[{...oldObject,experiments:[oldSetup]}]}]}})) !== stable(metadata({state:{objects:[{...family,configurations:[{...physicalObject,experiments:[setup]}]}]}}))) return false;
      }
    }
  }
  return true;
}

function isSeedOnlyPhysical(value) {
  const originalSeed = defaultPhysical();
  const legacySeed = structuredClone(originalSeed);
  legacySeed.state.objects[0].configurations = [];
  const matchesSeed = [originalSeed, legacySeed].some(seed => metadata(seed) === metadata(value));
  const hasTrials = (stateOf(value)?.objects ?? []).some(category => category.configurations.some(item => item.experiments.some(setup => (setup.trials ?? []).length > 0)));
  return matchesSeed && !hasTrials;
}

function validateShape(kind, value) {
  requireObject(value, 'value');
  if (!Number.isInteger(value.version) || value.version < 0) fail('持久化版本无效');
  const state = kind === 'sessions' ? value : requireObject(value.state, 'state');
  const key = { physical:'objects', projects:'projects', tasks:'tasks', sessions:'sessions' }[kind];
  const items = list(state[key], key);
  const ids = new Set();
  for (const item of items) {
    requireObject(item, key); identifier(item.id);
    if (ids.has(item.id)) fail(`${key} ID 重复`); ids.add(item.id);
  }
  if (kind === 'projects') for (const project of items) for (const artifact of list(project.artifacts, 'artifacts')) requireObject(artifact, 'artifact');
  const references = (value, label) => { if (value !== undefined) for (const ref of list(value, label)) { requireObject(ref, label); identifier(ref.projectId); identifier(ref.artifactId); } };
  if (kind === 'tasks') for (const task of items) {
    for (const requirement of list(task.requirements, 'requirements')) { requireObject(requirement, 'requirement'); references(requirement.artifactRefs, 'artifactRefs'); }
    for (const section of list(requireObject(task.reportDraft, 'reportDraft').sections, 'sections')) { requireObject(section, 'section'); references(section.artifactRefs, 'artifactRefs'); }
    references(task.artifactRefs, 'artifactRefs');
    if (task.professionalProjects !== undefined) for (const project of list(task.professionalProjects, 'professionalProjects')) { requireObject(project, 'professionalProject'); references(project.artifactRefs, 'artifactRefs'); }
  }
  if (kind === 'sessions') for (const session of items) {
    identifier(session.storageProjectId, 'storageProjectId');
    if (typeof session.title !== 'string' || typeof session.createdAt !== 'string' || typeof session.updatedAt !== 'string') fail('会话标题或时间格式无效');
    if (!['overview','doe','doeMethods','analysis','digitalTwin','virtualCondition','report','resources','task'].includes(session.capability)) fail('会话专业功能无效');
    for (const draft of Object.values(requireObject(session.drafts, 'drafts'))) requireObject(draft, 'draft');
    requireObject(session.handoffs, 'handoffs');
    if (session.businessScope !== undefined) requireObject(session.businessScope, 'businessScope');
    if (session.handoffs !== undefined) for (const handoff of Object.values(requireObject(session.handoffs, 'handoffs'))) requireObject(handoff, 'handoff');
  }
}

function physicalIndex(value) {
  const index = { owners:new Map(), configs:new Map(), experiments:new Map(), trials:new Map(), records:new Map(), files:new Map(), charts:new Map(), tables:new Map(), names:new Map() };
  const register = (item, owner, type) => {
    requireObject(item, type); identifier(item.id);
    const key=JSON.stringify(type === 'table' ? [type,owner,item.id] : [type,item.id]);
    if (index.owners.has(key)) fail(`物理数据 ${type} ID 重复: ${item.id}`);
    index.owners.set(key, `${type}:${owner}`);
  };
  const addName = (trialId, name, owner) => {
    const key = `${trialId}:${nameKey(name)}`;
    if (!index.names.has(key)) index.names.set(key,new Set());
    index.names.get(key).add(owner);
  };
  index.addName = addName;
  for (const family of stateOf(value)?.objects ?? []) {
    register(family, '', 'category');
    for (const config of list(family.configurations, 'configurations')) {
      register(config, family.id, 'configuration'); index.configs.set(config.id, config);
      for (const experiment of list(config.experiments, 'experiments')) {
        register(experiment, config.id, 'experiment'); list(experiment.parameters, 'parameters'); index.experiments.set(experiment.id, { ...experiment, configId:config.id });
        for (const trial of list(experiment.trials, 'trials')) {
          register(trial, experiment.id, 'trial');
          if (typeof trial.loadSpectrum !== 'string') fail('载荷谱格式无效');
          index.trials.set(trial.id, { ...trial, configId:config.id, experimentId:experiment.id });
          for (const record of list(trial.records, 'records')) {
            register(record, trial.id, 'record'); list(record.actualConditions,'actualConditions'); list(record.measurements,'measurements');
            if (!Number.isInteger(record.executionNumber) || record.executionNumber < 1) fail('执行记录序号无效');
            index.records.set(record.id, { ...record, trialId:trial.id });
            for (const file of list(record.rawFiles, 'rawFiles')) {
              register(file, record.id, 'file'); list(file.headers,'headers');
              if (file.headers.some(field => typeof field !== 'string')) fail('CSV 字段无效');
              index.files.set(file.id, { ...file, recordId:record.id, trialId:trial.id });
            }
            for (const table of list(record.tables, 'tables')) {
              register(table, record.id, 'table');
              index.tables.set(JSON.stringify([record.id,table.id]),{...table,sourceRecordId:record.id});
              addName(trial.id, table.name, `table:${JSON.stringify([record.id,table.id])}`);
              const file=index.files.get(table.rawFileId);
              if (!file || file.recordId !== record.id || !list(table.fields,'fields').length || table.fields.some(field => !file.headers.includes(field))) fail('数据表必须引用本执行记录的原始 CSV 字段');
            }
          }
          for (const chart of list(trial.charts,'charts')) {
            requireObject(chart,'chart'); identifier(chart.id);
            const chartKey=JSON.stringify([chart.sourceRecordId,chart.id]);
            const ownerKey=`chart:${chartKey}`;
            if (index.owners.has(ownerKey)) fail('图表来源与 ID 重复');
            index.owners.set(ownerKey,`chart:${trial.id}:${chart.sourceRecordId}`);
            addName(trial.id,chart.name,ownerKey);
            const file=index.files.get(chart.rawFileId), record=index.records.get(chart.sourceRecordId);
            if (!record || record.trialId !== trial.id || !file || file.recordId !== record.id || !file.headers.includes(chart.xField) || !file.headers.includes(chart.yField)) fail('图表必须引用本执行记录的原始 CSV 字段');
            index.charts.set(chartKey, chart);
          }
        }
      }
    }
  }
  return index;
}
const sourceIdentity = source => stable(source ? { physicalObjectId:source.physicalObjectId, experimentId:source.experimentId, trialId:source.trialId, testRecordId:source.testRecordId } : null);
function resolveScope(index, scope) {
  requireObject(scope, '来源');
  if (!scope.physicalObjectId) {
    if (scope.experimentId || scope.trialId || scope.testRecordId) fail('缺少物理对象来源');
    return {};
  }
  const config=index.configs.get(scope.physicalObjectId);
  const experiment=scope.experimentId ? index.experiments.get(scope.experimentId) : undefined;
  const record=scope.testRecordId ? index.records.get(scope.testRecordId) : undefined;
  const trial=scope.trialId ? index.trials.get(scope.trialId) : record && index.trials.get(record.trialId);
  if (!config || scope.experimentId && (!experiment || experiment.configId !== config.id) || scope.trialId && !trial || trial && (!experiment || trial.experimentId !== experiment.id) || scope.testRecordId && (!record || !trial || record.trialId !== trial.id)) fail('物理对象、试验构型或执行记录来源无效');
  return { config, experiment, trial, record };
}
function renderedArtifactResults(artifact) {
  const payload=artifact.payload;
  if (Array.isArray(payload.results)) return payload.results;
  const results=[];
  if (Array.isArray(payload.charts)) for (const [i,chart] of payload.charts.entries()) if (chart?.option && typeof chart.option === 'object') results.push({id:String(chart.id ?? `chart-${i}`),name:String(chart.title ?? chart.name ?? artifact.title)});
  const table=(id,name,value)=>{if(Array.isArray(value) && value.some(row=>row && typeof row === 'object')) results.push({id,name});};
  table('anomalies',`${artifact.title} · 异常事件`,payload.anomalies);
  table('candidates',`${artifact.title} · 根因候选`,payload.candidates);
  table('plan',artifact.title,payload.plan);table('conditions',artifact.title,payload.conditions);
  table('factors',`${artifact.title} · 设计因子`,payload.factors);
  for (const [key,name] of [['credibility','可信度'],['errorLimit','校准结果'],['trustedRange','可信范围']]) if (typeof payload[key] === 'number' || typeof payload[key] === 'string') results.push({id:key,name});
  const conclusion=payload.conclusion ?? payload.confirmedRootCause?.reason;
  if (typeof conclusion === 'string') results.push({id:'conclusion',name:artifact.title});
  if (!results.length && artifact.type !== 'report') results.push({id:'legacy-summary',name:artifact.title});
  return results;
}
function addArtifactNames(index,artifact,sessions = []) {
  const scopes=artifact.payload.sourceScope ? [artifact.payload.sourceScope] : sessions.filter(session=>session.storageProjectId === artifact.projectId && session.businessScope).map(session=>session.businessScope);
  const sources=scopes.map(scope=>resolveScope(index,scope));
  const ids=new Set();
  for (const result of renderedArtifactResults(artifact)) {
    requireObject(result,'result');identifier(result.id);nameKey(result.name);
    if(ids.has(result.id))fail('同一成果中的结果 ID 重复');ids.add(result.id);
    for (const source of sources) if(source.trial && artifact.type !== 'report')index.addName(source.trial.id,result.name,`artifact:${JSON.stringify([artifact.projectId,artifact.id,result.id])}`);
  }
}
function validateGraph(states, previous, legacyImport = false) {
  const index=physicalIndex(states.physical), old=physicalIndex(previous.physical);
  for (const trial of index.trials.values()) {
    const existing = old.trials.get(trial.id);
    if (!legacyImport && !existing && !trial.loadSpectrum.trim()) fail('请填写载荷谱名称或编号');
    if (existing?.records.length && existing.loadSpectrum.trim() && trial.loadSpectrum !== existing.loadSpectrum) fail('已有执行记录，变更载荷谱请新建具体试验');
    if (!legacyImport && !trial.loadSpectrum.trim() && trial.records.some(record => !existing?.records.some(saved => saved.id === record.id))) fail('请先补充本试验的载荷谱名称或编号');
  }
  for (const [id,owner] of index.owners) if (old.owners.has(id) && old.owners.get(id) !== owner) fail('不能变更已有实体的来源归属');
  for (const collection of ['charts','tables']) for (const [key,result] of old[collection]) if (!index[collection].has(key)) {
    for (const [nextKey,next] of index[collection]) if (next.id === result.id && !old[collection].has(nextKey)) fail('不能变更已有图表或数据表的来源记录');
  }
  const oldArtifacts=new Map((stateOf(previous.projects)?.projects ?? []).flatMap(project => project.artifacts.map(artifact => [`${project.id}/${artifact.id}`,artifact])));
  for (const artifact of oldArtifacts.values()) addArtifactNames(old,artifact,previous.sessions?.sessions);
  const artifacts=new Map();
  for (const project of stateOf(states.projects)?.projects ?? []) for (const artifact of project.artifacts) {
    requireObject(artifact,'artifact'); identifier(artifact.id); requireObject(artifact.payload,'payload');
    if (artifact.projectId !== project.id) fail('成果项目来源无效');
    const key=`${project.id}/${artifact.id}`;
    if (artifacts.has(key)) fail('成果 ID 重复'); artifacts.set(key,artifact);
    const oldArtifact=oldArtifacts.get(key);
    if (oldArtifact && sourceIdentity(oldArtifact.payload.sourceScope) !== sourceIdentity(artifact.payload.sourceScope)) fail('不能变更已有成果的来源');
  }
  const artifactRef = reference => {
    requireObject(reference,'成果引用');
    if (!artifacts.has(`${reference.projectId}/${reference.artifactId}`)) fail('引用的成果不存在');
  };
  const validateFiles = (files, source) => {
    for (const reference of list(files,'rawFiles')) {
      requireObject(reference,'rawFile'); const file=index.files.get(reference.id);
      if (!file || source.record && !reference.sourceRecordId && file.recordId !== source.record.id || source.trial && file.trialId !== source.trial.id || source.config && index.trials.get(file.trialId)?.configId !== source.config.id || reference.sourceRecordId && reference.sourceRecordId !== file.recordId || reference.trialId && reference.trialId !== file.trialId) fail('CSV 来源属于其他执行记录或具体试验');
    }
  };
  for (const artifact of artifacts.values()) {
    const payload=artifact.payload;
    const source=payload.sourceScope ? resolveScope(index,payload.sourceScope) : {};
    if (payload.sourceContext?.scope) {
      resolveScope(index,payload.sourceContext.scope);
      if (sourceIdentity(payload.sourceContext.scope) !== sourceIdentity(payload.sourceScope)) fail('成果来源快照与来源引用不一致');
    }
    if (payload.sourceContext?.rawFiles) validateFiles(payload.sourceContext.rawFiles,source);
    if (payload.results !== undefined) list(payload.results,'results');
    addArtifactNames(index,artifact,states.sessions?.sessions);
    if (artifact.type === 'report') {
      const definition=payload.reportDefinition === undefined ? {} : requireObject(payload.reportDefinition,'reportDefinition');
      const taskIds=[payload.sourceScope?.taskId,definition.taskId,payload.taskId].filter(value=>value !== undefined);
      if (new Set(taskIds).size > 1) fail('报告任务书来源不一致');
      const taskId=taskIds[0];
      const task=taskId ? (stateOf(states.tasks)?.tasks ?? []).find(item=>item.id === taskId) : undefined;
      if (taskId && !task) fail('报告任务书不存在');
      const taskRefs=task ? [...(task.artifactRefs ?? []),...task.requirements.flatMap(item=>item.artifactRefs ?? []),...task.reportDraft.sections.flatMap(item=>item.artifactRefs ?? []),...(task.professionalProjects ?? []).flatMap(item=>item.artifactRefs ?? [])] : [];
      const checkReportSource=(candidate,reference)=> {
        if (task && candidate.trial && candidate.trial.taskBookId !== task.id) fail('报告不能引用其他任务书的具体试验');
        if (!task && source.trial && candidate.trial && candidate.trial.id !== source.trial.id) fail('报告不能引用其他具体试验的成果');
        if (!task && source.trial && candidate.config && !candidate.trial && (candidate.config.id !== source.config.id || candidate.experiment && candidate.experiment.id !== source.experiment.id)) fail('报告物理对象或构型来源不一致');
        if (task && !candidate.trial && reference && !taskRefs.some(item=>item.projectId === reference.projectId && item.artifactId === reference.artifactId)) fail('报告成果尚未关联本任务书');
      };
      for (const container of [payload,definition]) {
        if (container.chartRefs !== undefined) for (const reference of list(container.chartRefs,'chartRefs')) {
          requireObject(reference,'chartRef');identifier(reference.physicalObjectId);identifier(reference.experimentId);identifier(reference.testRecordId);identifier(reference.chartId);
          const chartSource=resolveScope(index,reference);
          if (!chartSource.record || !index.charts.has(JSON.stringify([reference.testRecordId,reference.chartId]))) fail('报告引用的图表或来源记录不存在');
          checkReportSource(chartSource);
        }
        if (container.artifactRefs !== undefined) for (const reference of list(container.artifactRefs,'artifactRefs')) {
          artifactRef(reference);
          const referenced=artifacts.get(`${reference.projectId}/${reference.artifactId}`);
          const scopes=referenced.payload.sourceScope ? [referenced.payload.sourceScope] : (states.sessions?.sessions ?? []).filter(session=>session.storageProjectId === referenced.projectId && session.businessScope).map(session=>session.businessScope);
          const referencedSources=scopes.length ? scopes.map(scope=>resolveScope(index,scope)) : [{}];
          for (const candidate of referencedSources) checkReportSource(candidate,reference);
        }
      }
    }
    if (payload.upstreamArtifactRefs !== undefined) for (const reference of list(payload.upstreamArtifactRefs,'upstreamArtifactRefs')) {
      artifactRef(reference);
      const upstream=artifacts.get(`${reference.projectId}/${reference.artifactId}`);
      if (source.trial && upstream.payload.sourceScope) {
        const parent=resolveScope(index,upstream.payload.sourceScope);
        if (parent.trial && parent.trial.id !== source.trial.id) fail('不能引用其他具体试验的成果');
      }
    }
  }
  const tasks=stateOf(states.tasks)?.tasks ?? [];
  for (const task of tasks) {
    const refs=[...(task.artifactRefs ?? []),...task.requirements.flatMap(item=>item.artifactRefs ?? []),...task.reportDraft.sections.flatMap(item=>item.artifactRefs ?? []),...(task.professionalProjects ?? []).flatMap(item=>item.artifactRefs ?? []),...(task.reportDraft.formalReportArtifact ? [task.reportDraft.formalReportArtifact] : [])];
    for (const reference of refs) artifactRef(reference);
  }
  for (const trial of index.trials.values()) if (trial.taskBookId && !tasks.some(task=>task.id===trial.taskBookId)) fail('关联任务书不存在');
  for (const config of index.configs.values()) for (const experiment of config.experiments) {
    if (experiment.designArtifactRef) artifactRef(experiment.designArtifactRef);
    for (const trial of experiment.trials) if (trial.designArtifactRef) artifactRef(trial.designArtifactRef);
  }
  const projectIds=new Set((stateOf(states.projects)?.projects ?? []).map(project=>project.id));
  for (const session of states.sessions?.sessions ?? []) {
    if (!projectIds.has(session.storageProjectId)) fail('会话成果项目不存在');
    if (session.businessScope) resolveScope(index,session.businessScope);
    for (const handoff of Object.values(session.handoffs ?? {})) if (handoff.workspaceSession) resolveScope(index,handoff.workspaceSession);
  }
  index.warnings=[];
  for (const [key,owners] of index.names) if (owners.size > 1) {
    const previousOwners=old.names.get(key);
    if (!legacyImport && (!previousOwners || previousOwners.size < 2 || [...owners].some(owner=>!previousOwners.has(owner)))) fail('本具体试验已有同名成果，请使用其他名称',409);
    index.warnings.push({code:'LEGACY_DUPLICATE_RESULT_NAME',key,owners:[...owners]});
  }
  return index;
}

async function createWorkspaceApi(options = {}) {
  const SQL=await initSqlJs();
  const dbPath=path.resolve(options.dbPath ?? process.env.PROTANGRAM_WORKSPACE_DB ?? path.join(__dirname,'../../data/workspace.sqlite'));
  // This is deployment-wide authorization, not authenticated per-user identity.
  // No body field, cookie or request header is trusted as a role assertion.
  const role=(options.role ?? process.env.PROTANGRAM_WORKSPACE_ROLE) === 'admin' ? 'admin' : 'experimenter';
  const router=express.Router();
  fs.mkdirSync(path.dirname(dbPath),{recursive:true});
  const open=()=>new SQL.Database(fs.readFileSync(dbPath));
  const atomicSave=db=> {
    const temp=`${dbPath}.${process.pid}.${randomUUID()}.tmp`;
    let fd;
    try {
      fd=fs.openSync(temp,'wx',0o600); fs.writeFileSync(fd,Buffer.from(db.export())); fs.fsyncSync(fd); fs.closeSync(fd); fd=undefined;
      fs.renameSync(temp,dbPath);
    } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  };
  const locked=fn=> {
    let fd;
    try { fd=fs.openSync(`${dbPath}.lock`,'wx',0o600); }
    catch (error) { if (error.code==='EEXIST') fail('数据库正在写入，请重试',503); throw error; }
    try { return fn(); }
    finally { fs.closeSync(fd); fs.unlinkSync(`${dbPath}.lock`); }
  };
  locked(()=> {
    if (fs.existsSync(dbPath)) {
      const db=open();
      try {
        const columns=db.exec('PRAGMA table_info(workspace_files)')[0]?.values ?? [];
        if (!columns.some(column=>column[1] === 'revision')) {
          db.run('ALTER TABLE workspace_files ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
          atomicSave(db);
        }
      } finally { db.close(); }
      return;
    }
    const db=new SQL.Database();
    try {
      db.run('CREATE TABLE workspace_states (kind TEXT PRIMARY KEY, value TEXT, revision INTEGER NOT NULL); CREATE TABLE workspace_files (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime_type TEXT NOT NULL, trial_id TEXT, record_id TEXT, task_id TEXT, content BLOB NOT NULL, revision INTEGER NOT NULL DEFAULT 1)');
      for (const kind of KINDS) db.run('INSERT INTO workspace_states VALUES (?, ?, 0)',[kind,kind==='physical' ? JSON.stringify(defaultPhysical()) : null]);
      atomicSave(db);
    } finally { db.close(); }
  });
  const snapshot=db=> {
    const states={},revisions={};
    for (const kind of KINDS) { const stmt=db.prepare('SELECT value,revision FROM workspace_states WHERE kind=?'); try {stmt.bind([kind]); if (!stmt.step()) throw new Error('工作台数据库结构无效');const row=stmt.getAsObject();states[kind]=row.value===null ? null : JSON.parse(row.value);revisions[kind]=row.revision;} finally {stmt.free();} }
    return {states,revisions};
  };
  const write=(changes,legacyImport=false)=>locked(()=> {
    requireObject(changes,'changes');
    if (!Object.keys(changes).length) fail('没有待保存的更改');
    const db=open();
    try {
      const previous=snapshot(db),next={...previous.states};
      if (legacyImport) {
        if (role !== 'admin') fail('仅管理员可导入历史工作台',403);
        if (!isSeedOnlyPhysical(previous.states.physical) || (stateOf(previous.states.projects)?.projects ?? []).length || (stateOf(previous.states.tasks)?.tasks ?? []).length || (previous.states.sessions?.sessions ?? []).length) fail('仅空工作台可导入历史数据',409);
      }
      for (const [kind,change] of Object.entries(changes)) {
        if (!KINDS.includes(kind)) fail('未知工作台数据类型',404);
        requireObject(change,'change');
        if (!Number.isInteger(change.revision) || change.revision < 0) fail('revision 无效');
        if (change.revision !== previous.revisions[kind]) fail('数据已由其他页面更新，请刷新后重试',409,'REVISION_CONFLICT');
        validateShape(kind,change.value);next[kind]=change.value;
      }
      if (changes.physical && role !== 'admin' && !canAppendPhysicalMetadata(previous.states.physical,next.physical)) fail('普通实验人员只能新增类别、物理对象和试验构型，不能修改或删除已有定义',403);
      const index=validateGraph(next,previous.states,legacyImport);
      const fileRows=db.exec('SELECT id,trial_id,record_id,task_id FROM workspace_files');
      if (fileRows.length) for (const [id,trialId,recordId,taskId] of fileRows[0].values) {
        if (recordId && (!index.records.has(recordId) || index.records.get(recordId).trialId !== trialId)) fail('已有文件的执行记录不能删除或变更归属');
        if (taskId && !(stateOf(next.tasks)?.tasks ?? []).some(task=>task.id===taskId)) fail('已有文件的任务书不能删除');
        const metadata=index.files.get(id);if (metadata && (metadata.recordId !== recordId || metadata.trialId !== trialId)) fail('文件来源不能变更');
      }
      db.run('BEGIN TRANSACTION');
      for (const [kind,change] of Object.entries(changes)) db.run('UPDATE workspace_states SET value=?,revision=revision+1 WHERE kind=?',[JSON.stringify(change.value),kind]);
      db.run('COMMIT');atomicSave(db);
      return {revisions:snapshot(db).revisions,...(index.warnings.length ? {warnings:index.warnings} : {})};
    } finally { db.close(); }
  });
  router.get('/',(_req,res,next)=> {let db;try {db=open();res.json({success:true,data:{...snapshot(db),access:{role,identityMode:'deployment-config'}}});}catch(error){next(error);}finally{db?.close();}});
  router.post('/commit',(req,res,next)=>{try{res.json({success:true,data:write(req.body?.changes,req.body?.legacyImport === true)});}catch(error){next(error);}});
  router.put('/:kind',(req,res,next)=>{try{const {revisions}=write({[req.params.kind]:req.body});res.json({success:true,data:{revision:revisions[req.params.kind]}});}catch(error){next(error);}});
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:100*1024*1024,files:1,fields:4}});
  router.post('/files/:id',upload.single('file'),(req,res,next)=> {
    try {
      identifier(req.params.id);
      if (!req.file) fail('请选择文件');
      let savedRevision;
      locked(()=> {
        const db=open();
        try {
          const {states}=snapshot(db),index=physicalIndex(states.physical);
          const {trialId,recordId,taskId}=req.body;
          if (taskId) {
            if (trialId || recordId || !(stateOf(states.tasks)?.tasks ?? []).some(task=>task.id===taskId)) fail('任务书来源无效');
          } else {
            if (!trialId || !recordId || index.records.get(recordId)?.trialId !== trialId) fail('文件执行记录来源无效');
            const metadata=index.files.get(req.params.id);
            if (metadata && (metadata.recordId !== recordId || metadata.trialId !== trialId)) fail('文件属于其他执行记录');
          }
          let replacingTaskBook=false;
          const existing=db.prepare('SELECT trial_id,record_id,task_id,revision FROM workspace_files WHERE id=?');
          try {
            existing.bind([req.params.id]);
            if(existing.step()) {
              const owner=existing.getAsObject();
              if (owner.task_id !== (taskId ?? null) || owner.trial_id !== (trialId ?? null) || owner.record_id !== (recordId ?? null)) fail('文件来源不能变更');
              if (!taskId || owner.record_id || owner.trial_id) fail('文件 ID 已存在，不能覆盖',409);
              if (typeof req.body.revision !== 'string' || !/^[1-9]\d*$/.test(req.body.revision) || !Number.isSafeInteger(Number(req.body.revision))) fail('请提供有效文件 revision');
              if (Number(req.body.revision) !== owner.revision) fail('文件已由其他页面更新，请重新载入',409,'REVISION_CONFLICT');
              savedRevision=owner.revision+1;
              replacingTaskBook=true;
            }
          } finally{existing.free();}
          if (!replacingTaskBook) savedRevision=1;
          db.run('BEGIN TRANSACTION');
          if (replacingTaskBook) db.run('UPDATE workspace_files SET name=?,mime_type=?,content=?,revision=revision+1 WHERE id=?',[uploadName(req.file.originalname),req.file.mimetype || 'application/octet-stream',req.file.buffer,req.params.id]);
          else db.run('INSERT INTO workspace_files (id,name,mime_type,trial_id,record_id,task_id,content) VALUES (?,?,?,?,?,?,?)',[req.params.id,uploadName(req.file.originalname),req.file.mimetype || 'application/octet-stream',trialId ?? null,recordId ?? null,taskId ?? null,req.file.buffer]);
          db.run('COMMIT');atomicSave(db);
        } finally {db.close();}
      });
      res.json({success:true,data:{id:req.params.id,revision:savedRevision}});
    } catch(error){next(error);}
  });
  router.get('/files/:id',(req,res,next)=> {
    let db,stmt;
    try {
      db=open();stmt=db.prepare('SELECT name,mime_type,content,revision FROM workspace_files WHERE id=?');stmt.bind([req.params.id]);if(!stmt.step())fail('找不到文件',404);
      const row=stmt.getAsObject();
      res.set('X-Workspace-File-Revision',String(row.revision));res.set('Access-Control-Expose-Headers','X-Workspace-File-Revision, Content-Disposition');
      res.set('Content-Type',row.mime_type);res.set('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`);res.send(Buffer.from(row.content));
    }catch(error){next(error);}finally{stmt?.free();db?.close();}
  });
  router.use((error,_req,res,_next)=>res.status(error.status ?? (error instanceof multer.MulterError ? 400 : 500)).json({success:false,...(error.code === 'REVISION_CONFLICT' ? {code:error.code} : {}),error:error.status || error instanceof multer.MulterError ? error.message : '数据库保存或读取失败，请重试'}));
  return { router, close() {}, dbPath };
}
module.exports={createWorkspaceApi};
