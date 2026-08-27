const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
function task(id,extra={}){return{id,parentId:'',title:id,state:'',owner:'',due:'2026-08-20',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra}}
async function boot(page,items,mode='personal',projectView='list'){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(({items,mode,projectView})=>{applyJsonObject({schema_version:'2.2',workspace_info_markdown:'Phase B',items},'Phase B','phase-b.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);if(mode==='team')setProjectView(projectView);clearUndoHistory('phase-b');dirty=false},{items,mode,projectView})}
function row(page,id){return page.locator(`#ganttView .ganttRow[data-task-id="${id}"],#row_${id}`).first()}
function pane(page){return page.locator('#taskDetailPane')}
async function open(page,id){await row(page,id).locator('.taskDetailOpenBtn').click();await expect(pane(page)).toBeVisible()}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>queueMicrotask(resolve)))}

test('DETAIL-B-ACTUAL-01 direct Actual edits form one Task Detail Undo/Redo group',async({page})=>{
  await boot(page,[task('A',{actual_start:'2026-08-01',actual_end:'2026-08-03',actual_start_source:'system',actual_end_source:'system'})]);await open(page,'A');
  const start=pane(page).getByRole('textbox',{name:'実績開始',exact:true}),end=pane(page).getByRole('textbox',{name:'実績終了',exact:true});await start.fill('2026/08/02');await start.press('Enter');await end.fill('2026/08/04');await end.press('Enter');await settle(page);
  expect(await page.evaluate(()=>({start:itemById('A').actual_start,end:itemById('A').actual_end,ss:itemById('A').actual_start_source,es:itemById('A').actual_end_source,undo:undoStack.length,count:undoStack[0]?.detailActionCount,mode:taskDetailViewMode,open:taskDetailPaneOpen}))).toEqual({start:'2026-08-02',end:'2026-08-04',ss:'user',es:'user',undo:1,count:2,mode:'detail',open:true});
  await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('A').actual_start)).toBe('2026-08-01');await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>itemById('A').actual_start)).toBe('2026-08-02');
});

test('DETAIL-B-ACTUAL-02 authoritative validation is preserved on direct fields',async({page})=>{
  const messages=[];page.on('dialog',async d=>{messages.push(d.message());await d.dismiss()});await boot(page,[task('A',{state:'進行中',actual_start:'2026-08-02',actual_start_source:'system'}),task('B',{state:'完了',completed:true,actual_start:'2026-08-01',actual_end:'2026-08-02'})]);await open(page,'A');const start=pane(page).getByRole('textbox',{name:'実績開始',exact:true}),end=pane(page).getByRole('textbox',{name:'実績終了',exact:true});await start.fill('');await start.press('Enter');await expect.poll(()=>messages.length).toBe(1);expect(messages[0]).toContain('進行中');
  await start.fill('2026/08/05');await start.press('Enter');await end.fill('2026/08/04');await end.press('Enter');await expect.poll(()=>messages.length).toBe(2);expect(messages[1]).toContain('実績開始以降');
});

test('DETAIL-B-PARENT-01 visible row candidate, explicit Change and Undo preserve subtree',async({page})=>{
  await boot(page,[task('P'),task('Q',{sortOrder:2000}),task('A',{parentId:'P',sortOrder:1000}),task('K',{parentId:'A'})]);await open(page,'A');await pane(page).getByRole('button',{name:'親を変更'}).click();
  await row(page,'Q').locator('.doneBtn').click();expect(await page.evaluate(()=>({candidate:pblParentSelectedId,parent:itemById('A').parentId,undo:undoStack.length}))).toEqual({candidate:'Q',parent:'P',undo:0});await expect(row(page,'Q')).toHaveClass(/parentCandidateRow/);
  await pane(page).getByRole('button',{name:'変更'}).click();await settle(page);expect(await page.evaluate(()=>({parent:itemById('A').parentId,child:itemById('K').parentId,undo:undoStack.length,mode:taskDetailViewMode}))).toEqual({parent:'Q',child:'A',undo:1,mode:'detail'});await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('A').parentId)).toBe('P');await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>itemById('A').parentId)).toBe('Q');
});

