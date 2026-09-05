const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

function task(id,extra={}){return{id,parentId:'',title:id,state:'',owner:'',due:'2026-08-20',summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra}}
async function boot(page,items,mode='personal',workspace='PBL情報'){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(({items,mode,workspace})=>{applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:workspace,items},'PBL','pbl.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);clearUndoHistory('pbl')},{items,mode,workspace})}
async function state(page){return page.evaluate(()=>({items:JSON.parse(JSON.stringify(data.items)),undo:undoStack.length,redo:redoStack.length,selected:selectedTaskId,workspace:data.workspace_info_markdown,schema:data.schema_version}))}
async function openPicker(page,id){await page.evaluate(id=>openParentPicker(id),id);await expect(page.locator('#pblParentPickerBack')).toBeVisible()}

test('PBL1-01 基本移動は対象だけを書換え、部分木と移動先末尾sortOrderを維持',async({page})=>{
  const items=[task('A',{sortOrder:1000}),task('B',{parentId:'A',sortOrder:1000}),task('C',{parentId:'B',sortOrder:1000}),task('D',{sortOrder:2000}),task('E',{parentId:'D',sortOrder:5000})];await boot(page,items);
  expect(await page.evaluate(()=>reassignTaskParent('B','D'))).toMatchObject({ok:true,noOp:false});
  expect(await page.evaluate(()=>({B:itemById('B'),C:itemById('C'),E:itemById('E')}))).toMatchObject({B:{parentId:'D',sortOrder:6000,due:'2026-08-20'},C:{parentId:'B',sortOrder:1000},E:{parentId:'D',sortOrder:5000}});
  expect(await page.evaluate(()=>collectSubtreeIds('B').has('C'))).toBe(true);
  expect((await state(page)).undo).toBe(1);
});

test('PBL1-02 child/root/grandchildの各方向をSchema変更なしで移動',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('C',{parentId:'B'}),task('D',{parentId:'A',sortOrder:2000}),task('E',{parentId:'D'})]);
  expect((await page.evaluate(()=>reassignTaskParent('C','D'))).ok).toBe(true); // grandchild -> higher branch child
  expect(await page.evaluate(()=>itemById('C').parentId)).toBe('D');
  expect((await page.evaluate(()=>reassignTaskParent('C','E'))).ok).toBe(true); // another descendant branch
  expect(await page.evaluate(()=>itemById('C').parentId)).toBe('E');
  expect((await page.evaluate(()=>reassignTaskParent('C',''))).ok).toBe(true); // child -> root
  expect(await page.evaluate(()=>itemById('C').parentId)).toBe('');
  expect((await page.evaluate(()=>reassignTaskParent('A','C'))).ok).toBe(true); // root -> child
  expect(await page.evaluate(()=>({parent:itemById('A').parentId,schema:data.schema_version}))).toEqual({parent:'C',schema:'3.0'});
});

test('PBL1-03 self・descendant・不存在・関連cycleをmutation層で安全に拒否',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('C',{parentId:'B'}),task('X',{parentId:'Y'}),task('Y',{parentId:'X'})]);const before=await state(page);
  for(const [id,parent,part] of [['A','A','自身'],['A','C','配下'],['A','NOPE','見つかりません'],['X','A','循環']]){const result=await page.evaluate(([id,parent])=>reassignTaskParent(id,parent),[id,parent]);expect(result.ok).toBe(false);expect(result.reason).toContain(part)}
  const after=await state(page);expect(after.items).toEqual(before.items);expect(after.undo).toBe(0);
});

test('PBL1-04 同じ親はsort/history/renderを変更しないno-op',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A',sortOrder:4321})]);const result=await page.evaluate(()=>{let renders=0;const base=render;render=function(){renders++;return base()};const r=reassignTaskParent('B','A');return{r,renders,parent:itemById('B').parentId,order:itemById('B').sortOrder,undo:undoStack.length}});
  expect(result).toEqual({r:{ok:true,noOp:true,reason:''},renders:0,parent:'A',order:4321,undo:0});
});

test('PBL1-05 完了階層・依存循環・繰返し境界違反は他データを変えず拒否',async({page})=>{
  const cases=[
    {items:[task('DONE',{completed:true,state:'完了'}),task('OLD',{parentId:'DONE'}),task('OPEN')],move:['OPEN','DONE'],text:'解決済み'},
    {items:[task('P'),task('T',{dependencies:[{task_id:'P',type:'finish_to_start'}]})],move:['T','P'],text:'循環'},
    {items:[task('R',{repeat:'毎週'}),task('A',{parentId:'R',dependencies:[{task_id:'B',type:'finish_to_start'}]}),task('B',{parentId:'R'})],move:['A',''],text:'繰返しチェックリスト'},
    {items:[task('R',{repeat:'毎週'}),task('Q',{repeat:'毎月'})],move:['Q','R'],text:'複数の繰返し'}
  ];
  for(const c of cases){await boot(page,c.items);const before=await state(page),result=await page.evaluate(move=>reassignTaskParent(...move),c.move),after=await state(page);expect(result.ok).toBe(false);expect(result.reason).toContain(c.text);expect(after.items).toEqual(before.items);expect(after.undo).toBe(0)}
});

