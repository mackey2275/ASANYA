const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
const task=(id,extra={})=>({id,parentId:'',state:'',impact:'',title:id,owner:'',due:'2026-08-25',planned_duration_days:1,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
async function boot(page,items,mode='personal'){await page.setViewportSize({width:1100,height:600});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(({items,mode})=>{applyJsonObject({schema_version:'2.0',items},'phase4','phase4.json',null,{remember:false,writePermissionGranted:false});setMode(mode);clearUndoHistory('phase4')},{items,mode})}
const value=(page,id)=>page.evaluate(id=>{const x=itemById(id);return x&&JSON.parse(JSON.stringify(x))},id);

test('PHASE4-COMPLETE-01 Project状態完了は未終了、終了・再オープンは状態と独立してToDoへ反映',async({page})=>{
  await boot(page,[task('N')],'team');const state=page.locator('.ganttRow[data-task-id="N"] .ganttState select');await state.selectOption('完了');expect(await value(page,'N')).toMatchObject({state:'完了',completed:false});await page.evaluate(()=>setMode('personal'));await page.locator('#vOpen').click();await expect(page.locator('#row_N')).toHaveCount(1);
  await page.evaluate(()=>setMode('team'));await page.locator('.ganttRow[data-task-id="N"] .doneBtn').click();expect(await value(page,'N')).toMatchObject({state:'完了',completed:true});await page.evaluate(()=>setMode('personal'));await page.locator('#vDone').click();await page.locator('#row_N .doneBtn').click();expect(await value(page,'N')).toMatchObject({state:'完了',completed:false});await page.locator('#vOpen').click();await expect(page.locator('#row_N')).toHaveCount(1)
});

test('PHASE4-COMPLETE-02 ToDo終了・再オープンは状態を保持し各操作を1回Undo/Redo',async({page})=>{
  await boot(page,[task('N')]);await page.locator('#row_N .doneBtn').click();expect(await value(page,'N')).toMatchObject({state:'完了',completed:true});await page.keyboard.press('Control+z');expect(await value(page,'N')).toMatchObject({state:'',completed:false});await page.keyboard.press('Control+y');expect(await value(page,'N')).toMatchObject({state:'完了',completed:true});await page.locator('#vDone').click();await page.locator('#row_N .doneBtn').click();expect(await value(page,'N')).toMatchObject({state:'完了',completed:false});await page.locator('#vOpen').click();await page.evaluate(()=>setMode('team'));await expect(page.locator('.ganttRow[data-task-id="N"] .ganttState select')).toHaveValue('完了')
});

test('PHASE4-ROLL-01 ToDo繰返し完了は同一ID・同一件数で次回へ進みactualをclear',async({page})=>{
  const rule={type:'daily'};await boot(page,[task('R',{due:'2026-10-25',state:'進行中',repeat:'毎日',recurrence_rule:rule,actual_start:'2026-10-24',actual_end:'2026-10-25',actual_start_source:'user',actual_end_source:'system'})]);await page.locator('#row_R .doneBtn').click();const x=await value(page,'R');expect(await page.evaluate(()=>data.items.length)).toBe(1);expect(x).toMatchObject({id:'R',due:'2026-10-26',state:'',completed:false,repeat:'毎日',recurrence_rule:rule});for(const k of['actual_start','actual_end','actual_start_source','actual_end_source'])expect(x[k]).toBeUndefined();await expect(page.locator('#row_R')).toHaveCount(1);await page.locator('#vDone').click();await expect(page.locator('#row_R')).toHaveCount(0)
});

test('PHASE4-ROLL-02 Project完了も同じrolloverを使用',async({page})=>{
  await boot(page,[task('R',{state:'進行中',repeat:'隔週',recurrence_rule:{type:'biweekly'},actual_start:'2026-08-24',actual_end:'2026-08-25'})],'team');await page.locator('.ganttRow[data-task-id="R"] .doneBtn').click();expect(await value(page,'R')).toMatchObject({id:'R',due:'2026-09-08',state:'',completed:false,repeat:'隔週'});expect(await page.evaluate(()=>data.items.length)).toBe(1);await expect(page.locator('.ganttRow[data-task-id="R"] .ganttState select')).toHaveValue('')
});

test('PHASE4-ROLL-03 daily/weekly/biweekly/monthly/bimonthly/yearlyを同一taskへ適用',async({page})=>{
  const cases=[['D','2026-10-25','毎日',{type:'daily'},'2026-10-26'],['W','2026-08-25','毎週',{type:'weekly',weekdays:[2]},'2026-09-08'],['B','2026-08-25','隔週',{type:'biweekly'},'2026-09-08'],['M','2026-08-31','毎月',{type:'monthly',mode:'date',day:31},'2026-09-30'],['BM','2026-09-30','隔月',{type:'bimonthly',parity:'odd',mode:'date',day:30},'2026-11-30'],['Y','2026-08-25','毎年',{type:'yearly',month:8,day:25},'2027-08-25']];await boot(page,cases.map((c,i)=>task(c[0],{due:c[1],repeat:c[2],recurrence_rule:c[3],sortOrder:(i+1)*1000})));for(const c of cases)await page.evaluate(id=>toggle(data.items.findIndex(x=>x.id===id)),c[0]);for(const c of cases)expect(await value(page,c[0])).toMatchObject({id:c[0],due:c[4],completed:false,state:'',repeat:c[2],recurrence_rule:c[3]});expect(await page.evaluate(()=>data.items.length)).toBe(cases.length)
});

test('PHASE4-ROLL-04 rollover Undo/Redoは全fieldを1 transactionで復元',async({page})=>{
  const before=task('R',{due:'2026-10-25',state:'進行中',repeat:'毎日',recurrence_rule:{type:'daily'},actual_start:'2026-10-24',actual_end:'2026-10-25',actual_start_source:'user',actual_end_source:'system'});await boot(page,[before]);const normalizedBefore=await value(page,'R');await page.locator('#row_R .doneBtn').click();await page.keyboard.press('Control+z');expect(await value(page,'R')).toEqual(normalizedBefore);expect(await page.evaluate(()=>data.items.length)).toBe(1);await page.keyboard.press('Control+y');const after=await value(page,'R');expect(after).toMatchObject({id:'R',due:'2026-10-26',state:'',completed:false,repeat:'毎日'});expect(after.actual_start).toBeUndefined();expect(await page.evaluate(()=>data.items.length)).toBe(1)
});

test('PHASE4-ROLL-05 次回計算不能はdata/historyを完全no-opにして通知',async({page})=>{
  await boot(page,[task('R',{due:'',repeat:'毎日',recurrence_rule:{type:'daily'},state:'進行中'})]);const before=await page.evaluate(()=>({data:JSON.stringify(data.items),undo:undoStack.length}));await page.locator('#row_R .doneBtn').click();expect(await page.evaluate(()=>({data:JSON.stringify(data.items),undo:undoStack.length}))).toEqual(before);await expect(page.locator('#toast')).toContainText('次回の繰返し期限を計算できない')
});

test('PHASE4-ROLL-06 ToDo/Project rolloverはDue FLIPを使いProject時間軸位置を維持',async({page})=>{
  const items=[task('R',{due:'2026-10-01',repeat:'毎月',recurrence_rule:{type:'monthly',mode:'date',day:1}}),...Array.from({length:35},(_,i)=>task('T'+i,{due:`2026-10-${String(Math.min(28,i+2)).padStart(2,'0')}`,sortOrder:(i+2)*1000})),task('FUTURE',{due:'2028-12-31',planned_duration_days:900,sortOrder:99000})];await boot(page,items,'team');await page.evaluate(()=>setGanttTimelineScroll(600));const before=await page.evaluate(()=>({timeline:ganttTimelineScrollLeft,anchor:rcCaptureViewport().anchorDay,pageY:scrollY}));expect(before.timeline).toBeGreaterThan(0);await page.locator('.ganttRow[data-task-id="R"] .doneBtn').click();await expect(page.locator('.ganttRow[data-task-id="R"]')).toHaveAttribute('data-sort-move-kind','due');await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4000}).toBe(0);const after=await page.evaluate(()=>({timeline:ganttTimelineScrollLeft,anchor:rcCaptureViewport().anchorDay}));expect(after.timeline).toBeCloseTo(before.timeline,6);expect(Math.abs(after.anchor-before.anchor)).toBeLessThan(.01);expect(await value(page,'R')).toMatchObject({id:'R',due:'2026-11-01',completed:false,state:''})
});