test('DETAIL-B-PARENT-02 self/descendant/current invalid and Cancel cleans highlights',async({page})=>{
  await boot(page,[task('P'),task('A',{parentId:'P'}),task('K',{parentId:'A'})]);await open(page,'A');await pane(page).getByRole('button',{name:'親を変更'}).click();await row(page,'K').locator('.doneBtn').click();expect(await page.evaluate(()=>pblParentSelectedId)).toBe('P');await row(page,'A').locator('.doneBtn').click();expect(await page.evaluate(()=>pblParentSelectedId)).toBe('P');
  await row(page,'P').locator('.doneBtn').click();expect(await page.evaluate(()=>pblParentSelectedId)).toBe('P');await pane(page).getByRole('button',{name:'キャンセル'}).click();expect(await page.evaluate(()=>({parent:itemById('A').parentId,undo:undoStack.length,mode:taskDetailViewMode,candidate:pblParentSelectedId}))).toEqual({parent:'P',undo:0,mode:'detail',candidate:null});await expect(page.locator('.parentCandidateRow')).toHaveCount(0);
  await expect(page.locator('#pblParentPickerBack')).toBeHidden();
});

test('DETAIL-B-DEP-01 Project predecessor/successor add supports search and row candidate with one Undo',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000}),task('C',{sortOrder:3000})],'team','list');await open(page,'A');await pane(page).getByRole('button',{name:'＋ 前工程'}).click();await row(page,'B').locator('.ganttTaskTitle').click();expect(await page.evaluate(()=>({candidate:relationSelectedTaskId,deps:itemById('A').dependencies.length}))).toEqual({candidate:'B',deps:0});await pane(page).getByRole('button',{name:'追加'}).click();await settle(page);expect(await page.evaluate(()=>({dep:itemById('A').dependencies[0],undo:undoStack.length,mode:taskDetailViewMode}))).toEqual({dep:{task_id:'B',type:'finish_to_start'},undo:1,mode:'detail'});
  await pane(page).getByRole('button',{name:'＋ 後工程'}).click();await row(page,'C').locator('.ganttTaskTitle').click();await pane(page).locator('.taskDetailDepSelect').selectOption('finish_to_finish');await pane(page).getByRole('button',{name:'追加'}).click();await settle(page);expect(await page.evaluate(()=>itemById('C').dependencies)).toContainEqual({task_id:'A',type:'finish_to_finish'});expect(await page.evaluate(()=>({undo:undoStack.length,count:undoStack[0]?.detailActionCount}))).toEqual({undo:1,count:2});
});

test('DETAIL-B-DEP-02 duplicate/self/cycle reject and type/delete each create one Undo',async({page})=>{
  const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});await boot(page,[task('A',{dependencies:[{task_id:'B',type:'finish_to_start'}]}),task('B'),task('C',{dependencies:[{task_id:'A',type:'finish_to_finish'}]})],'team','list');await open(page,'A');
  expect(await page.evaluate(()=>dependencyAddCore('B','A','finish_to_finish').ok)).toBe(false);expect(await page.evaluate(()=>dependencyAddCore('A','A','finish_to_start').ok)).toBe(false);expect(await page.evaluate(()=>dependencyAddCore('C','A','finish_to_start').ok)).toBe(false);await expect.poll(()=>dialogs.length).toBe(1);expect(await page.evaluate(()=>undoStack.length)).toBe(0);
  await pane(page).locator('.taskDetailRelationControls').first().getByRole('button',{name:'変更',exact:true}).click();await pane(page).locator('.taskDetailDepSelect').selectOption('finish_to_finish');await pane(page).getByRole('button',{name:'変更',exact:true}).click();await settle(page);expect(await page.evaluate(()=>({type:itemById('A').dependencies[0].type,undo:undoStack.length}))).toEqual({type:'finish_to_finish',undo:1});await pane(page).locator('.taskDetailRelationControls').first().getByRole('button',{name:'削除',exact:true}).click();await settle(page);expect(await page.evaluate(()=>({deps:itemById('A').dependencies.length,undo:undoStack.length,count:undoStack[0]?.detailActionCount}))).toEqual({deps:0,undo:1,count:2});await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('A').dependencies[0].type)).toBe('finish_to_start');
});

