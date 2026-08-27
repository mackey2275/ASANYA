const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
function task(id,extra={}){return{id,parentId:'',title:id,state:'',owner:'',due:'2026-08-28',planned_duration_days:5,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra}}
async function boot(page,items,mode='personal',projectView='list'){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(({items,mode,projectView})=>{applyJsonObject({schema_version:'2.2',items},'Follow-up','followup.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);if(mode==='team')setProjectView(projectView);clearUndoHistory('followup');dirty=false},{items,mode,projectView})}
function row(page,id){return page.locator(`#ganttView .ganttRow[data-task-id="${id}"],#row_${id}`).first()}
function pane(page){return page.locator('#taskDetailPane')}
async function open(page,id){await row(page,id).locator('.taskDetailOpenBtn').click();await expect(pane(page)).toBeVisible()}

test('DETAIL-BF-FIELDS-01 direct title owner summary repeat stay synchronized and undoable',async({page})=>{
  await boot(page,[task('A')]);await open(page,'A');
  await pane(page).getByLabel('タイトル').fill('変更後');await pane(page).getByLabel('タイトル').blur();
  await pane(page).getByLabel('担当').fill(' 山田 ');await pane(page).getByLabel('担当').blur();
  await pane(page).getByLabel('概要').fill('1行目\n2行目');await pane(page).getByLabel('概要').blur();
  await pane(page).getByLabel('繰返し').selectOption('毎日');
  expect(await page.evaluate(()=>{const x=itemById('A');return{x:{title:x.title,owner:x.owner,summary:x.summary,repeat:x.repeat},undo:undoStack.length,count:undoStack[0]?.detailActionCount}})).toEqual({x:{title:'変更後',owner:'山田',summary:'1行目\n2行目',repeat:'毎日'},undo:1,count:4});
  await expect(row(page,'A')).toContainText('変更後');
});

test('DETAIL-BF-STATUS-01 pane status uses authoritative blockers and automatic actual dates',async({page})=>{
  const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});
  await boot(page,[task('P'),task('A',{dependencies:[{task_id:'P',type:'finish_to_start'}]})]);await open(page,'A');
  await pane(page).getByLabel('ステータス').selectOption('進行中');await expect.poll(()=>dialogs.length).toBe(1);expect(await page.evaluate(()=>itemById('A').state)).toBe('');
  await page.evaluate(()=>{itemById('P').completed=true;itemById('P').state='完了';render()});await pane(page).getByLabel('ステータス').selectOption('進行中');
  expect(await page.evaluate(()=>({state:itemById('A').state,start:itemById('A').actual_start,source:itemById('A').actual_start_source}))).toEqual({state:'進行中',start:expect.any(String),source:'system'});
});

test('DETAIL-BF-PLAN-01 derived start edit preserves due, inclusive days, milestone distinction and Undo',async({page})=>{
  await boot(page,[task('A'),task('M',{planned_duration_days:0,sortOrder:2000})]);await open(page,'A');
  await expect(pane(page).getByRole('textbox',{name:'計画開始',exact:true})).toHaveValue('2026/08/24');await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).fill('2026/08/26');await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).press('Enter');
  expect(await page.evaluate(()=>({due:itemById('A').due,days:itemById('A').planned_duration_days,undo:undoStack.length}))).toEqual({due:'2026-08-28',days:3,undo:1});
  await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('A').planned_duration_days)).toBe(5);
  await page.evaluate(()=>openTaskDetailPane('M'));await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).fill('2026/08/28');await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).press('Enter');expect(await page.evaluate(()=>itemById('M').planned_duration_days)).toBe(0);
  await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).fill('2026/08/27');await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).press('Enter');expect(await page.evaluate(()=>itemById('M').planned_duration_days)).toBe(2);
});

test('DETAIL-BF-PLAN-02 invalid start rejected; days and due preserve the opposite anchor',async({page})=>{
  const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});await boot(page,[task('A')]);await open(page,'A');
  await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).fill('2026/08/29');await pane(page).getByRole('textbox',{name:'計画開始',exact:true}).press('Enter');await expect.poll(()=>dialogs.length).toBe(1);expect(await page.evaluate(()=>itemById('A').planned_duration_days)).toBe(5);
  await pane(page).getByLabel('計画日数').fill('3');await pane(page).getByLabel('計画日数').blur();expect(await page.evaluate(()=>({due:itemById('A').due,days:itemById('A').planned_duration_days}))).toEqual({due:'2026-08-28',days:3});await expect(pane(page).getByRole('textbox',{name:'計画開始',exact:true})).toHaveValue('2026/08/26');
  await pane(page).getByRole('textbox',{name:'計画完了',exact:true}).fill('2026/08/30');await pane(page).getByRole('textbox',{name:'計画完了',exact:true}).press('Enter');expect(await page.evaluate(()=>({due:itemById('A').due,days:itemById('A').planned_duration_days}))).toEqual({due:'2026-08-30',days:3});await expect(pane(page).getByRole('textbox',{name:'計画開始',exact:true})).toHaveValue('2026/08/28');
});

