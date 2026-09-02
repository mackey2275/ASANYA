const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

function task(id,extra={}){return{id,parentId:'',title:id,state:'',owner:'',due:'2026-08-20',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra}}
async function boot(page,items,mode='personal',projectView='list'){
  await page.evaluate(()=>{if(typeof dirty!=='undefined')dirty=false}).catch(()=>{});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,mode,projectView})=>{applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'Phase 2 workspace',items},'PBL2','pbl2.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);if(mode==='team')setProjectView(projectView);clearUndoHistory('pbl2')},{items,mode,projectView});
}
async function order(page,parentId='',mode='personal'){
  return page.evaluate(({parentId,mode})=>{const sample=data.items.find(x=>(x.parentId||'')===parentId),group=sample?moveGroup(data.items.indexOf(sample)):[];return group.map(p=>p.x.id)},{parentId,mode});
}
function row(page,id){return page.locator(`#ganttView .ganttRow[data-task-id="${id}"],#row_${id}`).first()}
async function dragAfter(page,source,target){
  const h=row(page,source).locator('.siblingDragHandle'),box=await h.boundingBox(),targetBox=await row(page,target).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2+10,{steps:2});
  await page.mouse.move(targetBox.x+40,targetBox.y+targetBox.height-2,{steps:5});await page.mouse.up();
}
async function dragBefore(page,source,target){
  const h=row(page,source).locator('.siblingDragHandle'),box=await h.boundingBox(),targetBox=await row(page,target).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2+10,{steps:2});
  await page.mouse.move(targetBox.x+40,targetBox.y+2,{steps:5});await page.mouse.up();
}

test('PBL2-DND-01 root siblings move down/up and first/last with one history entry',async({page})=>{
  await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000}),task('C',{sortOrder:3000})]);
  await expect(row(page,'A').locator('.siblingDragHandle')).toBeVisible();
  await dragAfter(page,'A','C');expect(await order(page)).toEqual(['B','C','A']);
  expect(await page.evaluate(()=>({undo:undoStack.length,action:undoStack.at(-1)?.actionType,selected:selectedTaskId,attention:sortAttentionTaskId}))).toEqual({undo:1,action:'manual_order',selected:'A',attention:'A'});
  await page.evaluate(()=>performUndo());expect(await order(page)).toEqual(['A','B','C']);
  await page.evaluate(()=>performRedo());expect(await order(page)).toEqual(['B','C','A']);
  await expect(row(page,'A')).not.toHaveClass(/sortMoveAnimating/,{timeout:4000});
  await dragBefore(page,'A','B');expect(await order(page)).toEqual(['A','B','C']);
});

test('PBL2-DND-02 child siblings reorder while hierarchy and descendant sortOrder remain unchanged',async({page})=>{
  await boot(page,[task('P'),task('A',{parentId:'P',sortOrder:1000}),task('A1',{parentId:'A',sortOrder:777}),task('B',{parentId:'P',sortOrder:2000})]);
  await dragAfter(page,'A','B');expect(await order(page,'P')).toEqual(['B','A']);
  expect(await page.evaluate(()=>({a:itemById('A'),a1:itemById('A1'),subtree:[...collectSubtreeIds('A')]}))).toMatchObject({a:{parentId:'P'},a1:{parentId:'A',sortOrder:777},subtree:['A','A1']});
  await expect(row(page,'A')).toHaveClass(/sortMovePrimary/);
});

test('PBL2-DND-03 different parent/date drops are invalid and create no mutation or history',async({page})=>{
  await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000}),task('X',{parentId:'B',sortOrder:1000}),task('D',{due:'2026-08-21',sortOrder:3000})]);
  const before=await page.evaluate(()=>JSON.stringify(data.items.map(x=>[x.id,x.parentId,x.due,x.sortOrder])));
  await dragAfter(page,'A','X');await dragAfter(page,'A','D');
  expect(await page.evaluate(()=>({items:JSON.stringify(data.items.map(x=>[x.id,x.parentId,x.due,x.sortOrder])),undo:undoStack.length}))).toEqual({items:before,undo:0});
});

