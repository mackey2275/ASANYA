const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,parentId='',extra={})=>({id,parentId,title:`Task ${id}`,state:'未着手',owner:'',due:'2026-09-30',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:1,...extra});
const fixture=()=>[task('A'),task('B','A'),task('X','',{sortOrder:2000}),task('M','',{sortOrder:3000,state:'メモ'})];
async function boot(page,width=1280,display='project-detail'){
  await page.setViewportSize({width,height:720});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,display})=>{applyJsonObject({schema_version:'3.1',workspace_info_markdown:'PBL-038',items},'pbl038','pbl038.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(display);clearUndoHistory('pbl038');dirty=false;saveState='saved';openTaskDetailPane('A')},{items:fixture(),display});
}
const paneBox=page=>page.locator('#taskDetailPane').boundingBox();
async function dragHeader(page,deltaX,deltaY=0){const box=await page.locator('#taskDetailPane .taskDetailPaneHeader').boundingBox();await page.mouse.move(box.x+90,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+90+deltaX,box.y+box.height/2+deltaY,{steps:6});await page.mouse.up()}
const near=(actual,expected,tolerance=1.5)=>expect(Math.abs(actual-expected)).toBeLessThanOrEqual(tolerance);

test('PBL038-CORE-01 eligible header pointer drag moves only horizontally',async({page})=>{
  await boot(page);const before=await paneBox(page);await dragHeader(page,-240,80);const after=await paneBox(page);
  expect(after.x).toBeLessThan(before.x-200);near(after.y,before.y);near(after.width,before.width);near(after.height,before.height);near(after.y+after.height,before.y+before.height);
  expect(await page.locator('#taskDetailPane').evaluate(el=>getComputedStyle(el).top)).toBe('52px');
});

test('PBL038-CORE-02 left and right clamps keep the pane reachable and preserve Project scroll',async({page})=>{
  await boot(page);
  await expect.poll(()=>page.locator('.projectOuterScrollDock').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>{const dock=document.querySelector('.projectOuterScrollDock');dock.scrollLeft=37;dock.dispatchEvent(new Event('scroll'));const unified=document.querySelector('.projectUnified');if(unified)unified.scrollTop=19});
  await expect.poll(()=>page.evaluate(()=>({outer:ganttView.scrollLeft,dock:document.querySelector('.projectOuterScrollDock').scrollLeft}))).toEqual({outer:37,dock:37});
  const beforeScroll=await page.evaluate(()=>({outer:ganttView.scrollLeft,vertical:document.querySelector('.projectUnified')?.scrollTop||0}));
  await dragHeader(page,-3000);let box=await paneBox(page);expect(box.x).toBeGreaterThanOrEqual(7);await dragHeader(page,3000);box=await paneBox(page);near(box.x+box.width,1280-14,2);
  await expect.poll(()=>page.evaluate(()=>({outer:ganttView.scrollLeft,dock:document.querySelector('.projectOuterScrollDock').scrollLeft,vertical:document.querySelector('.projectUnified')?.scrollTop||0}))).toEqual({...beforeScroll,dock:beforeScroll.outer});
});

test('PBL038-CORE-03 close control never drags and explicit close/reopen preserves offset',async({page})=>{
  await boot(page);await dragHeader(page,-180);const moved=await paneBox(page);await page.locator('.taskDetailPaneClose').click();await expect(page.locator('#taskDetailPane')).toBeHidden();expect(await page.evaluate(()=>pbl038TaskDetailOffsetX)).toBeLessThan(-100);await page.evaluate(()=>openTaskDetailPane('A'));const reopened=await paneBox(page);near(reopened.x,moved.x);
});

test('PBL038-CORE-04 body interactions do not drag or create persistence/history state',async({page})=>{
  await boot(page);await dragHeader(page,-160);const before=await paneBox(page);const state=await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,undo:undoStack.length,redo:redoStack.length,revision:dataRevision}));const body=page.locator('.taskDetailPaneBody');const bodyBox=await body.boundingBox();await page.mouse.move(bodyBox.x+80,bodyBox.y+80);await page.mouse.down();await page.mouse.move(bodyBox.x+240,bodyBox.y+130,{steps:4});await page.mouse.up();await body.evaluate(el=>el.scrollTop=40);const after=await paneBox(page);near(after.x,before.x);expect(await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,undo:undoStack.length,redo:redoStack.length,revision:dataRevision}))).toEqual(state);
});

test('PBL038-CORE-05 task switching, same-task toggle, Memo, and view switching share one runtime position',async({page})=>{
  await boot(page);await dragHeader(page,-210);const moved=await paneBox(page);await page.evaluate(()=>openTaskDetailPane('X'));near((await paneBox(page)).x,moved.x);expect(await page.evaluate(()=>taskDetailPaneTaskId)).toBe('X');await page.evaluate(()=>pbl033ToggleTaskDetail('X'));await expect(page.locator('#taskDetailPane')).toBeHidden();await page.evaluate(()=>pbl033ToggleTaskDetail('X'));near((await paneBox(page)).x,moved.x);await page.evaluate(()=>{setDisplayMode('project-simple');openTaskDetailPane('M')});near((await paneBox(page)).x,moved.x);expect(await page.locator('.taskDetailTitleInput')).toHaveValue('Task M');await page.evaluate(()=>setDisplayMode('todo-tree'));near((await paneBox(page)).x,moved.x);
});

