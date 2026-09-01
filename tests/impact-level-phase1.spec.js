const {test,expect}=require('playwright/test');
const {installFsAccessMock}=require('./helpers/fs-access-mock');
const {APP}=require('./helpers/app-target');

const legacyTask=(id,impact,extra={})=>({id,parentId:'',state:'未着手',impact,title:id,owner:'',due:'2026-08-20',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});

async function boot(page){
  await installFsAccessMock(page);await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await expect(page).toHaveTitle(APP.includes('v260')?'ASANYA v2.6.0':'ASANYA v2.5.0');expect(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)).toBe('2.5');
}
async function apply(page,schema,items){
  return page.evaluate(({schema,items})=>applyJsonObject({...((schema===null)?{}:{schema_version:schema}),items},'impact-test','impact.json',null,{remember:false,writePermissionGranted:false}),{schema,items});
}
async function openMockDb(page,id,schema,items,options={}){
  const text=JSON.stringify({...((schema===null)?{}:{schema_version:schema}),items});
  await page.evaluate(async({id,text,options})=>{const handle=__fsMock.create(id,{name:options.name||id+'.json',text,writePermission:'granted'}),file=await handle.getFile();await applyJsonObject(JSON.parse(text),'impact-test',file.name,handle,{remember:false,writePermissionGranted:true,fileText:text,fileModified:file.lastModified,fileSize:file.size})},{id,text,options});
  return text;
}
async function startSave(page,source='manual'){await page.evaluate(source=>{window.__impactSavePromise=performDbSave({allowDownload:false,source})},source)}
async function finishSave(page){return page.evaluate(()=>window.__impactSavePromise)}
async function acceptUpgrade(page){await expect(page.locator('.impactUpgradeDialog')).toBeVisible();await page.locator('#impactUpgradeAccept').click()}
async function cancelUpgrade(page){await expect(page.locator('.impactUpgradeDialog')).toBeVisible();await page.locator('#impactUpgradeCancel').click()}

test.beforeEach(async({page})=>boot(page));

test('IMPACT-MIGRATE-01 supported legacy schemas map to numeric runtime only',async({page})=>{
  const schemas=[null,'1.1','1.5','1.8','1.9','2.0','2.1','2.2'];
  for(const schema of schemas){
    await apply(page,schema,[legacyTask('A','A old'),legacyTask('BD','B-期限 old'),legacyTask('BR','B-定期'),legacyTask('C','C old'),legacyTask('BL',''),{id:'MISS',title:'missing'}]);
    expect(await page.evaluate(()=>data.items.map(x=>({level:x.impact_level,legacy:Object.prototype.hasOwnProperty.call(x,'impact')})))).toEqual([3,2,2,1,0,0].map(level=>({level,legacy:false})));
    expect(await page.evaluate(()=>({loadedSchemaVersion,schemaMigrationPending}))).toEqual({loadedSchemaVersion:schema===null?'旧形式（versionなし）':schema,schemaMigrationPending:true});
  }
});

test('IMPACT-MIGRATE-02 tolerant variants and unknown diagnostic behavior',async({page})=>{
  await apply(page,'2.2',[legacyTask('A',' A 任意 '),legacyTask('BD','B anything'),legacyTask('BR','旧 定期 分類'),legacyTask('C','C-any'),legacyTask('X','mystery'),legacyTask('X2','mystery')]);
  expect(await page.evaluate(()=>data.items.map(x=>x.impact_level))).toEqual([3,2,2,1,0,0]);
  expect(await page.evaluate(()=>activeImpactMigrationIssues)).toEqual([{value:'mystery',count:2,taskIds:['X','X2']}]);
});

