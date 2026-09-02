const {test,expect}=require('playwright/test');
test.setTimeout(20000);
const {APP}=require('./helpers/app-target');
const task=(id,title=id,extra={})=>({id,parentId:'',state:'',impact:'',title,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
async function boot(page,items){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(items=>applyJsonObject({schema_version:'1.8',items},'test','undo.json',null,{remember:false,writePermissionGranted:false}),items);await page.waitForTimeout(0)}

test('UNDO-01: 複数操作を逆順UndoしCtrl+Y/Ctrl+Shift+ZでRedo',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20',planned_duration_days:2})]);
  await page.evaluate(()=>chg(0,'due','2026-08-21'));await page.waitForTimeout(0);await page.evaluate(()=>changePlannedDuration(0,'5'));await page.waitForTimeout(0);await page.evaluate(()=>changeState(0,'進行中'));
  await page.waitForTimeout(0);expect(await page.evaluate(()=>undoStack.length)).toBe(3);
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').state)).toBe('');
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').planned_duration_days)).toBe(2);
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');
  await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-21');
  await page.keyboard.press('Control+Shift+z');expect(await page.evaluate(()=>itemById('A').planned_duration_days)).toBe(5);
  await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').state)).toBe('進行中');
});
test('UNDO-02: Undo後の新規操作でRedo branchを破棄しno-opは記録しない',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);
  await page.evaluate(()=>chg(0,'due','2026-08-21'));await page.waitForTimeout(0);await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>redoStack.length)).toBe(1);
  await page.evaluate(()=>chg(0,'owner','山口'));await page.waitForTimeout(0);
  expect(await page.evaluate(()=>redoStack.length)).toBe(0);
  const before=await page.evaluate(()=>undoStack.length);await page.evaluate(()=>chg(0,'owner','山口'));await page.waitForTimeout(0);
  expect(await page.evaluate(()=>undoStack.length)).toBe(before);
});

test('UNDO-03: 未確定フィールドのCtrl+Zは編集開始値へ戻し履歴を消費しない',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmTodoTree').click();
  await page.locator('#row_A .titleText').fill('Alpha edited');
  await page.locator('#row_A .titleText').press('Control+z');
  await expect(page.locator('#row_A .titleText')).toHaveText('Alpha');
  expect(await page.evaluate(()=>({title:itemById('A').title,history:undoStack.length}))).toEqual({title:'Alpha',history:0});
});

test('UNDO-03A: child draftは1回目field、2回目draft、3回目確定履歴の順にUndo',async({page})=>{
  await boot(page,[task('A','Alpha',{owner:'before',due:'2026-08-20',planned_duration_days:2})]);await page.evaluate(()=>chg(0,'owner','confirmed'));await page.waitForTimeout(0);expect(await page.evaluate(()=>undoStack.length)).toBe(1);
  await page.locator('#dmProjectDetail').click();await page.evaluate(()=>selectTask('A'));await page.keyboard.press('Enter');const id=await page.evaluate(()=>draftTaskId);await page.locator(`#row_${id} .titleText`).fill('Draft');await page.locator(`#row_${id} .titleText`).press('Enter');const due=page.locator(`#row_${id} input[id^="d"]`);await due.fill('2026-08-25');await due.press('Control+z');
  expect(await page.evaluate(id=>({draft:draftTaskId,stage:draftStage,owner:itemById('A').owner,history:undoStack.length}),id)).toEqual({draft:id,stage:'due',owner:'confirmed',history:1});await expect(page.locator(`#row_${id} input[id^="d"]`)).toBeHidden();await expect(page.locator(`#row_${id} .dueTxt`)).toBeVisible();
  await page.keyboard.press('Control+z');expect(await page.evaluate(id=>({exists:!!itemById(id),dom:!!document.getElementById('row_'+id),draft:draftTaskId,origin:draftOriginId,stage:draftStage,tx:undoTransaction,owner:itemById('A').owner,history:undoStack.length}),id)).toEqual({exists:false,dom:false,draft:'',origin:'',stage:'',tx:null,owner:'confirmed',history:1});
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>({owner:itemById('A').owner,history:undoStack.length}))).toEqual({owner:'before',history:0});
});