test('PBL2-DND-04 click/short motion/title/Due do not reorder; Escape cancels active drag',async({page})=>{
  await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})]);
  const handle=row(page,'A').locator('.siblingDragHandle'),box=await handle.boundingBox();await page.mouse.click(box.x+5,box.y+5);
  await row(page,'A').locator('.titleText').click();await expect(row(page,'A').locator('.titleText')).toBeFocused();
  await page.evaluate(()=>document.activeElement.blur());await row(page,'A').locator('.dueTxt').click();await expect(row(page,'A').locator('input[type="text"]')).toBeVisible();
  await page.keyboard.press('Escape');await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();await page.mouse.move(box.x+5,box.y+20);await page.keyboard.press('Escape');await page.mouse.up();
  expect(await order(page)).toEqual(['A','B']);expect(await page.evaluate(()=>undoStack.length)).toBe(0);
});

test('PBL2-DND-05 Change Parent selection has priority over the handle',async({page})=>{
  await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})]);await page.evaluate(()=>openParentPicker('A'));
  await row(page,'B').locator('.siblingDragHandle').click();
  expect(await page.evaluate(()=>({candidate:pblParentSelectedId,drag:!!siblingDragState,undo:undoStack.length}))).toEqual({candidate:'B',drag:false,undo:0});
});

test('PBL2-DND-06 Project effective-start scope and List/Gantt shared order',async({page})=>{
  await boot(page,[task('A',{due:'2026-08-20',sortOrder:1000}),task('B',{due:'2026-08-20',sortOrder:2000}),task('C',{due:'2026-08-21',sortOrder:3000})],'team','list');
  await dragAfter(page,'A','B');expect(await order(page)).toEqual(['B','A']);
  await page.evaluate(()=>setProjectView('gantt'));expect(await order(page)).toEqual(['B','A']);
  const before=await page.evaluate(()=>({order:moveGroup(data.items.indexOf(itemById('A'))).map(p=>p.x.id),x:ganttTimelineScrollLeft,undo:undoStack.length}));
  await dragAfter(page,'A','C');expect(await page.evaluate(()=>({order:moveGroup(data.items.indexOf(itemById('A'))).map(p=>p.x.id),x:ganttTimelineScrollLeft,undo:undoStack.length}))).toEqual(before);
  await expect(page.locator('.ganttBar').first()).toBeVisible();
});

test('PBL2-DND-07 persisted sort order keeps Schema, hierarchy, and workspace information',async({page})=>{
  await boot(page,[task('P'),task('A',{parentId:'P',sortOrder:1000}),task('B',{parentId:'P',sortOrder:2000})]);await dragAfter(page,'A','B');
  const json=await page.evaluate(()=>persistableData());await page.evaluate(json=>applyJsonObject(json,'Reload','reload.json',null,{remember:false,writePermissionGranted:false}),json);
  expect(await page.evaluate(()=>({schema:data.schema_version,current:CURRENT_SCHEMA_VERSION,workspace:data.workspace_info_markdown,parentA:itemById('A').parentId,parentB:itemById('B').parentId,order:moveGroup(data.items.indexOf(itemById('A'))).map(p=>p.x.id)}))).toEqual({schema:'2.5',current:'2.5',workspace:'Phase 2 workspace',parentA:'P',parentB:'P',order:['B','A']});
});

test('PBL2-DND-08 vertical auto-scroll stops after cancellation and does not change horizontal Gantt scroll',async({page})=>{
  await page.setViewportSize({width:1100,height:520});const items=Array.from({length:45},(_,i)=>task('T'+i,{sortOrder:(i+1)*1000}));await boot(page,items,'team','gantt');
  const handle=row(page,'T0').locator('.siblingDragHandle');await handle.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await handle.boundingBox(),before=await page.evaluate(()=>({page:scrollY,list:document.getElementById('ganttView').scrollTop,x:ganttTimelineScrollLeft}));
  const bottom=await page.evaluate(()=>innerHeight-2);await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();await page.mouse.move(box.x+5,box.y+20,{steps:2});await page.mouse.move(box.x+5,bottom,{steps:5});await page.waitForTimeout(250);await page.keyboard.press('Escape');await page.mouse.up();
  const stopped=await page.evaluate(()=>({page:scrollY,list:document.getElementById('ganttView').scrollTop,x:ganttTimelineScrollLeft,raf:siblingDragAutoFrame}));await page.waitForTimeout(120);
  expect(stopped.page+stopped.list).toBeGreaterThan(before.page+before.list);expect(stopped.x).toBe(before.x);expect(stopped.raf).toBe(0);expect(await page.evaluate(()=>scrollY+document.getElementById('ganttView').scrollTop)).toBe(stopped.page+stopped.list);
});

