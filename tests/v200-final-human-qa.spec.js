const {test,expect}=require('playwright/test');
const {installFsAccessMock}=require('./helpers/fs-access-mock');
const {APP}=require('./helpers/app-target');
const task=(id,extra={})=>({id,parentId:'',state:'',impact:'',title:id,owner:'owner',due:'2026-08-20',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,planned_duration_days:1,...extra});
async function fresh(page,items,schema='2.0'){await page.setViewportSize({width:1680,height:900});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(({items,schema})=>applyJsonObject({schema_version:schema,items},'final','final.json',null,{remember:false,writePermissionGranted:false}),{items,schema});await page.evaluate(()=>setMode('team'));await page.waitForTimeout(60)}

test('ORDER-DUP-01/02 duplicate positive sortOrder normalizes only after valid move',async({page})=>{
  await fresh(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:1000}),task('C',{sortOrder:1000})]);
  await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='B'),-1));
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['B','A','C']);
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.sortOrder))).toEqual([1000,2000,3000]);
});

test('ORDER-DUP-03 boundary is a complete no-op including duplicate values and viewport',async({page})=>{
  await fresh(page,[task('A',{sortOrder:700}),task('B',{sortOrder:700}),task('C',{sortOrder:700})]);
  const before=await page.evaluate(()=>({json:JSON.stringify(data.items),dirty,undo:undoStack.length,y:scrollY,renders:0}));
  const after=await page.evaluate(()=>{let renders=0;const base=render;render=()=>{renders++;return base()};moveItem(data.items.findIndex(x=>x.id==='A'),-1);return{json:JSON.stringify(data.items),dirty,undo:undoStack.length,y:scrollY,renders}});
  expect(after).toEqual(before);
});

test('UNDO-FLIP-01/02 Undo and Redo animate subtree and displaced rows through shared FLIP',async({page})=>{
  await fresh(page,[task('Q',{due:'2026-08-01',sortOrder:1000}),task('P',{due:'2026-08-02',sortOrder:2000}),task('C',{parentId:'P',due:''}),task('G',{parentId:'C',due:''})]);
  const due=page.locator('.ganttRow[data-task-id="P"] .dueTxt');await due.click();const input=page.locator('.ganttRow[data-task-id="P"] input[type="text"]');await input.fill('2026/07/31');await input.press('Enter');await page.waitForTimeout(2300);
  await page.evaluate(()=>performUndo());
  for(const id of['P','C','G'])await expect(page.locator(`.ganttRow[data-task-id="${id}"]`)).toHaveClass(/sortMovePrimary/); await expect(page.locator('.ganttRow[data-task-id="Q"]')).toHaveClass(/sortMoveDisplaced/);
  expect(await page.locator('.sortMoveAnimating').count()).toBeGreaterThan(1);await page.waitForTimeout(400);await page.screenshot({path:'test-results/asanya-v200-undo-subtree-flip.png'});await page.waitForTimeout(1900);
  await page.evaluate(()=>performRedo()); for(const id of['P','C','G'])await expect(page.locator(`.ganttRow[data-task-id="${id}"]`)).toHaveClass(/sortMovePrimary/); expect(await page.locator('.sortMoveAnimating').count()).toBeGreaterThan(1);
});

test('FLIP-SCROLL-01 vertical wheel cancels animation/follow and preserves manual scroll',async({page})=>{
  const items=Array.from({length:35},(_,i)=>task(`T${i+1}`,{due:`2026-08-${String((i%20)+1).padStart(2,'0')}`,sortOrder:(i+1)*1000})); await fresh(page,items); await page.evaluate(()=>window.scrollTo(0,220));
  await page.evaluate(()=>{const before=displaySortIndex('T2');sortMoveAnimationArmed='test';itemById('T2').due='2026-09-30';applyPostSortMove('T2',before);render();sortMoveAnimationArmed=''}); await expect(page.locator('.sortMoveAnimating').first()).toBeVisible();
  await page.mouse.wheel(0,180); await expect(page.locator('.sortMoveAnimating')).toHaveCount(0); const y=await page.evaluate(()=>scrollY); await page.waitForTimeout(2400); expect(await page.evaluate(()=>scrollY)).toBe(y); expect(await page.evaluate(()=>projectPlannedVisible().at(-1).x.id)).toBe('T2');
});

