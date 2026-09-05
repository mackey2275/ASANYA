const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,impact_level=0,extra={})=>({id,parentId:'',title:id,state:'',owner:'',due:'2026-08-28',planned_duration_days:3,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level,...extra});
async function boot(page,items=[task('A')],mode='personal'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,mode})=>{applyJsonObject({schema_version:'2.5',workspace_info_markdown:'',items},'impact-phase2','impact-phase2.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);clearUndoHistory('impact-phase2');dirty=false},{items,mode});
}
const row=(page,id)=>page.locator(`#ganttView .ganttRow[data-task-id="${id}"],#row_${id}`).first();
const pane=page=>page.locator('#taskDetailPane');
async function open(page,id='A'){await row(page,id).locator('.taskDetailOpenBtn').click();await expect(pane(page)).toBeVisible()}

test('IMPACT2-DETAIL-01 renders all four numeric levels with shared accessible stars',async({page})=>{
  await boot(page,[task('L0',0),task('L1',1,{sortOrder:2000}),task('L2',2,{sortOrder:3000}),task('L3',3,{sortOrder:4000})]);
  for(const [id,text] of [['L0','☆☆☆'],['L1','★☆☆'],['L2','★★☆'],['L3','★★★']]){await open(page,id);const stars=pane(page).locator('.taskDetailImpactStars .impactStar');await expect(stars).toHaveCount(3);expect((await stars.allTextContents()).join('')).toBe(text);for(let n=1;n<=3;n++){await expect(stars.nth(n-1)).toHaveAttribute('type','button');await expect(stars.nth(n-1)).toHaveAttribute('aria-label',`影響度${n}`)}}
});

test('IMPACT2-DETAIL-02 visible pointer and keyboard transitions use approved toggle semantics',async({page})=>{
  await boot(page);await open(page);const click=async n=>pane(page).locator('.taskDetailImpactStars .impactStar').nth(n-1).click();await click(1);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(1);await click(1);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(0);await click(2);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(2);await click(1);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(1);await click(2);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(2);await click(2);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(0);await click(2);await click(3);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(3);const third=pane(page).locator('.taskDetailImpactStars .impactStar').nth(2);await third.focus();await third.press('Enter');expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(0);await third.press('Space');expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(3)
});

test('IMPACT2-UNDO-01 Impact plus another detail edit is one session Undo/Redo',async({page})=>{
  await boot(page,[task('A',2,{owner:'old'})]);await open(page);await pane(page).locator('.taskDetailImpactStars .impactStar').nth(0).click();await pane(page).getByLabel('担当').fill('new');await pane(page).getByLabel('担当').blur();await page.evaluate(()=>new Promise(r=>queueMicrotask(r)));expect(await page.evaluate(()=>undoStack.map(x=>({action:x.actionType,count:x.detailActionCount,task:x.taskId})))).toEqual([{action:'task_detail_session',count:2,task:'A'}]);await pane(page).locator('.taskDetailPaneClose').click();await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>({impact:itemById('A').impact_level,owner:itemById('A').owner,redo:redoStack.length}))).toEqual({impact:2,owner:'old',redo:1});await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>({impact:itemById('A').impact_level,owner:itemById('A').owner}))).toEqual({impact:1,owner:'new'})
});

test('IMPACT2-UNDO-02 A/B detail sessions stay separate',async({page})=>{
  await boot(page,[task('A'),task('B',2,{sortOrder:2000})]);await open(page,'A');await pane(page).locator('.taskDetailImpactStars .impactStar').nth(0).click();await page.evaluate(()=>hqa21SelectWithoutRender('B'));await pane(page).locator('.taskDetailImpactStars .impactStar').nth(2).click();expect(await page.evaluate(()=>undoStack.map(x=>({task:x.taskId,count:x.detailActionCount})))).toEqual([{task:'A',count:1},{task:'B',count:1}]);await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>({a:itemById('A').impact_level,b:itemById('B').impact_level}))).toEqual({a:1,b:2})
});

