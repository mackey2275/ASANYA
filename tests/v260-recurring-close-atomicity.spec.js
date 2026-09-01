const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',title:id,state:'進行中',owner:'',due:'',planned_duration_days:1,summary:'',repeat:'毎日',recurrence_rule:{type:'daily'},completed:false,dependencies:[],sortOrder:1000,impact_level:2,...extra});
async function boot(page,items){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(items=>{applyJsonObject({schema_version:'2.5',workspace_info_markdown:'',items},'atomicity','atomicity.json',null,{remember:false,writePermissionGranted:false});setView('all');clearUndoHistory('atomicity');dirty=false;redoStack.length=0},items);
}
const state=page=>page.evaluate(()=>({json:JSON.stringify(data.items),undo:JSON.stringify(undoStack),redo:JSON.stringify(redoStack),dirty}));

test('RC-ATOMIC-01 no-Due recurring Close is a complete no-op',async({page})=>{
  await boot(page,[task('R')]);const before=await state(page);await page.locator('#row_R .doneBtn').click();expect(await state(page)).toEqual(before);await expect(page.locator('#toast')).toContainText('次回の繰返し期限を計算できない');
});

test('RC-ATOMIC-02 failed Close preserves existing Actual values and sources',async({page})=>{
  await boot(page,[task('R',{actual_start:'2026-08-10',actual_end:'2026-08-11',actual_start_source:'user',actual_end_source:'system'})]);const before=await state(page);await page.evaluate(()=>toggle(0));expect(await state(page)).toEqual(before);
});

test('RC-ATOMIC-03 Status 完了 and Open remain exact after invalid Close',async({page})=>{
  await boot(page,[task('R',{state:'完了',actual_start:'2026-08-10',actual_end:'2026-08-11',actual_start_source:'user',actual_end_source:'user'})]);const before=await state(page);await page.evaluate(()=>toggle(0));expect(await state(page)).toEqual(before);
});

test('RC-ATOMIC-04 cancelled recurring task remains exact after invalid Close',async({page})=>{
  await boot(page,[task('R',{state:'中止'})]);const before=await state(page);await page.evaluate(()=>toggle(0));expect(await state(page)).toEqual(before);
});

test('RC-ATOMIC-05 valid recurring Close keeps same-record rollover and one Undo',async({page})=>{
  await boot(page,[task('R',{due:'2026-09-10',actual_start:'2026-09-01',actual_end:'2026-09-10',actual_start_source:'user',actual_end_source:'system'})]);await page.evaluate(()=>toggle(0));expect(await page.evaluate(()=>({count:data.items.length,item:itemById('R'),undo:undoStack.length,dirty}))).toMatchObject({count:1,item:{id:'R',due:'2026-09-11',state:'',completed:false,repeat:'毎日'},undo:1,dirty:true});expect(await page.evaluate(()=>itemById('R').actual_start)).toBeUndefined();
});

test('RC-ATOMIC-06 Status 完了 alone assists Actual but does not rollover or Close',async({page})=>{
  await boot(page,[task('R',{state:'未着手',due:'2026-09-10'})]);await page.evaluate(()=>changeState(0,'完了'));expect(await page.evaluate(()=>({item:itemById('R'),undo:undoStack.length}))).toMatchObject({item:{id:'R',due:'2026-09-10',state:'完了',completed:false,actual_start:'2026-09-01',actual_end:'2026-09-01'},undo:1});
});

test('RC-ATOMIC-07 failed recurring parent Close leaves parent and descendants exact',async({page})=>{
  await boot(page,[task('P',{state:'完了'}),task('C',{parentId:'P',state:'完了',repeat:'',recurrence_rule:undefined,sortOrder:2000}),task('G',{parentId:'C',state:'中止',repeat:'',recurrence_rule:undefined,sortOrder:3000})]);const before=await state(page);await page.evaluate(()=>toggle(0));expect(await state(page)).toEqual(before);
});
