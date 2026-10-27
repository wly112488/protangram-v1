import assert from 'node:assert/strict';
import test, {beforeEach} from 'node:test';
import {loadWorkspace,MemoryStorage} from './helpers/workspaceTest.mjs';
globalThis.localStorage=new MemoryStorage();
const api=await loadWorkspace(`export * from './src/workspace/physicalObjectStore';export * from './src/workspace/equipmentCompositionModel';export * from './src/workspace/equipmentManagementModel';export * from './src/workspace/physicalNavigation';export * from './src/workspace/trialConfigurationStore';export * from './src/workspace/analysisResultModel';`);
const p=api.usePhysicalObjectStore,c=api.useTrialConfigurationStore;
beforeEach(()=>{localStorage.values.clear();p.setState({objects:[]});c.setState({configurations:[],categories:[]});});
function setup(){const category=p.getState().addRoot({name:'风扇',type:'风扇'}),fan=p.getState().addConfiguration(category,{name:'A'}),rotor=p.getState().addComponent(fan,{name:'转子'}),blade=p.getState().addComponent(rotor,{name:'叶片'}),sibling=p.getState().addComponent(fan,{name:'静子'});return {category,fan,rotor,blade,sibling};}
const refs=()=>api.flattenEquipment(p.getState().objects);
const add=(id,name,value)=>p.getState().addField(id,'parameters',{name,value,form:'单值',description:'参数说明',unit:'mm'});

test('alphabetical parameter ordering is deterministic and editing a child preserves parent, siblings, IDs and existing formats',()=>{
 const f=setup();add(f.fan,'Zulu','100');add(f.rotor,'beta','20');add(f.rotor,'Alpha','10');add(f.rotor,'alpha','11');add(f.sibling,'Sibling','5');
 const child=refs().find(ref=>ref.id===f.rotor).equipment;
 const order=api.sortEquipmentParameters(child.parameters);assert.deepEqual(order.map(field=>field.name),['Alpha','alpha','beta']);assert.deepEqual(child.parameters.map(field=>field.name),['beta','Alpha','alpha']);
 const original=child.parameters[0];p.getState().updateField(f.rotor,'parameters',original.id,{...original,name:'Aardvark',value:'30',form:'序列'});
 assert.equal(refs().find(ref=>ref.id===f.fan).equipment.parameters[0].value,'100');assert.equal(refs().find(ref=>ref.id===f.sibling).equipment.parameters[0].value,'5');
 assert.equal(refs().find(ref=>ref.id===f.rotor).equipment.parameters.find(field=>field.id===original.id).form,'序列');assert.equal(original.value,'20');
 const navigation=api.resolvePhysicalNavigation(p.getState().objects,new URLSearchParams({objectId:f.category,configurationId:f.blade}));assert.equal(navigation.configuration.id,f.blade);assert.equal(navigation.missing,false);
});

test('selecting a parent persists all descendant IDs and roles, preserving public parameters and existing CFG identity on edit',async()=>{
 const f=setup();add(f.fan,'Length','100');add(f.blade,'Chord','12');const before=JSON.stringify(p.getState().objects);
 const scope=api.equipmentSelectionScope(p.getState().objects,[f.fan,f.rotor]);assert.deepEqual(scope.map(ref=>ref.id),[f.fan,f.rotor,f.blade,f.sibling]);
 assert.deepEqual(api.equipmentSelectionRoots(p.getState().objects,scope.map(ref=>ref.id)),[f.fan]);
 const id=c.getState().createConfiguration({name:'级联组合',members:[{objectId:f.fan,role:'tested'},{objectId:f.blade,role:'measurement'}]});
 const cfg=c.getState().getConfiguration(id);assert.deepEqual(new Set(cfg.members.map(member=>member.objectId)),new Set(scope.map(ref=>ref.id)));assert.equal(cfg.members.find(member=>member.objectId===f.blade).role,'measurement');
 assert.equal(JSON.stringify(p.getState().objects),before);assert.ok(cfg.members.every(member=>!('parameters' in member)));
 c.getState().updateConfiguration(id,{...cfg,name:'改名组合'});assert.equal(c.getState().configurations.length,1);assert.equal(c.getState().getConfiguration(id).name,'改名组合');
 const stored=JSON.parse(localStorage.getItem('protangram-trial-configurations-v1')).state.configurations;
 c.setState({configurations:[]});localStorage.setItem('protangram-trial-configurations-v1',JSON.stringify({version:1,state:{configurations:stored,categories:[]}}));await c.persist.rehydrate();assert.deepEqual(c.getState().getConfiguration(id).members,cfg.members);
 const snapshot=structuredClone(c.getState().configurations);assert.throws(()=>c.getState().updateConfiguration(id,{name:'bad',members:[{objectId:'missing',role:'tested'}]}),/失效/);assert.deepEqual(c.getState().configurations,snapshot);
});

test('public object and hierarchy changes never rewrite captured equipment or historical record values',()=>{
 const f=setup();add(f.fan,'Diameter','100');add(f.blade,'Chord','12');
 const members=api.selectedEquipmentMembers(p.getState().objects,[f.fan],[]);const snapshot=api.captureCfgEquipment(p.getState().objects,members);
 const experiment=p.getState().addExperiment(f.fan,{name:'历史布置',parameters:[]});const trial=p.getState().addConcreteTrial(experiment,{name:'历史试验',loadSpectrum:''});const record=p.getState().addTrialRecord(trial,{});
 const before=JSON.stringify(refs().find(ref=>ref.id===f.fan).equipment.experiments[0].trials[0].records[0]);
 const field=refs().find(ref=>ref.id===f.blade).equipment.parameters[0];p.getState().updateField(f.blade,'parameters',field.id,{...field,value:'999'});p.getState().addComponent(f.rotor,{name:'新增下级'});
 assert.equal(snapshot.find(item=>item.objectId===f.blade).parameters[0].value,'12');assert.equal(snapshot.length,4);assert.equal(snapshot.find(item=>item.objectId===f.blade).parentId,f.rotor);
 assert.equal(JSON.stringify(refs().find(ref=>ref.id===f.fan).equipment.experiments[0].trials[0].records.find(item=>item.id===record)),before);
 assert.equal(refs().find(ref=>ref.id===f.blade).equipment.parameters[0].value,'999');
});
