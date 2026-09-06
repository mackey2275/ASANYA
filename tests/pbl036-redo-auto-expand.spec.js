const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,parentId='',extra={})=>({id,parentId,title:id,state:'未着手',owner:'',due:'2026-09-20',planned_duration_days:2,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:1,...extra});
async function boot(page,items,display='project-detail'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,display})=>{applyJsonObject({schema_version:'3.1',workspace_info_markdown:'',items},'pbl036-followup','pbl036-followup.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(display);clearUndoHistory('pbl036-followup');dirty=false},{items,display});
}
const disclosure=(page,id)=>page.locator(`.ganttRow[data-task-id="${id}"] .projectHierarchyDisclosure`);

test('PBL036-REDO exact deferred sequence expands destination and reveals moved subtree',async({page})=>{
  await boot(page,[task('A'),task('B','A'),task('C','B'),task('X','',{sortOrder:2000}),task('Y','X')]);
  await disclosure(page,'B').click();await disclosure(page,'X').click();
  await page.locator('.ganttRow[data-task-id="B"] .taskDetailOpenBtn').click();
  await page.locator('#taskDetailPane').getByRole('button',{name:'親を変更'}).click();
  await page.locator('.ganttRow[data-task-id="X"] .ganttTaskTitle').click();
  await page.locator('#taskDetailPane').getByRole('button',{name:'変更',exact:true}).click();
  await page.locator('#taskDetailPane .taskDetailPaneClose').click();
  await expect(page.locator('.ganttRow[data-task-id="B"]')).toBeVisible();expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('X'))).toBe(false);
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('B').parentId)).toBe('A');await disclosure(page,'X').click();expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('X'))).toBe(true);
  await page.keyboard.press('Control+y');expect(await page.evaluate(()=>({parent:itemById('B').parentId,destinationCollapsed:pbl036CollapsedTaskIds.has('X'),movedCollapsed:pbl036CollapsedTaskIds.has('B')}))).toEqual({parent:'X',destinationCollapsed:false,movedCollapsed:true});await expect(page.locator('.ganttRow[data-task-id="B"]')).toBeVisible();await expect(page.locator('.ganttRow[data-task-id="C"]')).toHaveCount(0);
  await page.evaluate(()=>setDisplayMode('project-simple'));await expect(page.locator('.ganttRow[data-task-id="B"]')).toBeVisible();expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('X'))).toBe(false)
});

test('PBL036-REDO-NOOP rejected reparent and unavailable Redo preserve collapse state',async({page})=>{
  await boot(page,[task('M','',{state:'メモ'}),task('MC','M',{state:'メモ'}),task('A','',{sortOrder:2000})]);await disclosure(page,'M').click();const before=await page.evaluate(()=>({undo:undoStack.length,redo:redoStack.length}));expect((await page.evaluate(()=>reassignTaskParent('A','M'))).ok).toBe(false);expect(await page.evaluate(()=>({collapsed:pbl036CollapsedTaskIds.has('M'),undo:undoStack.length,redo:redoStack.length}))).toEqual({collapsed:true,...before});expect(await page.evaluate(()=>performRedo())).toBe(false);expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('M'))).toBe(true)
});

test('PBL036-REDO-MEMO valid Memo reparent Redo expands normal destination',async({page})=>{
  await boot(page,[task('M','',{state:'メモ'}),task('X','',{sortOrder:2000}),task('Y','X')]);await disclosure(page,'X').click();expect((await page.evaluate(()=>reassignTaskParent('M','X'))).ok).toBe(true);await page.evaluate(()=>performUndo());await disclosure(page,'X').click();expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('X'))).toBe(true);expect(await page.evaluate(()=>performRedo())).toBe(true);expect(await page.evaluate(()=>({parent:itemById('M').parentId,state:itemById('M').state,collapsed:pbl036CollapsedTaskIds.has('X')}))).toEqual({parent:'X',state:'メモ',collapsed:false});await expect(page.locator('.ganttRow[data-task-id="M"]')).toBeVisible()
});

