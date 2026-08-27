const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
function task(id,extra={}){return{id,parentId:'',title:id,state:'',owner:'',due:'2026-08-28',planned_duration_days:5,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra}}
async function boot(page,items,mode='personal'){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(({items,mode})=>{applyJsonObject({schema_version:'2.2',items},'Final detail','final-detail.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);clearUndoHistory('final-detail');dirty=false},{items,mode})}
const pane=page=>page.locator('#taskDetailPane');
async function open(page,id){await page.evaluate(id=>openTaskDetailPane(id),id);await expect(pane(page)).toBeVisible()}

for(const [width,compact,minMain] of [[1366,false,800],[1200,false,650],[1100,true,590],[1000,true,540]])test(`DETAIL-BFINAL-WIDTH-${width} final responsive geometry`,async({page})=>{
  await page.setViewportSize({width,height:760});await boot(page,[task('A')]);await open(page,'A');const g=await pane(page).evaluate(el=>{const r=el.getBoundingClientRect();return{width:r.width,left:r.left,schedule:getComputedStyle(el.querySelector('.taskDetailSchedule')).gridTemplateColumns.split(' ').length,relation:getComputedStyle(el.querySelector('.taskDetailRelationRow')).gridTemplateColumns.split(' ').length}});
  expect(g.left).toBeGreaterThanOrEqual(minMain);expect(g.width).toBeLessThan(width*.65);expect(g.schedule).toBe(compact?3:4);expect(g.relation).toBe(compact?2:3);expect(await page.evaluate(()=>({undo:undoStack.length,dirty}))).toEqual({undo:0,dirty:false})
});

test('DETAIL-BFINAL-RESIZE presentation-only resize preserves data, selection and Undo',async({page})=>{
  await page.setViewportSize({width:1366,height:760});await boot(page,[task('A')]);await open(page,'A');const before=await page.evaluate(()=>({data:JSON.stringify(data),id:selectedTaskId,undo:undoStack.length,dirty}));await page.setViewportSize({width:1000,height:760});await page.waitForTimeout(50);expect(await page.evaluate(()=>({data:JSON.stringify(data),id:selectedTaskId,undo:undoStack.length,dirty}))).toEqual(before)
});

test('DETAIL-BFINAL-SCROLL-01 reopen same or different task always starts at top',async({page})=>{
  const items=[task('A'),task('B',{sortOrder:2000}),...Array.from({length:28},(_,i)=>task(`C${i}`,{parentId:'A',sortOrder:3000+i}))];await page.setViewportSize({width:1200,height:600});await boot(page,items);await open(page,'A');expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop})).toBeGreaterThan(0);await pane(page).locator('.taskDetailPaneClose').click();await open(page,'A');expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(0);await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop=el.scrollHeight);await pane(page).locator('.taskDetailPaneClose').click();await open(page,'B');expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(0)
});

test('DETAIL-BFINAL-SCROLL-02 rerender and field commit while open preserve scroll',async({page})=>{
  const items=[task('A'),...Array.from({length:28},(_,i)=>task(`C${i}`,{parentId:'A',sortOrder:2000+i}))];await page.setViewportSize({width:1200,height:600});await boot(page,items);await open(page,'A');const result=await page.evaluate(()=>{const body=taskDetailPane.querySelector('.taskDetailPaneBody');body.scrollTop=Math.min(180,body.scrollHeight-body.clientHeight);const before=body.scrollTop;renderTaskDetailPane();const afterRender=body.scrollTop;const input=taskDetailPane.querySelector('[aria-label="概要"]');input.value='edited';taskDetailCommitText('summary',input);return{before,afterRender,afterEdit:body.scrollTop,summary:itemById('A').summary}});expect(result.before).toBeGreaterThan(0);expect(result.afterRender).toBe(result.before);expect(result.afterEdit).toBe(result.before);expect(result.summary).toBe('edited')
});

