const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',title:`Task ${id}`,state:'未着手',owner:'',due:'2026-09-30',planned_duration_days:2,summary:`summary ${id} alpha beta gamma`,repeat:'',completed:false,dependencies:[],sortOrder:id==='A'?1000:2000,impact_level:1,...extra});
const fixture=()=>[task('A'),task('B')];

async function loadData(page){
  await page.evaluate(items=>{applyJsonObject({schema_version:'3.1',workspace_info_markdown:'PBL-040',items},'pbl040','pbl040.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode('project-detail');clearUndoHistory('pbl040');dirty=false;saveState='saved'},fixture());
}
async function boot(page,width=1280){
  await page.setViewportSize({width,height:720});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await loadData(page);
}
async function openSummary(page,id='A'){
  await page.locator(`.ganttRow[data-task-id="${id}"] .sum`).click();await expect(page.locator('.summaryModal')).toBeVisible();
}
const modalBox=page=>page.locator('.summaryModal').boundingBox();
async function dragHeader(page,deltaX,deltaY=0){
  const box=await page.locator('.summaryModal .askMsg').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+deltaX,y+deltaY,{steps:6});await page.mouse.up();
}
async function pointerStroke(page,locator,deltaX=80,deltaY=20){
  const box=await locator.boundingBox(),x=box.x+Math.min(30,box.width/3),y=box.y+Math.min(20,box.height/3);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+deltaX,y+deltaY,{steps:5});await page.mouse.up();
}
const near=(actual,expected,tolerance=1.5)=>expect(Math.abs(actual-expected)).toBeLessThanOrEqual(tolerance);

test('PBL040-01 first wide open uses the existing centered position',async({page})=>{
  await boot(page);await openSummary(page);const box=await modalBox(page);near(box.x,(1280-box.width)/2);expect(await page.evaluate(()=>pbl040SummaryModalOffsetX)).toBe(0);
});

test('PBL040-02 header drag moves horizontally only and keeps the modal open and focused',async({page})=>{
  await boot(page);await openSummary(page);const before=await modalBox(page);await dragHeader(page,-180,80);const after=await modalBox(page);expect(after.x).toBeLessThan(before.x-150);near(after.y,before.y);await expect(page.locator('.summaryModal')).toBeVisible();await expect(page.locator('#summaryModalText')).toBeFocused();
});

test('PBL040-03 three-pixel threshold ignores jitter and accepts intended movement',async({page})=>{
  await boot(page);await openSummary(page);const before=await modalBox(page);await dragHeader(page,2);let after=await modalBox(page);near(after.x,before.x);await dragHeader(page,4);after=await modalBox(page);expect(after.x).toBeGreaterThan(before.x+2.5);
});

test('PBL040-04 left clamp preserves the 20px viewport gutter',async({page})=>{
  await boot(page);await openSummary(page);await dragHeader(page,-3000);const box=await modalBox(page);near(box.x,20,1);
});

test('PBL040-05 right clamp preserves the 20px viewport gutter',async({page})=>{
  await boot(page);await openSummary(page);await dragHeader(page,3000);const box=await modalBox(page);near(box.x+box.width,1260,1);
});

test('PBL040-06 drag preserves textarea focus, selection, and text',async({page})=>{
  await boot(page);await openSummary(page);await page.locator('#summaryModalText').evaluate(el=>{el.focus();el.setSelectionRange(8,15)});const before=await page.evaluate(()=>({value:summaryModalText.value,start:summaryModalText.selectionStart,end:summaryModalText.selectionEnd}));await dragHeader(page,-120);await expect(page.locator('#summaryModalText')).toBeFocused();expect(await page.evaluate(()=>({value:summaryModalText.value,start:summaryModalText.selectionStart,end:summaryModalText.selectionEnd}))).toEqual(before);
});

test('PBL040-07 textarea, path, and action controls are not drag surfaces',async({page})=>{
  await boot(page);await openSummary(page);const before=await modalBox(page);await pointerStroke(page,page.locator('#summaryModalText'));let after=await modalBox(page);near(after.x,before.x);await pointerStroke(page,page.locator('.summaryModalPath'));after=await modalBox(page);near(after.x,before.x);await pointerStroke(page,page.locator('#summaryModalSave'),80,0);after=await modalBox(page);near(after.x,before.x);await pointerStroke(page,page.locator('#summaryModalCancel'),-80,0);after=await modalBox(page);near(after.x,before.x);await expect(page.locator('.summaryModal')).toBeVisible();
});

test('PBL040-08 close and reopen retain runtime position across same and different tasks',async({page})=>{
  await boot(page);await openSummary(page,'A');await dragHeader(page,-150);const moved=await modalBox(page);await page.locator('#summaryModalCancel').click();await openSummary(page,'A');near((await modalBox(page)).x,moved.x);await page.locator('#summaryModalCancel').click();await openSummary(page,'B');near((await modalBox(page)).x,moved.x);
});

test('PBL040-09 reload resets the runtime position without persisted UI state',async({page})=>{
  await boot(page);await openSummary(page);await dragHeader(page,-160);expect(await page.evaluate(()=>pbl040SummaryModalOffsetX)).toBeLessThan(-100);await page.reload();await loadData(page);await openSummary(page);const box=await modalBox(page);near(box.x,(1280-box.width)/2);expect(await page.evaluate(()=>({offset:pbl040SummaryModalOffsetX,stored:localStorage.getItem('pbl040SummaryModalOffsetX')}))).toEqual({offset:0,stored:null});
});

test('PBL040-10 resize above the breakpoint immediately re-clamps the modal',async({page})=>{
  await boot(page);await openSummary(page);await dragHeader(page,-3000);await page.setViewportSize({width:900,height:720});await expect.poll(async()=>{const box=await modalBox(page);return box.x>=19.5&&box.x+box.width<=880.5}).toBe(true);
});

test('PBL040-11 761 enables drag while 760 disables it and centers the modal',async({page})=>{
  await boot(page,761);await openSummary(page);const at761=await modalBox(page);await dragHeader(page,-12);expect((await modalBox(page)).x).toBeLessThan(at761.x-8);await page.setViewportSize({width:760,height:720});await expect.poll(async()=>{const box=await modalBox(page);return Math.abs(box.x-(760-box.width)/2)<=1.5}).toBe(true);const centered=await modalBox(page);near(centered.x,(760-centered.width)/2);expect(await page.locator('.summaryModal').evaluate(el=>getComputedStyle(el).transform)).toBe('none');await dragHeader(page,20);near((await modalBox(page)).x,centered.x);
});

test('PBL040-12 wide narrow wide centers temporarily and restores the remembered offset',async({page})=>{
  await boot(page);await openSummary(page);await dragHeader(page,-150);const moved=await modalBox(page),offset=await page.evaluate(()=>pbl040SummaryModalOffsetX);await page.setViewportSize({width:760,height:720});await expect.poll(async()=>{const box=await modalBox(page);return Math.abs(box.x-(760-box.width)/2)<=1.5}).toBe(true);let box=await modalBox(page);near(box.x,(760-box.width)/2);expect(await page.evaluate(()=>pbl040SummaryModalOffsetX)).toBe(offset);await page.setViewportSize({width:1280,height:720});await expect.poll(async()=>Math.abs((await modalBox(page)).x-moved.x)<=1.5).toBe(true);box=await modalBox(page);near(box.x,moved.x);expect(await page.evaluate(()=>pbl040SummaryModalOffsetX)).toBe(offset);
});

test('PBL040-13 synthetic composition does not block drag or corrupt the Summary textarea',async({page})=>{
  // Native IME conversion requires Human QA and may end when the header is operated. Synthetic events verify only that ASANYA does not intentionally block drag or corrupt textarea state.
  await boot(page);await openSummary(page);const text=page.locator('#summaryModalText'),before=await modalBox(page),value=await text.inputValue();await text.dispatchEvent('compositionstart',{data:'変換'});await dragHeader(page,-120);expect((await modalBox(page)).x).toBeLessThan(before.x-100);await expect(text).toBeFocused();await expect(page.locator('.summaryModal')).toBeVisible();await expect(text).toHaveValue(value);expect(await page.evaluate(()=>pbl040SummaryModalDrag)).toBeNull();await text.dispatchEvent('compositionend',{data:'変換'});await text.evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));await text.type('!');await expect(text).toHaveValue(value+'!');
});

