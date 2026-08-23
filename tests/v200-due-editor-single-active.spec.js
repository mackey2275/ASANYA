const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,due,sortOrder)=>({id,parentId:'',state:'',impact:'',title:id,owner:'',due,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder});
async function fresh(page,mode='personal'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(items=>applyJsonObject({schema_version:'2.0',items},'due-hotfix','due-hotfix.json',null,{remember:false,writePermissionGranted:false}),[
    task('A','2026-08-20',1000),task('B','2026-08-22',2000),task('C','',3000)
  ]);
  await page.evaluate(mode=>setMode(mode),mode);
}
const row=(page,mode,id)=>page.locator(mode==='team'?`.ganttRow[data-task-id="${id}"]`:`#row_${id}`);
const input=(page,mode,id)=>row(page,mode,id).locator('.dateEdit input[type="text"]');
const dueCell=(page,mode,id)=>row(page,mode,id).locator('td.dueCellHit');
const visibleEditors=page=>page.locator('.dateEdit:visible input[type="text"][id^="d"]');

for(const mode of ['personal','team'])test(`DUE-SINGLE-01 ${mode}: A→B→Cで常に最新1 editorだけ`,async({page})=>{
  await fresh(page,mode);
  await dueCell(page,mode,'A').click({position:{x:2,y:2}});await expect(input(page,mode,'A')).toBeFocused();
  await dueCell(page,mode,'B').click({position:{x:2,y:2}});await expect(input(page,mode,'B')).toBeFocused();await expect(visibleEditors(page)).toHaveCount(1);
  await dueCell(page,mode,'C').click({position:{x:2,y:2}});await expect(input(page,mode,'C')).toBeFocused();await expect(visibleEditors(page)).toHaveCount(1);
  expect(await page.evaluate(()=>undoStack.length)).toBe(0);
});

for(const mode of ['personal','team'])test(`DUE-SINGLE-02 ${mode}: valid変更をswitch commit`,async({page})=>{
  await fresh(page,mode);await dueCell(page,mode,'A').click({position:{x:2,y:2}});await input(page,mode,'A').fill('2026/08/25');
  await dueCell(page,mode,'B').click({position:{x:2,y:2}});
  expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-25');await expect(input(page,mode,'B')).toBeFocused();await expect(visibleEditors(page)).toHaveCount(1);
});

for(const mode of ['personal','team'])test(`DUE-SINGLE-03 ${mode}: invalid変更はAを維持してBを開かない`,async({page})=>{
  await fresh(page,mode);await dueCell(page,mode,'A').click({position:{x:2,y:2}});await input(page,mode,'A').fill('invalid-date');
  const dialog=page.waitForEvent('dialog'),click=dueCell(page,mode,'B').evaluate(el=>el.click());await (await dialog).accept();await click;
  await expect(input(page,mode,'A')).toBeFocused();await expect(input(page,mode,'A')).toHaveValue('invalid-date');await expect(input(page,mode,'B')).toBeHidden();await expect(visibleEditors(page)).toHaveCount(1);
});

for(const mode of ['personal','team'])test(`DUE-SINGLE-04 ${mode}: 空期限をswitch commit`,async({page})=>{
  await fresh(page,mode);await dueCell(page,mode,'A').click({position:{x:2,y:2}});await input(page,mode,'A').fill('');await dueCell(page,mode,'B').click({position:{x:2,y:2}});
  expect(await page.evaluate(()=>itemById('A').due)).toBe('');await expect(input(page,mode,'B')).toBeFocused();await expect(visibleEditors(page)).toHaveCount(1);
});

test('DUE-SINGLE-05 switch commitは1履歴でUndo可能',async({page})=>{
  await fresh(page);await dueCell(page,'personal','A').click({position:{x:2,y:2}});await input(page,'personal','A').fill('2026/08/25');await dueCell(page,'personal','B').click({position:{x:2,y:2}});
  await page.keyboard.press('Escape');await expect(visibleEditors(page)).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>undoStack.length)).toBe(1);
  await page.evaluate(()=>performUndo());expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-20');await page.evaluate(()=>performRedo());expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-08-25');
});

test('DUE-SINGLE-06 calendar・d数字・Enter/Escape・空期限activationを維持',async({page})=>{
  await fresh(page);await dueCell(page,'personal','C').click({position:{x:2,y:2}});await expect(input(page,'personal','C')).toBeFocused();await page.keyboard.press('Escape');await expect(visibleEditors(page)).toHaveCount(0);
  await dueCell(page,'personal','A').click({position:{x:2,y:2}});await page.evaluate(()=>{window.__pickerCalls=0;HTMLInputElement.prototype.showPicker=function(){window.__pickerCalls++}});await row(page,'personal','A').locator('.calBtn').click();expect(await page.evaluate(()=>window.__pickerCalls)).toBe(1);
  await input(page,'personal','A').press('d');await input(page,'personal','A').press('1');expect(await page.evaluate(()=>itemById('A').due)).toBe(await page.evaluate(()=>addDays(ymd(),1)));await expect(visibleEditors(page)).toHaveCount(0);
  await dueCell(page,'personal','B').click({position:{x:2,y:2}});await input(page,'personal','B').fill('2026/08/24');await input(page,'personal','B').press('Enter');expect(await page.evaluate(()=>itemById('B').due)).toBe('2026-08-24');await expect(visibleEditors(page)).toHaveCount(0);
});