test('UNDO-03B: 期限手入力・期限なしはCtrl+Z一回で開始値へ戻り通常表示',async({page})=>{
  await boot(page,[task('A','With due',{due:'2026-08-20'}),task('B','No due',{sortOrder:2000})]);await page.locator('#dmTodoTree').click();
  await page.locator('#row_A .dueTxt').click();let input=page.locator('#row_A input[id^="d"]');await input.fill('2026-08-25');await input.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await expect(page.locator('#row_A .dueTxt')).toBeVisible();expect(await page.evaluate(()=>undoStack.length)).toBe(0);
  await page.locator('#row_B .dueTxt').click();input=page.locator('#row_B input[id^="d"]');await input.fill('2026-08');await input.press('Control+z');expect(await page.evaluate(()=>itemById('B').due)).toBe('');await expect(page.locator('#row_B .dueTxt')).toBeVisible();expect(await page.evaluate(()=>undoStack.length)).toBe(0);
});

test('UNDO-03C: date picker clear相当の未確定空値も開始期限へ戻してeditorを閉じる',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmProjectDetail').click();await page.evaluate(()=>setMode('team'));await page.locator('.ganttRow[data-task-id="A"] .ganttDue .dueTxt').click();const input=page.locator('.ganttRow[data-task-id="A"] .ganttDueText');await input.fill('');await page.locator('.ganttRow[data-task-id="A"] .ganttDueCalendar').evaluate(el=>{el.value='';el.dispatchEvent(new Event('change',{bubbles:true}))});await input.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await expect(page.locator('.ganttRow[data-task-id="A"] .ganttDueText')).toBeHidden();await expect(page.locator('.ganttRow[data-task-id="A"] .ganttDue')).toContainText(await page.evaluate(()=>dueLab('2026-08-20')));expect(await page.evaluate(()=>undoStack.length)).toBe(0);
});

test('UNDO-03D: d→1は通常状態・期限editor経由とも確定しUndo/Redo可能',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmTodoTree').click();await page.evaluate(()=>selectTask('A'));const shortcutDue=await page.evaluate(()=>addDays(ymd(),1));
  await page.keyboard.press('d');await page.keyboard.press('1');let input=page.locator('#row_A input[id^="d"]');await expect(input).toBeVisible();await expect(input).toHaveValue(await page.evaluate(v=>editDateText(v),shortcutDue));expect(await page.evaluate(()=>({due:itemById('A').due,history:undoStack.length}))).toEqual({due:'2026-08-20',history:0});await input.press('Control+z');await expect(input).toBeHidden();expect(await page.evaluate(()=>({due:itemById('A').due,history:undoStack.length}))).toEqual({due:'2026-08-20',history:0});
  await page.locator('#row_A .dueTxt').click();input=page.locator('#row_A input[id^="d"]');await input.press('d');await input.press('1');await expect(page.locator('#row_A input[id^="d"]')).toBeHidden();expect(await page.evaluate(()=>({due:itemById('A').due,armed:dateShortcutArmed,active:activeUndoEditor,history:undoStack.length}))).toEqual({due:shortcutDue,armed:false,active:null,history:1});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe(shortcutDue);
});

test('UNDO-03F: composition中Ctrl+Zはapp処理せず、その後field→draft→historyの順を維持',async({page})=>{
  await boot(page,[task('P','Parent'),task('B','Existing child',{parentId:'P',owner:'before',sortOrder:2000})]);await page.evaluate(()=>chg(1,'owner','confirmed'));await page.waitForTimeout(0);await page.locator('#dmProjectDetail').click();await page.evaluate(()=>selectTask('B'));await page.keyboard.press('Enter');const id=await page.evaluate(()=>draftTaskId),title=page.locator(`#row_${id} .titleText`);await title.dispatchEvent('compositionstart',{data:'日'});await title.evaluate(el=>{el.textContent='日本';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'日本',inputType:'insertCompositionText'}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,isComposing:true,keyCode:229,bubbles:true,cancelable:true}))});await title.dispatchEvent('compositionend',{data:'日本'});
  expect(await page.evaluate(id=>({b:!!itemById('B'),c:!!itemById(id),draft:draftTaskId,origin:draftOriginId,history:undoStack.length}),id)).toEqual({b:true,c:true,draft:id,origin:'B',history:1});await title.press('Control+z');expect(await page.evaluate(id=>({b:!!itemById('B'),c:!!itemById(id),draft:draftTaskId,history:undoStack.length}),id)).toEqual({b:true,c:true,draft:id,history:1});await page.keyboard.press('Control+z');expect(await page.evaluate(id=>({b:!!itemById('B'),c:!!itemById(id),draft:draftTaskId,history:undoStack.length}),id)).toEqual({b:true,c:false,draft:'',history:1});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>({b:!!itemById('B'),owner:itemById('B').owner,history:undoStack.length}))).toEqual({b:true,owner:'before',history:0});
});