test('IMPACT2-SCROLL-01 same-task Impact rerender preserves pane scroll',async({page})=>{
  const children=Array.from({length:18},(_,i)=>task('C'+i,0,{parentId:'A',sortOrder:2000+i}));await boot(page,[task('A'),...children]);await open(page);const body=pane(page).locator('.taskDetailPaneBody');await body.evaluate(el=>el.scrollTop=220);const before=await body.evaluate(el=>el.scrollTop);expect(before).toBeGreaterThan(0);await page.evaluate(()=>document.querySelector('#taskDetailPane .taskDetailImpactStars .impactStar[data-star="2"]').click());expect(await body.evaluate(el=>el.scrollTop)).toBe(before);expect(await page.evaluate(()=>itemById('A').impact_level)).toBe(2)
});

test('IMPACT2-COLUMNS-01 ToDo and Project place Priority after the compact add operation and before Status',async({page})=>{
  const impactLabel=(APP.includes('priority_width_followup')||APP.includes('v260')||APP.includes('v270'))?'優先度':'影響度',pbl021=APP.includes('pbl021');await boot(page);let labels=(await page.locator('#head th').allTextContents()).map(x=>x.trim());expect(labels).toContain(impactLabel);if(pbl021)expect(labels).not.toContain('子');
  await page.evaluate(()=>setMode('team'));labels=(await page.locator('#ganttView .ganttHeader .projectInfoTable th').allTextContents()).map(x=>x.trim());expect(labels.slice(labels.indexOf(impactLabel),labels.indexOf('ステータス')+1)).toEqual([impactLabel,'ステータス']);const cells=await page.locator('.ganttRow[data-task-id="A"] .projectInfoTable td').evaluateAll(es=>es.map(e=>e.querySelector('.impactStars')?'impact':e.querySelector('select')?.getAttribute('onchange')?.includes('changeState')?'state':e.querySelector('.taskAddBtn,.childBtn')?'add':'other'));expect(cells.slice(cells.indexOf('impact'),cells.indexOf('state')+1)).toEqual(['impact','state'])
});

test('IMPACT2-COLUMNS-02 top-level and child drafts align without premature commit',async({page})=>{
  await boot(page,[task('P')],'team');const top=page.locator('.projectTopDraftRow .projectInfoTable tr');const topKinds=await top.locator('td').evaluateAll(es=>es.map(e=>e.querySelector('#b_impact')?'impact':e.querySelector('#b_state')?'state':'other'));expect(topKinds.slice(topKinds.indexOf('impact'),topKinds.indexOf('state')+1)).toEqual(['impact','state']);await page.evaluate(()=>{selectTask('P');startDraftTask('child')});const id=await page.evaluate(()=>draftTaskId),draft=page.locator(`.ganttRow[data-task-id="${id}"]`);await draft.locator('.titleText').fill('Child');await draft.locator('.impactStar').nth(1).click();expect(await page.evaluate(id=>({id:draftTaskId,stage:draftStage,level:itemById(id).impact_level}),id)).toEqual({id,stage:'due',level:2});expect(await draft.locator('.projectInfoTable td').evaluateAll(es=>{const kinds=es.map(e=>e.querySelector('.impactStars')?'impact':e.querySelector('select')?.getAttribute('onchange')?.includes('changeState')?'state':'other');return kinds.slice(kinds.indexOf('impact'),kinds.indexOf('state')+1)})).toEqual(['impact','state'])
});

test('IMPACT2-ISOLATION-01 star click does not alter Status, selection, child count, or DnD',async({page})=>{
  await boot(page,[task('A',0,{state:'未着手'}),task('B',0,{sortOrder:2000})],'team');await open(page,'A');const before=await page.evaluate(()=>({state:itemById('A').state,selected:selectedTaskId,count:data.items.length}));await pane(page).locator('.taskDetailImpactStars .impactStar').nth(1).click();expect(await page.evaluate(()=>({state:itemById('A').state,selected:selectedTaskId,count:data.items.length,drag:!!siblingDragState,impact:itemById('A').impact_level}))).toEqual({...before,drag:false,impact:2});await pane(page).getByLabel('ステータス').selectOption('進行中');expect(await page.evaluate(()=>({state:itemById('A').state,impact:itemById('A').impact_level}))).toEqual({state:'進行中',impact:2})
});
