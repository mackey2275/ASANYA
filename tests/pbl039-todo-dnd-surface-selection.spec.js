const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

function task(id,extra={}){return{id,parentId:'',title:id,state:'',owner:'',due:'',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra}}

async function boot(page,items,display='todo-tree',view='all'){
  await page.setViewportSize({width:1280,height:720});
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,display,view})=>{applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'PBL-039',items},'PBL-039','pbl039.json',null,{remember:false,writePermissionGranted:false});setView(view);setDisplayMode(display);clearUndoHistory('pbl039');dirty=false;saveState='saved'},{items,display,view});
}

async function projectThenTodo(page,display,view='all'){
  await page.evaluate(()=>setDisplayMode('project-detail'));
  await expect(page.locator('#ganttView .ganttRow[data-task-id]')).not.toHaveCount(0);
  await page.evaluate(({display,view})=>{setView(view);setDisplayMode(display);clearUndoHistory('pbl039-surface')},{display,view});
  await expect(page.locator('#ganttView')).toBeHidden();
}

const todoRow=(page,id)=>page.locator(`#row_${id}`);
const projectRow=(page,id)=>page.locator(`#ganttView .ganttRow[data-task-id="${id}"]`);
const groupOrder=(page,id)=>page.evaluate(id=>{const x=itemById(id);return moveGroup(data.items.indexOf(x)).map(p=>p.x.id)},id);

async function drag(page,source,target,{surface='todo',after=true}={}){
  const sourceRow=surface==='project'?projectRow(page,source):todoRow(page,source);
  const targetRow=surface==='project'?projectRow(page,target):todoRow(page,target);
  const handle=sourceRow.locator('.siblingDragHandle'),box=await handle.boundingBox(),targetBox=await targetRow.boundingBox();
  expect(box).not.toBeNull();expect(targetBox).not.toBeNull();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2+10,{steps:2});
  await page.mouse.move(targetBox.x+40,after?targetBox.y+targetBox.height-2:targetBox.y+2,{steps:6});await page.mouse.up();
}

test('PBL039-01 Project to ToDo Tree uses the visible ToDo surface and moves down',async({page})=>{
  await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})]);await projectThenTodo(page,'todo-tree');
  expect(await page.evaluate(()=>({gantt:!!document.querySelector('#ganttView .ganttRow[data-task-id="A"]'),rendered:pbl2RenderedRow('A')?.id}))).toEqual({gantt:true,rendered:'row_A'});
  await drag(page,'A','B');expect(await groupOrder(page,'A')).toEqual(['B','A']);
  expect(await page.evaluate(()=>({undo:undoStack.length,action:undoStack.at(-1)?.actionType,selected:selectedTaskId}))).toEqual({undo:1,action:'manual_order',selected:'A'});
});

test('PBL039-02 frozen reverse direction succeeds with stale same-ID Gantt rows',async({page})=>{
  await boot(page,[task('B',{sortOrder:1000}),task('A',{sortOrder:2000})]);await projectThenTodo(page,'todo-tree');
  await drag(page,'A','B',{after:false});expect(await groupOrder(page,'A')).toEqual(['A','B']);
  expect(await page.evaluate(()=>undoStack.length)).toBe(1);
});

test('PBL039-03 Project to ToDo Date uses the visible ToDo surface',async({page})=>{
  await boot(page,[task('A',{due:'2026-09-10',sortOrder:1000}),task('B',{due:'2026-09-10',sortOrder:2000})]);await projectThenTodo(page,'todo-date');
  expect(await page.evaluate(()=>({mode,sortMode,gantt:!!document.querySelector('#ganttView .ganttRow[data-task-id="B"]'),rendered:pbl2RenderedRow('B')?.id}))).toEqual({mode:'personal',sortMode:'date',gantt:true,rendered:'row_B'});
  await drag(page,'A','B');expect(await groupOrder(page,'A')).toEqual(['B','A']);
});

test('PBL039-04 same parent with a different Due remains rejected',async({page})=>{
  const items=[task('A',{due:'2026-09-10',sortOrder:1000}),task('C',{due:'2026-09-10',sortOrder:2000}),task('B',{due:'2026-09-11',sortOrder:3000})];
  await boot(page,items);await projectThenTodo(page,'todo-tree');const before=await page.evaluate(()=>JSON.stringify(data.items.map(x=>[x.id,x.parentId,x.due,x.sortOrder])));
  await drag(page,'A','B');expect(await page.evaluate(()=>({items:JSON.stringify(data.items.map(x=>[x.id,x.parentId,x.due,x.sortOrder])),undo:undoStack.length}))).toEqual({items:before,undo:0});
});

test('PBL039-05 Project sibling drag remains on the Project surface',async({page})=>{
  await boot(page,[task('A',{due:'2026-09-10',sortOrder:1000}),task('B',{due:'2026-09-10',sortOrder:2000})],'project-detail');
  expect(await page.evaluate(()=>({mode,rendered:pbl2RenderedRow('A')?.dataset.taskId}))).toEqual({mode:'team',rendered:'A'});
  await drag(page,'A','B',{surface:'project'});expect(await groupOrder(page,'A')).toEqual(['B','A']);expect(await page.evaluate(()=>undoStack.length)).toBe(1);
});

test('PBL039-06 repaired ToDo drag remains one Undo/Redo transaction',async({page})=>{
  await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})]);await projectThenTodo(page,'todo-tree');
  await drag(page,'A','B');expect(await groupOrder(page,'A')).toEqual(['B','A']);
  await page.evaluate(()=>performUndo());expect(await groupOrder(page,'A')).toEqual(['A','B']);
  await page.evaluate(()=>performRedo());expect(await groupOrder(page,'A')).toEqual(['B','A']);
  expect(await page.evaluate(()=>({undo:undoStack.length,redo:redoStack.length,action:undoStack.at(-1)?.actionType}))).toEqual({undo:1,redo:0,action:'manual_order'});
});

test('PBL039-07 hidden completed sibling stays in the group without owning ToDo geometry',async({page})=>{
  const items=[task('A',{sortOrder:1000}),task('C',{sortOrder:2000,completed:true,state:'完了'}),task('B',{sortOrder:3000})];
  await boot(page,items);await projectThenTodo(page,'todo-tree','open');
  await expect(todoRow(page,'C')).toHaveCount(0);expect(await groupOrder(page,'A')).toEqual(['A','C','B']);
  await drag(page,'A','B');expect(await groupOrder(page,'A')).toEqual(['C','B','A']);
});

test('PBL039-08 DB A to B to A keeps the current ToDo surface authoritative',async({page})=>{
  const dbA=[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})],dbB=[task('X',{sortOrder:1000}),task('Y',{sortOrder:2000})];
  await boot(page,dbA);await projectThenTodo(page,'todo-tree');
  await page.evaluate(items=>applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,items},'DB B','b.json',null,{remember:false,writePermissionGranted:false}),dbB);
  await expect(todoRow(page,'X')).toBeVisible();
  await page.evaluate(items=>{applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,items},'DB A','a.json',null,{remember:false,writePermissionGranted:false});clearUndoHistory('pbl039-db-switch')},dbA);
  expect(await page.evaluate(()=>({stale:!!document.querySelector('#ganttView .ganttRow[data-task-id="A"]'),rendered:pbl2RenderedRow('A')?.id}))).toEqual({stale:true,rendered:'row_A'});
  await drag(page,'A','B');expect(await groupOrder(page,'A')).toEqual(['B','A']);
});