test('UNDO-03G: calendar選択は即commit・editor終了しUndo/Redo可能',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmProjectDetail').click();await page.evaluate(()=>setMode('team'));await page.locator('.ganttRow[data-task-id="A"] .ganttDue .dueTxt').click();await page.locator('.ganttRow[data-task-id="A"] .ganttDueCalendar').evaluate(el=>{el.value='2026-08-25';el.dispatchEvent(new Event('change',{bubbles:true}))});await expect(page.locator('.ganttRow[data-task-id="A"] .ganttDueText')).toBeHidden();expect(await page.evaluate(()=>({due:itemById('A').due,active:activeUndoEditor,history:undoStack.length}))).toEqual({due:'2026-08-25',active:null,history:1});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-25');
});

test('UNDO-03H: 期限Enter確定とd→1反復は直後のUndo/Redoで戻る',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmTodoTree').click();
  await page.locator('#row_A .dueTxt').click();let input=page.locator('#row_A input[id^="d"]');await input.fill('2026-08-25');await input.press('Enter');expect(await page.evaluate(()=>({due:itemById('A').due,active:activeUndoEditor}))).toEqual({due:'2026-08-25',active:null});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-25');
  for(let n=0;n<5;n++){await page.evaluate(()=>{itemById('A').due='2026-08-20';save();render();clearUndoHistory('repeat')});const shortcutDue=await page.evaluate(()=>addDays(ymd(),1));await page.locator('#row_A .dueTxt').click();input=page.locator('#row_A input[id^="d"]');await input.press('d');await input.press('1');expect(await page.evaluate(()=>({due:itemById('A').due,active:activeUndoEditor,history:undoStack.length}))).toEqual({due:shortcutDue,active:null,history:1});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe(shortcutDue)}
});

test('UNDO-03I: compositionendまでは期限editorを維持し、終了後の確定もUndo/Redo可能',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmTodoTree').click();await page.locator('#row_A .dueTxt').click();const input=page.locator('#row_A input[id^="d"]'),shortcutDue=await page.evaluate(()=>addDays(ymd(),1));
  await input.evaluate(el=>{window.__imeTrace=[];for(const type of ['compositionstart','compositionupdate','input','keydown','compositionend','focusout','blur'])el.addEventListener(type,ev=>window.__imeTrace.push({type,key:ev.key||'',isComposing:!!ev.isComposing}),true);const finishBase=finishCommittedUndoEditor;finishCommittedUndoEditor=function(target){window.__imeTrace.push({type:'finishCommittedUndoEditor'});return finishBase(target)};const saveBase=saveDueText;saveDueText=function(i,target){window.__imeTrace.push({type:'saveDueText'});return saveBase(i,target)};const renderBase=render;render=function(){window.__imeTrace.push({type:'render'});return renderBase()};el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value='ｄ';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'ｄ',inputType:'insertCompositionText',isComposing:true}));el.value='ｄ１';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'１',inputType:'insertCompositionText',isComposing:true}))});let trace=await page.evaluate(()=>window.__imeTrace);await expect(input).toBeVisible();expect(trace.map(x=>x.type)).not.toEqual(expect.arrayContaining(['saveDueText','render']));expect(await page.evaluate(()=>({due:itemById('A').due,history:undoStack.length}))).toEqual({due:'2026-08-20',history:0});await input.dispatchEvent('compositionend',{data:'１'});await expect.poll(()=>page.evaluate(()=>itemById('A').due)).toBe(shortcutDue);trace=await page.evaluate(()=>window.__imeTrace);
  await expect(input).toBeHidden();expect(trace.map(x=>x.type)).toEqual(expect.arrayContaining(['compositionstart','input','compositionend','saveDueText','finishCommittedUndoEditor','blur','focusout','render']));expect(await page.evaluate(()=>({due:itemById('A').due,noCompositionTarget:imeCompositionTarget===null,history:undoStack.length}))).toEqual({due:shortcutDue,noCompositionTarget:true,history:1});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe(shortcutDue);
});