test('PBL1-06 UIは現在親・root・階層path・無効候補・検索を表示',async({page})=>{
  await boot(page,[task('A',{title:'案件A'}),task('B',{parentId:'A',title:'同名'}),task('C',{parentId:'B',title:'孫'}),task('D',{title:'同名',owner:'山口'})]);
  await page.evaluate(()=>{const fake=document.createElement('button');document.body.appendChild(fake);toggleRelation({stopPropagation(){},currentTarget:fake},'B')});
  await expect(page.locator('#relationPopup')).toContainText('現在の親:');await expect(page.locator('#relationPopup')).toContainText('案件A');await expect(page.getByRole('button',{name:'親を変更'})).toBeVisible();await page.getByRole('button',{name:'親を変更'}).click();
  await expect(page.locator('.parentPickerCurrent')).toContainText('案件A');await expect(page.locator('[data-parent-id=""]')).toContainText('親なし');await expect(page.locator('[data-parent-id="B"]')).toBeDisabled();await expect(page.locator('[data-parent-id="C"]')).toBeDisabled();await expect(page.locator('[data-parent-id="D"]')).toContainText('同名');
  await page.locator('#pblParentSearch').fill('山口');await expect(page.locator('.parentCandidate')).toHaveCount(1);await expect(page.locator('.parentCandidate')).toContainText('同名');
});

test('PBL1-07 candidate選択だけ・Cancel・Escはcommitしない',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('D')]);await openPicker(page,'B');await page.locator('[data-parent-id="D"]').click();expect(await page.evaluate(()=>itemById('B').parentId)).toBe('A');expect((await state(page)).undo).toBe(0);await page.getByRole('button',{name:'キャンセル'}).click();expect(await page.evaluate(()=>itemById('B').parentId)).toBe('A');
  await openPicker(page,'B');await page.locator('[data-parent-id="D"]').click();await page.keyboard.press('Escape');expect(await page.evaluate(()=>({parent:itemById('B').parentId,undo:undoStack.length,picker:!!pblParentPicker()}))).toEqual({parent:'A',undo:0,picker:false});
});

test('PBL1-08 explicit confirmationは1回commitしUndo/Redoでparent/orderを復元',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A',sortOrder:2345}),task('D'),task('E',{parentId:'D',sortOrder:7000})]);await page.evaluate(()=>selectTask('B'));await openPicker(page,'B');await page.locator('[data-parent-id="D"]').click();expect(await page.locator('#pblParentConfirm')).toBeEnabled();await page.locator('#pblParentConfirm').click();await page.waitForTimeout(0);
  expect(await page.evaluate(()=>({parent:itemById('B').parentId,order:itemById('B').sortOrder,undo:undoStack.length,selected:selectedTaskId}))).toEqual({parent:'D',order:8000,undo:1,selected:'B'});
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>({parent:itemById('B').parentId,order:itemById('B').sortOrder,undo:undoStack.length,redo:redoStack.length}))).toEqual({parent:'A',order:2345,undo:0,redo:1});
  await page.keyboard.press('Control+y');expect(await page.evaluate(()=>({parent:itemById('B').parentId,order:itemById('B').sortOrder,undo:undoStack.length,redo:redoStack.length}))).toEqual({parent:'D',order:8000,undo:1,redo:0});
});

test('PBL1-09 保存・再読込でparent/order/subtree/Schema/workspace情報を保持',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('C',{parentId:'B'}),task('D')],'personal','# 重要情報');await page.evaluate(()=>reassignTaskParent('B','D'));const json=await page.evaluate(()=>JSON.stringify(persistableData()));await page.evaluate(json=>applyJsonObject(JSON.parse(json),'reload','pbl.json',null,{remember:false,writePermissionGranted:false}),json);
  expect(await page.evaluate(()=>({schema:data.schema_version,workspace:data.workspace_info_markdown,parent:itemById('B').parentId,order:itemById('B').sortOrder,child:itemById('C').parentId}))).toEqual({schema:'3.0',workspace:'# 重要情報',parent:'D',order:1000,child:'B'});
});

