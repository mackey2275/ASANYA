const {test,expect}=require('playwright/test');
const APP='/asanya_task_manager_v270_pbl030_pbl027_pbl021_pbl022_dev.html';
const task=(id,extra={})=>({id,parentId:'',state:'',impact_level:0,title:id,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
async function fresh(page,items=[],schema='3.0'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await expect(page.locator('body')).not.toHaveClass(/dbBooting/);
  await page.evaluate(({items,schema})=>applyJsonObject({schema_version:schema,items},'pbl022','pbl022.json',null,{remember:false,writePermissionGranted:false}),{items,schema});
}

test('PBL022-CORE-01 Schema 3.0 normalization and serialization preserve only valid recurring schedule dates',async({page})=>{
  await fresh(page,[task('R',{due:'2026-10-10',repeat:'毎日',recurrence_rule:{type:'daily'},recurrence_schedule_date:'2026-10-08'}),task('N',{due:'2026-10-10',recurrence_schedule_date:'2026-10-01'}),task('B',{repeat:'毎日',recurrence_rule:{type:'daily'},recurrence_schedule_date:'bad'})]);
  expect(await page.evaluate(()=>({version:CURRENT_SCHEMA_VERSION,tasks:data.items.map(x=>({id:x.id,s:x.recurrence_schedule_date})),saved:persistableData()}))).toMatchObject({version:'3.0',tasks:[{id:'R',s:'2026-10-08'},{id:'N',s:undefined},{id:'B',s:undefined}],saved:{schema_version:'3.0'}});
});

test('PBL022-CORE-02 first Due establishes schedule once; later edits and clearing preserve it',async({page})=>{
  await fresh(page,[task('R',{repeat:'毎日',recurrence_rule:{type:'daily'}})]);
  const result=await page.evaluate(()=>{const i=0;chg(i,'due','2026-10-10');const first=itemById('R').recurrence_schedule_date;chg(i,'due','2026-10-12');const second=itemById('R').recurrence_schedule_date;chg(i,'due','');return{first,second,afterClear:itemById('R').recurrence_schedule_date,due:itemById('R').due}});
  expect(result).toEqual({first:'2026-10-10',second:'2026-10-10',afterClear:'2026-10-10',due:''});
});

test('PBL022-CORE-03 recurrence enable/change/no-op/disable applies approved re-anchor semantics',async({page})=>{
  await fresh(page,[task('R',{due:'2026-10-10'})]);
  const result=await page.evaluate(()=>{commitRepeatChange(0,'毎週',{type:'weekly',weekdays:[6]});const enabled=itemById('R').recurrence_schedule_date;itemById('R').due='2026-10-12';commitRepeatChange(0,'毎週',{type:'weekly',weekdays:[6]});const noOp=itemById('R').recurrence_schedule_date;commitRepeatChange(0,'隔週',{type:'biweekly'});const changed=itemById('R').recurrence_schedule_date;commitRepeatChange(0,'',null);return{enabled,noOp,changed,repeat:itemById('R').repeat,schedule:itemById('R').recurrence_schedule_date}});
  expect(result).toEqual({enabled:'2026-10-10',noOp:'2026-10-10',changed:'2026-10-12',repeat:'',schedule:undefined});
});

test('PBL022-CORE-04 next occurrence uses schedule date, advances at least once, and catches up to >= today',async({page})=>{
  await fresh(page);
  const result=await page.evaluate(()=>{const today=ymd(),old=addDays(today,-5);return{today,daily:nextRecurringDue({due:addDays(today,20),recurrence_schedule_date:old,repeat:'毎日',recurrence_rule:{type:'daily'}}),one:nextRecurringOccurrence('2026-09-08','毎週',{type:'weekly',weekdays:[2]}),bi:nextRecurringOccurrence('2026-09-08','隔週',{type:'biweekly'})}});
  expect(result.daily).toBe(result.today);expect(result.one).toBe('2026-09-15');expect(result.bi).toBe('2026-09-22');
});

test('PBL022-CORE-05 recurrence pattern engine remains unchanged for all supported shapes',async({page})=>{
  await fresh(page);
  const v=await page.evaluate(()=>({weekly:nextRecurringOccurrence('2026-08-17','毎週',{type:'weekly',weekdays:[1,3,5]}),month:nextRecurringOccurrence('2025-01-31','毎月',{type:'monthly',mode:'date',day:31}),nth:nextRecurringOccurrence('2026-08-04','毎月',{type:'monthly',mode:'weekday',ordinal:1,weekday:2}),last:nextRecurringOccurrence('2026-08-28','毎月',{type:'monthly',mode:'weekday',ordinal:'last',weekday:5}),bimonth:nextRecurringOccurrence('2026-01-31','隔月',{type:'bimonthly',parity:'odd',mode:'date',day:31}),leap:nextRecurringOccurrence('2027-02-28','毎年',{type:'yearly',month:2,day:29})}));
  expect(v).toEqual({weekly:'2026-08-19',month:'2025-02-28',nth:'2026-09-01',last:'2026-09-25',bimonth:'2026-03-31',leap:'2028-02-29'});
});

test('PBL022-CORE-06 Calendar, D shortcut and Gantt due-marker paths preserve an established schedule date',async({page})=>{
  await fresh(page,[task('R',{due:'2026-10-10',repeat:'毎日',recurrence_rule:{type:'daily'},recurrence_schedule_date:'2026-10-08'})]);
  await page.evaluate(()=>setDueFromCalendar(0,'2026-10-11'));expect(await page.evaluate(()=>itemById('R').recurrence_schedule_date)).toBe('2026-10-08');
  await page.locator('#row_R .dueTxt').click();await page.locator('#d0').fill('2026/10/12');await page.locator('#d0').press('Enter');expect(await page.evaluate(()=>itemById('R').recurrence_schedule_date)).toBe('2026-10-08');
  await page.evaluate(()=>{setMode('team');const t=itemById('R');dueMarkerDragState={pointerId:7,task:t,originalDue:t.due,proposal:'2026-10-13',dragged:true,before:displaySortIndex(t.id),preview:{remove(){}}};finishDueMarkerDrag({pointerId:7,preventDefault(){}})});expect(await page.evaluate(()=>({due:itemById('R').due,s:itemById('R').recurrence_schedule_date}))).toEqual({due:'2026-10-13',s:'2026-10-08'});
});

test('PBL022-CORE-07 missed daily/weekly/biweekly/monthly occurrences land on first valid date >= today',async({page})=>{
  await fresh(page);const v=await page.evaluate(()=>{const today=ymd(),weekday=pd(today).getDay();return{today,daily:nextRecurringDue({recurrence_schedule_date:addDays(today,-4),repeat:'毎日',recurrence_rule:{type:'daily'}}),weekly:nextRecurringDue({recurrence_schedule_date:addDays(today,-14),repeat:'毎週',recurrence_rule:{type:'weekly',weekdays:[weekday]}}),biweekly:nextRecurringDue({recurrence_schedule_date:addDays(today,-14),repeat:'隔週',recurrence_rule:{type:'biweekly'}}),monthly:nextRecurringDue({recurrence_schedule_date:addMonths(today,-2),repeat:'毎月',recurrence_rule:{type:'monthly',mode:'date',day:pd(today).getDate()}})}});expect(v.daily).toBe(v.today);expect(v.weekly).toBe(v.today);expect(v.biweekly).toBe(v.today);expect(v.monthly).toBe(v.today);
});

test('PBL022-HIER-01 rollover is same-record, uses scheduled delta, resets hierarchy and is one Undo/Redo',async({page})=>{
  await fresh(page,[task('R',{due:'2026-10-10',repeat:'毎週',recurrence_rule:{type:'weekly',weekdays:[2]},recurrence_schedule_date:'2026-10-06',actual_start:'2026-10-01',actual_end:'2026-10-02'}),task('C',{parentId:'R',due:'2026-10-11',completed:true,state:'完了',sortOrder:2000}),task('G',{parentId:'C',due:'',completed:true,state:'完了',sortOrder:3000})]);
  const before=await page.evaluate(()=>({count:data.items.length,undo:undoStack.length}));
  expect(await page.evaluate(()=>rolloverRecurringTask(itemById('R')))).toBe(true);
  const after=await page.evaluate(()=>({count:data.items.length,root:itemById('R'),child:itemById('C'),grand:itemById('G'),undo:undoStack.length}));
  expect(after.count).toBe(before.count);expect(after.root.due).toBe('2026-10-13');expect(after.root.recurrence_schedule_date).toBe('2026-10-13');expect(after.child.due).toBe('2026-10-18');expect(after.grand.due).toBe('');expect(after.undo).toBe(before.undo+1);expect(after.root.actual_start).toBeUndefined();expect(after.child.completed).toBe(false);
  await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>({due:itemById('R').due,s:itemById('R').recurrence_schedule_date,child:itemById('C').due}))).toEqual({due:'2026-10-10',s:'2026-10-06',child:'2026-10-11'});
  await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>({due:itemById('R').due,s:itemById('R').recurrence_schedule_date,child:itemById('C').due}))).toEqual({due:'2026-10-13',s:'2026-10-13',child:'2026-10-18'});
});