test('PBL040-14 opening and dragging are runtime-only and do not mutate product state',async({page})=>{
  await boot(page);await page.evaluate(()=>selectTask('A'));await openSummary(page);const before=await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,undo:undoStack.length,redo:redoStack.length,selectedTaskId,summary:itemById('A').summary}));await dragHeader(page,-140);expect(await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,undo:undoStack.length,redo:redoStack.length,selectedTaskId,summary:itemById('A').summary}))).toEqual(before);
});

test('PBL040-15 moved modal preserves Save, Cancel, and backdrop-close lifecycle',async({page})=>{
  await boot(page);await openSummary(page,'A');await dragHeader(page,-120);await page.locator('#summaryModalText').fill('saved');await page.locator('#summaryModalSave').click();expect(await page.evaluate(()=>itemById('A').summary)).toBe('saved');await openSummary(page,'B');await dragHeader(page,80);await page.locator('#summaryModalText').fill('cancelled');await page.locator('#summaryModalCancel').click();expect(await page.evaluate(()=>itemById('B').summary)).toBe('summary B alpha beta gamma');await openSummary(page,'B');await page.locator('#summaryModalText').fill('outside');await page.mouse.click(5,360);await expect(page.locator('.summaryModal')).toHaveCount(0);expect(await page.evaluate(()=>itemById('B').summary)).toBe('summary B alpha beta gamma');
});