test('IMPACT-SCHEMA25-01 round trip uses impact_level only and normalizes invalid values',async({page})=>{
  await apply(page,'2.5',[{id:'N0',impact_level:0},{id:'N1',impact_level:1},{id:'N2',impact_level:'2'},{id:'N3',impact_level:3},{id:'BAD',impact_level:99,impact:'A'}]);
  expect(await page.evaluate(()=>data.items.map(x=>x.impact_level))).toEqual([0,1,2,3,0]);
  const saved=await page.evaluate(()=>persistableData());expect(saved.schema_version).toBe('2.5');for(const item of saved.items){expect(item).toHaveProperty('impact_level');expect(item).not.toHaveProperty('impact')}
  expect(await page.evaluate(()=>schemaMigrationPending)).toBe(false);
});

test('IMPACT-SCHEMA25-02 unsupported gap and future schemas are rejected',async({page})=>{
  expect(await page.evaluate(()=>['2.3','2.4','2.6','9.0'].map(schema=>{try{prepareSchemaObject({schema_version:schema,items:[]});return'accepted'}catch(e){return e.schemaKind}}))).toEqual(['unsupported-gap','unsupported-gap','newer','newer']);
});

test('IMPACT-UPGRADE-01 exact old JSON is backed up before primary Schema 2.5 write',async({page})=>{
  const original=await openMockDb(page,'primary','2.2',[legacyTask('A','B-期限 old')],{name:'my.tasks.json'});
  await page.evaluate(()=>{chg(0,'title','edited');__fsMock.create('backup',{name:'my.tasks_schema2.2.json',text:''});__fsMock.queueSave('backup')});
  await startSave(page);await acceptUpgrade(page);expect(await finishSave(page)).toBe(true);
  const result=await page.evaluate(()=>({backup:__fsMock.snapshot('backup').text,primary:JSON.parse(__fsMock.snapshot('primary').text),calls:__fsMock.calls(),loadedSchemaVersion,schemaMigrationPending,dirty,currentDbName}));
  expect(result.backup).toBe(original);expect(result.primary.schema_version).toBe('2.5');expect(result.primary.items[0]).toMatchObject({impact_level:2,title:'edited'});expect(result.primary.items[0]).not.toHaveProperty('impact');
  expect(result.calls.find(x=>x.op==='showSaveFilePicker').suggestedName).toBe('my.tasks_schema2.2.json');expect(result.calls.findIndex(x=>x.op==='write'&&x.id==='backup')).toBeLessThan(result.calls.findIndex(x=>x.op==='write'&&x.id==='primary'));
  expect(result).toMatchObject({loadedSchemaVersion:'2.5',schemaMigrationPending:false,dirty:false,currentDbName:'my.tasks.json'});
});

test('IMPACT-UPGRADE-02 schema-less/2.0 backup naming and cancellation preserve primary',async({page})=>{
  for(const [schema,name] of [[null,'tasks_schema-legacy.json'],['2.0','tasks_schema2.0.json']]){
    const original=await openMockDb(page,'p'+String(schema),schema,[legacyTask('A','A')],{name:'tasks.json'});await page.evaluate(()=>chg(0,'owner','dirty'));
    await startSave(page);await acceptUpgrade(page);expect(await finishSave(page)).toBe(false);
    expect(await page.evaluate(id=>__fsMock.snapshot(id).text,'p'+String(schema))).toBe(original);expect(await page.evaluate(()=>dirty)).toBe(true);expect((await page.evaluate(()=>__fsMock.calls())).filter(x=>x.op==='showSaveFilePicker').at(-1).suggestedName).toBe(name);
  }
});

