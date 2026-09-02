const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const item=(id,extra={})=>({id,parentId:'',state:'',impact:'',title:id,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
const day=(offset)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
async function fresh(page,items,mode='personal'){
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(items=>applyJsonObject({schema_version:'2.0',items},'phase1','phase1.json',null,{remember:false,writePermissionGranted:false}),items);
  await page.evaluate(mode=>setMode(mode),mode);
}

test('P1-DUE-STYLE: 今日・明日を穏やかに強調し期限超過を優先（ToDo / Project）',async({page})=>{
  const items=[item('today',{due:day(0)}),item('tomorrow',{due:day(1),sortOrder:2000}),item('late',{due:day(-1),sortOrder:3000})];
  for(const mode of ['personal','team']){
    await fresh(page,items,mode);
    const due=id=>page.locator(mode==='team'?`.ganttRow[data-task-id="${id}"] .dueTxt`:`#row_${id} .dueTxt`).last();
    await expect(due('today')).toHaveClass(/dueToday/);
    await expect(due('tomorrow')).toHaveClass(/dueTomorrow/);
    const late=due('late');
    await expect(late).not.toHaveClass(/dueToday|dueTomorrow/);
    expect(await late.evaluate(el=>getComputedStyle(el.closest('.late')).color)).toBe('rgb(176, 0, 32)');
  }
});

test('P1-DUE-CELL: 期限セル全体と空期限から編集でき、editor内操作は再起動しない',async({page})=>{
  for(const mode of ['personal','team']){
    await fresh(page,[item('blank'),item('dated',{due:day(4),sortOrder:2000})],mode);
    const row=mode==='team'?page.locator('.ganttRow[data-task-id="blank"]'):page.locator('#row_blank');
    const cell=row.locator('td.dueCellHit');
    const box=await cell.boundingBox();
    await page.mouse.click(box.x+box.width-3,box.y+box.height/2);
    await expect(cell.locator('input[type="text"]')).toBeFocused();
    await cell.locator('input[type="text"]').click();
    await expect(cell.locator('input[type="text"]')).toBeFocused();
    await page.evaluate(()=>{window.__pickerCalls=0;HTMLInputElement.prototype.showPicker=function(){window.__pickerCalls++}});
    await cell.locator('.calBtn').click();
    expect(await page.evaluate(()=>window.__pickerCalls)).toBe(1);
  }
});

test('P1-SORT: Projectの日付順は無効、ToDoの日付順は従来どおり',async({page})=>{
  await fresh(page,[item('late',{due:day(5)}),item('early',{due:day(1),sortOrder:2000})],'team');
  await expect(page.locator('#sDate')).toBeDisabled();
  await expect(page.locator('#sDate')).toHaveAttribute('aria-disabled','true');
  expect(await page.evaluate(()=>sortMode)).toBe('tree');
  await page.evaluate(()=>setSortMode('date'));
  expect(await page.evaluate(()=>sortMode)).toBe('tree');
  await page.evaluate(()=>setMode('personal'));
  await expect(page.locator('#sDate')).toBeEnabled();
  await page.evaluate(()=>setSortMode('date'));
  expect(await page.evaluate(()=>sortMode)).toBe('date');
  expect(await page.locator('#body tr[id^="row_"] .titleText').allTextContents()).toEqual(['early','late']);
});

test('P1-FOOTER: 説明文を除去して件数表示だけを維持',async({page})=>{
  await fresh(page,[item('one')]);
  await expect(page.locator('.foot')).not.toContainText('taskdb_xxx.json');
  await expect(page.locator('.foot')).not.toContainText('正本はJSON');
  await expect(page.locator('#cnt')).toContainText('表示 1件 / 全体 1件');
});

test('P1-TITLE-STATE: 保留は灰色、中止は灰色＋取消線、完了表示を優先（ToDo / Project）',async({page})=>{
  const items=[item('hold',{state:'保留'}),item('cancel',{state:'中止',sortOrder:2000}),item('doneHold',{state:'保留',completed:true,sortOrder:3000})];
  for(const mode of ['personal','team']){
    await fresh(page,items,mode);
    await page.evaluate(()=>setView('all'));
    const title=id=>page.locator(`${mode==='team'?`.ganttRow[data-task-id="${id}"]`:`#row_${id}`} .titleText, ${mode==='team'?`.ganttRow[data-task-id="${id}"]`:`#row_${id}`} .ganttTaskTitle`).last();
    await expect(title('hold')).toHaveClass(/taskTitleHold/);
    expect(await title('hold').evaluate(el=>getComputedStyle(el).textDecorationLine)).toBe('none');
    await expect(title('cancel')).toHaveClass(/taskTitleCancelled/);
    expect(await title('cancel').evaluate(el=>getComputedStyle(el).textDecorationLine)).toContain('line-through');
    expect(await title('doneHold').evaluate(el=>getComputedStyle(el).textDecorationLine)).toContain('line-through');
  }
});

test('P1-LOGO: ヘッダーの∵ロゴを1px上へ微調整',async({page})=>{
  await page.goto(APP);
  await expect(page.locator('h1 svg')).toHaveCSS('transform',/matrix\(1, 0, 0, 1, 0, -2\)/);
});
