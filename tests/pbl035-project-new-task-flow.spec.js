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

test('PBL035-PROJECT-SUMMARY-ENTER uncommitted top row commits title and Summary before leaving',async({page})=>{
  await boot(page,'project-detail',[task('P'),task('Q',{sortOrder:2000})]);const before=await page.evaluate(()=>({count:data.items.length,undo:undoStack.length}));
  await page.locator('#b_title').fill('Summary-first task');
  expect(await page.evaluate(()=>({count:data.items.length,found:data.items.some(x=>x.title==='Summary-first task')}))).toEqual({count:before.count,found:false});
  await page.locator('#b_summary').fill('Summary entered before Due');
  expect(await page.evaluate(()=>data.items.some(x=>x.title==='Summary-first task'))).toBe(false);
  await page.locator('#b_summary').press('Enter');
  const id=await page.evaluate(()=>data.items.find(x=>x.title==='Summary-first task')?.id);expect(id).toBeTruthy();
  await page.locator('.ganttRow[data-task-id="P"] .ganttTaskName').click();await page.locator('.ganttRow[data-task-id="Q"] .ganttTaskName').click();
  expect(await page.evaluate(({id,before})=>({count:data.items.length,task:itemById(id)&&{title:itemById(id).title,summary:itemById(id).summary},persisted:persistableData().items.find(x=>x.id===id)?.summary,undoDelta:undoStack.length-before.undo}),{id,before})).toEqual({count:before.count+1,task:{title:'Summary-first task',summary:'Summary entered before Due'},persisted:'Summary entered before Due',undoDelta:1});
  await page.keyboard.press('Control+z');expect(await page.evaluate(id=>!!itemById(id),id)).toBe(false);
  await page.keyboard.press('Control+y');expect(await page.evaluate(id=>({title:itemById(id)?.title,summary:itemById(id)?.summary}),id)).toEqual({title:'Summary-first task',summary:'Summary entered before Due'});
});

test('PBL035-PROJECT-EXISTING-ROW-ENTER Summary Enter finalizes a same-level draft immediately',async({page})=>{
  await boot(page,'project-detail',[task('P'),task('Q',{sortOrder:2000})]);await page.evaluate(()=>selectTask('P'));await page.keyboard.press('Enter');
  const id=await page.evaluate(()=>draftTaskId),row=page.locator(`.ganttRow[data-task-id="${id}"]`);expect(id).toBeTruthy();await expect(row.locator('.ganttDraftTitle')).toBeVisible();
  await row.locator('.ganttDraftTitle').fill('Sibling from Enter');await row.locator('.hierarchyDraftSummary').fill('Summary from Enter');await row.locator('.hierarchyDraftSummary').press('Enter');
  expect(await page.evaluate(()=>({draftTaskId,draftStage}))).toEqual({draftTaskId:'',draftStage:''});
  await page.locator('.ganttRow[data-task-id="Q"] .ganttTaskName').click();
  expect(await page.evaluate(id=>({count:data.items.filter(x=>x.title==='Sibling from Enter').length,task:itemById(id)&&{parentId:itemById(id).parentId,title:itemById(id).title,summary:itemById(id).summary},serialized:persistableData().items.filter(x=>x.title==='Sibling from Enter').length}),id)).toEqual({count:1,task:{parentId:'',title:'Sibling from Enter',summary:'Summary from Enter'},serialized:1});
  await page.keyboard.press('Control+z');expect(await page.evaluate(id=>!!itemById(id),id)).toBe(false);await page.keyboard.press('Control+y');expect(await page.evaluate(id=>({title:itemById(id)?.title,summary:itemById(id)?.summary}),id)).toEqual({title:'Sibling from Enter',summary:'Summary from Enter'});
});

function manyProjectTasks(count=40){return Array.from({length:count},(_,i)=>task(`P${String(i+1).padStart(2,'0')}`,{title:`Project task ${i+1}`,due:`2027-01-${String((i%28)+1).padStart(2,'0')}`,sortOrder:(i+1)*1000}))}

async function expectVisibleProjectRow(page,id){
  await expect.poll(()=>page.evaluate(id=>{const row=renderedTaskRow(id);if(!row)return false;const scroller=taskVerticalScroller(row),pageScroll=scroller===document.scrollingElement||scroller===document.documentElement||scroller===document.body,view=pageScroll?{top:0,bottom:innerHeight}:scroller.getBoundingClientRect(),header=document.querySelector('#ganttView .ganttHeader'),hr=header?.getBoundingClientRect(),visibleTop=hr&&hr.top<=view.top+1&&hr.bottom>view.top?Math.max(view.top,hr.bottom):view.top,rr=row.getBoundingClientRect();return rr.top>=visibleTop-1&&rr.bottom<=view.bottom+1},id)).toBe(true);
}

async function startSummaryFirstSibling(page,title){
  await page.evaluate(()=>selectTask('P01'));await page.keyboard.press('Enter');const id=await page.evaluate(()=>draftTaskId);expect(id).toBeTruthy();const row=page.locator(`.ganttRow[data-task-id="${id}"]`);await row.locator('.ganttDraftTitle').fill(title);await row.locator('.hierarchyDraftSummary').fill(`Summary for ${title}`);await row.locator('.hierarchyDraftSummary').press('Enter');return id;
}

