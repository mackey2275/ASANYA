const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,parentId='',extra={})=>({id,parentId,title:id,state:'未着手',owner:'',due:'',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:1,...extra});
const fixture=()=>[task('A'),task('B','A'),task('C','B'),task('D','A',{sortOrder:2000}),task('X','',{sortOrder:3000})];
async function boot(page,items=fixture(),display='todo-tree'){
  await page.setViewportSize({width:1280,height:720});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,display})=>{applyJsonObject({schema_version:'3.0',workspace_info_markdown:'PBL-033',items},'pbl033','pbl033.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(display);clearUndoHistory('pbl033');dirty=false;saveState='saved'},{items,display});
}
const ids=page=>page.locator('#body tr[id^="row_"]').evaluateAll(rows=>rows.map(row=>row.id.slice(4)));

test('PBL033-CORE-01 recursively collapses and restores while preserving nested manual state',async({page})=>{
  await boot(page);await page.locator('#row_B .hierarchyDisclosure').click();expect(await ids(page)).toEqual(['A','B','D','X']);await page.locator('#row_A .hierarchyDisclosure').click();expect(await ids(page)).toEqual(['A','X']);await page.locator('#row_A .hierarchyDisclosure').click();expect(await ids(page)).toEqual(['A','B','D','X']);expect(await page.locator('#row_B .hierarchyDisclosure').getAttribute('aria-expanded')).toBe('false');await page.locator('#row_B .hierarchyDisclosure').click();expect(await ids(page)).toEqual(['A','B','C','D','X']);
});

test('PBL033-CORE-02 disclosure is separate, accessible, parent-only, and UI-only',async({page})=>{
  await boot(page);await expect(page.locator('#row_A .hierarchyDisclosure')).toHaveText('▼');await expect(page.locator('#row_A .hierarchyDisclosure')).toHaveAttribute('aria-expanded','true');await expect(page.locator('#row_A .hierarchyDisclosure')).toHaveAttribute('title','子タスクを折りたたむ');await page.locator('#row_A .hierarchyDisclosure').click();await expect(page.locator('#row_A .hierarchyDisclosure')).toHaveAttribute('title','子タスクを展開する');await page.locator('#row_A .hierarchyDisclosure').click();await expect(page.locator('#row_C button.hierarchyDisclosure')).toHaveCount(0);await expect(page.locator('#row_A .taskDetailOpenBtn')).toHaveText('›');const before=await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,revision:dataRevision,undo:undoStack.length,pane:taskDetailPaneOpen}));await page.locator('#row_A .hierarchyDisclosure').click();expect(await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,revision:dataRevision,undo:undoStack.length,pane:taskDetailPaneOpen}))).toEqual(before);
});

test('PBL033-FOLLOWUP-01 contextual Help explains hierarchy disclosure',async({page})=>{
  await boot(page);await page.locator('#helpTrigger').click();await expect(page.locator('[data-help-section="todo"]')).toContainText('▶ / ▼：親タスクの子・孫タスクを展開／折りたたみ');
});