test('IMPACT-UPGRADE-03 unknown warning, cancel, then accepted explicit save',async({page})=>{
  const original=await openMockDb(page,'primary','2.2',[legacyTask('U','mystery')],{name:'tasks.json'});await page.evaluate(()=>chg(0,'owner','dirty'));
  await startSave(page,'auto');await expect(page.locator('.impactUpgradeDialog')).toContainText('1件');await expect(page.locator('.impactUpgradeDialog')).toContainText('mystery');await cancelUpgrade(page);expect(await finishSave(page)).toBe(false);
  expect(await page.evaluate(()=>({dirty,text:__fsMock.snapshot('primary').text,suspended:impactAutosavePromptSuspended}))).toEqual({dirty:true,text:original,suspended:true});
  expect(await page.evaluate(()=>performDbSave({allowDownload:false,source:'auto'}))).toBe(false);await expect(page.locator('.impactUpgradeDialog')).toHaveCount(0);
  await page.evaluate(()=>{__fsMock.create('backup',{name:'tasks_schema2.2.json'});__fsMock.queueSave('backup')});await startSave(page,'manual');await acceptUpgrade(page);expect(await finishSave(page)).toBe(true);expect(JSON.parse(await page.evaluate(()=>__fsMock.snapshot('primary').text)).items[0]).toMatchObject({impact_level:0});
});

test('IMPACT-UPGRADE-04 backup write failure never overwrites primary',async({page})=>{
  const original=await openMockDb(page,'primary','2.2',[legacyTask('A','A')]);await page.evaluate(()=>{chg(0,'owner','dirty');__fsMock.create('backup',{failWrite:true});__fsMock.queueSave('backup')});await startSave(page);await acceptUpgrade(page);expect(await finishSave(page)).toBe(false);expect(await page.evaluate(()=>__fsMock.snapshot('primary').text)).toBe(original);expect(await page.evaluate(()=>dirty)).toBe(true);
});

test('IMPACT-STAR-01 all click transitions work in visible ToDo controls',async({page})=>{
  await apply(page,'2.5',[{id:'T',title:'T',impact_level:0}]);const expected=[[0,1,1],[0,2,2],[0,3,3],[1,1,0],[1,2,2],[1,3,3],[2,1,1],[2,2,0],[2,3,3],[3,1,1],[3,2,2],[3,3,0]];
  for(const [start,star,end] of expected){await page.evaluate(start=>{itemById('T').impact_level=start;render();clearUndoHistory('transition')},start);await page.locator('#row_T .impactStar').nth(star-1).click();expect(await page.evaluate(()=>itemById('T').impact_level)).toBe(end)}
});

test('IMPACT-STAR-02 Project, keyboard, accessibility, Undo/Redo and no row-selection side effect',async({page})=>{
  await apply(page,'2.5',[{id:'T',title:'T',impact_level:0}]);await page.evaluate(()=>setMode('team'));const star=page.locator('.ganttRow[data-task-id="T"] .impactStar').nth(1);await expect(star).toHaveAttribute('aria-label','影響度2');await star.focus();await star.press('Enter');expect(await page.evaluate(()=>({level:itemById('T').impact_level,selected:selectedTaskId,undo:undoStack.length}))).toEqual({level:2,selected:'',undo:1});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('T').impact_level)).toBe(0);await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('T').impact_level)).toBe(2);await expect(star).toHaveAttribute('type','button');expect(await page.evaluate(()=>ganttTimelineScrollLeft)).toBe(0);
});

test('IMPACT-STAR-03 top-level and child draft commit numeric level only',async({page})=>{
  await apply(page,'2.5',[{id:'P',title:'Parent',impact_level:0}]);await page.locator('#b_title').fill('Top');await page.locator('#b_title').press('Enter');await page.locator('#b_impact .impactStar').nth(2).click();await page.locator('#b_due').fill('2026-08-20');await page.locator('#b_due').press('Enter');await expect.poll(()=>page.evaluate(()=>data.items.find(x=>x.title==='Top')?.impact_level)).toBe(3);await page.waitForTimeout(180);
  await page.evaluate(()=>{selectTask('P');startDraftTask('child')});const draftId=await page.evaluate(()=>draftTaskId);const row=page.locator(`#row_${draftId}`);await expect(row.locator('.titleText')).toBeVisible();await row.locator('.titleText').fill('Child');await row.locator('.impactStar').nth(0).click();await expect.poll(()=>page.evaluate(()=>draftStage)).toBe('due');await row.locator('input[type=text]').first().press('Escape').catch(()=>{});expect(await page.evaluate(id=>({level:itemById(id).impact_level,legacy:'impact'in itemById(id)}),draftId)).toEqual({level:1,legacy:false});
});

