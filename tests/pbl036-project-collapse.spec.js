const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,parentId='',extra={})=>({id,parentId,title:id,state:'未着手',owner:'',due:'2026-09-20',planned_duration_days:2,actual_start:'2026-09-10',actual_end:'',summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:1,...extra});
const fixture=()=>[task('A'),task('B','A'),task('C','B'),task('D','A',{sortOrder:2000}),task('X','',{sortOrder:3000}),task('M','',{state:'メモ',sortOrder:4000})];
async function boot(page,items=fixture(),display='project-detail'){
  await page.setViewportSize({width:1280,height:720});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(async({items,display})=>{await applyJsonObject({schema_version:'3.1',workspace_info_markdown:'PBL-036',items},'pbl036','pbl036.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(display);clearUndoHistory('pbl036');dirty=false;saveState='saved'},{items,display});
}
const ids=page=>page.locator('#ganttView .ganttRow[data-task-id]').evaluateAll(rows=>rows.map(row=>row.dataset.taskId));
const disclosure=(page,id)=>page.locator(`#ganttView .ganttRow[data-task-id="${id}"] .projectHierarchyDisclosure`);

test('PBL036-CORE-01 recursively collapses and restores while retaining nested manual state',async({page})=>{
  await boot(page);await disclosure(page,'B').click();expect(await ids(page)).toEqual(['A','B','D','X','M']);await disclosure(page,'A').click();expect(await ids(page)).toEqual(['A','X','M']);await disclosure(page,'A').click();expect(await ids(page)).toEqual(['A','B','D','X','M']);await expect(disclosure(page,'B')).toHaveAttribute('aria-expanded','false');await disclosure(page,'B').click();expect(await ids(page)).toEqual(['A','B','C','D','X','M']);
});

test('PBL036-CORE-02 accessible parent-only control is UI-only and hides the complete project row',async({page})=>{
  await boot(page);await expect(disclosure(page,'A')).toHaveText('▼');await expect(disclosure(page,'A')).toHaveAttribute('title','子タスクを折りたたむ');await expect(disclosure(page,'C')).toHaveCount(0);const before=await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,revision:dataRevision,undo:undoStack.length}));await disclosure(page,'A').click();expect(await page.evaluate(()=>({json:JSON.stringify(persistableData()),dirty,revision:dataRevision,undo:undoStack.length}))).toEqual(before);await expect(page.locator('.ganttRow[data-task-id="B"]')).toHaveCount(0);await expect(page.locator('.ganttRow[data-task-id="C"]')).toHaveCount(0);
});

test('PBL036-MODES-01 Detail and Simple share state; ToDo remains independent',async({page})=>{
  await boot(page);await disclosure(page,'A').click();await page.evaluate(()=>setDisplayMode('project-simple'));expect(await ids(page)).toEqual(['A','X','M']);await page.evaluate(()=>setDisplayMode('todo-tree'));await expect(page.locator('#row_A .hierarchyDisclosure')).toHaveAttribute('aria-expanded','true');await expect(page.locator('#row_B')).toBeVisible();await page.evaluate(()=>setDisplayMode('project-detail'));expect(await ids(page)).toEqual(['A','X','M']);
});

test('PBL036-FILTER-01 matching descendant temporarily reveals its path and clearing restores collapse',async({page})=>{
  await boot(page,fixture().map(item=>({...item,owner:item.id==='C'?'match':'other'})));await disclosure(page,'A').click();await page.evaluate(()=>{ownerFilterValues=new Set(['match']);render()});expect(await ids(page)).toEqual(['A','B','C']);expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('A'))).toBe(true);await expect(disclosure(page,'A')).toHaveAttribute('aria-expanded','true');await page.evaluate(()=>{ownerFilterValues.clear();render()});expect(await ids(page)).toEqual(['A','X','M']);
});

test('PBL036-FILTER-02 parent-only match does not expose nonmatching descendants',async({page})=>{
  await boot(page,fixture().map(item=>({...item,owner:item.id==='A'?'match':'other'})));await page.evaluate(()=>{ownerFilterValues=new Set(['match']);render()});expect(await ids(page)).toEqual(['A']);await expect(disclosure(page,'A')).toHaveCount(0);
});