test('UNDO-03J: IME composition確定を5回反復後も別編集を含むUndo/Redo routingを維持',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmTodoTree').click();const shortcutDue=await page.evaluate(()=>addDays(ymd(),1));
  for(let n=0;n<5;n++){await page.evaluate(()=>{itemById('A').due='2026-08-20';save();render();clearUndoHistory('ime-repeat')});await page.locator('#row_A .dueTxt').click();const input=page.locator('#row_A input[id^="d"]');await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value='ｄ';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'ｄ',inputType:'insertCompositionText',isComposing:true}));el.value='ｄ１';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'１',inputType:'insertCompositionText',isComposing:true}))});expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await input.dispatchEvent('compositionend',{data:'１'});await expect.poll(()=>page.evaluate(()=>itemById('A').due)).toBe(shortcutDue);expect(await page.evaluate(()=>({due:itemById('A').due,noCompositionTarget:imeCompositionTarget===null}))).toEqual({due:shortcutDue,noCompositionTarget:true});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe(shortcutDue)}
  await page.locator('#row_A .titleText').fill('Beta');await page.locator('#row_A .titleText').press('Enter');await page.waitForTimeout(0);await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').title)).toBe('Alpha');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').title)).toBe('Beta');await page.locator('#row_A .dueTxt').click();const due=page.locator('#row_A input[id^="d"]');await due.fill('2026-08-25');await due.press('Enter');await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe(shortcutDue);
});

test('UNDO-03E: Project List新規追加行はsort移動先へfollow・赤attentionし作成履歴は1件',async({page})=>{
  await boot(page,[task('E','Early',{due:'2026-08-10',planned_duration_days:1}),task('L','Late',{due:'2026-08-30',planned_duration_days:1,sortOrder:2000})]);await page.locator('#dmProjectDetail').click();
  await page.locator('#b_title').fill('Middle');await page.locator('#b_title').press('Enter');await page.locator('#b_due').fill('2026-08-20');await page.locator('#b_due').press('Enter');await page.locator('#b_planned').fill('1');await page.locator('#b_planned').press('Enter');await page.waitForTimeout(150);const id=await page.evaluate(()=>selectedTaskId);expect(id).toBeTruthy();await expect(page.locator(`#row_${id}`)).toHaveClass(/sortAttention/);expect(await page.evaluate(id=>{const r=document.getElementById('row_'+id).getBoundingClientRect();return{index:displaySortIndex(id),visible:r.top>=0&&r.bottom<=innerHeight,history:undoStack.length}},id)).toEqual({index:1,visible:true,history:1});
  await page.keyboard.press('Control+z');expect(await page.evaluate(id=>!!itemById(id),id)).toBe(false);await page.keyboard.press('Control+y');expect(await page.evaluate(id=>({exists:!!itemById(id),selected:selectedTaskId}),id)).toEqual({exists:true,selected:id});
});

test('UNDO-03H: Project List期限なし新規追加行もselected青枠・follow、赤attentionなし',async({page})=>{
  await boot(page,[task('A','Existing',{due:'2026-08-10',planned_duration_days:1})]);await page.locator('#dmProjectDetail').click();await page.locator('#b_title').fill('No schedule');await page.locator('#b_title').press('Enter');await page.locator('#b_due').press('Enter');await page.locator('#b_planned').press('Enter');await page.waitForTimeout(150);const id=await page.evaluate(()=>selectedTaskId);await expect(page.locator(`#row_${id}`)).toHaveClass(/selectedRow/);await expect(page.locator(`#row_${id}`)).not.toHaveClass(/sortAttention/);expect(await page.evaluate(id=>{const r=document.getElementById('row_'+id).getBoundingClientRect();return{selected:selectedTaskId,visible:r.top>=0&&r.bottom<=innerHeight,attention:sortAttentionTaskId,history:undoStack.length}},id)).toEqual({selected:id,visible:true,attention:'',history:1});
});