test('PBL1-10 ToDo/Project List/Ganttで共通階層を反映し水平scrollを維持',async({page})=>{
  await boot(page,[task('A',{due:'2028-08-10',planned_duration_days:700}),task('B',{parentId:'A',due:'2028-08-11',planned_duration_days:500}),task('C',{due:'2028-08-12',planned_duration_days:400})]);expect(await page.locator('#row_B .indent').evaluate(el=>el.style.width)).not.toBe('0px');
  await page.evaluate(()=>setMode('team'));await page.evaluate(()=>setGanttTimelineScroll(180));const beforeScroll=await page.evaluate(()=>ganttTimelineScrollLeft);expect(beforeScroll).toBeGreaterThan(100);expect((await page.evaluate(()=>reassignTaskParent('B','C'))).ok).toBe(true);expect(await page.evaluate(()=>ganttTimelineScrollLeft)).toBeCloseTo(beforeScroll,6);await expect(page.locator('.ganttRow[data-task-id="B"] .ganttTaskTitle')).toBeVisible();expect(await page.evaluate(()=>itemById('B').parentId)).toBe('C');
  await page.evaluate(()=>setProjectView('gantt'));expect(await page.evaluate(()=>ganttTimelineScrollLeft)).toBeCloseTo(beforeScroll,6);await expect(page.locator('.ganttRow[data-task-id="B"]')).toBeVisible();expect(await page.evaluate(()=>ancestorsOf(itemById('B')).map(x=>x.id))).toEqual(['C']);await page.evaluate(()=>setMode('personal'));expect(await page.evaluate(()=>itemById('B').parentId)).toBe('C');
});

test('PBL1-11 pickerはmode/DB lifecycleで安全にcloseしmanual-order helperを維持',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A',sortOrder:1000}),task('C',{parentId:'A',sortOrder:2000})]);await openPicker(page,'B');await page.evaluate(()=>setMode('team'));expect(await page.evaluate(()=>!!pblParentPicker())).toBe(false);await page.evaluate(()=>setMode('personal'));await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='B'),1));expect(await page.evaluate(()=>({b:itemById('B').sortOrder,c:itemById('C').sortOrder,undo:undoStack.length}))).toEqual({b:2000,c:1000,undo:1});
});

test('PBL1-FU-01 親変更はY移動あり・なしの両方で赤強調し通常選択は青のまま',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('C',{sortOrder:2000})]);await page.evaluate(()=>selectTask('C'));await expect(page.locator('#row_C')).toHaveClass(/selectedRow/);await expect(page.locator('#row_C')).not.toHaveClass(/sortAttention/);
  expect((await page.evaluate(()=>reassignTaskParent('B','C'))).ok).toBe(true);await expect(page.locator('#row_B')).toHaveClass(/sortAttention/);expect(await page.evaluate(()=>!!pendingSortMoveAnimation||!!document.querySelector('#row_B.sortMoveAnimating'))).toBeTruthy();
  await boot(page,[task('A'),task('B',{parentId:'A'})]);const before=await page.evaluate(()=>({index:displaySortIndex('B'),y:scrollY}));expect((await page.evaluate(()=>reassignTaskParent('B',''))).ok).toBe(true);const after=await page.evaluate(()=>({index:displaySortIndex('B'),y:scrollY,pending:!!pendingSortMoveAnimation}));expect(after).toEqual({index:before.index,y:before.y,pending:false});await expect(page.locator('#row_B')).toHaveClass(/sortAttention/);
});

test('PBL1-FU-02 ToDoの可視行背景で候補選択し、行clickだけではcommitせず変更で1回確定',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('D')]);await openPicker(page,'B');await page.locator('#row_D td.title').click({position:{x:2,y:2}});expect(await page.evaluate(()=>({candidate:pblParentSelectedId,parent:itemById('B').parentId,undo:undoStack.length}))).toEqual({candidate:'D',parent:'A',undo:0});await expect(page.locator('#row_D')).toHaveClass(/parentCandidateRow/);await expect(page.locator('#pblParentSelection')).toContainText('D');await page.locator('#pblParentConfirm').click();await page.waitForTimeout(0);expect(await page.evaluate(()=>({parent:itemById('B').parentId,undo:undoStack.length}))).toEqual({parent:'D',undo:1});
});

test('PBL1-FU-03 Project行背景でも候補選択しCancel・mode cleanupで状態を除去',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('D')],'team');await openPicker(page,'B');await page.locator('.ganttRow[data-task-id="D"] .ganttTaskName').click({position:{x:2,y:2}});expect(await page.evaluate(()=>({candidate:pblParentSelectedId,parent:itemById('B').parentId}))).toEqual({candidate:'D',parent:'A'});await expect(page.locator('.ganttRow[data-task-id="D"]')).toHaveClass(/parentCandidateRow/);await page.locator('#pblParentCancel').click();expect(await page.evaluate(()=>({parent:itemById('B').parentId,picker:!!pblParentPicker(),highlight:!!document.querySelector('.parentCandidateRow')}))).toEqual({parent:'A',picker:false,highlight:false});await openPicker(page,'B');await page.locator('.ganttRow[data-task-id="D"] .ganttTaskName').click({position:{x:2,y:2}});await page.evaluate(()=>setMode('personal'));expect(await page.evaluate(()=>({picker:!!pblParentPicker(),candidate:pblParentSelectedId,highlight:!!document.querySelector('.parentCandidateRow')}))).toEqual({picker:false,candidate:null,highlight:false});
});

