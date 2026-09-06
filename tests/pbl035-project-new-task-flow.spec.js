const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',title:id,state:'未着手',owner:'',due:'2026-09-10',planned_duration_days:2,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:1,...extra});

async function boot(page,display='project-detail',items=[task('P')]){
  await page.setViewportSize({width:1280,height:720});
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(({display,items})=>{applyJsonObject({schema_version:'3.1',workspace_info_markdown:'',items},'pbl035','pbl035.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(display);clearUndoHistory('pbl035');dirty=false},{display,items});
}

async function createTop(page,title,due='2026-09-20'){
  await page.locator('#b_title').fill(title);
  await page.locator('#b_title').press('Enter');
  await expect(page.locator('#b_due')).toBeFocused();
  await page.locator('#b_due').fill(due);
  await page.locator('#b_due').press('Enter');
  return page.evaluate(title=>data.items.find(x=>x.title===title)?.id,title);
}

async function startChild(page,parent='P'){
  await page.locator(`.ganttRow[data-task-id="${parent}"] .taskAddBtn`).click();
  await page.getByRole('menuitem',{name:'1つ下の階層に追加'}).click();
  return page.evaluate(()=>draftTaskId);
}

async function finishDraft(page,id,title,due='2026-09-21'){
  const row=page.locator(`.ganttRow[data-task-id="${id}"]`);
  await row.locator('.titleText').fill(title);
  await row.locator('.titleText').press('Enter');
  const input=row.locator('input[type="text"]');
  await expect(input).toBeFocused();
  if(due===null){await input.fill('');await input.press('Enter')}
  else{await input.fill(due);await input.press('Enter')}
}

async function expectCreationFinished(page,id){
  await expect.poll(()=>page.evaluate(()=>({draftTaskId,draftStage}))).toEqual({draftTaskId:'',draftStage:''});
  expect(await page.evaluate(()=>document.activeElement?.classList?.contains('ganttInlineInput')||document.activeElement?.classList?.contains('plannedDays'))).toBe(false);
  expect(await page.evaluate(()=>taskDetailPaneOpen)).toBe(false);
}

for(const display of ['project-detail','project-simple'])test(`PBL035-ROOT ${display} top root finishes after Due`,async({page})=>{
  await boot(page,display);
  const before=await page.evaluate(()=>undoStack.length),id=await createTop(page,'ROOT-'+display);
  expect(id).toBeTruthy();
  await expectCreationFinished(page,id);
  expect(await page.evaluate(id=>({due:itemById(id).due,planned:itemById(id).planned_duration_days,undo:undoStack.length}),id)).toEqual({due:'2026-09-20',planned:undefined,undo:before+1});
});

test('PBL035-CHILD collapsed parent expands and child finishes after Due',async({page})=>{
  await boot(page,'project-detail',[task('P'),task('OLD',{parentId:'P'})]);
  await page.locator('.ganttRow[data-task-id="P"] .projectHierarchyDisclosure').click();
  const id=await startChild(page);
  expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('P'))).toBe(false);
  await finishDraft(page,id,'CHILD');
  await expectCreationFinished(page,id);
  expect(await page.evaluate(id=>({parent:itemById(id).parentId,due:itemById(id).due}),id)).toEqual({parent:'P',due:'2026-09-21'});
});

test('PBL035-MEMO child keeps Memo semantics and finishes after Due',async({page})=>{
  await boot(page,'project-detail',[task('M',{state:'メモ'})]);
  const id=await startChild(page,'M');
  await finishDraft(page,id,'MEMO-CHILD');
  await expectCreationFinished(page,id);
  expect(await page.evaluate(id=>({parent:itemById(id).parentId,state:itemById(id).state}),id)).toEqual({parent:'M',state:'メモ'});
});

test('PBL035-BLANK-DUE skipping Due finishes without changing empty-Due semantics',async({page})=>{
  await boot(page);
  const id=await startChild(page);
  await finishDraft(page,id,'NO-DUE',null);
  await expectCreationFinished(page,id);
  expect(await page.evaluate(id=>itemById(id).due,id)).toBe('');
});

test('PBL035-EXISTING existing Due editing stays outside creation continuation',async({page})=>{
  await boot(page);
  const row=page.locator('.ganttRow[data-task-id="P"]');
  await row.locator('.ganttDue').click();
  const input=row.locator('.ganttDueText');
  await input.fill('2026-09-22');
  await input.press('Enter');
  expect(await page.evaluate(()=>({due:itemById('P').due,draftTaskId,draftStage}))).toEqual({due:'2026-09-22',draftTaskId:'',draftStage:''});
  expect(await page.evaluate(()=>document.activeElement?.closest?.('.ganttPlanned')!==null)).toBe(false);
});

test('PBL035-PLANNED Planned Duration remains manually editable after creation',async({page})=>{
  await boot(page);
  const id=await createTop(page,'PLANNED'),cell=page.locator(`.ganttRow[data-task-id="${id}"] .ganttPlanned`);
  await cell.click();
  const input=cell.locator('.ganttInlineInput');
  await expect(input).toBeFocused();
  await input.fill('5');
  await input.press('Enter');
  expect(await page.evaluate(id=>itemById(id).planned_duration_days,id)).toBe(5);
});

test('PBL035-IME Project top full-width lifecycle commits once and does not enter Planned',async({page})=>{
  await boot(page);
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss()});
  await page.locator('#b_title').fill('IME');await page.locator('#b_title').press('Enter');
  const input=page.locator('#b_due'),before=await page.evaluate(()=>({count:data.items.length,undo:undoStack.length}));
  await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value='ｄ';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'ｄ',inputType:'insertCompositionText',isComposing:true}));el.value='ｄ０';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'０',inputType:'insertCompositionText',isComposing:true}))});
  await expect(input).not.toBeFocused();await page.waitForTimeout(150);expect(dialogs).toBe(0);expect(await page.evaluate(()=>data.items.length)).toBe(before.count);
  await input.dispatchEvent('compositionend',{data:'０'});
  await expect.poll(()=>page.evaluate(()=>data.items.length)).toBe(before.count+1);
  const id=await page.evaluate(()=>data.items.find(x=>x.title==='IME')?.id);await expectCreationFinished(page,id);
  expect(await page.evaluate(id=>({due:itemById(id).due,undo:undoStack.length,pending:dueImeShortcutPending}),id)).toEqual({due:await page.evaluate(()=>ymd()),undo:before.undo+1,pending:null});
  await page.waitForTimeout(150);expect(dialogs).toBe(0);
});
