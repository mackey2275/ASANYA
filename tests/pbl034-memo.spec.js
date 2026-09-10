const {test,expect}=require('playwright/test');
const {APP,TARGET_PRODUCT_VERSION}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',title:id,state:'未着手',owner:'',due:'2026-09-10',planned_duration_days:2,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:0,...extra});
async function boot(page,items,schema='3.1'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,schema})=>applyJsonObject({schema_version:schema,workspace_info_markdown:'',items},'pbl034','pbl034.json',null,{remember:false,writePermissionGranted:false}),{items,schema});
  await page.evaluate(()=>{setView('all');clearUndoHistory('pbl034');dirty=false});
}

test('PBL034-SCHEMA 3.0 migrates, Memo is valid in 3.1, and future schema is rejected',async({page})=>{
  await boot(page,[task('A')],'3.0');
  expect(await page.evaluate(()=>({current:CURRENT_SCHEMA_VERSION,loaded:loadedSchemaVersion,pending:schemaMigrationPending,title:APP_TITLE}))).toEqual({current:'3.1',loaded:'3.0',pending:true,title:'ASANYA v'+(TARGET_PRODUCT_VERSION||'3.1.0')});
  await page.evaluate(()=>changeState(0,'メモ'));
  expect(await page.evaluate(()=>persistableData())).toMatchObject({schema_version:'3.1',items:[{id:'A',state:'メモ'}]});
  expect(await page.evaluate(()=>norm({id:'X',state:'UNKNOWN'}).state)).toBe('');
  expect(await page.evaluate(()=>{try{prepareSchemaObject({schema_version:'3.2',items:[]});return''}catch(e){return e.schemaKind}})).toBe('newer');
});

test('PBL034-VIS Project shows Memo, ToDo hides it, and KPI/overdue exclude it',async({page})=>{
  await boot(page,[task('M',{state:'メモ',due:'2020-01-01'}),task('W',{due:'2020-01-01',sortOrder:2000})]);
  await page.evaluate(()=>setDisplayMode('project-detail'));await expect(page.locator('.ganttRow[data-task-id="M"]')).toBeVisible();await expect(page.locator('#kpis')).toContainText('未終了1件');await expect(page.locator('#kpis')).toContainText('期限超過1件');
  await page.evaluate(()=>setDisplayMode('project-simple'));await expect(page.locator('.ganttRow[data-task-id="M"]')).toBeVisible();
  await page.evaluate(()=>setDisplayMode('todo-tree'));await expect(page.locator('#row_M')).toHaveCount(0);await expect(page.locator('#row_W')).toBeVisible();
  await page.evaluate(()=>setDisplayMode('todo-date'));await expect(page.locator('#row_M')).toHaveCount(0);
});

test('PBL034-HIER Memo hierarchy rules, child creation, and parent completion',async({page})=>{
  await boot(page,[task('P'),task('M',{parentId:'P',state:'メモ'}),task('MM',{parentId:'M',state:'メモ'})]);
  expect(await page.evaluate(()=>({resolved:isHierarchyResolved(itemById('M')),unfinished:logicalUnfinishedDescendantCount('P')}))).toEqual({resolved:true,unfinished:0});
  await page.evaluate(()=>toggle(data.items.findIndex(x=>x.id==='P')));expect(await page.evaluate(()=>itemById('P').completed)).toBe(true);
  await page.evaluate(()=>{toggle(data.items.findIndex(x=>x.id==='P'));selectedTaskId='M';startDraftTask('child')});expect(await page.evaluate(()=>itemById(draftTaskId).state)).toBe('メモ');
  await page.evaluate(()=>cancelDraftTask(draftTaskId));
  expect(await page.evaluate(()=>reassignTaskParent('P','M').ok)).toBe(false);
  expect(await page.evaluate(()=>reassignTaskParent('MM','P').ok)).toBe(true);
});

