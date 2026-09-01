const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',title:id,state:'未着手',owner:'',due:'2026-09-10',planned_duration_days:2,summary:`summary-${id}`,repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:2,...extra});
async function boot(page,items,mode='personal'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,mode})=>{applyJsonObject({schema_version:'2.5',workspace_info_markdown:'',items},'pbl023','pbl023.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);clearUndoHistory('pbl023');dirty=false},{items,mode});
}
const snapshot=(page,id)=>page.evaluate(id=>{const x=itemById(id);return JSON.parse(JSON.stringify(x))},id);

test('PBL023-A Status 完了 stays Open, sets Actual End, satisfies dependency, and does not rollover',async({page})=>{
  await boot(page,[task('P',{repeat:'毎日',recurrence_rule:{type:'daily'}}),task('S',{dependencies:[{task_id:'P',type:'finish_to_start'}],sortOrder:2000})]);
  await page.evaluate(()=>changeState(0,'完了'));
  const today=await page.evaluate(()=>ymd()),p=await snapshot(page,'P');
  expect(p).toMatchObject({state:'完了',completed:false,due:'2026-09-10',actual_start:today,actual_end:today});
  expect(await page.evaluate(()=>({satisfied:isDependencySatisfied(itemById('P')),blocked:startBlockers(itemById('S')).length,undo:undoStack.length}))).toEqual({satisfied:true,blocked:0,undo:1});
  await page.evaluate(()=>setView('open'));await expect(page.locator('#row_P')).toBeVisible();await expect(page.locator('#row_P .doneBtn')).toHaveText('○');
});

test('PBL023-B Close from every Status and Reopen preserve the agreed Status and Actual semantics',async({page})=>{
  const states=['未着手','進行中','保留','完了','中止'];
  await boot(page,states.map((state,i)=>task(String(i),{state,sortOrder:(i+1)*1000,...(state==='完了'?{actual_start:'2026-09-01',actual_end:'2026-09-02'}:{})})));
  for(let i=0;i<states.length;i++)await page.evaluate(i=>toggle(i),i);
  const closed=await page.evaluate(()=>data.items.map(x=>({state:x.state,closed:x.completed,start:x.actual_start,end:x.actual_end})));
  expect(closed.map(x=>[x.state,x.closed])).toEqual([['完了',true],['完了',true],['完了',true],['完了',true],['中止',true]]);
  for(let i=0;i<4;i++){expect(closed[i].start).toBeTruthy();expect(closed[i].end).toBeTruthy()}
  expect(closed[4].start).toBeUndefined();expect(closed[4].end).toBeUndefined();
  await page.evaluate(()=>{toggle(3);toggle(4)});
  expect(await page.evaluate(()=>data.items.slice(3).map(x=>({state:x.state,closed:x.completed,end:x.actual_end})))).toEqual([{state:'完了',closed:false,end:'2026-09-02'},{state:'中止',closed:false,end:undefined}]);
});

test('PBL023-C hierarchy Close uses deep resolved eligibility, cascades once, and parent-only Reopen',async({page})=>{
  await boot(page,[task('P'),task('C',{parentId:'P',state:'完了'}),task('G',{parentId:'C',state:'中止'}),task('A',{parentId:'P',state:'完了',completed:true})]);
  await page.evaluate(()=>toggle(0));
  expect(await page.evaluate(()=>data.items.map(x=>({id:x.id,state:x.state,closed:x.completed})))).toEqual([
    {id:'P',state:'完了',closed:true},{id:'C',state:'完了',closed:true},{id:'G',state:'中止',closed:true},{id:'A',state:'完了',closed:true}
  ]);
  expect(await page.evaluate(()=>undoStack.length)).toBe(1);
  await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>data.items.map(x=>x.completed))).toEqual([false,false,false,true]);
  await page.evaluate(()=>performRedo());await page.evaluate(()=>toggle(0));
  expect(await page.evaluate(()=>data.items.map(x=>x.completed))).toEqual([false,true,true,true]);
});

test('PBL023-D unresolved deep child blocks parent Close without mutation, Undo, or dirty',async({page})=>{
  await boot(page,[task('P'),task('C',{parentId:'P',state:'完了'}),task('G',{parentId:'C',state:'保留'})]);
  const before=await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}));
  page.once('dialog',d=>d.accept());await page.evaluate(()=>toggle(0));
  expect(await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}))).toEqual(before);
});