test('IMPACT-COMPAT-01 recurrence copies level, sorting unchanged, Copilot uses stars',async({page})=>{
  await apply(page,'2.5',[{id:'R',title:'Repeat',impact_level:2,due:'2026-08-20',repeat:'毎日',completed:false,sortOrder:1000},{id:'B',title:'B',impact_level:3,due:'2026-08-21',sortOrder:2000}]);const before=await page.evaluate(()=>visible().map(x=>x.x.id));await page.evaluate(()=>toggle(data.items.findIndex(x=>x.id==='R')));const rolled=await page.evaluate(()=>itemById('R'));expect(rolled.impact_level).toBe(2);expect(rolled).not.toHaveProperty('impact');expect(rolled.due).toBe('2026-08-21');expect((await page.evaluate(()=>buildCopilotPrompt(itemById('B')))).match(/影響度: ★★★/)).toBeTruthy();expect(before).toEqual(['R','B']);
});

test('IMPACT-COMPAT-02 ASANA import boundary maps legacy values through the common mapper',async({page})=>{
  expect(await page.evaluate(()=>['A','B-期限','B-定期','C',''].map((impact,i)=>norm({id:'C'+i,source:'ASANA',impact}).impact_level))).toEqual([3,2,2,1,0]);expect(await page.evaluate(()=>norm({id:'U',source:'ASANA',impact:'unknown'}).impact_level)).toBe(0);
});

test('IMPACT-DEFER-01 Task Detail remains unchanged and has no Impact editor',async({page})=>{
  await apply(page,'2.5',[{id:'T',title:'T',impact_level:2}]);await page.locator('#row_T .taskDetailOpenBtn').click();await expect(page.locator('#taskDetailPane')).toBeVisible();const phase2=APP.includes('phase2')||APP.includes('priority_width_followup')||APP.includes('pbl024_025')||APP.includes('v260')||APP.endsWith('/asanya_task_manager_v250.html');await expect(page.locator('#taskDetailPane').getByText('影響度',{exact:true})).toHaveCount(phase2?1:0);await expect(page.locator('#taskDetailPane .impactStars')).toHaveCount(phase2?1:0);
});

test('IMPACT-COPY-01 ordinary copy serializes Schema 2.5 without mutating old primary',async({page})=>{
  const original=await openMockDb(page,'primary','2.2',[legacyTask('A','A')],{name:'tasks.json'});await page.evaluate(()=>{__fsMock.create('copy',{name:'tasks_copy.json'});__fsMock.queueSave('copy');window.__copyPromise=saveCopyJson()});await acceptUpgrade(page);await page.evaluate(()=>window.__copyPromise);const copy=JSON.parse(await page.evaluate(()=>__fsMock.snapshot('copy').text));expect(copy.schema_version).toBe('2.5');expect(copy.items[0]).toMatchObject({impact_level:3});expect(copy.items[0]).not.toHaveProperty('impact');expect(await page.evaluate(()=>__fsMock.snapshot('primary').text)).toBe(original);
});

test('IMPACT-SWITCH-01 cancelling required legacy upgrade cancels DB switch without writes',async({page})=>{
  const original=await openMockDb(page,'source','2.2',[legacyTask('A','A')],{name:'old.json'});await page.evaluate(()=>{chg(0,'title','dirty');__fsMock.create('next',{name:'next.json',text:JSON.stringify({schema_version:'2.5',items:[]})});__fsMock.queueOpen('next');window.__switchPromise=startJsonFileRead()});await cancelUpgrade(page);await page.evaluate(()=>window.__switchPromise);expect(await page.evaluate(()=>({name:currentDbName,dirty,text:__fsMock.snapshot('source').text,opens:__fsMock.calls().filter(x=>x.op==='showOpenFilePicker').length}))).toEqual({name:'old.json',dirty:true,text:original,opens:0});
});