test('UNDO-04: Projectドラフトは完了全体が1履歴、取消は履歴なし',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20',planned_duration_days:2})]);await page.locator('#dmProjectDetail').click();await page.evaluate(()=>selectTask('A'));
  await page.keyboard.press('Enter');let id=await page.evaluate(()=>draftTaskId);await page.locator(`#row_${id} .titleText`).fill('Created');await page.locator(`#row_${id} .titleText`).press('Enter');await page.locator(`#row_${id} input[id^="d"]`).fill('2026-08-25');await page.locator(`#row_${id} input[id^="d"]`).press('Enter');await page.locator(`#row_${id} input[type="number"]`).fill('3');await page.locator(`#row_${id} input[type="number"]`).press('Enter');await page.waitForTimeout(0);
  expect(await page.evaluate(()=>undoStack.length)).toBe(1);await page.keyboard.press('Control+z');expect(await page.evaluate(id=>!!itemById(id),id)).toBe(false);await page.keyboard.press('Control+y');expect(await page.evaluate(id=>({exists:!!itemById(id),selected:selectedTaskId}),id)).toEqual({exists:true,selected:id});
  await page.keyboard.press('Enter');const cancelId=await page.evaluate(()=>draftTaskId);await page.locator(`#row_${cancelId} .titleText`).waitFor();await page.locator(`#row_${cancelId} .titleText`).press('Escape');expect(await page.evaluate(id=>({exists:!!itemById(id),history:undoStack.length}),cancelId)).toEqual({exists:false,history:1});
});

test('UNDO-05: 削除は階層と依存関係をsnapshotどおり復元',async({page})=>{
  await boot(page,[task('P','Parent'),task('C','Child',{parentId:'P',sortOrder:2000}),task('D','Dependent',{dependencies:[{task_id:'P',type:'FS'}],sortOrder:3000}),]);
  await page.evaluate(()=>{window.confirm=()=>true;data.items[0].completed=true;clearUndoHistory('fixture');setUndoAction('delete_task','P');delItem(0)});await page.waitForTimeout(0);
  expect(await page.evaluate(()=>itemById('D').dependencies)).toEqual([]);await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>({parent:itemById('C').parentId,dep:itemById('D').dependencies[0]}))).toEqual({parent:'P',dep:{task_id:'P',type:'finish_to_finish'}});
  await page.keyboard.press('Control+y');expect(await page.evaluate(()=>!!itemById('P'))).toBe(false);
});

test('UNDO-06: 状態変更に伴う実績自動設定も1回で復元',async({page})=>{
  await boot(page,[task('A','Alpha')]);await page.evaluate(()=>changeState(0,'進行中'));await page.waitForTimeout(0);
  const changed=await page.evaluate(()=>({state:itemById('A').state,start:itemById('A').actual_start,source:itemById('A').actual_start_source,count:undoStack.length}));expect(changed.state).toBe('進行中');expect(changed.start).toBeTruthy();expect(changed.source).toBe('system');expect(changed.count).toBe(1);
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>({state:itemById('A').state,start:itemById('A').actual_start,source:itemById('A').actual_start_source}))).toEqual({state:'',start:undefined,source:undefined});
});

test('UNDO-07: due marker dragは1履歴でUndo/Redoし選択を追従',async({page})=>{
  await boot(page,[task('A','Alpha',{due:'2026-08-20'})]);await page.locator('#dmProjectDetail').click();await page.evaluate(()=>setMode('team'));const marker=page.locator('.ganttRow[data-task-id="A"] .ganttDueOnlyMarker');await marker.scrollIntoViewIfNeeded();const box=await marker.boundingBox();await page.mouse.move(box.x+2,box.y+2);await page.mouse.down();await page.mouse.move(box.x+56,box.y+2,{steps:8});await page.mouse.up();await page.waitForTimeout(0);const moved=await page.evaluate(()=>itemById('A').due);expect(moved).not.toBe('2026-08-20');expect(await page.evaluate(()=>undoStack.length)).toBe(1);
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>({due:itemById('A').due,selected:selectedTaskId}))).toEqual({due:'2026-08-20',selected:'A'});await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe(moved);
});

test('UNDO-08: history上限50、DB再読込でclear、保存相当では維持',async({page})=>{
  await boot(page,[task('A','Alpha')]);await page.evaluate(()=>{for(let i=0;i<55;i++){chg(0,'owner','owner-'+i);commitUndoTransaction()}});expect(await page.evaluate(()=>undoStack.length)).toBe(50);
  await page.evaluate(()=>save());expect(await page.evaluate(()=>undoStack.length)).toBe(50);
  await page.evaluate(()=>applyJsonObject({schema_version:'1.8',items:[{...itemById('A'),owner:'disk'}]},'reload','undo.json',null,{remember:false,writePermissionGranted:false}));expect(await page.evaluate(()=>({undo:undoStack.length,redo:redoStack.length}))).toEqual({undo:0,redo:0});
});