test('PBL034-CONVERT conversion guards preserve data and rejected changes create no history',async({page})=>{
  await boot(page,[task('A',{actual_start:'2026-09-01',actual_end:'2026-09-02',summary:'keep'}),task('C',{parentId:'A'}),task('D',{dependencies:[{task_id:'A',type:'finish_to_start'}],sortOrder:2000}),task('R',{repeat:'毎日',recurrence_rule:{type:'daily'},sortOrder:3000})]);
  const before=await page.evaluate(()=>undoStack.length);await page.evaluate(()=>changeState(0,'メモ'));expect(await page.evaluate(()=>({state:itemById('A').state,undo:undoStack.length}))).toEqual({state:'未着手',undo:before});
  await page.evaluate(()=>{itemById('C').state='メモ';itemById('D').dependencies=[];changeState(0,'メモ')});expect(await page.evaluate(()=>itemById('A'))).toMatchObject({state:'メモ',actual_start:'2026-09-01',actual_end:'2026-09-02',summary:'keep'});
  await page.evaluate(()=>changeState(data.items.findIndex(x=>x.id==='R'),'メモ'));expect(await page.evaluate(()=>itemById('R').state)).toBe('未着手');
  await page.evaluate(()=>changeState(data.items.findIndex(x=>x.id==='C'),'進行中'));expect(await page.evaluate(()=>itemById('C').state)).toBe('メモ');
});

test('PBL034-DEP Memo is excluded and defensively rejected as either endpoint',async({page})=>{
  await boot(page,[task('M',{state:'メモ'}),task('A',{sortOrder:2000}),task('B',{sortOrder:3000})]);
  await page.evaluate(()=>{relationOpenId='A';relationFormDirection='predecessor'});expect(await page.evaluate(()=>dependencyCandidateList().map(x=>x.id))).not.toContain('M');
  expect(await page.evaluate(()=>dependencyAddCore('M','A','finish_to_start').ok)).toBe(false);expect(await page.evaluate(()=>dependencyAddCore('A','M','finish_to_finish').ok)).toBe(false);
  expect(await page.evaluate(()=>dependencyAddCore('A','B','finish_to_start').ok)).toBe(true);
});

test('PBL034-CLOSE Close/Reopen preserves Memo and never creates Actual',async({page})=>{
  await boot(page,[task('M',{state:'メモ'})]);await page.evaluate(()=>toggle(0));expect(await page.evaluate(()=>itemById('M'))).toMatchObject({state:'メモ',completed:true});expect(await page.evaluate(()=>itemById('M').actual_start)).toBeUndefined();
  await page.evaluate(()=>toggle(0));expect(await page.evaluate(()=>itemById('M'))).toMatchObject({state:'メモ',completed:false});
  await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('M').completed)).toBe(true);await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>itemById('M').completed)).toBe(false);
});

test('PBL034-GANTT Memo dates render but do not affect parent schedule or conflicts',async({page})=>{
  await boot(page,[task('P',{due:'2026-09-10',planned_duration_days:2}),task('M',{parentId:'P',state:'メモ',due:'2026-10-01',planned_duration_days:10}),task('A',{parentId:'P',due:'2026-09-10',planned_duration_days:2,sortOrder:2000})]);
  await page.evaluate(()=>setDisplayMode('project-detail'));expect(await page.evaluate(()=>({memo:ganttScheduleForTask(itemById('M')),summary:descendantSummarySchedule(itemById('P')),conflicts:parentPlanConflicts().length,overdue:isTaskOverdue(itemById('M'),'2026-12-01')}))).toMatchObject({memo:{end:'2026-10-01'},summary:{end:'2026-09-10'},conflicts:0,overdue:false});
  await expect(page.locator('.ganttRow[data-task-id="M"] .ganttBar')).toBeVisible();await expect(page.locator('.ganttRow[data-task-id="M"]')).toHaveClass(/memoRow/);
});

test('PBL034-REC Memo cannot recur; Memo subtree keeps identity through parent rollover',async({page})=>{
  await boot(page,[task('R',{due:'2026-09-10',repeat:'毎日',recurrence_rule:{type:'daily'}}),task('M',{parentId:'R',state:'メモ',due:'2026-09-09',actual_start:'2026-09-01',actual_end:'2026-09-02',completed:true})]);
  expect(await page.evaluate(()=>commitRepeatChange(1,'毎週',{type:'weekly',weekdays:[1]}))).toBe(false);await page.evaluate(()=>toggle(0));
  expect(await page.evaluate(()=>itemById('M'))).toMatchObject({parentId:'R',state:'メモ',due:'2026-09-10',completed:false});expect(await page.evaluate(()=>itemById('M').actual_start)).toBeUndefined();
});