test('DETAIL-BFINAL3-UI-TODO visible ToDo detail controls reset A to B pane scroll',async({page})=>{
  const items=['A','B'].flatMap((id,n)=>[task(id,{sortOrder:10000*n+1000}),...Array.from({length:24},(_,i)=>task(`${id}${i}`,{parentId:id,sortOrder:10000*n+2000+i}))]);await page.setViewportSize({width:1200,height:600});await boot(page,items);await page.locator('#row_A .taskDetailOpenBtn').click();const before=await pane(page).locator('.taskDetailPaneBody').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop});expect(before).toBeGreaterThan(0);await page.locator('#row_B .taskDetailOpenBtn').click();expect(await pane(page).getByLabel('タイトル').inputValue()).toBe('B');expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(0);expect(await page.evaluate(()=>({undo:undoStack.length,dirty}))).toEqual({undo:0,dirty:false})
});

test('DETAIL-BFINAL3-UI-PROJECT visible Project selection/follow resets A to B pane scroll',async({page})=>{
  const items=['A','B'].flatMap((id,n)=>[task(id,{sortOrder:10000*n+1000}),...Array.from({length:24},(_,i)=>task(`${id}${i}`,{parentId:id,sortOrder:10000*n+2000+i}))]);await page.setViewportSize({width:1200,height:600});await boot(page,items,'team');await page.locator('#ganttView .ganttRow[data-task-id="A"] .taskDetailOpenBtn').click();const before=await pane(page).locator('.taskDetailPaneBody').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop});expect(before).toBeGreaterThan(0);await page.locator('#ganttView .ganttRow[data-task-id="B"] .ganttTaskTitle').click();expect(await pane(page).getByLabel('タイトル').inputValue()).toBe('B');expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(0);expect(await page.evaluate(()=>({undo:undoStack.length,dirty}))).toEqual({undo:0,dirty:false})
});

test('DETAIL-BFINAL2-SCROLL-01 open pane base A to B/C resets only local pane scroll',async({page})=>{
  const roots=['A','B','C'],items=roots.flatMap((id,n)=>[task(id,{sortOrder:10000*n+1000}),...Array.from({length:24},(_,i)=>task(`${id}${i}`,{parentId:id,sortOrder:10000*n+2000+i}))]);await page.setViewportSize({width:1200,height:600});await boot(page,items);await open(page,'A');for(const id of ['B','C']){const before=await pane(page).locator('.taskDetailPaneBody').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop});expect(before).toBeGreaterThan(0);await page.evaluate(id=>openTaskDetailPane(id),id);expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(0);expect(await page.evaluate(()=>taskDetailPaneTaskId)).toBe(id)}expect(await page.evaluate(()=>({undo:undoStack.length,redo:redoStack.length,dirty}))).toEqual({undo:0,redo:0,dirty:false})
});

test('DETAIL-BFINAL2-SCROLL-02 same base edit and ToDo/Project mode switches preserve scroll',async({page})=>{
  const items=[task('A'),...Array.from({length:28},(_,i)=>task(`C${i}`,{parentId:'A',sortOrder:2000+i}))];await page.setViewportSize({width:1200,height:600});await boot(page,items);await open(page,'A');const initial=await pane(page).locator('.taskDetailPaneBody').evaluate(el=>{el.scrollTop=Math.min(180,el.scrollHeight-el.clientHeight);return el.scrollTop});expect(initial).toBeGreaterThan(0);await page.evaluate(()=>setMode('team'));expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(initial);await page.evaluate(()=>setMode('personal'));expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(initial);await pane(page).getByLabel('概要').fill('same base');await pane(page).getByLabel('概要').blur();expect(await pane(page).locator('.taskDetailPaneBody').evaluate(el=>el.scrollTop)).toBe(initial);expect(await page.evaluate(()=>taskDetailPaneTaskId)).toBe('A')
});