test('PBL036-SEARCH-01 hidden search result is temporarily revealed until another selection',async({page})=>{
  await boot(page);await disclosure(page,'A').click();await page.evaluate(()=>jumpFromTaskSearch('C'));await expect(page.locator('.ganttRow[data-task-id="C"]')).toBeVisible();expect(await page.evaluate(()=>({selected:selectedTaskId,reveal:pbl036SearchRevealTaskId,collapsed:pbl036CollapsedTaskIds.has('A')}))).toEqual({selected:'C',reveal:'C',collapsed:true});await page.evaluate(()=>selectTask('X'));await page.evaluate(()=>render());expect(await ids(page)).toEqual(['A','X','M']);
});

test('PBL036-SELECTION-01 collapsing a selected descendant normalizes selection and open Detail once',async({page})=>{
  await boot(page);await page.evaluate(()=>openTaskDetailPane('C'));await disclosure(page,'A').click();expect(await page.evaluate(()=>({selected:selectedTaskId,detail:taskDetailPaneTaskId,open:taskDetailPaneOpen,mode:taskDetailViewMode}))).toEqual({selected:'A',detail:'A',open:true,mode:'detail'});await expect(page.locator('.ganttRow[data-task-id="A"]')).toHaveClass(/ganttSelected/);await expect(page.locator('.ganttRow[data-task-id="C"]')).toHaveCount(0);
});

for(const display of ['project-detail','project-simple'])test(`PBL036-EVENT ${display} isolates disclosure and preserves Task Detail toggle`,async({page})=>{
  await boot(page,fixture(),display);await page.evaluate(()=>openTaskDetailPane('X'));await disclosure(page,'A').click();expect(await page.evaluate(()=>({selected:selectedTaskId,detail:taskDetailPaneTaskId,open:taskDetailPaneOpen}))).toEqual({selected:'X',detail:'X',open:true});await page.locator('.ganttRow[data-task-id="A"] .taskDetailOpenBtn').click();await page.locator('.ganttRow[data-task-id="X"] .taskDetailOpenBtn').click();expect(await page.evaluate(()=>({selected:selectedTaskId,detail:taskDetailPaneTaskId,open:taskDetailPaneOpen}))).toEqual({selected:'X',detail:'X',open:true});await page.locator('.ganttRow[data-task-id="X"] .taskDetailOpenBtn').click();expect(await page.evaluate(()=>({selected:selectedTaskId,open:taskDetailPaneOpen}))).toEqual({selected:'X',open:false});
});

test('PBL036-CREATE-01 child creation expands its collapsed parent and preserves draft transaction',async({page})=>{
  await boot(page);await disclosure(page,'A').click();await page.locator('.ganttRow[data-task-id="A"] .taskAddBtn').click();await page.getByRole('menuitem',{name:'1つ下の階層に追加'}).click();expect(await page.evaluate(()=>({collapsed:pbl036CollapsedTaskIds.has('A'),parent:itemById(draftTaskId).parentId,undo:undoStack.length}))).toEqual({collapsed:false,parent:'A',undo:0});await expect(page.locator('.ganttRow[data-task-id="'+await page.evaluate(()=>draftTaskId)+'"] .titleText')).toBeFocused();
});

test('PBL036-CREATE-02 child creation below collapsed Memo expands it and retains Memo semantics',async({page})=>{
  await boot(page,[task('M','',{state:'メモ'}),task('N','M',{state:'メモ'})]);await disclosure(page,'M').click();await page.locator('.ganttRow[data-task-id="M"] .taskAddBtn').click();await page.getByRole('menuitem',{name:'1つ下の階層に追加'}).click();expect(await page.evaluate(()=>({collapsed:pbl036CollapsedTaskIds.has('M'),parent:itemById(draftTaskId).parentId,state:itemById(draftTaskId).state}))).toEqual({collapsed:false,parent:'M',state:'メモ'});
});

test('PBL036-PARENT-01 valid move expands destination, rejected move does not, moved collapsed parent retains state',async({page})=>{
  await boot(page,[task('A'),task('B','A'),task('X'),task('Y','X')]);await disclosure(page,'A').click();await disclosure(page,'X').click();expect((await page.evaluate(()=>reassignTaskParent('B','X'))).ok).toBe(true);expect(await page.evaluate(()=>({parent:itemById('B').parentId,collapsed:pbl036CollapsedTaskIds.has('X')}))).toEqual({parent:'X',collapsed:false});expect((await page.evaluate(()=>reassignTaskParent('X','B'))).ok).toBe(false);expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('A'))).toBe(true);expect((await page.evaluate(()=>reassignTaskParent('A','X'))).ok).toBe(true);expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('A'))).toBe(true);
});