test('PBL038-RESPONSIVE-01 narrow disables drag and wide-narrow-wide restores the reclamped runtime offset',async({page})=>{
  await boot(page);await dragHeader(page,-220);const wide=await paneBox(page);const offset=await page.evaluate(()=>pbl038TaskDetailOffsetX);await page.setViewportSize({width:760,height:720});const narrow=await paneBox(page);expect(await page.locator('#taskDetailPane').evaluate(el=>getComputedStyle(el).transform)).toBe('none');await dragHeader(page,-120);near((await paneBox(page)).x,narrow.x);expect(await page.evaluate(()=>pbl038TaskDetailOffsetX)).toBe(offset);await page.setViewportSize({width:1280,height:720});near((await paneBox(page)).x,wide.x,2);
});

test('PBL038-RESPONSIVE-02 resize reclamps and reload returns to the default right position',async({page})=>{
  await boot(page,1500);await dragHeader(page,-3000);await page.setViewportSize({width:900,height:720});let box=await paneBox(page);expect(box.x).toBeGreaterThanOrEqual(7);expect(box.x+box.width).toBeLessThanOrEqual(892);await page.reload();await page.evaluate(async items=>{await applyJsonObject({schema_version:'3.1',workspace_info_markdown:'PBL-038',items},'pbl038','pbl038.json',null,{remember:false,writePermissionGranted:false});openTaskDetailPane('A')},fixture());box=await paneBox(page);near(box.x+box.width,900-14,2);expect(await page.evaluate(()=>pbl038TaskDetailOffsetX)).toBe(0);
});

test('PBL038-CONTRACT-01 Help stacking and fixed Task Detail geometry remain authoritative',async({page})=>{
  await boot(page);await dragHeader(page,-140);const contract=await page.evaluate(()=>{openHelp();const pane=getComputedStyle(taskDetailPane),help=getComputedStyle(document.getElementById('helpPopover'));return{top:pane.top,bottom:pane.bottom,width:pane.width,z:Number(pane.zIndex),helpZ:Number(help.zIndex),position:pane.position,bodyOverflow:getComputedStyle(taskDetailPane.querySelector('.taskDetailPaneBody')).overflowY}});expect(contract).toEqual({top:'52px',bottom:'14px',width:contract.width,z:1050,helpZ:1600,position:'fixed',bodyOverflow:'auto'});expect(parseFloat(contract.width)).toBeGreaterThanOrEqual(260);
});

test('PBL038-FU-01 Summary caret and focus survive an actual header drag',async({page})=>{
  await boot(page);const summary=page.locator('.taskDetailSummary');await summary.fill('alpha beta gamma');await summary.evaluate(el=>{el.focus();el.setSelectionRange(6,6)});const before=await paneBox(page);await dragHeader(page,-120);const after=await paneBox(page);expect(after.x).toBeLessThan(before.x-100);await expect(summary).toBeFocused();expect(await summary.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd,value:el.value}))).toEqual({start:6,end:6,value:'alpha beta gamma'});
});

test('PBL038-FU-02 Summary non-empty selection survives an actual header drag',async({page})=>{
  await boot(page);const summary=page.locator('.taskDetailSummary');await summary.fill('alpha beta gamma');await summary.evaluate(el=>{el.focus();el.setSelectionRange(6,10)});const before=await paneBox(page);await dragHeader(page,-120);expect((await paneBox(page)).x).toBeLessThan(before.x-100);await expect(summary).toBeFocused();expect(await summary.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd,selected:el.value.slice(el.selectionStart,el.selectionEnd),value:el.value}))).toEqual({start:6,end:10,selected:'beta',value:'alpha beta gamma'});
});

test('PBL038-FU-03 actual header drag never blurs or focuses out the active Summary editor',async({page})=>{
  await boot(page);const summary=page.locator('.taskDetailSummary');await summary.evaluate(el=>{window.__pbl038FocusEvents={blur:0,focusout:0};el.addEventListener('blur',()=>__pbl038FocusEvents.blur++);el.addEventListener('focusout',()=>__pbl038FocusEvents.focusout++);el.focus()});await dragHeader(page,-120);await expect(summary).toBeFocused();expect(await page.evaluate(()=>__pbl038FocusEvents)).toEqual({blur:0,focusout:0});
});