test('PBL3-UI-01 ▲▼ column is gone while title handle remains and ToDo geometry aligns',async({page})=>{
  await page.setViewportSize({width:760,height:600});await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})]);
  expect(await page.evaluate(()=>cols())).toEqual(['done','child','impact','title','repeat','due','summary']);
  await expect(page.locator('[data-c="move"],.moveBtns,.moveBtn')).toHaveCount(0);await expect(row(page,'A').locator('.siblingDragHandle')).toBeVisible();
  const geometry=await page.evaluate(()=>({heads:document.querySelectorAll('#head th').length,cells:document.querySelectorAll('#row_A>td').length,cols:document.querySelectorAll('#cols col').length,titleIndex:[...document.querySelectorAll('#head th')].findIndex(x=>x.dataset.c==='title'),handleInTitle:!!document.querySelector('#row_A td.title .titleWrap>.siblingDragHandle')}));
  expect(geometry).toEqual({heads:7,cells:7,cols:7,titleIndex:3,handleInTitle:true});
});

test('PBL3-UI-02 Project header, draft, rows and timeline align without an ordering column',async({page})=>{
  await page.setViewportSize({width:820,height:620});await boot(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})],'team','gantt');
  expect(await page.evaluate(()=>cols())).toEqual(['done','child','impact','state','title','owner','planned','repeat','due','summary']);await expect(page.locator('#ganttView [data-c="move"],#ganttView .moveBtn')).toHaveCount(0);
  const aligned=await page.evaluate(()=>{const head=document.querySelector('.ganttHeader .projectInfoTable'),draft=document.querySelector('.projectTopDraftRow .projectInfoTable'),task=document.querySelector('.ganttRow[data-task-id="A"] .projectInfoTable'),clip=document.querySelector('.ganttHeader .ganttTimelineClip'),h=head.getBoundingClientRect(),d=draft.getBoundingClientRect(),r=task.getBoundingClientRect(),c=clip.getBoundingClientRect();return{widths:[h.width,d.width,r.width],gap:c.left-h.right,headCells:head.querySelectorAll('th').length,rowCells:task.querySelectorAll('td').length,handle:!!task.querySelector('.ganttTaskName .siblingDragHandle')}});
  expect(Math.max(...aligned.widths)-Math.min(...aligned.widths)).toBeLessThan(1);expect(Math.abs(aligned.gap)).toBeLessThan(1);expect(aligned).toMatchObject({headCells:10,rowCells:10,handle:true});
});

async function createDraftDue(page){await page.evaluate(()=>{selectedTaskId='BASE';startDraftTask('sibling');commitDraftTitle(draftTaskId,'NEW')});return page.locator('.draftRow input[type="text"]:visible').last()}
async function composePair(input,prefix,digit){await input.evaluate((el,{prefix,digit})=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value=prefix;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:prefix,inputType:'insertCompositionText',isComposing:true}));el.value=prefix+digit;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:digit,inputType:'insertCompositionText',isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:digit}))},{prefix,digit})}
async function blankDue(page,title='NEW'){await page.locator('#b_title').fill(title);await page.locator('#b_title').press('Enter');return page.locator('#b_due')}
async function composeSeparate(input,prefix,digit){await input.evaluate((el,{prefix,digit})=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value=prefix;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:prefix,inputType:'insertCompositionText',isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:prefix}));el.value=digit;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:digit,inputType:'insertText',isComposing:false}))},{prefix,digit})}

test('PBL2-DUE-HQA-01 top new-row separate ｄ/Ｄ then 0 reaches shared handler once',async({page})=>{
  let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss()});for(const prefix of ['ｄ','Ｄ']){await boot(page,[task('BASE')]);const input=await blankDue(page,'TOP-'+prefix),before=await page.evaluate(()=>({count:data.items.length,undo:undoStack.length,y:scrollY}));await composeSeparate(input,prefix,'0');await expect.poll(()=>page.evaluate(()=>data.items.length)).toBe(before.count+1);expect(await page.evaluate(title=>{const x=data.items.find(t=>t.title===title);return{due:x?.due,count:data.items.filter(t=>t.title===title).length,undo:undoStack.length,y:scrollY,residue:document.getElementById('b_due')?.value}},'TOP-'+prefix)).toEqual({due:await page.evaluate(()=>ymd()),count:1,undo:before.undo+1,y:before.y,residue:''})}expect(dialogs).toBe(0)
});