test('PBL033-FOLLOWUP-02 Help returns top-right while Search and Move swap KPI positions',async({page})=>{
  await boot(page);const placement=()=>page.evaluate(()=>{const actions=[...document.querySelectorAll('#kpis>button')];return{helpCount:document.querySelectorAll('#helpTrigger').length,searchCount:document.querySelectorAll('#taskSearchBtn').length,moveCount:[...document.querySelectorAll('button')].filter(x=>x.textContent.includes('選択タスクを別DBへ移動')).length,helpInHeader:helpTrigger.parentElement===document.querySelector('body>h1'),helpInKpi:!!document.querySelector('#kpis>#helpTrigger'),moveInShortcut:!!document.querySelector('#shortcutHelpRow button'),order:actions.map(x=>x.textContent.trim())}});expect(await placement()).toEqual({helpCount:1,searchCount:1,moveCount:1,helpInHeader:true,helpInKpi:false,moveInShortcut:false,order:['🔎 タスク検索','↗ 選択タスクを別DBへ移動']});await page.evaluate(()=>{refreshDbStatus();render()});expect(await placement()).toEqual({helpCount:1,searchCount:1,moveCount:1,helpInHeader:true,helpInKpi:false,moveInShortcut:false,order:['🔎 タスク検索','↗ 選択タスクを別DBへ移動']});await page.locator('#helpTrigger').click();await expect(page.locator('#helpPopover')).toBeVisible();await page.keyboard.press('Escape');await page.evaluate(()=>{window.__searchCalls=0;window.__moveCalls=0;toggleTaskSearch=()=>window.__searchCalls++;moveSelectedTaskToOtherDb=()=>window.__moveCalls++});await page.locator('#taskSearchBtn').click();await page.getByRole('button',{name:'↗ 選択タスクを別DBへ移動'}).click();expect(await page.evaluate(()=>({search:window.__searchCalls,move:window.__moveCalls}))).toEqual({search:1,move:1});
});

test('PBL033-FOLLOWUP-03 Task Detail button toggles same task and switches different task',async({page})=>{
  await boot(page);await page.locator('#row_A .taskDetailOpenBtn').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,detail:taskDetailPaneTaskId,selected:selectedTaskId}))).toEqual({open:true,detail:'A',selected:'A'});await page.locator('#row_A .taskDetailOpenBtn').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,selected:selectedTaskId}))).toEqual({open:false,selected:'A'});await page.locator('#row_A .taskDetailOpenBtn').click();await page.locator('#row_X .taskDetailOpenBtn').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,detail:taskDetailPaneTaskId,selected:selectedTaskId}))).toEqual({open:true,detail:'X',selected:'X'});await page.locator('#taskDetailPane .taskDetailPaneClose').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,selected:selectedTaskId}))).toEqual({open:false,selected:'X'});
});

test('PBL033-FOLLOWUP-04 Task Detail mismatch uses normal open path',async({page})=>{
  await boot(page);await page.evaluate(()=>{openTaskDetailPane('A');selectedTaskId='X';updateRenderedTaskSelection('X')});await page.locator('#row_A .taskDetailOpenBtn').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,detail:taskDetailPaneTaskId,selected:selectedTaskId}))).toEqual({open:true,detail:'A',selected:'A'});
});

for(const display of ['project-detail','project-simple'])test(`PBL033-HOTFIX ${display} switches Detail without a delayed close`,async({page})=>{
  await boot(page,fixture(),display);const button=id=>page.locator(`.ganttRow[data-task-id="${id}"] .taskDetailOpenBtn`);
  await button('A').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,detail:taskDetailPaneTaskId,selected:selectedTaskId}))).toEqual({open:true,detail:'A',selected:'A'});
  await button('X').click();await page.waitForTimeout(350);expect(await page.evaluate(()=>({open:taskDetailPaneOpen,detail:taskDetailPaneTaskId,selected:selectedTaskId}))).toEqual({open:true,detail:'X',selected:'X'});
});

test('PBL033-HOTFIX Project repeated switching, same-task close, explicit close, and Memo share one handler',async({page})=>{
  await boot(page,[task('M','',{state:'メモ'}),task('A','',{sortOrder:2000}),task('B','',{sortOrder:3000})],'project-detail');const button=id=>page.locator(`.ganttRow[data-task-id="${id}"] .taskDetailOpenBtn`);
  for(const id of ['M','A','B']){await button(id).click();await page.waitForTimeout(120);expect(await page.evaluate(()=>({open:taskDetailPaneOpen,detail:taskDetailPaneTaskId,selected:selectedTaskId}))).toEqual({open:true,detail:id,selected:id})}
  await button('B').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,selected:selectedTaskId}))).toEqual({open:false,selected:'B'});await button('B').click();await page.locator('#taskDetailPane .taskDetailPaneClose').click();expect(await page.evaluate(()=>({open:taskDetailPaneOpen,selected:selectedTaskId}))).toEqual({open:false,selected:'B'});
});

