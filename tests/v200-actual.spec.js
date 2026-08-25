const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
const task=(id,title,extra={})=>({id,parentId:'',state:'',impact:'',title,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:0,...extra});
async function open(page){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload()}
async function setData(page,items,schema='1.8'){await page.evaluate(({items,schema})=>applyJsonObject({schema_version:schema,items},'Playwright','actual.json',null,{remember:false,writePermissionGranted:false}),{items,schema})}
async function show(page,items){await setData(page,items);await page.locator('#mTeam').click();await page.evaluate(()=>setMode('team'));await expect(page.locator('#ganttView')).toBeVisible()}
async function drag(page,locator,dx){await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();if(!b)throw new Error('drag target missing');await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2,{steps:5});await page.mouse.up()}
test.beforeEach(async({page})=>open(page));

test('GANTT-ACTUAL-SCHEMA-01: 旧Schema実績をuserとしてSchema 2.0保存',async({page})=>{
await setData(page,[task('legacy','旧実績',{actual_start:'2026-07-01',actual_end:'2026-07-03'})],'1.7');const result=await page.evaluate(()=>({item:itemById('legacy'),saved:persistableData()}));expect(result.item).toMatchObject({actual_start_source:'user',actual_end_source:'user'});expect(result.saved.schema_version).toBe(await page.evaluate(()=>CURRENT_SCHEMA_VERSION));expect(result.saved.items[0]).not.toHaveProperty('planned_start');
});

test('GANTT-ACTUAL-VIEW-01: 未設定・進行中・完了・同日の実績表示と時間軸拡張',async({page})=>{
  await show(page,[task('none','なし',{due:'2026-08-12',planned_duration_days:2}),task('done','完了',{state:'完了',due:'2026-08-12',planned_duration_days:2,actual_start:'2026-06-01',actual_end:'2026-06-03'}),task('running','進行中',{state:'進行中',actual_start:'2026-08-01'}),task('point','同日',{state:'完了',actual_start:'2026-08-05',actual_end:'2026-08-05'})]);await expect(page.locator('.ganttRow[data-task-id="none"] .actualLine,.ganttRow[data-task-id="none"] .actualSameDay')).toHaveCount(0);await expect(page.locator('.ganttRow[data-task-id="done"] .actualLine')).toBeVisible();await expect(page.locator('.ganttRow[data-task-id="running"] .actualLine.running')).toHaveAttribute('data-gantt-tip',/未完了/);await expect(page.locator('.ganttRow[data-task-id="point"] .actualSameDay')).toBeVisible();await expect(page.locator('.ganttHeader .ganttDate').first().locator('.ganttDateYear')).toHaveText('2026');await expect(page.locator('.ganttHeader .ganttDate').first().locator('.ganttDateMonthDay')).toHaveText('05/30');expect(await page.evaluate(()=>persistableData().items.find(x=>x.id==='running'))).not.toHaveProperty('actual_end');
});

test('GANTT-ACTUAL-UI-01: date入力検証・user化・保留タスクの正順クリア',async({page})=>{
  await show(page,[task('edit','編集',{state:'保留',due:'2026-08-20',planned_duration_days:5})]);await page.locator('.ganttRow[data-task-id="edit"] .actualEditBtn').click();await page.locator('#actualStartInput').fill('2026-08-02');await page.locator('#actualEndInput').fill('2026-08-04');await page.locator('#actualSaveBtn').click();expect(await page.evaluate(()=>itemById('edit'))).toMatchObject({actual_start_source:'user',actual_end_source:'user',due:'2026-08-20',planned_duration_days:5});await page.locator('.ganttRow[data-task-id="edit"] .actualEditBtn').click();await page.locator('#actualEndClear').click();await page.locator('#actualSaveBtn').click();await page.locator('.ganttRow[data-task-id="edit"] .actualEditBtn').click();await page.locator('#actualStartClear').click();await page.locator('#actualSaveBtn').click();const x=await page.evaluate(()=>itemById('edit'));expect(x).not.toHaveProperty('actual_start');expect(x).not.toHaveProperty('actual_start_source');expect(x).not.toHaveProperty('actual_end');expect(x).not.toHaveProperty('actual_end_source');
});

test('GANTT-ACTUAL-DRAG-01: 計画ドラッグは実績日とsourceを変更しない',async({page})=>{
  await show(page,[task('drag','計画',{due:'2026-08-20',planned_duration_days:5,actual_start:'2026-08-01',actual_start_source:'system',actual_end:'2026-08-03',actual_end_source:'user'})]);const before=await page.evaluate(()=>{const x=itemById('drag');return{x:x.actual_start,y:x.actual_end,xs:x.actual_start_source,ys:x.actual_end_source}});await drag(page,page.locator('.ganttBar[data-task-id="drag"]'),36);await drag(page,page.locator('.ganttBar[data-task-id="drag"] .ganttResizeHandle.left'),-36);await drag(page,page.locator('.ganttBar[data-task-id="drag"] .ganttResizeHandle.right'),36);expect(await page.evaluate(()=>{const x=itemById('drag');return{x:x.actual_start,y:x.actual_end,xs:x.actual_start_source,ys:x.actual_end_source}})).toEqual(before);
});

test('GANTT-ACTUAL-INDEPENDENCE-01: 親計画包含と状態は実績値を判定へ混ぜない',async({page})=>{
  await setData(page,[task('parent','親',{due:'2026-08-20',planned_duration_days:10,actual_start:'2026-01-01',actual_end:'2026-12-31'}),task('child','子',{parentId:'parent',due:'2026-08-18',planned_duration_days:2,actual_start:'2025-01-01',actual_end:'2027-01-01'})]);expect(await page.evaluate(()=>parentPlanConflicts().length)).toBe(0);
});