test('PBL022-UI-01 matching Due and schedule show no basis or deviation UI',async({page})=>{
  for(const repeat of ['毎週','隔週','毎月']){
    await fresh(page,[task('R',{due:'2026-10-10',repeat,recurrence_rule:null,recurrence_schedule_date:'2026-10-10'})]);
    await page.locator('#row_R .recurrenceSettings').click();
    await expect(page.locator('.recurrenceBasis')).toHaveCount(0);
    await expect(page.getByText('繰返し基準日')).toHaveCount(0);
    await expect(page.locator('#recurrenceReanchor')).toHaveCount(0);
    await page.evaluate(()=>cancelRecurrenceEditor());
  }
});

test('PBL022-UI-02 normal recurrence deviations use plain guidance without generic re-anchor',async({page})=>{
  for(const repeat of ['毎日','毎週','毎月','隔月','毎年']){
    await fresh(page,[task('R',{due:'2026-10-10',repeat,recurrence_rule:null,recurrence_schedule_date:'2026-10-08'})]);
    await page.locator('#row_R .recurrenceSettings').click();
    await expect(page.locator('.recurrenceBasis')).toContainText('今回の期限は 10/10 に変更されています。');
    await expect(page.locator('.recurrenceBasis')).toContainText('次回以降は設定した繰返し予定に戻ります。');
    await expect(page.getByText('繰返し基準日')).toHaveCount(0);
    await expect(page.getByText('現在の期限を繰返し基準にする')).toHaveCount(0);
    await expect(page.locator('#recurrenceReanchor')).toHaveCount(0);
    await page.evaluate(()=>cancelRecurrenceEditor());
  }
});