test('PBL023-E child Reopen is blocked only by a Closed ancestor',async({page})=>{
  await boot(page,[task('P',{state:'完了',completed:true}),task('C',{parentId:'P',state:'完了',completed:true})]);
  const before=await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}));
  page.once('dialog',async d=>{expect(d.message()).toContain('先に親・祖先を再オープン');await d.accept()});await page.evaluate(()=>toggle(1));
  expect(await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}))).toEqual(before);
  await page.evaluate(()=>{toggle(0);toggle(1)});
  expect(await page.evaluate(()=>data.items.map(x=>({state:x.state,closed:x.completed})))).toEqual([{state:'完了',closed:false},{state:'完了',closed:false}]);
});

test('PBL023-F dependency satisfaction ignores Close and predecessor cancellation is blocked',async({page})=>{
  await boot(page,[task('P',{state:'中止',completed:true}),task('S',{dependencies:[{task_id:'P',type:'finish_to_start'}],sortOrder:2000}),task('Q',{sortOrder:3000}),task('T',{dependencies:[{task_id:'Q',type:'finish_to_finish'}],sortOrder:4000})]);
  expect(await page.evaluate(()=>startBlockers(itemById('S')).map(x=>x.task.id))).toEqual(['P']);
  const before=await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}));
  page.once('dialog',async d=>{expect(d.message()).toContain('先に依存関係を削除');await d.accept()});await page.evaluate(()=>changeState(2,'中止'));
  expect(await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}))).toEqual(before);
  await page.evaluate(()=>{dependencyRemoveCore('Q','T');changeState(data.items.findIndex(x=>x.id==='Q'),'中止')});
  expect(await page.evaluate(()=>itemById('Q').state)).toBe('中止');
});

test('PBL023-G recurring Status complete does not roll; Close uses unchanged in-place rollover and one Undo',async({page})=>{
  await boot(page,[task('R',{repeat:'毎日',recurrence_rule:{type:'daily'},actual_start:'2026-09-01',actual_start_source:'user'})]);
  await page.evaluate(()=>changeState(0,'完了'));const completed=await snapshot(page,'R');expect(completed).toMatchObject({id:'R',due:'2026-09-10',state:'完了',completed:false});
  await page.evaluate(()=>toggle(0));const rolled=await snapshot(page,'R');expect(rolled).toMatchObject({id:'R',due:'2026-09-11',state:'',completed:false,repeat:'毎日'});expect(rolled.actual_start).toBeUndefined();expect(rolled.actual_end).toBeUndefined();
  expect(await page.evaluate(()=>({count:data.items.length,undo:undoStack.length}))).toEqual({count:1,undo:2});
  await page.evaluate(()=>performUndo());expect(await snapshot(page,'R')).toEqual(completed);
});

test('PBL023-H ToDo and Project share 未終了 / 終了済み filtering and wording',async({page})=>{
  await boot(page,[task('OPEN',{state:'完了'}),task('CLOSED',{state:'完了',completed:true,sortOrder:2000})]);
  await expect(page.locator('#vOpen')).toHaveText('未終了');await expect(page.locator('#vDone')).toHaveText('終了済み');await expect(page.locator('#kpis')).toContainText('未終了');
  for(const mode of ['personal','team']){
    await page.evaluate(mode=>setMode(mode),mode);await page.evaluate(()=>setView('open'));
    const selector=mode==='team'?'.ganttRow[data-task-id]':'#body tr[id^="row_"]';expect(await page.locator(selector).evaluateAll(rows=>rows.map(r=>r.dataset.taskId||r.id.slice(4)))).toContain('OPEN');expect(await page.locator(selector).evaluateAll(rows=>rows.map(r=>r.dataset.taskId||r.id.slice(4)))).not.toContain('CLOSED');
    await page.evaluate(()=>setView('done'));expect(await page.locator(selector).evaluateAll(rows=>rows.map(r=>r.dataset.taskId||r.id.slice(4)))).toContain('CLOSED');
  }
  await expect(page.locator('.doneBtn').first()).toHaveAttribute('title','再オープン');await expect(page.locator('#shortcutHelp')).toContainText('Delete＝終了／再オープン');
  await expect(page.locator('#doneBulkToolbar')).toContainText('終了済みタスク');
});

