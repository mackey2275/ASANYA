const {test,expect}=require('playwright/test');
const {installFsAccessMock}=require('./helpers/fs-access-mock');
const {APP}=require('./helpers/app-target');

test.setTimeout(30_000);

const task=(id='T',extra={})=>({
  id,parentId:'',state:'',impact_level:0,title:id,owner:'',due:'',summary:'',repeat:'',completed:false,
  source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra
});
const snapshot=(id='2026-09-11T06:58:24.381Z',items=[task()])=>({
  snapshot_id:id,captured_at:id,product_version:'3.2.0',schema_version:'3.2',snapshot_format_version:'1.0',items
});
const root=(snapshots=[],items=[task('LIVE')])=>({schema_version:'3.2',workspace_info_markdown:'workspace',items,snapshots});

async function boot(page){
  await installFsAccessMock(page);await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await expect(page).toHaveTitle('ASANYA v3.2.0');expect(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)).toBe('3.2');
}
async function adopt(page,id,value,options={}){
  const text=JSON.stringify(value);
  await page.evaluate(async({id,text,options})=>{const handle=__fsMock.create(id,{name:options.name||id+'.json',text,writePermission:'granted',...options}),file=await handle.getFile();await applyJsonObject(JSON.parse(text),'pbl042',file.name,handle,{remember:false,writePermissionGranted:true,fileText:text,fileModified:file.lastModified,fileSize:file.size})},{id,text,options});
  return text;
}
async function acceptUpgrade(page){await expect(page.locator('.impactUpgradeDialog')).toBeVisible();await page.locator('#impactUpgradeAccept').click()}
async function startSave(page,source='manual'){await page.evaluate(source=>{window.__pbl042Save=performDbSave({allowDownload:false,source})},source)}

test.beforeEach(async({page})=>boot(page));

test('PBL042-P1-01: Schema 3.1 loads non-destructively as 3.2 runtime with empty snapshots',async({page})=>{
  const original=await adopt(page,'legacy',{schema_version:'3.1',workspace_info_markdown:'legacy',items:[task('L')]});
  expect(await page.evaluate(()=>({schema:data.schema_version,snapshots:data.snapshots,loadedSchemaVersion,schemaMigrationPending,dirty,writes:__fsMock.snapshot('legacy').writeCount,text:__fsMock.snapshot('legacy').text}))).toEqual({schema:'3.2',snapshots:[],loadedSchemaVersion:'3.1',schemaMigrationPending:true,dirty:false,writes:0,text:original});
});

test('PBL042-P1-02: current empty/1-5 snapshot roots load and serialize in stored order',async({page})=>{
  await page.evaluate(()=>applyJsonObject({schema_version:'3.2',workspace_info_markdown:'',items:[],snapshots:[]},'empty','empty.json',null,{remember:false,writePermissionGranted:false}));
  expect(await page.evaluate(()=>persistableData())).toEqual({schema_version:'3.2',workspace_info_markdown:'',items:[],snapshots:[]});
  const five=Array.from({length:5},(_,i)=>snapshot(`2026-09-1${i+1}T06:58:24.381Z`,[task('T'+i,{planned_duration_days:0})]));await page.evaluate(value=>applyJsonObject(value,'five','five.json',null,{remember:false,writePermissionGranted:false}),root(five));
  expect(await page.evaluate(()=>({ids:data.snapshots.map(x=>x.snapshot_id),saved:persistableData().snapshots}))).toEqual({ids:five.map(x=>x.snapshot_id),saved:five});
});

test('PBL042-P1-02B: all canonical optional Task fields round-trip without derived state',async({page})=>{
  const historical=task('FULL',{parentId:'P',state:'進行中',impact_level:3,title:'Full',owner:'Owner',due:'2026-09-30',summary:'Summary',repeat:'毎週',completed:false,source:'ASANA',asana_task_id:'asana-1',history:[{at:'kept'}],dependencies:[{task_id:'P',type:'finish_to_start'}],sortOrder:0,planned_duration_days:0,actual_start:'2026-09-01',actual_start_source:'system',actual_end:'2026-09-02',actual_end_source:'user',recurrence_rule:{type:'weekly',weekdays:[1,3]},recurrence_schedule_date:'2026-09-30'}),history=[snapshot('2026-09-11T08:00:00.000Z',[historical])];await page.evaluate(value=>applyJsonObject(value,'full','full.json',null,{remember:false,writePermissionGranted:false}),root(history));
  expect((await page.evaluate(()=>persistableData().snapshots))[0].items[0]).toEqual(historical);
});