test('DETAIL-BFINAL2-UNDO base switch is a boundary but creates no history itself',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);await open(page,'A');await pane(page).getByLabel('タイトル').fill('A1');await pane(page).getByLabel('タイトル').blur();expect(await page.evaluate(()=>undoStack.length)).toBe(1);await page.evaluate(()=>openTaskDetailPane('B'));expect(await page.evaluate(()=>({length:undoStack.length,ids:undoStack.map(x=>x.taskId),base:taskDetailPaneTaskId}))).toEqual({length:1,ids:['A'],base:'B'});await pane(page).getByLabel('担当').fill('Owner B');await pane(page).getByLabel('担当').blur();expect(await page.evaluate(()=>({length:undoStack.length,ids:undoStack.map(x=>x.taskId)}))).toEqual({length:2,ids:['A','B']})
});

test('DETAIL-BFINAL-ACTUAL-01 no legacy Actual button; pane direct edit and grouped Undo remain',async({page})=>{
  await boot(page,[task('A')],'team');expect(await page.locator('.actualEditBtn').count()).toBe(0);await page.evaluate(()=>setProjectView('gantt'));expect(await page.locator('.actualEditBtn').count()).toBe(0);await open(page,'A');const input=pane(page).getByRole('textbox',{name:'実績開始',exact:true});await input.fill('2026/08/26');await input.press('Enter');expect(await page.evaluate(()=>({value:itemById('A').actual_start,undo:undoStack.length,count:undoStack[0]?.detailActionCount}))).toEqual({value:'2026-08-26',undo:1,count:1});await pane(page).locator('.taskDetailPaneClose').click();await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('A').actual_start||'')).toBe('')
});

test('DETAIL-BFINAL-ACTUAL-02 status auto dates and Gantt actual line remain',async({page})=>{
  await boot(page,[task('A')],'team');await open(page,'A');await pane(page).getByLabel('ステータス').selectOption('進行中');expect(await page.evaluate(()=>({state:itemById('A').state,start:itemById('A').actual_start,today:ymd()}))).toEqual({state:'進行中',start:await page.evaluate(()=>ymd()),today:await page.evaluate(()=>ymd())});await page.evaluate(()=>setProjectView('gantt'));await expect(page.locator('#ganttView .ganttRow[data-task-id="A"] .actualLine,#ganttView .ganttRow[data-task-id="A"] .actualPoint')).toHaveCount(1);expect(await page.locator('.actualEditBtn').count()).toBe(0)
});

test('DETAIL-BFINAL-MISSING-01 missing-plan label is hidden without changing schedule or due-only behavior',async({page})=>{
  await boot(page,[task('NONE',{due:'',planned_duration_days:null}),task('DUE',{due:'2026-08-30',planned_duration_days:null,sortOrder:2000})],'team');const before=await page.evaluate(()=>JSON.stringify(data.items));await page.evaluate(()=>setProjectView('gantt'));await expect(page.locator('.ganttMissing:visible')).toHaveCount(0);await expect(page.locator('#ganttView .ganttRow[data-task-id="NONE"] .ganttBar,#ganttView .ganttRow[data-task-id="NONE"] .ganttMilestone,#ganttView .ganttRow[data-task-id="NONE"] .ganttDueOnlyMarker')).toHaveCount(0);await expect(page.locator('#ganttView .ganttRow[data-task-id="DUE"] .ganttBar,#ganttView .ganttRow[data-task-id="DUE"] .ganttMilestone')).toHaveCount(0);await expect(page.locator('#ganttView .ganttRow[data-task-id="DUE"] .ganttDueOnlyMarker')).toHaveCount(1);expect(await page.evaluate(()=>({items:JSON.stringify(data.items),dueDate:itemById('DUE').due,undo:undoStack.length,dirty}))).toEqual({items:before,dueDate:'2026-08-30',undo:0,dirty:false})
});

test('DETAIL-BFINAL-TOP Task Detail suppression and restoration are unchanged',async({page})=>{
  await boot(page,[task('A')]);await page.evaluate(()=>{Object.defineProperty(window,'scrollY',{value:500,writable:true});syncBackToTop()});await expect(page.locator('#backToTopBtn')).toBeVisible();await open(page,'A');await expect(page.locator('#backToTopBtn')).toBeHidden();await pane(page).locator('.taskDetailPaneClose').click();await expect(page.locator('#backToTopBtn')).toBeVisible()
});