test('PBL023-I PBL-025 visuals and PBL-024 Summary modal remain protected',async({page})=>{
  await boot(page,[task('P',{state:'完了',completed:true,summary:'parent'}),task('C',{parentId:'P',state:'完了',summary:'child'})],'team');
  const styles=await page.evaluate(()=>{const closed=document.querySelector('.ganttRow[data-task-id="P"]'),open=document.querySelector('.ganttRow[data-task-id="C"]');return{closedTitle:getComputedStyle(closed.querySelector('.ganttTaskTitle')).textDecorationLine,closedSummary:getComputedStyle(closed.querySelector('.sum span')).textDecorationLine,openSummary:getComputedStyle(open.querySelector('.sum span')).textDecorationLine}});
  expect(styles.closedTitle).toContain('line-through');expect(styles.closedSummary).not.toContain('line-through');expect(styles.openSummary).not.toContain('line-through');
  await page.locator('.ganttRow[data-task-id="C"] .sum').click();await expect(page.locator('.summaryModalPath')).toHaveText('P ＞ C');await expect(page.locator('.summaryModalPathCurrent')).toHaveText('C');await page.locator('#summaryModalCancel').click();
});

test('PBL023-J Task Detail Status completion stays Open and participates in one session Undo',async({page})=>{
  await boot(page,[task('A')]);await page.locator('#row_A .taskDetailOpenBtn').click();await page.locator('#taskDetailPane select[aria-label="ステータス"]').selectOption('完了');
  expect(await snapshot(page,'A')).toMatchObject({state:'完了',completed:false});expect((await snapshot(page,'A')).actual_end).toBeTruthy();
  await page.locator('.taskDetailPaneClose').click();expect(await page.evaluate(()=>undoStack.length)).toBe(1);await page.evaluate(()=>performUndo());expect(await snapshot(page,'A')).toMatchObject({state:'未着手',completed:false});
  await expect(page.locator('#taskDetailPane .doneBtn')).toHaveCount(0);
});

test('PBL023-K PBL-017 geometry and Schema/persistence remain exact',async({page})=>{
  await boot(page,[task('A')]);expect(await page.evaluate(()=>({schema:CURRENT_SCHEMA_VERSION,todo:[DEF.impact,DEF.title],project:[PROJECT_COL_DEFAULTS.impact,PROJECT_COL_DEFAULTS.title],fields:Object.keys(persistableData().items[0]).filter(k=>['state','completed'].includes(k)).sort()}))).toEqual({schema:'2.5',todo:[56,424],project:[56,424],fields:['completed','state']});
  const labels=(await page.locator('#head th').allTextContents()).map(x=>x.trim());expect(labels).toContain('優先度');expect(labels).toContain('終了');
});

test('PBL023-L 終了 terminology is complete, compact, and keeps Status 完了 distinct',async({page})=>{
  await boot(page,[task('OPEN'),task('CLOSED',{state:'完了',completed:true,sortOrder:2000})]);await page.evaluate(()=>setView('all'));
  await expect(page.locator('#row_OPEN .doneBtn')).toHaveAttribute('title','終了する');await expect(page.locator('#row_OPEN .doneBtn')).toHaveAttribute('aria-label','OPENを終了する');
  await expect(page.locator('#row_CLOSED .doneBtn')).toHaveAttribute('title','再オープン');
  const todo=await page.locator('#head th').first().evaluate(el=>({width:el.getBoundingClientRect().width,text:el.textContent.trim()}));expect(todo.text).toBe('終了');expect(todo.width).toBeGreaterThanOrEqual(30);expect(todo.width).toBeLessThanOrEqual(32);
  await page.evaluate(()=>setMode('team'));await expect(page.locator('.ganttRow[data-task-id="OPEN"] .ganttState select option')).toContainText(['未着手','進行中','完了','保留','中止']);const project=await page.locator('.ganttHeader th[data-c="done"]').evaluate(el=>({width:el.getBoundingClientRect().width,text:el.textContent.trim()}));expect(project.text).toBe('終了');expect(project.width).toBeGreaterThanOrEqual(30);expect(project.width).toBeLessThanOrEqual(32);
  await expect(page.locator('body')).not.toContainText('クローズ');expect(await page.evaluate(()=>({todo:widths.done,project:PROJECT_COL_DEFAULTS.done,button:document.querySelector('.doneBtn').getBoundingClientRect().width}))).toEqual({todo:31,project:31,button:20});
});