test('PBL042-P1-03: future/gap Schema and malformed snapshot collections reject safely',async({page})=>{
  const results=await page.evaluate(()=>['3.1.1','3.3','9.0'].map(schema=>{try{prepareSchemaObject({schema_version:schema,items:[],snapshots:[]});return'accepted'}catch(e){return e.schemaKind}}));
  expect(results).toEqual(['unsupported-gap','newer','newer']);
  const cases=[undefined,{},Array.from({length:6},(_,i)=>({snapshot_id:'s'+i,captured_at:'2026-09-11T06:58:24.381Z',product_version:'3.2.0',schema_version:'3.2',snapshot_format_version:'1.0',items:[]}))];
  for(const snapshots of cases)expect(await page.evaluate(value=>{try{prepareSchemaObject({schema_version:'3.2',items:[],snapshots:value});return'accepted'}catch(e){return e.schemaKind}},snapshots)).toBe('malformed-snapshot');
});

test('PBL042-P1-04: invalid envelope metadata and duplicate IDs reject',async({page})=>{
  const valid=snapshot(),cases=[
    [snapshot(' bad '),'snapshot_id'],[{...valid,captured_at:'not-a-date'},'captured_at'],[{...valid,product_version:''},'identity'],[{...valid,product_version:'3.2'},'product identity'],[{...valid,schema_version:'3.2.0'},'schema identity'],
    [{...valid,snapshot_format_version:undefined},'format'],[{...valid,snapshot_format_version:'2.0'},'format'],[{...valid,items:{}},'items'],
    [[valid,{...valid}], 'duplicate']
  ];
  for(const [candidate] of cases){const value=Array.isArray(candidate)?candidate:[candidate];expect(await page.evaluate(value=>{try{prepareSchemaObject({schema_version:'3.2',items:[],snapshots:value});return'accepted'}catch(e){return e.schemaKind}},value)).toBe('malformed-snapshot')}
});

test('PBL042-P1-05: malformed historical Tasks reject without tolerant repair or partial adoption',async({page})=>{
  const good=root([snapshot()]);await page.evaluate(value=>applyJsonObject(value,'good','good.json',null,{remember:false,writePermissionGranted:false}),good);const before=await page.evaluate(()=>JSON.stringify(data));
  const malformed=[
    task('',{}),task('DUP'),task('DEP',{dependencies:[{task_id:'P',type:'bad'}]}),task('REC',{repeat:'毎週',recurrence_rule:{type:'weekly',weekdays:[]}}),
    task('DATE',{actual_start:'bad'}),task('TYPE',{planned_duration_days:'0'}),task('RUNTIME',{selectedTaskId:'leak'})
  ];
  for(let i=0;i<malformed.length;i++){
    const items=i===1?[task('DUP'),task('DUP')]:[malformed[i]],candidate=root([snapshot('2026-09-11T07:00:00.000Z',items)]);
    const result=await page.evaluate(async value=>{try{await applyJsonObject(value,'bad','bad.json',null,{remember:false,writePermissionGranted:false});return'accepted'}catch(e){return e.schemaKind}},candidate);
    expect(result).toBe('malformed-snapshot');expect(await page.evaluate(()=>JSON.stringify(data))).toBe(before);
  }
});

test('PBL042-P1-06: snapshot Task serializer is narrow and never recurses root/runtime state',async({page})=>{
  const serialized=await page.evaluate(value=>serializeTaskForSnapshot(value),{...task('S'),snapshots:[{bad:true}],workspace_info_markdown:'bad',selectedTaskId:'bad',planned_start:'2026-09-10'});
  expect(serialized).toEqual(task('S'));for(const key of ['snapshots','workspace_info_markdown','selectedTaskId','planned_start'])expect(serialized).not.toHaveProperty(key);
});

