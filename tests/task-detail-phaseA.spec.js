const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

function task(id,extra={}){return{id,parentId:'',title:id,state:'',owner:'',due:'2026-08-20',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra}}
async function boot(page,items,mode='personal',projectView='list'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,mode,projectView})=>{applyJsonObject({schema_version:'2.2',workspace_info_markdown:'Phase A',items},'Phase A','phase-a.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);if(mode==='team')setProjectView(projectView);clearUndoHistory('phase-a');dirty=false},{items,mode,projectView});
}
function row(page,id){return page.locator(`#ganttView .ganttRow[data-task-id="${id}"],#row_${id}`).first()}
function pane(page){return page.locator('#taskDetailPane')}

test('DETAIL-A-01 explicit open/close and selected-task follow stay independent',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000}),task('C',{sortOrder:3000})]);
  await expect(pane(page)).toBeHidden();await row(page,'A').click();await expect(pane(page)).toBeHidden();
  await row(page,'A').locator('.taskDetailOpenBtn').click();await expect(pane(page)).toBeVisible();await expect(pane(page).getByLabel('タイトル')).toHaveValue('A');
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('ArrowDown');await expect(pane(page).getByLabel('タイトル')).toHaveValue('B');
  await pane(page).locator('.taskDetailPaneClose').click();expect(await page.evaluate(()=>selectedTaskId)).toBe('B');await row(page,'C').click();await expect(pane(page)).toBeHidden();
  expect(await page.evaluate(()=>({undo:undoStack.length,dirty}))).toEqual({undo:0,dirty:false});
});

test('DETAIL-A-02 row control order and existing child/title/DnD interactions',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);const a=row(page,'A');
  expect(await a.evaluate(el=>{const child=el.querySelector('.childBtn'),handle=el.querySelector('.siblingDragHandle'),detail=el.querySelector('.taskDetailOpenBtn'),title=el.querySelector('.titleText');return{childBeforeHandle:child.getBoundingClientRect().left<handle.getBoundingClientRect().left,handleBeforeDetail:handle.compareDocumentPosition(detail)&Node.DOCUMENT_POSITION_FOLLOWING?true:false,detailBeforeTitle:detail.compareDocumentPosition(title)&Node.DOCUMENT_POSITION_FOLLOWING?true:false}})).toEqual({childBeforeHandle:true,handleBeforeDetail:true,detailBeforeTitle:true});
  await a.locator('.taskDetailOpenBtn').dispatchEvent('pointerdown',{button:0,pointerId:7,clientX:10,clientY:10});expect(await page.evaluate(()=>!!siblingDragState)).toBe(false);
  await a.locator('.titleText').click();await expect(a.locator('.titleText')).toBeFocused();await page.evaluate(()=>document.activeElement.blur());
  await a.locator('.childBtn').click();expect(await page.evaluate(()=>({kind:draftKind,parent:itemById(draftTaskId)?.parentId}))).toEqual({kind:'child',parent:'A'});await page.keyboard.press('Escape');
  await a.locator('.siblingDragHandle').dispatchEvent('pointerdown',{button:0,pointerId:8,clientX:10,clientY:10});expect(await page.evaluate(()=>!!siblingDragState)).toBe(true);await page.keyboard.press('Escape');
});

test('DETAIL-A-03 hierarchy and dependency content uses current relationships with direct fields',async({page})=>{
  await boot(page,[task('P',{title:'Parent'}),task('A',{parentId:'P',title:'Focus',dependencies:[{task_id:'PRE',type:'finish_to_start'}]}),task('K',{parentId:'A',title:'Child'}),task('PRE',{title:'Before'}),task('POST',{title:'After',dependencies:[{task_id:'A',type:'finish_to_finish'}]})]);
  await row(page,'A').locator('.taskDetailOpenBtn').click();const text=await pane(page).locator('.taskDetailPaneBody').innerText();
  expect(text).toContain('Focus');expect(text).toContain('Parent');expect(text).toContain('Child');expect(text).toContain('Before');expect(text).toContain('After');expect(text).toContain('完了後に着手');expect(text).toContain('完了順序のみ');
  await expect(pane(page).getByLabel('タイトル')).toHaveValue('Focus');await expect(pane(page).getByLabel('担当')).toBeVisible();await expect(pane(page).getByLabel('概要')).toBeVisible();expect(await page.evaluate(()=>({undo:undoStack.length,dirty}))).toEqual({undo:0,dirty:false});
});