test('FLIP-SCROLL-02 horizontal timeline wheel does not cancel active animation',async({page})=>{
  await fresh(page,[task('A',{due:'2026-08-01'}),task('B',{due:'2026-08-02',sortOrder:2000}),task('C',{due:'2026-08-03',sortOrder:3000})]);
  await page.evaluate(()=>{const before=displaySortIndex('B');sortMoveAnimationArmed='test';itemById('B').due='2026-08-04';applyPostSortMove('B',before);render();sortMoveAnimationArmed=''}); const timeline=page.locator('.ganttHeader .ganttTimelineClip');await timeline.hover();await page.mouse.wheel(160,0);expect(await page.locator('.sortMoveAnimating').count()).toBeGreaterThan(0);
});

test('SCHEMA-200-02/03/04 1.9 opens unchanged, real save emits 2.0, future rejects',async({page})=>{
  await fresh(page,[task('A',{repeat:'毎日',recurrence_rule:{type:'daily'},actual_start:'2026-08-01',actual_start_source:'user'})],'1.9');
  expect(await page.evaluate(()=>({loadedSchemaVersion,schemaMigrationPending,dataSchema:data.schema_version}))).toEqual({loadedSchemaVersion:'1.9',schemaMigrationPending:true,dataSchema:await page.evaluate(()=>CURRENT_SCHEMA_VERSION)});
const persisted=await page.evaluate(()=>persistableData()); expect(persisted.schema_version).toBe(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)); expect(persisted.items[0]).toMatchObject({id:'A',actual_start_source:'user',recurrence_rule:{type:'daily'}});
const before=await page.evaluate(()=>JSON.stringify(data.items)); const result=await page.evaluate(()=>{try{prepareSchemaObject({schema_version:'9.0',items:[]});return'accepted'}catch(e){return e.schemaKind}}); expect(result).toBe('newer'); expect(await page.evaluate(()=>JSON.stringify(data.items))).toBe(before);
});

test('SCHEMA-200-01/02/03 File API mock proves create 2.0 and open-only does not write',async({page})=>{
  await installFsAccessMock(page);await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(()=>{__fsMock.createDirectory('newdir');__fsMock.queueDirectory('newdir')});await page.locator('#startNewDbBtn').click();await page.locator('#newDbNameInput').fill('New');await page.locator('#newDbNameNext').click();await page.locator('#newDbFolderNext').click();
  await expect.poll(()=>page.evaluate(()=>currentDbName)).toBe('New.json');const created=await page.evaluate(()=>__fsMock.directoryEntries('newdir')[0][1]),current=await page.evaluate(()=>CURRENT_SCHEMA_VERSION);expect(JSON.parse(await page.evaluate(id=>__fsMock.snapshot(id).text,created))).toEqual(current==='2.2'?{schema_version:'2.2',workspace_info_markdown:'',items:[]}:{schema_version:'2.0',items:[]});
  await page.evaluate(()=>enterUnloadedDbState('',true));const legacy=JSON.stringify({schema_version:'1.9',items:[{id:'L',title:'legacy',owner:'',due:'',parentId:'',state:'',impact:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000}]});await page.evaluate(text=>{__fsMock.create('legacy',{name:'legacy.json',text});__fsMock.queueOpen('legacy')},legacy);await page.locator('#startDbReadBtn').click();await expect(page.locator('#dbLoadingBack')).toBeHidden();expect(await page.evaluate(()=>__fsMock.snapshot('legacy').writeCount)).toBe(0);expect(await page.evaluate(()=>loadedSchemaVersion)).toBe('1.9');
  await page.evaluate(()=>chg(data.items.findIndex(x=>x.id==='L'),'owner','edited'));await page.evaluate(()=>performDbSave({allowDownload:false,source:'test'}));const saved=JSON.parse(await page.evaluate(()=>__fsMock.snapshot('legacy').text));expect(saved.schema_version).toBe(await page.evaluate(()=>CURRENT_SCHEMA_VERSION));expect(saved.items[0]).toMatchObject({id:'L',title:'legacy',owner:'edited',sortOrder:1000});
});

test('LOGO-01 and current Schema presentation at 1680x900',async({page})=>{await page.setViewportSize({width:1680,height:900});await page.goto(APP);await expect(page.locator('h1 svg')).toHaveCSS('transform',/matrix\(1, 0, 0, 1, 0, -2\)/);await expect(page.locator('h1 .schemaMeta')).toHaveText('schema_version '+await page.evaluate(()=>CURRENT_SCHEMA_VERSION)+'');await page.screenshot({path:'test-results/asanya-v200-final-human-qa.png'})});