test('PBL042-P1-07: normal save, autosave and reload preserve snapshot history',async({page})=>{
  const history=[snapshot()];await adopt(page,'primary',root(history));await page.evaluate(()=>chg(0,'title','manual edit'));await startSave(page);expect(await page.evaluate(()=>window.__pbl042Save)).toBe(true);
  let saved=JSON.parse(await page.evaluate(()=>__fsMock.snapshot('primary').text));expect(saved.snapshots).toEqual(history);expect(saved.items[0].title).toBe('manual edit');
  await page.evaluate(()=>chg(0,'owner','autosaved'));await expect.poll(()=>page.evaluate(()=>__fsMock.snapshot('primary').writeCount),{timeout:5000}).toBe(2);saved=JSON.parse(await page.evaluate(()=>__fsMock.snapshot('primary').text));expect(saved.snapshots).toEqual(history);
  await page.evaluate(async()=>{const handle=__fsMock.handle('primary');await loadDbFromHandle(handle,'reload',false,true)});expect(await page.evaluate(()=>data.snapshots)).toEqual(history);
});

test('PBL042-P1-08: Save Copy preserves snapshot history exactly and leaves primary unchanged',async({page})=>{
  const history=[snapshot()];const primary=await adopt(page,'primary',root(history),{name:'tasks.json'});await page.evaluate(()=>{__fsMock.create('copy',{name:'tasks_copy.json'});__fsMock.queueSave('copy');window.__copy=saveCopyJson()});await page.evaluate(()=>window.__copy);
  expect(JSON.parse(await page.evaluate(()=>__fsMock.snapshot('copy').text)).snapshots).toEqual(history);expect(await page.evaluate(()=>__fsMock.snapshot('primary').text)).toBe(primary);
});

test('PBL042-P1-09: new DB, switch and resume adopt each DB snapshot collection',async({page})=>{
  await page.evaluate(()=>{__fsMock.createDirectory('dir',{name:'folder'});__fsMock.queueDirectory('dir');window.__newDb=startNewDb()});await page.locator('#newDbNameInput').fill('fresh');await page.locator('#newDbNameNext').click();await page.locator('#newDbFolderNext').click();await page.evaluate(()=>window.__newDb);const entry=await page.evaluate(()=>__fsMock.directoryEntries('dir')[0]),created=JSON.parse(await page.evaluate(id=>__fsMock.snapshot(id).text,entry[1]));expect(created).toMatchObject({schema_version:'3.2',snapshots:[]});
  const a=[snapshot('2026-09-10T00:00:00.000Z',[task('A')])],b=[snapshot('2026-09-11T00:00:00.000Z',[task('B')])];await adopt(page,'a',root(a),{name:'a.json'});await adopt(page,'b',root(b),{name:'b.json'});expect(await page.evaluate(()=>data.snapshots)).toEqual(b);
  await page.evaluate(()=>{enterResumeDbState('a.json',__fsMock.handle('a'),'resume')});expect(await page.evaluate(()=>data.snapshots)).toEqual([]);await page.evaluate(()=>loadDbFromHandle(__fsMock.handle('a'),'resume',false,true));expect(await page.evaluate(()=>data.snapshots)).toEqual(a);
});

test('PBL042-P1-10: multi-file move preserves independent source/target histories',async({page})=>{
  const sourceHistory=[snapshot('2026-09-09T00:00:00.000Z',[task('SOURCE-H')])],targetHistory=[snapshot('2026-09-10T00:00:00.000Z',[task('TARGET-H')])];await adopt(page,'source',root(sourceHistory,[task('S')]),{name:'source.json'});page.on('dialog',dialog=>dialog.accept());await page.evaluate(value=>{__fsMock.create('target',{name:'target.json',text:JSON.stringify(value)});__fsMock.queueOpen('target');selectedTaskId='S';window.__move=moveSelectedTaskToOtherDb()},root(targetHistory,[task('T')]));await page.evaluate(()=>window.__move);
  const result=await page.evaluate(()=>({source:JSON.parse(__fsMock.snapshot('source').text),target:JSON.parse(__fsMock.snapshot('target').text),runtime:data.snapshots}));expect(result.source.snapshots).toEqual(sourceHistory);expect(result.target.snapshots).toEqual(targetHistory);expect(result.runtime).toEqual(sourceHistory);expect(result.source.items).toHaveLength(0);expect(result.target.items.map(x=>x.id)).toEqual(['T','S']);
});