test('PBL034-HQA-STATUS invalid status choices are hidden in Project rows and Task Detail',async({page})=>{
  await boot(page,[task('ELIGIBLE'),task('BLOCKED_CHILD',{sortOrder:2000}),task('NORMAL_CHILD',{parentId:'BLOCKED_CHILD',sortOrder:3000}),task('BLOCKED_DEP',{sortOrder:4000}),task('SUCCESSOR',{dependencies:[{task_id:'BLOCKED_DEP',type:'finish_to_start'}],sortOrder:5000}),task('BLOCKED_REPEAT',{repeat:'毎日',recurrence_rule:{type:'daily'},sortOrder:6000}),task('NORMAL_PARENT',{sortOrder:7000}),task('MEMO_PARENT',{state:'メモ',sortOrder:8000}),task('MEMO_CHILD',{parentId:'MEMO_PARENT',state:'メモ',sortOrder:9000}),task('MEMO_NORMAL_PARENT',{parentId:'NORMAL_PARENT',state:'メモ',sortOrder:10000}),task('ONLY_MEMO_CHILD',{parentId:'ELIGIBLE',state:'メモ',sortOrder:11000})]);
  await page.evaluate(()=>setDisplayMode('project-detail'));
  const options=async id=>page.locator(`.ganttRow[data-task-id="${id}"] select[onchange^="changeState"] option`).allTextContents();
  expect(await options('ELIGIBLE')).toContain('メモ');expect(await options('BLOCKED_CHILD')).not.toContain('メモ');expect(await options('BLOCKED_DEP')).not.toContain('メモ');expect(await options('BLOCKED_REPEAT')).not.toContain('メモ');expect(await options('MEMO_CHILD')).toEqual(['メモ']);expect(await options('MEMO_NORMAL_PARENT')).toEqual(expect.arrayContaining(['未着手','進行中','完了','保留','中止','メモ']));
  for(const id of ['BLOCKED_CHILD','MEMO_CHILD']){await page.locator(`.ganttRow[data-task-id="${id}"] .taskDetailOpenBtn`).click();const detail=await page.locator('#taskDetailPane select[aria-label="ステータス"] option').allTextContents();if(id==='BLOCKED_CHILD')expect(detail).not.toContain('メモ');else expect(detail).toEqual(['メモ']);await page.locator('#taskDetailPane .taskDetailPaneClose').click()}
  const before=await page.evaluate(()=>undoStack.length);await page.evaluate(()=>changeState(data.items.findIndex(x=>x.id==='BLOCKED_DEP'),'メモ'));expect(await page.evaluate(()=>({state:itemById('BLOCKED_DEP').state,undo:undoStack.length}))).toEqual({state:'未着手',undo:before});
});

test('PBL034-HQA-DEPENDENCY Memo dependency UI and candidates are absent while validation remains defensive',async({page})=>{
  await boot(page,[task('M',{state:'メモ'}),task('MC',{parentId:'M',state:'メモ',sortOrder:2000}),task('A',{sortOrder:3000}),task('B',{sortOrder:4000})]);await page.evaluate(()=>setDisplayMode('project-detail'));
  const memoRow=page.locator('.ganttRow[data-task-id="M"]');await expect(memoRow.locator('[title*="依存関係"]')).toHaveCount(0);await expect(memoRow.locator('[title="階層"]')).toHaveCount(1);
  await memoRow.locator('.taskDetailOpenBtn').click();await expect(page.locator('#taskDetailPane .taskDetailSection').filter({has:page.locator('h3:text-is("依存関係")')})).toHaveCount(0);await expect(page.locator('#taskDetailPane')).not.toContainText('前工程を追加');await expect(page.locator('#taskDetailPane')).not.toContainText('後工程を追加');
  await page.evaluate(()=>{relationOpenId='A';relationFormDirection='predecessor'});expect(await page.evaluate(()=>dependencyCandidateList().map(x=>x.id))).not.toContain('M');await page.evaluate(()=>relationFormDirection='successor');expect(await page.evaluate(()=>dependencyCandidateList().map(x=>x.id))).not.toContain('M');
  const before=await page.evaluate(()=>({memo:JSON.stringify(itemById('M')),a:JSON.stringify(itemById('A')),undo:undoStack.length}));expect(await page.evaluate(()=>dependencyAddCore('M','A','finish_to_start').ok)).toBe(false);expect(await page.evaluate(()=>({memo:JSON.stringify(itemById('M')),a:JSON.stringify(itemById('A')),undo:undoStack.length}))).toEqual(before);await expect(page.locator('#toast')).toContainText('メモは依存関係');
});