test('DETAIL-A-04 draft preserves persisted detail; mode and lifecycle remain safe',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);await row(page,'A').locator('.taskDetailOpenBtn').click();
  await row(page,'A').locator('.childBtn').click();await expect(pane(page).getByLabel('タイトル')).toHaveValue('A');
  await page.keyboard.press('Escape');await page.evaluate(()=>setMode('team'));await expect(pane(page).getByLabel('タイトル')).toHaveValue('A');await page.evaluate(()=>setMode('personal'));await expect(pane(page).getByLabel('タイトル')).toHaveValue('A');
  await page.evaluate(()=>{data.items=data.items.filter(x=>x.id!=='A');render()});await expect(pane(page)).toContainText('タスクを選択してください');
  await page.evaluate(()=>applyJsonObject({schema_version:'2.2',items:[{id:'NEW',parentId:'',title:'New DB',state:'',owner:'',due:'',planned_duration_days:null,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000}]},'Other','other.json',null,{remember:false,writePermissionGranted:false}));await expect(pane(page)).toBeVisible();await expect(pane(page)).toContainText('タスクを選択してください');
});

test('DETAIL-A-05 pane focus guards shortcuts while main-list shortcuts remain active',async({page})=>{
  await boot(page,[task('A'),task('B',{sortOrder:2000})]);await row(page,'A').locator('.taskDetailOpenBtn').click();const close=pane(page).locator('.taskDetailPaneClose');await close.focus();
  for(const key of ['Delete','d','F2','ArrowDown','Enter','Insert','Alt+i'])await page.keyboard.press(key);
  expect(await page.evaluate(()=>({items:data.items.length,selected:selectedTaskId,undo:undoStack.length,draft:draftTaskId,mode}))).toEqual({items:2,selected:'A',undo:0,draft:'',mode:'personal'});
  await page.evaluate(()=>{document.activeElement?.blur();hqa21SelectWithoutRender('A')});await page.keyboard.press('ArrowDown');expect(await page.evaluate(()=>selectedTaskId)).toBe('B');
});

test('DETAIL-A-06 existing relationship/actual/parent UIs remain above the pane',async({page})=>{
  await boot(page,[task('P'),task('A',{parentId:'P'})],'team','list');await row(page,'A').locator('.taskDetailOpenBtn').click();
  await row(page,'A').locator('.relationTrigger').first().click();await expect(page.locator('#relationPopup')).toBeVisible();expect(await page.evaluate(()=>Number(getComputedStyle(relationPopup).zIndex)>Number(getComputedStyle(taskDetailPane).zIndex))).toBe(true);await page.evaluate(()=>closeRelationPopup());
  await expect(page.locator('.actualEditBtn')).toHaveCount(0);await expect(pane(page).getByRole('textbox',{name:'実績開始',exact:true})).toBeVisible();
  await page.evaluate(()=>openParentPicker('A'));await expect(page.locator('#pblParentPickerBack')).toBeVisible();expect(await page.evaluate(()=>Number(getComputedStyle(document.getElementById('pblParentPickerBack')).zIndex)>Number(getComputedStyle(taskDetailPane).zIndex))).toBe(true);
});

for(const width of [1920,1600,1366,1280])test(`DETAIL-A-GEOMETRY-${width} overlay width and Gantt scroll stay stable`,async({page})=>{
  await page.setViewportSize({width,height:800});await boot(page,[task('A'),task('B',{due:'2027-08-20',sortOrder:2000})],'team','gantt');
  await page.evaluate(()=>{setGanttTimelineScroll(300);const host=document.getElementById('ganttView');host.scrollLeft=120;host.dispatchEvent(new Event('scroll'));scrollTo(0,180)});await page.waitForTimeout(100);const before=await page.evaluate(()=>({timeline:ganttTimelineScrollLeft,outer:document.getElementById('ganttView').scrollLeft,y:scrollY,gantt:document.getElementById('ganttView').getBoundingClientRect().width,dock:document.querySelector('.ganttScrollDock')?.getBoundingClientRect().left}));
  await row(page,'A').locator('.taskDetailOpenBtn').click();const open=await page.evaluate(()=>({timeline:ganttTimelineScrollLeft,outer:document.getElementById('ganttView').scrollLeft,y:scrollY,gantt:document.getElementById('ganttView').getBoundingClientRect().width,dock:document.querySelector('.ganttScrollDock')?.getBoundingClientRect().left,pane:taskDetailPane.getBoundingClientRect().width}));
  expect(open.pane).toBeLessThan(width*.65);expect(pane(page).getByRole('button',{name:'下',exact:true})).toHaveCount(0);expect(open).toMatchObject(before);await pane(page).locator('.taskDetailPaneClose').click();expect(await page.evaluate(()=>({timeline:ganttTimelineScrollLeft,outer:document.getElementById('ganttView').scrollLeft,y:scrollY,gantt:document.getElementById('ganttView').getBoundingClientRect().width,dock:document.querySelector('.ganttScrollDock')?.getBoundingClientRect().left}))).toEqual(before);
});