test('PBL042-P1-11: multi-file source failure rolls back target and preserves both histories',async({page})=>{
  const sourceHistory=[snapshot('2026-09-09T00:00:00.000Z',[task('SOURCE-H')])],targetHistory=[snapshot('2026-09-10T00:00:00.000Z',[task('TARGET-H')])],targetRoot=root(targetHistory,[task('T')]);await adopt(page,'source',root(sourceHistory,[task('S')]),{name:'source.json'});page.on('dialog',dialog=>dialog.accept());await page.evaluate(value=>{__fsMock.configure('source',{failWriteOnCall:1});__fsMock.create('target',{name:'target.json',text:JSON.stringify(value)});__fsMock.queueOpen('target');selectedTaskId='S';window.__move=moveSelectedTaskToOtherDb()},targetRoot);await page.evaluate(()=>window.__move);
  expect(await page.evaluate(()=>__fsMock.snapshot('target').text)).toBe(JSON.stringify(targetRoot));expect(await page.evaluate(()=>({items:data.items.map(x=>x.id),snapshots:data.snapshots}))).toEqual({items:['S'],snapshots:sourceHistory});
});

test('PBL042-P1-12: Task Undo/Redo excludes and preserves snapshot history',async({page})=>{
  const history=[snapshot()];await page.evaluate(value=>applyJsonObject(value,'undo','undo.json',null,{remember:false,writePermissionGranted:false}),root(history,[task('U',{title:'before'})]));await page.evaluate(()=>chg(0,'title','after'));await page.waitForTimeout(0);
  expect(await page.evaluate(()=>undoStack.map(entry=>({before:Object.prototype.hasOwnProperty.call(JSON.parse(entry.before),'snapshots'),after:Object.prototype.hasOwnProperty.call(JSON.parse(entry.after),'snapshots')})))).toEqual([{before:false,after:false}]);await page.keyboard.press('Control+z');expect(await page.evaluate(()=>({title:itemById('U').title,snapshots:data.snapshots}))).toEqual({title:'before',snapshots:history});await page.keyboard.press('Control+y');expect(await page.evaluate(()=>({title:itemById('U').title,snapshots:data.snapshots}))).toEqual({title:'after',snapshots:history});
});

test('PBL042-P1-13: first 3.1 destructive save requires exact backup before Schema 3.2 write',async({page})=>{
  const original=await adopt(page,'primary',{schema_version:'3.1',workspace_info_markdown:'legacy',items:[task('L')]},{name:'legacy.json'});await page.evaluate(()=>{chg(0,'title','updated');__fsMock.create('backup',{name:'legacy_schema3.1.json'});__fsMock.queueSave('backup')});await startSave(page);await acceptUpgrade(page);expect(await page.evaluate(()=>window.__pbl042Save)).toBe(true);
  const result=await page.evaluate(()=>({backup:__fsMock.snapshot('backup').text,primary:JSON.parse(__fsMock.snapshot('primary').text),calls:__fsMock.calls()}));expect(result.backup).toBe(original);expect(result.primary).toMatchObject({schema_version:'3.2',snapshots:[]});expect(result.calls.findIndex(x=>x.op==='write'&&x.id==='backup')).toBeLessThan(result.calls.findIndex(x=>x.op==='write'&&x.id==='primary'));
});

for(const mode of ['cancel','backup-fail','close-fail'])test(`PBL042-P1-14-${mode}: migration failure leaves Schema 3.1 primary unchanged`,async({page})=>{
  const original=await adopt(page,'primary',{schema_version:'3.1',items:[task('L')]},{name:mode+'.json'});await page.evaluate(mode=>{chg(0,'title','dirty');__fsMock.create('backup',{name:'backup.json',failWrite:mode==='backup-fail'});__fsMock.queueSave('backup');if(mode==='close-fail')__fsMock.configure('primary',{failClose:true})},mode);await startSave(page);await expect(page.locator('.impactUpgradeDialog')).toBeVisible();await page.locator(mode==='cancel'?'#impactUpgradeCancel':'#impactUpgradeAccept').click();expect(await page.evaluate(()=>window.__pbl042Save),mode).toBe(false);expect(await page.evaluate(()=>__fsMock.snapshot('primary').text)).toBe(original);
});