test('PBL036-LIFECYCLE-01 render/save preserve state, DB replacement clears it, reload starts expanded',async({page})=>{
  await boot(page);await disclosure(page,'A').click();await page.evaluate(()=>{render();save()});expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('A'))).toBe(true);await page.evaluate(async()=>applyJsonObject({schema_version:'3.1',items:[{...data.items[0],id:'A'}]},'next','next.json',null,{remember:false,writePermissionGranted:false}));expect(await page.evaluate(()=>({size:pbl036CollapsedTaskIds.size,reveal:pbl036SearchRevealTaskId}))).toEqual({size:0,reveal:''});await page.reload();expect(await page.evaluate(()=>pbl036CollapsedTaskIds.size)).toBe(0);
});

test('PBL036-MEMO-RECURRENCE-01 Memo is a normal hierarchy node and hidden recurring descendants still update',async({page})=>{
  await boot(page,[task('M','',{state:'メモ'}),task('N','M',{state:'メモ'}),task('R','',{repeat:'毎週',recurrence_schedule_date:'2026-09-20'}),task('C','R',{due:'2026-09-19'})]);await disclosure(page,'M').click();await expect(page.locator('.ganttRow[data-task-id="N"]')).toHaveCount(0);await disclosure(page,'R').click();const before=await page.evaluate(()=>itemById('C').due);await page.evaluate(()=>rolloverRecurringTask(itemById('R')));expect(await page.evaluate(()=>itemById('C').due)).not.toBe(before);expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('R'))).toBe(true);await expect(page.locator('.ganttRow[data-task-id="C"]')).toHaveCount(0);
});

test('PBL036-HIDDEN-01 completion, Due Undo/Redo, and conflict navigation remain data-based and safe',async({page})=>{
  await boot(page,[task('A'),task('B','A',{state:'完了'}),task('C','B',{state:'中止',due:'2026-09-12'}),task('P','',{due:'2026-09-15'}),task('S','A',{due:'2026-09-14',dependencies:[{task_id:'P',type:'finish_to_start'}]})]);await disclosure(page,'A').click();await page.evaluate(()=>{phase4Complete(itemById('B'));const input=document.createElement('input');input.value='2026-09-25';saveDueText(data.items.indexOf(itemById('C')),input)});expect(await page.evaluate(()=>({collapsed:pbl036CollapsedTaskIds.has('A'),due:itemById('C').due}))).toEqual({collapsed:true,due:'2026-09-25'});await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('C').due)).toBe('2026-09-12');await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>itemById('C').due)).toBe('2026-09-25');await page.evaluate(()=>showGanttConflict(0));await expect(page.locator('.ganttRow[data-task-id="S"]')).toBeVisible();expect(await page.evaluate(()=>pbl036CollapsedTaskIds.has('A'))).toBe(true);
});

test('PBL036-SCROLL-01 collapse preserves horizontal positions and keeps parent vertically anchored',async({page})=>{
  const items=[...Array.from({length:18},(_,i)=>task('P'+i,'',{sortOrder:i*1000})),task('A','',{sortOrder:20000}),...Array.from({length:20},(_,i)=>task('C'+i,'A',{sortOrder:i*1000})),...Array.from({length:20},(_,i)=>task('Z'+i,'',{sortOrder:30000+i*1000}))];await boot(page,items);await page.evaluate(async()=>{ganttView.scrollLeft=240;ganttView.dispatchEvent(new Event('scroll'));setGanttTimelineScroll(110);const row=document.querySelector('.ganttRow[data-task-id="A"]');window.scrollTo(0,row.getBoundingClientRect().top+scrollY-180);await new Promise(resolve=>requestAnimationFrame(resolve))});const before=await page.evaluate(()=>({outer:ganttView.scrollLeft,timeline:ganttTimelineScrollLeft,top:document.querySelector('.ganttRow[data-task-id="A"]').getBoundingClientRect().top}));await disclosure(page,'A').click();await page.waitForTimeout(80);const after=await page.evaluate(()=>({outer:ganttView.scrollLeft,timeline:ganttTimelineScrollLeft,top:document.querySelector('.ganttRow[data-task-id="A"]').getBoundingClientRect().top}));expect(Math.abs(after.outer-before.outer)).toBeLessThanOrEqual(16);expect(Math.abs(after.timeline-before.timeline)).toBeLessThanOrEqual(1);expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(1);
});