test('PBL036-REDO-RUNTIME auto-expand adds no history, dirty, persistence, selection, or Detail side effects',async({page})=>{
  await boot(page,[task('A'),task('B','A'),task('X','',{sortOrder:2000}),task('Y','X')]);await page.evaluate(()=>openTaskDetailPane('B'));await disclosure(page,'X').click();await page.evaluate(()=>reassignTaskParent('B','X'));await page.evaluate(()=>performUndo());await disclosure(page,'X').click();const before=await page.evaluate(()=>({undo:undoStack.length,redo:redoStack.length,selected:selectedTaskId,detail:taskDetailPaneTaskId,open:taskDetailPaneOpen,json:JSON.stringify(persistableData())}));await page.evaluate(()=>performRedo());const after=await page.evaluate(()=>({undo:undoStack.length,redo:redoStack.length,selected:selectedTaskId,detail:taskDetailPaneTaskId,open:taskDetailPaneOpen,json:JSON.stringify(persistableData()),parent:itemById('B').parentId,collapsed:pbl036CollapsedTaskIds.has('X')}));expect(after).toMatchObject({undo:before.undo+1,redo:before.redo-1,selected:before.selected,detail:before.detail,open:before.open,parent:'X',collapsed:false});expect(JSON.parse(after.json).items.find(x=>x.id==='B').parentId).toBe('X')
});

test('PBL036-HISTORY-CLOSE Undo returns a closed child visibly through its collapsed ancestor',async({page})=>{
  await boot(page,[task('A'),task('B','A'),task('S','A',{sortOrder:2000}),task('U','',{sortOrder:3000}),task('V','U')]);
  await page.evaluate(()=>setView('open'));
  await page.locator('.ganttRow[data-task-id="B"] .doneBtn').click();
  await expect(page.locator('.ganttRow[data-task-id="B"]')).toHaveCount(0);
  await disclosure(page,'A').click();
  await disclosure(page,'U').click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>({action:redoStack.at(-1)?.actionType,closed:itemById('B').completed,ancestorCollapsed:pbl036CollapsedTaskIds.has('A'),unrelatedCollapsed:pbl036CollapsedTaskIds.has('U')}))).toEqual({action:'close_task',closed:false,ancestorCollapsed:false,unrelatedCollapsed:true});
  await expect(page.locator('.ganttRow[data-task-id="B"]')).toBeVisible();
  await expect(page.locator('.ganttRow[data-task-id="V"]')).toHaveCount(0);
});

test('PBL036-REDO-PATH expands every required ancestor but preserves the moved root collapse',async({page})=>{
  await boot(page,[task('A'),task('B','A'),task('K','B'),task('M','',{sortOrder:3000}),task('N','M')]);
  await disclosure(page,'M').click();
  expect((await page.evaluate(()=>reassignTaskParent('M','B'))).ok).toBe(true);
  await page.keyboard.press('Control+z');
  await disclosure(page,'B').click();
  await disclosure(page,'A').click();
  await page.keyboard.press('Control+y');
  expect(await page.evaluate(()=>({parent:itemById('M').parentId,a:pbl036CollapsedTaskIds.has('A'),b:pbl036CollapsedTaskIds.has('B'),m:pbl036CollapsedTaskIds.has('M')}))).toEqual({parent:'B',a:false,b:false,m:true});
  await expect(page.locator('.ganttRow[data-task-id="M"]')).toBeVisible();
  await expect(page.locator('.ganttRow[data-task-id="N"]')).toHaveCount(0);
});

test('PBL036-HISTORY-REOPEN Undo returns a reopened child visibly in the closed Project view',async({page})=>{
  await boot(page,[task('A'),task('B','A',{state:'完了',completed:true}),task('S','A',{state:'完了',completed:true,sortOrder:2000})]);
  await page.evaluate(()=>setView('done'));
  await page.locator('.ganttRow[data-task-id="B"] .doneBtn').click();
  await expect(page.locator('.ganttRow[data-task-id="B"]')).toHaveCount(0);
  await disclosure(page,'A').click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>({action:redoStack.at(-1)?.actionType,closed:itemById('B').completed,collapsed:pbl036CollapsedTaskIds.has('A')}))).toEqual({action:'reopen_task',closed:true,collapsed:false});
  await expect(page.locator('.ganttRow[data-task-id="B"]')).toBeVisible();
});

test('PBL036-HISTORY-FILTER does not expand when the affected task remains filter-excluded',async({page})=>{
  await boot(page,[task('A','',{owner:'other'}),task('B','A',{owner:'excluded'}),task('S','A',{owner:'keep',sortOrder:2000})]);
  await page.evaluate(()=>setView('open'));
  await page.locator('.ganttRow[data-task-id="B"] .doneBtn').click();
  await page.evaluate(()=>{ownerFilterValues=new Set(['keep']);render()});
  await disclosure(page,'A').click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>({closed:itemById('B').completed,collapsed:pbl036CollapsedTaskIds.has('A')}))).toEqual({closed:false,collapsed:true});
  await expect(page.locator('.ganttRow[data-task-id="B"]')).toHaveCount(0);
});