test('DETAIL-B-DEP-03 ToDo supports the same direct dependency editing path',async({page})=>{
  await boot(page,[task('A',{dependencies:[{task_id:'B',type:'finish_to_start'}]}),task('B')]);await open(page,'A');await expect(pane(page).getByRole('button',{name:'＋ 前工程'})).toBeVisible();await expect(pane(page).getByRole('button',{name:'＋ 後工程'})).toBeVisible();expect(await page.evaluate(()=>mode)).toBe('personal');
});

test('DETAIL-B-STATE-01 task switch, pane close, and DB switch discard temporary state safely',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);await open(page,'A');await pane(page).getByRole('button',{name:'親を変更'}).click();await page.evaluate(()=>selectParentCandidate('B'));await page.evaluate(()=>hqa21SelectWithoutRender('B'));await expect(pane(page).getByLabel('タイトル')).toHaveValue('B');expect(await page.evaluate(()=>({mode:taskDetailViewMode,a:itemById('A').actual_start,undo:undoStack.length}))).toEqual({mode:'detail',a:undefined,undo:0});
  await pane(page).getByRole('button',{name:'親を変更'}).click();await pane(page).locator('.taskDetailPaneClose').click();expect(await page.evaluate(()=>({mode:taskDetailViewMode,parentTask:pblParentTaskId,open:taskDetailPaneOpen}))).toEqual({mode:'detail',parentTask:'',open:false});
  await open(page,'B');await pane(page).getByRole('button',{name:'親を変更'}).click();await page.evaluate(item=>applyJsonObject({schema_version:'2.2',items:[item]},'New','new.json',null,{remember:false,writePermissionGranted:false}),task('N'));expect(await page.evaluate(()=>({mode:taskDetailViewMode,id:taskDetailPaneTaskId,open:taskDetailPaneOpen}))).toEqual({mode:'detail',id:'',open:true});
});

test('DETAIL-B-SHORTCUT-01 native pane input editing is preserved without global shortcuts',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);await open(page,'A');const title=pane(page).getByLabel('タイトル');await title.fill('dDｄＤ09');await title.press('ArrowLeft');await title.press('Delete');expect(await title.inputValue()).toBe('dDｄＤ0');expect(await page.evaluate(()=>({items:data.items.length,selected:selectedTaskId,draft:draftTaskId,undo:undoStack.length}))).toEqual({items:2,selected:'A',draft:'',undo:0});
  await title.press('Escape');await page.evaluate(()=>{document.activeElement.blur();hqa21SelectWithoutRender('A')});await page.keyboard.press('ArrowDown');expect(await page.evaluate(()=>selectedTaskId)).toBe('B');
});

test('DETAIL-B-GANTT-01 overlay editing keeps timeline, outer, vertical, dock and width stable',async({page})=>{
  await page.setViewportSize({width:1366,height:800});await boot(page,[task('A'),task('B',{due:'2027-08-20',sortOrder:2000})],'team','gantt');await page.evaluate(()=>{setGanttTimelineScroll(300);document.getElementById('ganttView').scrollLeft=120;scrollTo(0,180)});const snap=()=>page.evaluate(()=>({timeline:ganttTimelineScrollLeft,outer:document.getElementById('ganttView').scrollLeft,y:scrollY,gantt:document.getElementById('ganttView').getBoundingClientRect().width})),before=await snap();await expect(page.locator('.ganttScrollDock')).toBeVisible();await open(page,'A');expect(await page.evaluate(()=>taskDetailPane.getBoundingClientRect().left)).toBeGreaterThanOrEqual(550);await pane(page).locator('.taskDetailPaneClose').click();await expect.poll(snap).toEqual(before);await expect(page.locator('.ganttScrollDock')).toBeVisible();
});