test('DETAIL-BF-ACTUAL-01 direct dates validate, set user source, calculate inclusive/running days and Undo',async({page})=>{
  const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});await boot(page,[task('A')]);await open(page,'A');
  await pane(page).getByRole('textbox',{name:'実績終了',exact:true}).fill('2026/08/27');await pane(page).getByRole('textbox',{name:'実績終了',exact:true}).press('Enter');await expect.poll(()=>dialogs.length).toBe(1);expect(await page.evaluate(()=>itemById('A').actual_end)).toBeUndefined();
  await pane(page).getByRole('textbox',{name:'実績開始',exact:true}).fill('2026/08/25');await pane(page).getByRole('textbox',{name:'実績開始',exact:true}).press('Enter');expect(await page.evaluate(()=>itemById('A').actual_start_source)).toBe('user');await expect(pane(page).getByLabel('実績日数')).toContainText('進行中');
  await pane(page).getByRole('textbox',{name:'実績終了',exact:true}).fill('2026/08/27');await pane(page).getByRole('textbox',{name:'実績終了',exact:true}).press('Enter');expect(await page.evaluate(()=>({end:itemById('A').actual_end,source:itemById('A').actual_end_source,undo:undoStack.length,count:undoStack[0]?.detailActionCount}))).toEqual({end:'2026-08-27',source:'user',undo:1,count:2});await expect(pane(page).getByLabel('実績日数')).toHaveText('3');await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>({start:itemById('A').actual_start,end:itemById('A').actual_end}))).toEqual({start:undefined,end:undefined});
});

test('DETAIL-BF-SHORTCUT-01 d shortcut works on all pane dates without residue or duplicate history',async({page})=>{
  await boot(page,[task('A',{actual_start:'2026-08-20',actual_start_source:'user'})]);await open(page,'A');
  for(const label of ['計画開始','計画完了','実績開始','実績終了']){const input=pane(page).getByRole('textbox',{name:label,exact:true});await input.fill('');await input.press('d');await input.press('0');await expect(input).not.toHaveValue(/d|ｄ|Ｄ/i)}
  expect(await page.evaluate(()=>data.items.length)).toBe(1);expect(await page.evaluate(()=>({undo:undoStack.length,count:undoStack[0]?.detailActionCount}))).toEqual({undo:1,count:3});
});

test('DETAIL-BF-SHORTCUT-02 full-width IME waits for compositionend, commits once and keeps viewport',async({page})=>{
  await page.setViewportSize({width:1280,height:650});await boot(page,[task('A',{actual_start:'2026-08-20',actual_start_source:'user'})]);await open(page,'A');const input=pane(page).getByRole('textbox',{name:'実績終了',exact:true}),before=await page.evaluate(()=>({y:scrollY,undo:undoStack.length}));
  await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value='ｄ';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'ｄ',inputType:'insertCompositionText',isComposing:true}));el.value='ｄ０';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'０',inputType:'insertCompositionText',isComposing:true}))});
  expect(await page.evaluate(()=>({end:itemById('A').actual_end,pending:dueImeShortcutPending?.finishingRequested}))).toEqual({end:undefined,pending:true});await input.dispatchEvent('compositionend',{data:'０'});await expect.poll(()=>page.evaluate(()=>itemById('A').actual_end)).toBe(await page.evaluate(()=>ymd()));expect(await page.evaluate(()=>({y:scrollY,undo:undoStack.length,pending:dueImeShortcutPending}))).toEqual({y:before.y,undo:before.undo+1,pending:null});
});

test('DETAIL-BF-CALENDAR-01 compact calendar change uses the same direct date path',async({page})=>{
  await boot(page,[task('A')]);await open(page,'A');const calendar=pane(page).getByRole('button',{name:'実績開始のカレンダー'}).locator('..').locator('input[type=date]');await calendar.evaluate(el=>{el.value='2026-08-25';el.dispatchEvent(new Event('change',{bubbles:true}))});expect(await page.evaluate(()=>({start:itemById('A').actual_start,source:itemById('A').actual_start_source,undo:undoStack.length}))).toEqual({start:'2026-08-25',source:'user',undo:1});
});