test('PBL033-SCOPE-01 ToDo collapse stays independent across date and both Project modes',async({page})=>{
  await boot(page);await page.locator('#row_A .hierarchyDisclosure').click();expect(await ids(page)).toEqual(['A','X']);await page.evaluate(()=>setDisplayMode('todo-date'));expect(new Set(await ids(page))).toEqual(new Set(['A','B','C','D','X']));await expect(page.locator('.hierarchyDisclosure')).toHaveCount(0);for(const display of ['project-detail','project-simple']){await page.evaluate(value=>setDisplayMode(value),display);expect(await page.locator('#ganttView .ganttRow[data-task-id]').count()).toBe(5);await expect(page.locator('#ganttView .projectHierarchyDisclosure')).toHaveCount(2);expect(await page.evaluate(()=>pbl036CollapsedTaskIds.size)).toBe(0)}await page.evaluate(()=>setDisplayMode('todo-tree'));expect(await ids(page)).toEqual(['A','X']);
});

test('PBL033-FILTER-01 matching descendant temporarily reveals its path and clearing restores collapse',async({page})=>{
  await boot(page,fixture().map(x=>({...x,owner:x.id==='C'?'match':'other'})));await page.locator('#row_B .hierarchyDisclosure').click();await page.evaluate(()=>{ownerFilterValues=new Set(['match']);render()});expect(await ids(page)).toEqual(['A','B','C']);expect(await page.evaluate(()=>pbl033CollapsedTaskIds.has('B'))).toBe(true);await page.evaluate(()=>{ownerFilterValues.clear();render()});expect(await ids(page)).toEqual(['A','B','D','X']);
});

test('PBL033-FILTER-02 parent-only match never exposes nonmatching descendants',async({page})=>{
  await boot(page,fixture().map(x=>({...x,owner:x.id==='A'?'match':'other'})));await page.evaluate(()=>{ownerFilterValues=new Set(['match']);render()});expect(await ids(page)).toEqual(['A']);
});

test('PBL033-SEARCH-01 hidden result is revealed and remains visible after Search closes until another selection',async({page})=>{
  await boot(page);await page.locator('#row_A .hierarchyDisclosure').click();await page.evaluate(()=>jumpFromTaskSearch('C'));await expect(page.locator('#row_C')).toBeVisible();expect(await page.evaluate(()=>({selected:selectedTaskId,reveal:pbl033SearchRevealTaskId,collapsed:pbl033CollapsedTaskIds.has('A')}))).toEqual({selected:'C',reveal:'C',collapsed:true});await page.evaluate(()=>closeTaskSearch());await expect(page.locator('#row_C')).toBeVisible();await page.evaluate(()=>selectTask('X'));expect(await ids(page)).toEqual(['A','X']);
});

test('PBL033-SELECTION-01 collapse normalizes descendant selection and Task Detail to parent only',async({page})=>{
  await boot(page);await page.evaluate(()=>{selectTask('C');openTaskDetailPane('C')});await page.locator('#row_A .hierarchyDisclosure').click();expect(await page.evaluate(()=>({selected:selectedTaskId,detail:taskDetailPaneTaskId,open:taskDetailPaneOpen}))).toEqual({selected:'A',detail:'A',open:true});await expect(page.locator('#row_A')).toHaveClass(/selectedRow/);await expect(page.locator('#row_C')).toHaveCount(0);await page.evaluate(()=>selectTask('X'));await page.locator('#row_A .hierarchyDisclosure').click();expect(await page.evaluate(()=>selectedTaskId)).toBe('X');
});