test('PBL022-UI-03 biweekly deviation can re-anchor phase with one Undo and Redo',async({page})=>{
  await fresh(page,[task('R',{due:'2026-10-10',repeat:'隔週',recurrence_rule:{type:'biweekly'},recurrence_schedule_date:'2026-10-08'})]);
  await page.locator('#row_R .recurrenceSettings').click();
  await expect(page.locator('.recurrenceBasis')).toContainText('今回の期限は 10/10 に変更されています。');
  await expect(page.locator('#recurrenceReanchor')).toHaveText('今回の期限から隔週で繰り返す');
  await page.locator('#recurrenceReanchor').focus();await expect(page.locator('#recurrenceReanchor')).toBeFocused();
  await page.locator('#recurrenceReanchor').press('Enter');
  expect(await page.evaluate(()=>({due:itemById('R').due,s:itemById('R').recurrence_schedule_date,rule:itemById('R').recurrence_rule,action:undoStack.at(-1)?.actionType}))).toEqual({due:'2026-10-10',s:'2026-10-10',rule:{type:'biweekly'},action:'change_recurrence_basis'});
  await expect(page.locator('.recurrenceBasis')).toHaveCount(0);
  await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('R').recurrence_schedule_date)).toBe('2026-10-08');
  await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>itemById('R').recurrence_schedule_date)).toBe('2026-10-10');
});

test('PBL022-UI-04 biweekly no-op and blank Due states expose no action or internal basis wording',async({page})=>{
  await fresh(page,[task('R',{due:'2026-10-10',repeat:'隔週',recurrence_rule:{type:'biweekly'},recurrence_schedule_date:'2026-10-10'})]);
  await page.locator('#row_R .recurrenceSettings').click();await expect(page.locator('#recurrenceReanchor')).toHaveCount(0);await page.evaluate(()=>cancelRecurrenceEditor());
  await fresh(page,[task('R',{due:'',repeat:'隔週',recurrence_rule:{type:'biweekly'},recurrence_schedule_date:'2026-10-08'})]);
  await page.locator('#row_R .recurrenceSettings').click();await expect(page.locator('.recurrenceBasis')).toContainText('今回の期限は未設定です。');await expect(page.locator('#recurrenceReanchor')).toHaveCount(0);await expect(page.getByText('繰返し基準日')).toHaveCount(0);
});

test('PBL022-UI-05 semantic recurrence change re-anchors while unchanged save does not',async({page})=>{
  await fresh(page,[task('R',{due:'2026-10-15',repeat:'毎月',recurrence_rule:{type:'monthly',mode:'date',day:13},recurrence_schedule_date:'2026-10-13'})]);
  const result=await page.evaluate(()=>{commitRepeatChange(0,'毎月',{type:'monthly',mode:'date',day:13});const unchanged=itemById('R').recurrence_schedule_date;commitRepeatChange(0,'毎月',{type:'monthly',mode:'date',day:15});return{unchanged,changed:itemById('R').recurrence_schedule_date,rule:itemById('R').recurrence_rule}});
  expect(result).toEqual({unchanged:'2026-10-13',changed:'2026-10-15',rule:{type:'monthly',mode:'date',day:15}});
});

test('PBL022-SCHEMA-01 Schema 2.5 migration initializes schedule deterministically without dirty write',async({page})=>{
  await fresh(page,[task('D',{due:'2026-10-10',repeat:'毎日'}),task('N',{repeat:'毎日',sortOrder:2000}),task('X',{due:'2026-10-10',sortOrder:3000})],'2.5');
  expect(await page.evaluate(()=>({loaded:loadedSchemaVersion,pending:schemaMigrationPending,dirty,items:data.items.map(x=>({id:x.id,s:x.recurrence_schedule_date})),saved:persistableData().schema_version}))).toEqual({loaded:'2.5',pending:true,dirty:false,items:[{id:'D',s:'2026-10-10'},{id:'N',s:undefined},{id:'X',s:undefined}],saved:'3.0'});
});

test('PBL022-SCHEMA-02 unsupported gap and future schemas are rejected',async({page})=>{
  await fresh(page);expect(await page.evaluate(()=>{const out={};for(const v of ['2.6','3.1'])try{prepareSchemaObject({schema_version:v,items:[]});out[v]='accepted'}catch(e){out[v]=e.schemaKind}return out})).toEqual({'2.6':'unsupported-gap','3.1':'newer'});
});