test('DETAIL-BF-KEYS-01 non-field pane focus blocks task shortcuts while date fields keep d shortcut',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);await open(page,'A');const close=pane(page).locator('.taskDetailPaneClose');await close.focus();for(const key of ['Delete','d','F2','ArrowDown','Enter','Insert'])await page.keyboard.press(key);expect(await page.evaluate(()=>({count:data.items.length,id:selectedTaskId,draft:draftTaskId,undo:undoStack.length}))).toEqual({count:2,id:'A',draft:'',undo:0});
});

test('DETAIL-BF-PARENT-01 visible candidate and Alt+S navigation keep base task until explicit Change',async({page})=>{
  await boot(page,[task('P'),task('Q',{sortOrder:2000}),task('A',{parentId:'P',sortOrder:3000})]);await open(page,'A');await pane(page).getByRole('button',{name:'親を変更'}).click();
  await page.keyboard.press('Alt+s');await expect(page.locator('#taskSearchPopup')).toBeVisible();await page.locator('#taskSearchInput').fill('Q');await page.locator('.taskSearchResult').filter({hasText:'Q'}).click();
  expect(await page.evaluate(()=>({mode:taskDetailViewMode,base:taskDetailPaneTaskId,selected:selectedTaskId,parent:itemById('A').parentId}))).toEqual({mode:'parent-select',base:'A',selected:'A',parent:'P'});
  await row(page,'Q').locator('.doneBtn').click();expect(await page.evaluate(()=>pblParentSelectedId)).toBe('Q');await pane(page).getByRole('button',{name:'変更'}).click();expect(await page.evaluate(()=>itemById('A').parentId)).toBe('Q');
});

test('DETAIL-BF-DEP-01 ToDo visible rows add/type/delete using common validation and explicit commit',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);await open(page,'A');await pane(page).getByRole('button',{name:'＋ 前工程'}).click();await row(page,'B').locator('.titleText').click();expect(await page.evaluate(()=>({candidate:relationSelectedTaskId,deps:itemById('A').dependencies.length,base:taskDetailPaneTaskId}))).toEqual({candidate:'B',deps:0,base:'A'});await expect(row(page,'B')).toHaveClass(/dependencyCandidateRow/);await pane(page).getByRole('button',{name:'追加'}).click();expect(await page.evaluate(()=>itemById('A').dependencies[0])).toEqual({task_id:'B',type:'finish_to_start'});
  await pane(page).locator('.taskDetailRelationControls').getByRole('button',{name:'変更'}).click();await pane(page).locator('.taskDetailDepSelect').selectOption('finish_to_finish');await pane(page).getByRole('button',{name:'変更',exact:true}).click();expect(await page.evaluate(()=>itemById('A').dependencies[0].type)).toBe('finish_to_finish');await pane(page).locator('.taskDetailRelationControls').getByRole('button',{name:'削除'}).click();expect(await page.evaluate(()=>itemById('A').dependencies)).toEqual([]);expect(await page.evaluate(()=>({undo:undoStack.length,count:undoStack[0]?.detailActionCount}))).toEqual({undo:1,count:3});
});

test('DETAIL-BF-PLACEMENT-01 right-only pane and TOP visibility are runtime-only',async({page})=>{
  await boot(page,[task('A')]);const before=await page.evaluate(()=>JSON.stringify(data));await open(page,'A');await expect(pane(page)).not.toHaveClass(/bottom/);await expect(pane(page).locator('.taskDetailPlacement,[data-place="bottom"]')).toHaveCount(0);await expect(page.locator('#backToTopBtn')).toHaveClass(/taskDetailSuppressed/);expect(await page.evaluate(()=>({data:JSON.stringify(data),undo:undoStack.length,id:taskDetailPaneTaskId}))).toEqual({data:before,undo:0,id:'A'});await pane(page).locator('.taskDetailPaneClose').click();await expect(page.locator('#backToTopBtn')).not.toHaveClass(/taskDetailSuppressed/);
});

test('DETAIL-BF-SUPPORTED-01 direct actual, parent, relation and inline paths remain available',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})],'team','list');await open(page,'A');await expect(pane(page).getByRole('textbox',{name:'実績開始',exact:true})).toBeVisible();await expect(pane(page).getByRole('button',{name:'親を変更'})).toBeVisible();await expect(pane(page).getByRole('button',{name:'＋ 前工程'})).toBeVisible();await row(page,'A').locator('.ganttTaskTitle').fill('Inline');await row(page,'A').locator('.ganttTaskTitle').blur();expect(await page.evaluate(()=>itemById('A').title)).toBe('Inline');
});