test('PBL038-FU-04 plain header click and drag keep an edit uncommitted until normal blur',async({page})=>{
  await boot(page);const summary=page.locator('.taskDetailSummary');await summary.fill('uncommitted edit');await summary.evaluate(el=>window.__pbl038Original=el);const clickBox=await page.locator('.taskDetailPaneHeader').boundingBox();await page.mouse.click(clickBox.x+90,clickBox.y+clickBox.height/2);await expect(summary).toBeFocused();expect(await page.evaluate(()=>({model:itemById('A').summary,visible:document.querySelector('.taskDetailSummary').value,dirty,undo:undoStack.length,same:document.querySelector('.taskDetailSummary')===__pbl038Original}))).toEqual({model:'',visible:'uncommitted edit',dirty:false,undo:0,same:true});
  const before=await paneBox(page);await dragHeader(page,-120);expect((await paneBox(page)).x).toBeLessThan(before.x-100);expect(await page.evaluate(()=>({model:itemById('A').summary,visible:document.querySelector('.taskDetailSummary').value,dirty,undo:undoStack.length,same:document.querySelector('.taskDetailSummary')===__pbl038Original}))).toEqual({model:'',visible:'uncommitted edit',dirty:false,undo:0,same:true});await summary.blur();expect(await page.evaluate(()=>({model:itemById('A').summary,dirty,undo:undoStack.length}))).toEqual({model:'uncommitted edit',dirty:true,undo:1});
});

test('PBL038-FU-05 synthetic composition does not block drag or corrupt uncommitted Summary state',async({page})=>{
  // Synthetic composition events do not model native Windows/Chrome IME pointer behavior. This verifies only that ASANYA does not intentionally block drag or corrupt local editor/model state.
  await boot(page);const summary=page.locator('.taskDetailSummary');await summary.fill('alpha beta gamma');await summary.focus();const before=await paneBox(page);await summary.dispatchEvent('compositionstart',{data:'変換'});await dragHeader(page,-120);expect((await paneBox(page)).x).toBeLessThan(before.x-100);await expect(summary).toBeFocused();expect(await page.evaluate(()=>({value:document.querySelector('.taskDetailSummary').value,model:itemById('A').summary,dirty,undo:undoStack.length,drag:pbl038TaskDetailDrag}))).toEqual({value:'alpha beta gamma',model:'',dirty:false,undo:0,drag:null});await summary.dispatchEvent('compositionend',{data:'変換'});await summary.type('!');await expect(summary).toHaveValue('alpha beta gamma!');expect(await page.evaluate(()=>({model:itemById('A').summary,dirty,undo:undoStack.length}))).toEqual({model:'',dirty:false,undo:0});
});

test('PBL038-FU-06 Title editor retains focus and uncommitted value during drag',async({page})=>{
  await boot(page);const title=page.locator('.taskDetailTitleInput');await title.fill('Uncommitted title');const before=await paneBox(page);await dragHeader(page,-120);expect((await paneBox(page)).x).toBeLessThan(before.x-100);await expect(title).toBeFocused();await expect(title).toHaveValue('Uncommitted title');expect(await page.evaluate(()=>({model:itemById('A').title,dirty,undo:undoStack.length}))).toEqual({model:'Task A',dirty:false,undo:0});
});

test('PBL038-FU-07 Owner editor retains focus and uncommitted value during drag',async({page})=>{
  await boot(page);const owner=page.locator('#taskDetailPane').getByRole('textbox',{name:'担当',exact:true});await owner.fill('Uncommitted owner');const before=await paneBox(page);await dragHeader(page,-120);expect((await paneBox(page)).x).toBeLessThan(before.x-100);await expect(owner).toBeFocused();await expect(owner).toHaveValue('Uncommitted owner');expect(await page.evaluate(()=>({model:itemById('A').owner,dirty,undo:undoStack.length}))).toEqual({model:'',dirty:false,undo:0});
});

test('PBL038-FU-08 planned completion editor does not blur validate or commit during drag',async({page})=>{
  await boot(page);const due=page.locator('#taskDetailPane').getByRole('textbox',{name:'計画完了',exact:true});await due.fill('2026/10/01');await due.evaluate(el=>{window.__pbl038DateEvents={blur:0,focusout:0};el.addEventListener('blur',()=>__pbl038DateEvents.blur++);el.addEventListener('focusout',()=>__pbl038DateEvents.focusout++)});const before=await paneBox(page);await dragHeader(page,-120);expect((await paneBox(page)).x).toBeLessThan(before.x-100);await expect(due).toBeFocused();await expect(due).toHaveValue('2026/10/01');expect(await page.evaluate(()=>({due:itemById('A').due,dirty,undo:undoStack.length,events:__pbl038DateEvents,dialog:!!document.querySelector('.askBack')}))).toEqual({due:'2026-09-30',dirty:false,undo:0,events:{blur:0,focusout:0},dialog:false});
});

test('PBL038-FU-09 movement below 3px is ignored and movement beyond it drags',async({page})=>{
  await boot(page);const header=page.locator('.taskDetailPaneHeader'),box=await header.boundingBox(),x=box.x+90,y=box.y+box.height/2,before=await paneBox(page);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-2,y);await page.mouse.up();near((await paneBox(page)).x,before.x);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-4,y);await page.mouse.up();expect((await paneBox(page)).x).toBeLessThan(before.x-2.5);
});