test('PBL035-PROJECT-AUTOFOLLOW empty Due follows the newly committed bottom row after sorting and preserves Undo/Redo',async({page})=>{
  await boot(page,'project-detail',manyProjectTasks());const id=await startSummaryFirstSibling(page,'Auto-follow empty Due');
  await expectVisibleProjectRow(page,id);
  const result=await page.evaluate(id=>{const rowIds=[...document.querySelectorAll('#ganttView .ganttRow[data-task-id]')].map(row=>row.dataset.taskId);return{id:itemById(id)?.id,title:itemById(id)?.title,summary:itemById(id)?.summary,due:itemById(id)?.due,count:data.items.filter(x=>x.title==='Auto-follow empty Due').length,persisted:persistableData().items.filter(x=>x.id===id).length,lastRow:rowIds.at(-1),history:undoStack.length}},id);
  expect(result).toMatchObject({id,title:'Auto-follow empty Due',summary:'Summary for Auto-follow empty Due',due:'',count:1,persisted:1,lastRow:id,history:1});
  await page.keyboard.press('Control+z');expect(await page.evaluate(id=>!!itemById(id),id)).toBe(false);await page.keyboard.press('Control+y');expect(await page.evaluate(id=>({title:itemById(id)?.title,summary:itemById(id)?.summary,due:itemById(id)?.due}),id)).toEqual({title:'Auto-follow empty Due',summary:'Summary for Auto-follow empty Due',due:''});
});

test('PBL035-PROJECT-AUTOFOLLOW valid Due follows the same Task ID at its normal sorted position',async({page})=>{
  await boot(page,'project-detail',manyProjectTasks());
  await page.evaluate(()=>selectTask('P01'));await page.keyboard.press('Enter');const id=await page.evaluate(()=>draftTaskId);expect(id).toBeTruthy();await page.evaluate(id=>{itemById(id).due='2028-12-31'},id);
  const row=page.locator(`.ganttRow[data-task-id="${id}"]`);await row.locator('.ganttDraftTitle').fill('Auto-follow valid Due');await row.locator('.hierarchyDraftSummary').fill('Summary for valid Due');await row.locator('.hierarchyDraftSummary').press('Enter');
  await expectVisibleProjectRow(page,id);
  expect(await page.evaluate(id=>{const rows=[...document.querySelectorAll('#ganttView .ganttRow[data-task-id]')];return{id:itemById(id)?.id,due:itemById(id)?.due,title:itemById(id)?.title,summary:itemById(id)?.summary,count:data.items.filter(x=>x.title==='Auto-follow valid Due').length,lastRow:rows.at(-1)?.dataset.taskId}},id)).toEqual({id,due:'2028-12-31',title:'Auto-follow valid Due',summary:'Summary for valid Due',count:1,lastRow:id});
});

test('PBL035-PROJECT-SUMMARY-LEAVE composition-confirmed Summary survives immediate selection of another row',async({page})=>{
  await boot(page,'project-detail');await page.locator('#b_title').fill('Summary composition task');const summary=page.locator('#b_summary');await summary.fill('日本語の概要');
  await summary.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:229,which:229,isComposing:true,bubbles:true,cancelable:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'日本語の概要'}))});
  expect(await page.evaluate(()=>data.items.some(x=>x.title==='Summary composition task'))).toBe(false);
  await page.locator('.ganttRow[data-task-id="P"] .ganttTaskName').click();await expect.poll(()=>page.evaluate(()=>data.items.some(x=>x.title==='Summary composition task'))).toBe(true);
  const created=await page.evaluate(()=>data.items.find(x=>x.title==='Summary composition task'));
  expect(created.summary).toBe('日本語の概要');
});

test('PBL035-PROJECT-TOP-DRAFT invalid entered Due blocks row selection without discarding fields',async({page})=>{
  await boot(page,'project-detail');let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss()});
  await page.locator('#b_title').fill('Invalid due draft');await page.locator('#b_due').fill('not a date');await page.locator('#b_summary').fill('Keep this Summary');
  await page.locator('.ganttRow[data-task-id="P"] .ganttTaskName').click();
  expect(dialogs).toBeLessThanOrEqual(1);expect(await page.evaluate(()=>({draft:document.getElementById('blank')?.id,title:document.getElementById('b_title')?.value,due:document.getElementById('b_due')?.value,summary:document.getElementById('b_summary')?.value,selected:selectedTaskId,created:data.items.some(x=>x.title==='Invalid due draft')}))).toEqual({draft:'blank',title:'Invalid due draft',due:'not a date',summary:'Keep this Summary',selected:'P',created:false});
});

test('PBL035-PROJECT-TOP-DRAFT invalid planned duration blocks row selection without discarding fields',async({page})=>{
  await boot(page,'project-detail');await page.locator('#b_title').fill('Invalid planned draft');await page.locator('#b_planned').fill('1.5');await page.locator('#b_summary').fill('Keep this Summary');
  await page.locator('.ganttRow[data-task-id="P"] .ganttTaskName').click();
  expect(await page.evaluate(()=>({draft:document.getElementById('blank')?.id,title:document.getElementById('b_title')?.value,planned:document.getElementById('b_planned')?.value,summary:document.getElementById('b_summary')?.value,selected:selectedTaskId,created:data.items.some(x=>x.title==='Invalid planned draft')}))).toEqual({draft:'blank',title:'Invalid planned draft',planned:'1.5',summary:'Keep this Summary',selected:'P',created:false});
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