test('PBL036-HISTORY-CREATE Insert child Redo reveals the recreated row through current collapsed ancestors',async({page})=>{
  await boot(page,[task('A'),task('OLD','A'),task('X','',{sortOrder:3000}),task('Y','X')]);
  await page.locator('.ganttRow[data-task-id="A"] .ganttTaskTitle').click();
  await page.locator('#kpis').click();
  expect(await page.evaluate(()=>selectedTaskId)).toBe('A');
  await page.keyboard.press('Insert');
  const childId=await page.evaluate(()=>draftTaskId),row=page.locator(`.ganttRow[data-task-id="${childId}"]`);
  await row.locator('.titleText').fill('B');
  await row.locator('.titleText').press('Enter');
  await row.locator('input[type="text"]').fill('2026-09-21');
  await row.locator('input[type="text"]').press('Enter');
  await expect.poll(()=>page.evaluate(()=>draftTaskId)).toBe('');
  expect(await page.evaluate(id=>({action:undoStack.at(-1)?.actionType,primary:undoStack.at(-1)?.taskId,parent:itemById(id)?.parentId}),childId)).toEqual({action:'create_task',primary:childId,parent:'A'});
  await page.keyboard.press('Control+z');
  await expect(page.locator(`.ganttRow[data-task-id="${childId}"]`)).toHaveCount(0);
  await disclosure(page,'A').click();
  await disclosure(page,'X').click();
  await page.keyboard.press('Control+y');
  expect(await page.evaluate(id=>({exists:!!itemById(id),parent:itemById(id)?.parentId,a:pbl036CollapsedTaskIds.has('A'),x:pbl036CollapsedTaskIds.has('X')}),childId)).toEqual({exists:true,parent:'A',a:false,x:true});
  await expect(page.locator(`.ganttRow[data-task-id="${childId}"]`)).toBeVisible();
  await expect(page.locator('.ganttRow[data-task-id="Y"]')).toHaveCount(0);
});

test('PBL036-HISTORY-CREATE-PATH recreated grandchild expands the full ancestor path',async({page})=>{
  await boot(page,[task('A'),task('B','A'),task('OLD','B')]);
  await page.locator('.ganttRow[data-task-id="B"] .ganttTaskTitle').click();
  await page.locator('#kpis').click();
  await page.keyboard.press('Insert');
  const childId=await page.evaluate(()=>draftTaskId),row=page.locator(`.ganttRow[data-task-id="${childId}"]`);
  await row.locator('.titleText').fill('C');await row.locator('.titleText').press('Enter');await row.locator('input[type="text"]').fill('');await row.locator('input[type="text"]').press('Enter');
  await page.keyboard.press('Control+z');
  await disclosure(page,'B').click();await disclosure(page,'A').click();
  await page.keyboard.press('Control+y');
  expect(await page.evaluate(()=>({a:pbl036CollapsedTaskIds.has('A'),b:pbl036CollapsedTaskIds.has('B')}))).toEqual({a:false,b:false});
  await expect(page.locator(`.ganttRow[data-task-id="${childId}"]`)).toBeVisible();
});

test('PBL036-HISTORY-CREATE-MEMO recreated Memo child uses the same Project reveal path',async({page})=>{
  await boot(page,[task('M','',{state:'メモ'}),task('OLD','M',{state:'メモ'})]);
  await page.locator('.ganttRow[data-task-id="M"] .ganttTaskTitle').click();
  await page.locator('#kpis').click();
  await page.keyboard.press('Insert');
  const childId=await page.evaluate(()=>draftTaskId),row=page.locator(`.ganttRow[data-task-id="${childId}"]`);
  await row.locator('.titleText').fill('MEMO-C');await row.locator('.titleText').press('Enter');await row.locator('input[type="text"]').fill('');await row.locator('input[type="text"]').press('Enter');
  await page.keyboard.press('Control+z');await disclosure(page,'M').click();await page.keyboard.press('Control+y');
  expect(await page.evaluate(id=>({state:itemById(id)?.state,collapsed:pbl036CollapsedTaskIds.has('M')}),childId)).toEqual({state:'メモ',collapsed:false});
  await expect(page.locator(`.ganttRow[data-task-id="${childId}"]`)).toBeVisible();
});
