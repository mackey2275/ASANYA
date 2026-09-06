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
  await boot(page);await page.evaluate(()=>{ganttView.scrollLeft=37;const unified=document.querySelector('.projectUnified');if(unified)unified.scrollTop=19});const beforeScroll=await page.evaluate(()=>({outer:ganttView.scrollLeft,vertical:document.querySelector('.projectUnified')?.scrollTop||0}));
  await dragHeader(page,-3000);let box=await paneBox(page);expect(box.x).toBeGreaterThanOrEqual(7);await dragHeader(page,3000);box=await paneBox(page);near(box.x+box.width,1280-14,2);
  expect(await page.evaluate(()=>({outer:ganttView.scrollLeft,vertical:document.querySelector('.projectUnified')?.scrollTop||0}))).toEqual(beforeScroll);
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