test('PBL033-CREATE-01 adding a child expands parent and preserves draft focus and Undo transaction',async({page})=>{
  await boot(page);await page.locator('#row_A .hierarchyDisclosure').click();await page.locator('#row_A .taskAddBtn').click();await page.getByRole('menuitem',{name:'1つ下の階層に追加'}).click();const id=await page.evaluate(()=>draftTaskId);expect(await page.evaluate(()=>({collapsed:pbl033CollapsedTaskIds.has('A'),parent:itemById(draftTaskId).parentId,undo:undoStack.length}))).toEqual({collapsed:false,parent:'A',undo:0});await expect(page.locator(`#row_${id} .titleText`)).toBeFocused();
});

test('PBL033-PARENT-01 move into collapsed destination expands it; moving collapsed parent preserves ID state',async({page})=>{
  await boot(page,[task('A'),task('B','A'),task('X'),task('Y','X')]);await page.locator('#row_A .hierarchyDisclosure').click();await page.locator('#row_X .hierarchyDisclosure').click();expect((await page.evaluate(()=>reassignTaskParent('B','X'))).ok).toBe(true);expect(await page.evaluate(()=>({parent:itemById('B').parentId,collapsed:pbl033CollapsedTaskIds.has('X')}))).toEqual({parent:'X',collapsed:false});expect((await page.evaluate(()=>reassignTaskParent('A','X'))).ok).toBe(true);expect(await page.evaluate(()=>pbl033CollapsedTaskIds.has('A'))).toBe(true);
});

test('PBL033-LIFECYCLE-01 ordinary save/render preserves state and DB replacement clears it',async({page})=>{
  await boot(page);await page.locator('#row_A .hierarchyDisclosure').click();await page.evaluate(()=>{render();save()});expect(await page.evaluate(()=>pbl033CollapsedTaskIds.has('A'))).toBe(true);await page.evaluate(()=>applyJsonObject({schema_version:'3.0',items:[{...data.items[0],id:'A'}]},'next','next.json',null,{remember:false,writePermissionGranted:false}));expect(await page.evaluate(()=>({size:pbl033CollapsedTaskIds.size,reveal:pbl033SearchRevealTaskId}))).toEqual({size:0,reveal:''});await expect(page.locator('#row_A button.hierarchyDisclosure')).toHaveCount(0);
});

test('PBL033-DND-COMPLETE-DUE-01 hidden rows are absent geometry but remain logical and missing-row paths stay safe',async({page})=>{
  await boot(page,[task('A'),task('B','A',{state:'完了'}),task('C','B',{state:'中止'}),task('X','',{sortOrder:2000})]);await page.locator('#row_A .hierarchyDisclosure').click();expect(await page.evaluate(()=>({logical:[...collectSubtreeIds('A')],rendered:pbl2SubtreeRows('A').map(row=>row.id||row.dataset.taskId),block:!!pbl2BlockRect('A')}))).toEqual({logical:['A','B','C'],rendered:['row_A'],block:true});expect(await page.evaluate(()=>{itemById('C').due='2026-08-20';pendingSortMoveAnimation={id:'C',oldTops:{},kind:'due'};playPendingSortMoveAnimation();rcFollowDueTaskAfterFlip('C');return true})).toBe(true);await page.evaluate(()=>phase4Complete(itemById('A')));expect(await page.evaluate(()=>data.items.map(x=>x.completed))).toEqual([true,true,true,false]);await expect(page.locator('.pbl027ExitGhost[data-task-id="B"],.pbl027ExitGhost[data-task-id="C"]')).toHaveCount(0);
});

test('PBL033-CONTROL-01 first and last child changes update disclosure without stale ID effects',async({page})=>{
  await boot(page,[task('A'),task('X')]);await expect(page.locator('#row_A button.hierarchyDisclosure')).toHaveCount(0);await page.evaluate(()=>{itemById('X').parentId='A';render()});await expect(page.locator('#row_A button.hierarchyDisclosure')).toHaveCount(1);await page.locator('#row_A .hierarchyDisclosure').click();await page.evaluate(()=>{itemById('X').parentId='';render()});await expect(page.locator('#row_A button.hierarchyDisclosure')).toHaveCount(0);expect(await page.evaluate(()=>pbl033CollapsedTaskIds.has('A'))).toBe(true);
});
