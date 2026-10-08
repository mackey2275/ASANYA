const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,due,sortOrder)=>({id,parentId:'',title:id,state:'未着手',owner:'',due,planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder,impact_level:0});

async function boot(page){
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
}

async function fixedDueLabel(page,now,due){
  return page.evaluate(({now,due})=>{
    const NativeDate=Date,fixedTime=new NativeDate(now+'T12:00:00').getTime();
    class FixedDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[fixedTime]))}
      static now(){return fixedTime}
    }
    window.Date=FixedDate;
    try{return dueLab(due)}finally{window.Date=NativeDate}
  },{now,due});
}

test.beforeEach(async({page})=>boot(page));

test('PBL046-01 7日後以降は同一年の日付へ1文字曜日を追加する',async({page})=>{
  expect(await fixedDueLabel(page,'2026-10-01','2026-10-08')).toBe('10/8 木');
  expect(await fixedDueLabel(page,'2026-10-01','2026-12-31')).toBe('12/31 木');
});

test('PBL046-02 年をまたぐ7日後以降は年付き日付へ1文字曜日を追加する',async({page})=>{
  expect(await fixedDueLabel(page,'2026-12-25','2027-01-01')).toBe('2027/1/1 金');
  expect(await fixedDueLabel(page,'2026-10-01','2027-01-02')).toBe('2027/1/2 土');
});

test('PBL046-03 相対表示・2～6日後・過去日付の合意済み表示を維持する',async({page})=>{
  const labels={
    yesterday:await fixedDueLabel(page,'2026-10-07','2026-10-06'),
    today:await fixedDueLabel(page,'2026-10-07','2026-10-07'),
    tomorrow:await fixedDueLabel(page,'2026-10-07','2026-10-08'),
    twoDays:await fixedDueLabel(page,'2026-10-05','2026-10-07'),
    sixDays:await fixedDueLabel(page,'2026-10-05','2026-10-11'),
    past:await fixedDueLabel(page,'2026-10-07','2026-10-01')
  };
  expect(labels).toEqual({yesterday:'昨日',today:'今日',tomorrow:'明日',twoDays:'水曜日',sixDays:'日曜日',past:'10/1'});
});

test('PBL046-04 ToDoとProjectは同じ共通期限ラベルを表示し永続値を変えない',async({page})=>{
  const fixture=await page.evaluate(()=>{
    const due=addDays(ymd(),8),label=dueLab(due);
    return{due,label,items:[{id:'A',parentId:'',title:'Eight days later',state:'未着手',owner:'',due,planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:0}]};
  });
  await page.evaluate(async items=>await applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items,snapshots:[]},'PBL-046','pbl046.json',null,{remember:false,writePermissionGranted:false}),fixture.items);
  await expect(page.locator('#row_A .dueTxt')).toHaveText(fixture.label);
  await page.evaluate(()=>setDisplayMode('project-detail'));
  await expect(page.locator('.ganttRow[data-task-id="A"] .ganttDue .dueTxt')).toHaveText(fixture.label);
  expect(await page.evaluate(()=>({due:itemById('A').due,persisted:persistableData().items.find(x=>x.id==='A').due}))).toEqual({due:fixture.due,persisted:fixture.due});
});

test('PBL046-05 年付き最長例がToDoとProjectの期限列に1行で収まる',async({page})=>{
  const item=task('A','2027-12-22',1000);
  await page.evaluate(async item=>await applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items:[item],snapshots:[]},'PBL-046-width','pbl046-width.json',null,{remember:false,writePermissionGranted:false}),item);
  const todo=page.locator('#row_A .dueTxt');
  await expect(todo).toHaveText('2027/12/22 水');
  const todoLayout=await todo.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return{lines:range.getClientRects().length,column:el.closest('td').getBoundingClientRect().width}});
  expect(todoLayout).toEqual({lines:1,column:104});
  await page.evaluate(()=>setDisplayMode('project-detail'));
  const project=page.locator('.ganttRow[data-task-id="A"] .ganttDue .dueTxt');
  await expect(project).toHaveText('2027/12/22 水');
  const projectLayout=await project.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return{lines:range.getClientRects().length,column:el.closest('td').getBoundingClientRect().width}});
  expect(projectLayout).toEqual({lines:1,column:104});
});

test('PBL046-06 旧既定88pxだけを104pxへ移行し手動幅を保持する',async({page})=>{
  await page.evaluate(()=>{
    localStorage.setItem(COLKEY,JSON.stringify({due:88,title:451}));
    localStorage.setItem(PROJECT_COL_KEY,JSON.stringify({due:88,title:452}));
  });
  await page.reload();
  expect(await page.evaluate(()=>({todo:{due:widths.due,title:widths.title},project:{due:projectWidths.due,title:projectWidths.title},storedProject:JSON.parse(localStorage.getItem(PROJECT_COL_KEY))}))).toEqual({
    todo:{due:104,title:451},
    project:{due:104,title:452},
    storedProject:{due:104,title:452}
  });
});
