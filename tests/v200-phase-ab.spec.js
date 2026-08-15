const {test,expect}=require('playwright/test');
const APP='/asana_style_task_manager_v200_dev.html';
const task=(id,title=id,extra={})=>({id,parentId:'',state:'',impact:'',title,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
async function boot(page){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload()}
async function show(page,items){await page.evaluate(items=>applyJsonObject({schema_version:'1.8',items},'test','phase-ab.json',null,{remember:false,writePermissionGranted:false}),items);await page.locator('#mTeam').click();await page.evaluate(()=>setMode('team'));await expect(page.locator('#ganttView')).toBeVisible()}
async function order(page){return page.locator('#ganttView .ganttRow[data-task-id]').evaluateAll(rs=>rs.map(r=>r.dataset.taskId))}
test.beforeEach(async({page})=>boot(page));

test('CRITICAL-IME-01: IME中Insert後もタイトルと各inline editorを再利用できる',async({page})=>{
  await show(page,[task('p','親',{state:'未着手',owner:'担当A',due:'2026-08-20',planned_duration_days:5})]);
  const row=page.locator('.ganttRow[data-task-id="p"]'),title=row.locator('.ganttTaskTitle');
  expect(await title.evaluate(el=>el.isContentEditable)).toBe(true);await title.click();await title.press('End');await title.type('編集');await title.press('Enter');expect(await page.evaluate(()=>itemById('p').title)).toBe('親編集');
  await title.click();await title.dispatchEvent('compositionstart',{data:'日本語'});await page.keyboard.press('Insert');expect(await page.evaluate(()=>data.items.length)).toBe(1);await title.dispatchEvent('compositionend',{data:'日本語'});await title.press('Enter');
  await title.click();await expect(title).toBeFocused();await title.press('End');await title.type('再');await title.press('Enter');expect(await page.evaluate(()=>itemById('p').title)).toBe('親編集再');
  await row.locator('.ganttState select').selectOption('進行中');await row.locator('.ganttOwner').click();await expect(row.locator('.ganttOwner input')).toBeFocused();await row.locator('.ganttOwner input').fill('担当B');await row.locator('.ganttOwner input').press('Enter');
  await row.locator('.ganttPlanned').click();await expect(row.locator('.ganttPlanned input')).toBeFocused();await row.locator('.ganttPlanned input').press('Escape');await row.locator('.ganttDue').click();await expect(row.locator('.ganttDueText')).toBeFocused();await row.locator('.ganttDueText').press('Escape');
  await row.locator('.ganttTaskTitle').click();await page.keyboard.press('Insert');expect(await page.evaluate(()=>data.items.length)).toBe(1);await row.locator('.ganttTaskName').click({position:{x:5,y:5}});await page.keyboard.press('Insert');expect(await page.evaluate(()=>data.items.length)).toBe(2);
});

test('GANTT-VISUAL-01: 子孫bar/実績を細くしsummaryを点線、未着手を中空にする',async({page})=>{
  await show(page,[task('p','親',{state:'進行中',due:'2026-08-25',planned_duration_days:20,actual_start:'2026-08-01'}),task('c','子',{parentId:'p',state:'',due:'2026-08-20',planned_duration_days:5,actual_start:'2026-08-02',sortOrder:2000}),task('g','孫',{parentId:'c',state:'未着手',due:'2026-08-18',planned_duration_days:2,actual_start:'2026-08-03',sortOrder:3000}),task('s','summary親',{state:'進行中',sortOrder:4000}),task('sc','summary子',{parentId:'s',state:'進行中',due:'2026-08-22',planned_duration_days:2,sortOrder:5000})]);
  const ph=await page.locator('.ganttBar[data-task-id="p"]').evaluate(e=>parseFloat(getComputedStyle(e).height)),ch=await page.locator('.ganttBar[data-task-id="c"]').evaluate(e=>parseFloat(getComputedStyle(e).height));expect(ch/ph).toBeGreaterThanOrEqual(.45);expect(ch/ph).toBeLessThanOrEqual(.55);
  await expect(page.locator('.ganttBar[data-task-id="s"]')).toHaveCSS('border-top-style','dashed');await expect(page.locator('.ganttBar[data-task-id="c"]')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const pa=await page.locator('.ganttRow[data-task-id="p"] .actualLine').evaluate(e=>parseFloat(getComputedStyle(e).height)),ca=await page.locator('.ganttRow[data-task-id="c"] .actualLine').evaluate(e=>parseFloat(getComputedStyle(e).height));expect(ca).toBeLessThan(pa);
  await page.evaluate(()=>{const p=itemById('s');p.due='2026-08-25';p.planned_duration_days=10;render()});await expect(page.locator('.ganttBar[data-task-id="s"]')).not.toHaveCSS('border-top-style','dashed');await page.evaluate(()=>{const p=itemById('s');delete p.due;delete p.planned_duration_days;render()});await expect(page.locator('.ganttBar[data-task-id="s"]')).toHaveCSS('border-top-style','dashed');
});

test('GANTT-VISUAL-02: 状態別の中空/中実と期限超過実績色の優先順位',async({page})=>{
  const past='2020-01-01';await show(page,[task('blank','blank',{due:'2026-08-20',planned_duration_days:2}),task('todo','todo',{state:'未着手',due:'2026-08-21',planned_duration_days:2,sortOrder:2000}),task('doing','doing',{state:'進行中',due:past,planned_duration_days:2,actual_start:'2020-01-01',sortOrder:3000}),task('hold','hold',{state:'保留',due:past,planned_duration_days:2,actual_start:'2020-01-01',sortOrder:4000}),task('cancel','cancel',{state:'中止',due:past,planned_duration_days:2,actual_start:'2020-01-01',sortOrder:5000})]);
  for(const id of ['blank','todo'])await expect(page.locator(`.ganttBar[data-task-id="${id}"]`)).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('.ganttBar[data-task-id="doing"]')).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const colors=await page.evaluate(()=>Object.fromEntries(['doing','hold','cancel'].map(id=>[id,getComputedStyle(document.querySelector(`.ganttRow[data-task-id="${id}"] .actualLine`)).backgroundColor])));expect(colors.doing).not.toBe(colors.hold);expect(colors.doing).not.toBe(colors.cancel);expect(colors.hold).not.toBe(colors.cancel);
});

test('DRAFT-FLOW-01: Project Listの新規taskはtitle→due→計画日数',async({page})=>{
  await page.evaluate(()=>applyJsonObject({schema_version:'1.8',items:[]},'test','draft.json',null,{remember:false}));await page.locator('#mTeam').click();await page.locator('#b_title').fill('新規');await page.locator('#b_title').press('Enter');await expect(page.locator('#b_due')).toBeFocused();await page.locator('#b_due').fill('2026/8/5');await page.locator('#b_due').press('Enter');await expect(page.locator('#b_planned')).toBeFocused();await page.locator('#b_planned').fill('1');await page.locator('#b_planned').press('Enter');expect(await page.evaluate(()=>data.items[0])).toMatchObject({title:'新規',due:'2026-08-05',planned_duration_days:1});
});

test('DRAFT-FLOW-02: child/grandchildはduration確定まで位置固定し確定後sort',async({page})=>{
  await show(page,[task('p','親'),task('late','遅い子',{parentId:'p',due:'2026-08-20',planned_duration_days:1,sortOrder:2000})]);
  await page.locator('.ganttRow[data-task-id="p"] .ganttTaskName').click({position:{x:5,y:5}});await page.keyboard.press('Insert');
  const id=await page.evaluate(()=>draftTaskId),title=page.locator('.ganttDraftRow .ganttDraftTitle');await title.fill('早い子');await title.press('Enter');
  const due=page.locator('.ganttDraftRow .ganttDue input[type="text"]');await due.fill('2026/8/5');await due.press('Enter');
  expect((await order(page)).indexOf(id)).toBeGreaterThan((await order(page)).indexOf('late'));const duration=page.locator('.ganttDraftRow .ganttPlanned input');await expect(duration).toBeFocused();await duration.fill('1');await duration.press('Enter');expect((await order(page)).slice(0,3)).toEqual(['p',id,'late']);expect(await page.evaluate(id=>itemById(id).parentId,id)).toBe('p');
  await page.locator(`.ganttRow[data-task-id="${id}"] .ganttTaskName`).click({position:{x:5,y:5}});await page.keyboard.press('Insert');const gid=await page.evaluate(()=>draftTaskId);await page.locator('.ganttDraftRow .ganttDraftTitle').fill('孫');await page.locator('.ganttDraftRow .ganttDraftTitle').press('Enter');await page.locator('.ganttDraftRow .ganttDue input[type="text"]').press('Escape');expect(await page.evaluate(gid=>itemById(gid),gid)).toBeUndefined();expect(await page.evaluate(()=>selectedTaskId)).toBe(id);
});

test('GANTT-UI-01: 列名をList用語へ統一しsort選択UIを追加しない',async({page})=>{await show(page,[task('p','親')]);await expect(page.locator('.ganttHeader .ganttLeftPane')).toContainText('タイトル');await expect(page.locator('.ganttHeader .ganttLeftPane')).toContainText('ステータス');await expect(page.getByText(/開始日順|期限順|元順/)).toHaveCount(0);expect(await page.evaluate(()=>data.schema_version)).toBe('1.9')});
