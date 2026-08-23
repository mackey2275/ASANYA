const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
const task=(id,title=id,extra={})=>({id,parentId:'',state:'',impact:'',title,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
async function boot(page){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload()}
async function setData(page,items){await page.evaluate(items=>applyJsonObject({schema_version:'1.8',items},'test','sort-child.json',null,{remember:false,writePermissionGranted:false}),items);await page.locator('#mTeam').click()}
async function gantt(page){await page.evaluate(()=>setMode('team'));await expect(page.locator('#ganttView')).toBeVisible()}
async function ganttOrder(page){return page.locator('#ganttView .ganttRow[data-task-id]').evaluateAll(rows=>rows.map(r=>r.dataset.taskId))}
async function listOrder(page){return await page.locator('#ganttView').isVisible()?ganttOrder(page):page.locator('#body tr:not(.blank)').evaluateAll(rows=>rows.map(r=>r.id.slice(4)))}
async function finishDraft(page,title,due='',duration=null){const input=page.locator('#ganttView .ganttDraftTitle');await expect(input).toBeFocused();await input.fill(title);await input.press('Enter');const dueInput=page.locator('#ganttView .ganttDraftRow .dateEdit input[type="text"]');await expect(dueInput).toBeFocused();if(due)await dueInput.fill(due);await dueInput.press('Enter');const planned=page.locator('#ganttView .ganttDraftRow .ganttPlanned input');await expect(planned).toBeFocused();if(duration!==null)await planned.fill(String(duration));await planned.press('Enter')}
test.beforeEach(async({page})=>boot(page));

test('PROJECT-SORT-01: 計画開始日で兄弟stable sortし未設定を後置、保存配列は不変',async({page})=>{
  const items=[task('A','A',{due:'2026-08-22',planned_duration_days:3}),task('B','B',{due:'2026-08-05',planned_duration_days:1,sortOrder:2000}),task('C','C',{due:'2026-08-10',planned_duration_days:1,sortOrder:3000}),task('same1','同日1',{due:'2026-08-12',planned_duration_days:1,sortOrder:4000}),task('same2','同日2',{due:'2026-08-12',planned_duration_days:1,sortOrder:5000}),task('none','未設定',{sortOrder:6000})];await setData(page,items);expect(await listOrder(page)).toEqual(['B','C','same1','same2','A','none']);expect(await page.evaluate(()=>data.items.map(x=>x.id))).toEqual(['A','B','C','same1','same2','none']);await gantt(page);expect(await ganttOrder(page)).toEqual(['B','C','same1','same2','A','none']);expect(await page.evaluate(()=>persistableData().items.map(x=>x.id))).toEqual(['A','B','C','same1','same2','none']);
});

test('PROJECT-SORT-02: 親計画優先と子孫effective startで階層を維持',async({page})=>{
  const items=[task('A','親A',{due:'2026-08-05',planned_duration_days:5}),task('A1','子A1',{parentId:'A',due:'2026-08-20',planned_duration_days:1,sortOrder:2000}),task('A2','子A2',{parentId:'A',due:'2026-08-10',planned_duration_days:1,sortOrder:3000}),task('B','親B',{due:'2026-08-05',planned_duration_days:1,sortOrder:4000}),task('B1','子B1',{parentId:'B',due:'2026-08-06',planned_duration_days:1,sortOrder:5000}),task('P','親計画なし',{sortOrder:6000}),task('P1','子P1',{parentId:'P',due:'2026-08-20',planned_duration_days:1,sortOrder:7000}),task('P2','子P2',{parentId:'P',due:'2026-08-03',planned_duration_days:1,sortOrder:8000})];await setData(page,items);const expected=['A','A2','A1','P','P2','P1','B','B1'];expect(await listOrder(page)).toEqual(expected);expect(await page.evaluate(()=>effectivePlannedStart(itemById('P')))).toBe('2026-08-03');await gantt(page);expect(await ganttOrder(page)).toEqual(expected);
});

test('GANTT-CHILD-01: Insertでtitle→期限を経てchild、child Insertでgrandchildを作成',async({page})=>{
  await setData(page,[task('parent','親',{planned_duration_days:10}),task('existing','既存子',{parentId:'parent',due:'2026-08-10',planned_duration_days:1,sortOrder:2000})]);await gantt(page);await page.locator('.ganttRow[data-task-id="parent"] .ganttTaskName').click({position:{x:5,y:5}});await page.keyboard.press('Insert');const childId=await page.evaluate(()=>draftTaskId);await finishDraft(page,'新規子','2026/8/15');const child=await page.evaluate(id=>itemById(id),childId);expect(child).toMatchObject({parentId:'parent',title:'新規子',due:'2026-08-15',dependencies:[]});expect(child).not.toHaveProperty('planned_duration_days');expect(child).not.toHaveProperty('actual_start');expect((await ganttOrder(page)).indexOf('existing')).toBeLessThan((await ganttOrder(page)).indexOf(childId));expect(await page.evaluate(id=>persistableData().items.some(x=>x.id===id),childId)).toBe(true);await page.locator(`.ganttRow[data-task-id="${childId}"] .ganttTaskName`).click({position:{x:5,y:5}});await page.keyboard.press('Insert');const grandId=await page.evaluate(()=>draftTaskId);await finishDraft(page,'孫');expect(await page.evaluate(id=>itemById(id).parentId,grandId)).toBe(childId);expect(await page.locator(`.ganttRow[data-task-id="${grandId}"] .childMark`)).toBeVisible();
});

test('GANTT-CHILD-02: ＋も共通draft path、Escと空Enterはprovisional taskを残さない',async({page})=>{
  await setData(page,[task('parent','親')]);await gantt(page);const before=await page.evaluate(()=>data.items.length);await page.locator('.ganttRow[data-task-id="parent"] .childBtn').click();expect(await page.evaluate(()=>draftKind)).toBe('child');await page.locator('#ganttView .ganttDraftTitle').press('Escape');expect(await page.evaluate(()=>({count:data.items.length,draft:draftTaskId,saved:persistableData().items.length}))).toEqual({count:before,draft:'',saved:before});await page.locator('.ganttRow[data-task-id="parent"] .childBtn').click();await page.locator('#ganttView .ganttDraftTitle').press('Enter');expect(await page.evaluate(()=>({count:data.items.length,draft:draftTaskId}))).toEqual({count:before,draft:''});
});

test('GANTT-CHILD-03: 編集中Insertは誤発火せず、新規child計画設定でbar・sort・summaryを更新',async({page})=>{
  await setData(page,[task('parent','親'),task('late','遅い子',{parentId:'parent',due:'2026-08-20',planned_duration_days:1,sortOrder:2000})]);await gantt(page);await page.locator('.ganttRow[data-task-id="late"] .ganttPlanned').click();let input=page.locator('.ganttRow[data-task-id="late"] .ganttPlanned input');await expect(input).toBeFocused();await input.press('Insert');expect(await page.evaluate(()=>draftTaskId)).toBe('');await input.press('Escape');await page.locator('.ganttRow[data-task-id="parent"] .childBtn').click();const id=await page.evaluate(()=>draftTaskId);await finishDraft(page,'早い子');await page.locator(`.ganttRow[data-task-id="${id}"] .ganttPlanned`).click();input=page.locator(`.ganttRow[data-task-id="${id}"] .ganttPlanned input`);await input.fill('1');await input.press('Enter');await page.locator(`.ganttRow[data-task-id="${id}"] .ganttDue .dueTxt`).click();input=page.locator(`.ganttRow[data-task-id="${id}"] .ganttDueText`);await input.fill('2026-08-05');await input.press('Enter');await expect(page.locator(`.ganttBar[data-task-id="${id}"]`)).toBeVisible();expect((await ganttOrder(page)).slice(0,3)).toEqual(['parent',id,'late']);await expect(page.locator('.ganttBar.summary[data-task-id="parent"]')).toHaveAttribute('data-start','2026-08-05');
});

test('GANTT-CHILD-04: childは親完了をblockするが親の進行中開始はblockしない',async({page})=>{
  await setData(page,[task('parent','親'),task('child','子',{parentId:'parent'})]);await gantt(page);await page.locator('.ganttRow[data-task-id="parent"] .ganttState select').selectOption('進行中');expect(await page.evaluate(()=>itemById('parent').state)).toBe('進行中');const action=page.locator('.ganttRow[data-task-id="parent"] .ganttState select').selectOption('完了'),dialog=await page.waitForEvent('dialog');expect(dialog.message()).toContain('子');await dialog.accept();await action;expect(await page.evaluate(()=>itemById('parent').state)).toBe('進行中');
});

test('PROJECT-SORT-DUE-ONLY-01: due only is a provisional display sort key',async({page})=>{
  const items=[task('A','due only late',{due:'2026-08-20'}),task('B','due only early',{due:'2026-08-10',sortOrder:2000}),task('C','formal early',{due:'2026-08-07',planned_duration_days:3,sortOrder:3000}),task('D','formal late',{due:'2026-08-15',planned_duration_days:1,sortOrder:4000}),task('N','no schedule',{sortOrder:5000})];
  await setData(page,items);
  expect(await listOrder(page)).toEqual(['C','B','D','A','N']);
  expect(await page.evaluate(()=>[projectSortEffectiveStart(itemById('A')),projectSortEffectiveStart(itemById('B')),projectSortEffectiveStart(itemById('C'))])).toEqual(['2026-08-20','2026-08-10','2026-08-05']);
  await gantt(page);
  expect(await ganttOrder(page)).toEqual(['C','B','D','A','N']);
});

test('PROJECT-SORT-DUE-ONLY-02: descendant due-only keys sort children, grandchildren and parent groups',async({page})=>{
  const items=[task('P','parent',{sortOrder:1000}),task('P1','child late',{parentId:'P',due:'2026-08-20',sortOrder:2000}),task('P2','child via grandchild',{parentId:'P',sortOrder:3000}),task('P21','grandchild earliest',{parentId:'P2',due:'2026-08-05',sortOrder:4000}),task('P3','child early',{parentId:'P',due:'2026-08-10',sortOrder:4500}),task('Q','other parent',{due:'2026-08-08',planned_duration_days:1,sortOrder:5000})];
  await setData(page,items);
  expect(await page.evaluate(()=>projectSortEffectiveStart(itemById('P')))).toBe('2026-08-05');
  expect(await listOrder(page)).toEqual(['P','P2','P21','P3','P1','Q']);
  await gantt(page);
  expect(await ganttOrder(page)).toEqual(['P','P2','P21','P3','P1','Q']);
});

test('PROJECT-SORT-DUE-ONLY-03: entering duration switches to formal start, resorts and highlights',async({page})=>{
  await setData(page,[task('A','target',{due:'2026-08-20'}),task('B','middle',{due:'2026-08-15',planned_duration_days:1,sortOrder:2000})]);
  expect(await listOrder(page)).toEqual(['B','A']);
  const input=page.locator('#row_A .plannedDays');
  await input.fill('10');
  await input.press('Enter');
  expect(await listOrder(page)).toEqual(['A','B']);
  await expect(page.locator('#row_A')).toHaveClass(/sortAttention/);
  expect(await page.evaluate(()=>projectSortEffectiveStart(itemById('A')))).toBe('2026-08-11');
  await page.locator('#row_B .titleText').click();
  await expect(page.locator('#row_A')).not.toHaveClass(/sortAttention/);
});

test('PROJECT-SORT-DUE-ONLY-04: provisional key does not create bars, warnings, summaries or JSON fields',async({page})=>{
  const items=[task('P','parent'),task('A','due only',{parentId:'P',due:'2026-08-10'}),task('B','dependency target',{due:'2026-08-20',dependencies:[{task_id:'A',type:'finish_to_start'}],sortOrder:3000})];
  await setData(page,items);
  expect(await page.evaluate(()=>({own:ownPlannedSchedule(itemById('A')),gantt:ganttScheduleForTask(itemById('A')),parent:ganttScheduleForTask(itemById('P')),conflicts:allGanttConflicts().length}))).toEqual({own:null,gantt:null,parent:null,conflicts:0});
  await gantt(page);
  await expect(page.locator('.ganttRow[data-task-id="A"] .ganttBar,.ganttRow[data-task-id="A"] .ganttMilestone')).toHaveCount(0);
  await expect(page.locator('.ganttRow[data-task-id="P"] .ganttBar,.ganttRow[data-task-id="P"] .ganttMilestone')).toHaveCount(0);
  const saved=await page.evaluate(()=>persistableData());
  expect(saved.schema_version).toBe('2.0');
  expect(saved.items.find(x=>x.id==='A')).not.toHaveProperty('planned_duration_days');
  expect(saved.items.find(x=>x.id==='A')).not.toHaveProperty('planned_start');
  expect(saved.items.find(x=>x.id==='A')).not.toHaveProperty('sort_start');
  expect(saved.items.find(x=>x.id==='A')).not.toHaveProperty('provisional_start');
});