test('PBL2-DUE-HQA-02 top new-row combined IME pair and full-width digit commit without stale blur validation',async({page})=>{
  let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss()});for(const [prefix,digit,n] of [['ｄ','０',0],['Ｄ','９',9]]){await boot(page,[task('BASE')]);const input=await blankDue(page,'PAIR-'+n),before=await page.evaluate(()=>({count:data.items.length,undo:undoStack.length,y:scrollY}));await input.evaluate((el,{prefix,digit})=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value=prefix;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:prefix,inputType:'insertCompositionText',isComposing:true}));el.value=prefix+digit;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:digit,inputType:'insertCompositionText',isComposing:true}));return{pending:{...dueImeShortcutPending},focused:document.activeElement===el,value:el.value}},{prefix,digit});expect(await page.evaluate(()=>({kind:dueImeShortcutPending?.targetKind,taskId:dueImeShortcutPending?.taskId,finishing:dueImeShortcutPending?.finishingRequested}))).toEqual({kind:'blank',taskId:'',finishing:true});await input.dispatchEvent('compositionend',{data:digit});await expect.poll(()=>page.evaluate(()=>data.items.length)).toBe(before.count+1);expect(await page.evaluate(({title,n})=>{const x=data.items.find(t=>t.title===title);return{due:x?.due,expected:addDays(ymd(),n),count:data.items.filter(t=>t.title===title).length,undo:undoStack.length,y:scrollY,pending:dueImeShortcutPending}}, {title:'PAIR-'+n,n})).toEqual({due:await page.evaluate(n=>addDays(ymd(),n),n),expected:await page.evaluate(n=>addDays(ymd(),n),n),count:1,undo:before.undo+1,y:before.y,pending:null});await page.waitForTimeout(150);expect(await page.evaluate(()=>data.items.length)).toBe(before.count+1)}expect(dialogs).toBe(0)
});

test('PBL2-DUE-HQA-03 top new-row normal Due entry and later editing stay valid',async({page})=>{
  await boot(page,[task('BASE')]);const input=await blankDue(page,'NORMAL');await input.fill('2026-09-02');await input.press('Enter');const id=await page.evaluate(()=>data.items.find(x=>x.title==='NORMAL')?.id);expect(await page.evaluate(id=>itemById(id)?.due,id)).toBe('2026-09-02');await row(page,id).locator('.dueTxt').click();const edit=row(page,id).locator('input[type="text"]');await edit.fill('2026-09-03');await edit.press('Enter');expect(await page.evaluate(id=>itemById(id)?.due,id)).toBe('2026-09-03')
});

test('PBL2-DUE-01 new-row full-width ｄ/Ｄ + 0 commits once without literal/error/scroll',async({page})=>{
  let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss()});for(const prefix of ['ｄ','Ｄ']){await boot(page,[task('BASE')]);const input=await createDraftDue(page);const before=await page.evaluate(()=>({y:scrollY,history:undoStack.length}));await composePair(input,prefix,'０');await expect.poll(()=>page.evaluate(()=>draftTaskId)).toBe('');expect(await page.evaluate(()=>({due:itemById(selectedTaskId).due,y:scrollY,history:undoStack.length,title:itemById(selectedTaskId).title}))).toEqual({due:await page.evaluate(()=>ymd()),y:before.y,history:before.history+1,title:'NEW'})}expect(dialogs).toBe(0)
});

test('PBL2-DUE-02 new-row full-width shortcut supports 0-9 and subsequent normal Due editing',async({page})=>{
  for(let n=0;n<=9;n++){await boot(page,[task('BASE')]);const input=await createDraftDue(page);await composePair(input,n%2?'Ｄ':'ｄ','０１２３４５６７８９'[n]);await expect.poll(()=>page.evaluate(()=>draftTaskId)).toBe('');expect(await page.evaluate(n=>itemById(selectedTaskId).due===addDays(ymd(),n),n)).toBe(true)}
  const id=await page.evaluate(()=>selectedTaskId);await row(page,id).locator('.dueTxt').click();const edit=row(page,id).locator('input[type="text"]');await edit.fill('2026-09-01');await edit.press('Enter');expect(await page.evaluate(id=>itemById(id).due,id)).toBe('2026-09-01');
});

test('PBL2-DUE-03 established-row full-width ｄ/Ｄ path remains immediate and single-commit',async({page})=>{
  for(const prefix of ['ｄ','Ｄ']){await boot(page,[task('BASE')]);await row(page,'BASE').locator('.dueTxt').click();const input=row(page,'BASE').locator('input[type="text"]'),before=await page.evaluate(()=>undoStack.length);await composePair(input,prefix,'０');await expect.poll(()=>page.evaluate(()=>itemById('BASE').due)).toBe(await page.evaluate(()=>ymd()));expect(await page.evaluate(()=>undoStack.length)).toBe(before+1)}
});