test('PBL1-FU-04 self・descendant・currentとinteractive editorは可視行候補を変更しない',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('C',{parentId:'B'}),task('D')]);await openPicker(page,'B');await page.locator('#row_D td.title').click({position:{x:2,y:2}});expect(await page.evaluate(()=>pblParentSelectedId)).toBe('D');for(const id of ['B','C','A']){await page.locator(`#row_${id} td.title`).click({position:{x:2,y:2}});expect(await page.evaluate(()=>pblParentSelectedId)).toBe('D')}await page.locator('#row_A .titleText').click();expect(await page.evaluate(()=>pblParentSelectedId)).toBe('D');expect(await page.evaluate(()=>itemById('B').parentId)).toBe('A');expect(await page.evaluate(()=>undoStack.length)).toBe(0);
});

test('PBL1-FFU-01 親選択中のToDoタイトルclickは編集せず候補化し、変更で1回だけ確定',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('D')]);await openPicker(page,'B');await page.locator('#row_D .titleText').click();expect(await page.evaluate(()=>({candidate:pblParentSelectedId,parent:itemById('B').parentId,editing:document.activeElement?.classList.contains('titleText'),undo:undoStack.length}))).toEqual({candidate:'D',parent:'A',editing:false,undo:0});await expect(page.locator('#row_D')).toHaveClass(/parentCandidateRow/);await page.locator('#pblParentConfirm').click();await page.waitForTimeout(0);expect(await page.evaluate(()=>({parent:itemById('B').parentId,undo:undoStack.length}))).toEqual({parent:'D',undo:1});
});

test('PBL1-FFU-02 Projectタイトルclickも候補化し、Cancelなら階層不変',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('D')],'team');await openPicker(page,'B');await page.locator('.ganttRow[data-task-id="D"] .ganttTaskTitle').click();expect(await page.evaluate(()=>({candidate:pblParentSelectedId,parent:itemById('B').parentId,editing:document.activeElement?.classList.contains('ganttTaskTitle')}))).toEqual({candidate:'D',parent:'A',editing:false});await page.locator('#pblParentCancel').click();expect(await page.evaluate(()=>({parent:itemById('B').parentId,undo:undoStack.length,picker:!!pblParentPicker()}))).toEqual({parent:'A',undo:0,picker:false});
});

test('PBL1-FFU-03 親選択中はDue・完了・関係controlを実行せず候補選択を優先',async({page})=>{
  await boot(page,[task('A'),task('B',{parentId:'A'}),task('D'),task('E'),task('F',{parentId:'E'})]);await openPicker(page,'B');await page.locator('#row_D .dueTxt').click();expect(await page.evaluate(()=>({candidate:pblParentSelectedId,dueVisible:getComputedStyle(document.querySelector('#row_D .dateEdit')).display,completed:itemById('D').completed}))).toEqual({candidate:'D',dueVisible:'none',completed:false});await page.locator('#row_E .doneBtn').click();expect(await page.evaluate(()=>({candidate:pblParentSelectedId,completed:itemById('E').completed,undo:undoStack.length}))).toEqual({candidate:'E',completed:false,undo:0});await page.locator('#row_E .relationTrigger').first().click();expect(await page.evaluate(()=>({candidate:pblParentSelectedId,relation:relationOpenId,parent:itemById('B').parentId}))).toEqual({candidate:'E',relation:'',parent:'A'});
});

test('PBL1-FFU-04 親選択終了後は通常タイトル編集が復帰しpicker検索・scroll・Cancelは操作可能',async({page})=>{
  const items=[task('A'),task('B',{parentId:'A'}),...Array.from({length:25},(_,i)=>task('T'+i,{sortOrder:(i+3)*1000}))];await boot(page,items);await openPicker(page,'B');await page.locator('#pblParentSearch').fill('T20');await expect(page.locator('[data-parent-id="T20"]')).toBeVisible();await page.mouse.wheel(0,500);await page.locator('#pblParentCancel').click();await page.locator('#row_T0 .titleText').click();expect(await page.evaluate(()=>({picker:!!pblParentPicker(),editing:document.activeElement?.classList.contains('titleText'),parent:itemById('B').parentId}))).toEqual({picker:false,editing:true,parent:'A'});
});