test('IMPACT-NEWDB-01 new database starts directly at Schema 2.5',async({page})=>{
  await page.evaluate(()=>{__fsMock.createDirectory('dir',{name:'folder'});__fsMock.queueDirectory('dir');window.__newPromise=startNewDb()});await expect(page.locator('#newDbNameInput')).toBeVisible();await page.locator('#newDbNameInput').fill('fresh');await page.locator('#newDbNameNext').click();await page.locator('#newDbFolderNext').click();await page.evaluate(()=>window.__newPromise);const entry=await page.evaluate(()=>__fsMock.directoryEntries('dir')[0]);expect(entry[0]).toBe('fresh.json');expect(JSON.parse((await page.evaluate(id=>__fsMock.snapshot(id).text,entry[1]))).schema_version).toBe('2.5');expect(await page.evaluate(()=>({loadedSchemaVersion,schemaMigrationPending}))).toEqual({loadedSchemaVersion:'2.5',schemaMigrationPending:false});
});

test('IMPACT-MOVE-01 cancelling destination upgrade leaves both JSON files exact',async({page})=>{
  const source=await openMockDb(page,'source','2.5',[{id:'S',title:'Move',impact_level:3}],{name:'source.json'}),target=JSON.stringify({schema_version:'2.2',items:[legacyTask('T','C')]});page.on('dialog',d=>d.accept());await page.evaluate(target=>{selectedTaskId='S';__fsMock.create('target',{name:'target.json',text:target});__fsMock.queueOpen('target');window.__movePromise=moveSelectedTaskToOtherDb()},target);await expect(page.locator('.impactUpgradeDialog')).toBeVisible();await cancelUpgrade(page);await page.evaluate(()=>window.__movePromise);expect(await page.evaluate(()=>({source:__fsMock.snapshot('source').text,target:__fsMock.snapshot('target').text}))).toEqual({source,target});
});

test('IMPACT-MOVE-02 destination and source legacy backups finish before either primary mutation',async({page})=>{
  const source=await openMockDb(page,'source','2.2',[legacyTask('S','A')],{name:'source.json'}),target=JSON.stringify({schema_version:'2.2',items:[legacyTask('T','C')]});page.on('dialog',d=>d.accept());await page.evaluate(target=>{selectedTaskId='S';__fsMock.create('target',{name:'target.json',text:target});__fsMock.create('targetBackup',{name:'target_schema2.2.json'});__fsMock.create('sourceBackup',{name:'source_schema2.2.json'});__fsMock.queueOpen('target');__fsMock.queueSave('targetBackup');__fsMock.queueSave('sourceBackup');window.__movePromise=moveSelectedTaskToOtherDb()},target);await acceptUpgrade(page);await acceptUpgrade(page);await page.evaluate(()=>window.__movePromise);const result=await page.evaluate(()=>({sourceBackup:__fsMock.snapshot('sourceBackup').text,targetBackup:__fsMock.snapshot('targetBackup').text,source:JSON.parse(__fsMock.snapshot('source').text),target:JSON.parse(__fsMock.snapshot('target').text),calls:__fsMock.calls()}));expect(result.sourceBackup).toBe(source);expect(result.targetBackup).toBe(target);expect(result.source.schema_version).toBe('2.5');expect(result.source.items).toHaveLength(0);expect(result.target.schema_version).toBe('2.5');expect(result.target.items.find(x=>x.id==='S')).toMatchObject({impact_level:3});const firstPrimary=Math.min(...['source','target'].map(id=>result.calls.findIndex(x=>x.op==='write'&&x.id===id)).filter(x=>x>=0));expect(result.calls.findIndex(x=>x.op==='write'&&x.id==='targetBackup')).toBeLessThan(firstPrimary);expect(result.calls.findIndex(x=>x.op==='write'&&x.id==='sourceBackup')).toBeLessThan(firstPrimary);
});
