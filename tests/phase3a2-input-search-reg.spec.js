const { test, expect } = require('playwright/test');

const app='/asana_style_task_manager_v157.html';
const task=(id,title=id,extra={})=>({id,parentId:'',state:'',title,completed:false,due:'',sortOrder:1000,dependencies:[],...extra});

async function boot(page){
  await page.goto(app);
  await page.evaluate(async()=>{localStorage.clear();if(indexedDB.databases)for(const db of await indexedDB.databases())indexedDB.deleteDatabase(db.name);});
  await page.reload();
}
async function setData(page,items){
  await page.evaluate(async items=>applyJsonObject({schema_version:'1.5',items},'Playwright','phase3.json',null,{remember:false,writePermissionGranted:false}),items);
}
async function blankCreate(page,title,due=''){
  await page.locator('#b_title').fill(title); await page.locator('#b_title').press('Enter');
  if(due)await page.locator('#b_due').fill(due); await page.locator('#b_due').press('Enter');
  return page.evaluate(title=>data.items.find(x=>x.title===title)?.id,title);
}
async function dialogFrom(page,action,accept){
  const pending=page.waitForEvent('dialog'),result=action(),dialog=await pending,message=dialog.message();
  accept?await dialog.accept():await dialog.dismiss(); await result; return message;
}
function addDaysText(days){const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;}

test.beforeEach(async({page})=>boot(page));

test('INPUT-01, INPUT-02: 最上段タイトルEnterから期限Enterで確定',async({page})=>{
  await page.locator('#b_title').fill('新規入力'); await page.locator('#b_title').press('Enter');
  await expect(page.locator('#b_due')).toBeFocused(); expect(await page.evaluate(()=>data.items.length)).toBe(0);
  await page.locator('#b_due').fill('2026/08/15'); await page.locator('#b_due').press('Enter');
  await expect(page.getByText('新規入力',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>data.items.map(x=>({title:x.title,due:x.due})))).toEqual([{title:'新規入力',due:'2026-08-15'}]);
  await expect(page.locator('tr.draftRow')).toHaveCount(0);
});

test('INPUT-04: composition中のEnterでは期限移動・確定しない',async({page})=>{
  const title=page.locator('#b_title'); await title.fill('変換中'); await title.focus();
  await title.dispatchEvent('compositionstart');
  await title.dispatchEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,isComposing:true,bubbles:true,cancelable:true});
  await title.dispatchEvent('compositionend',{data:'変換中'});
  await expect(title).toBeFocused(); expect(await page.evaluate(()=>data.items.length)).toBe(0); expect(await page.locator('#b_due').evaluate(e=>document.activeElement===e)).toBeFalsy();
});

test('INPUT-05, INPUT-06: Enter同階層・Insert子ドラフトのparentIdと位置',async({page})=>{
  await setData(page,[task('A','A'),task('A1','A1',{parentId:'A'}),task('B','B',{sortOrder:2000})]);
  await page.locator('#row_A').click(); await page.keyboard.press('Enter');
  let draft=await page.evaluate(()=>({id:draftTaskId,parentId:itemById(draftTaskId).parentId,rows:[...document.querySelectorAll('#body tr:not(.blank)')].map(x=>x.id)}));
  expect(draft.parentId).toBe(''); expect(draft.rows).toEqual(['row_A','row_A1',`row_${draft.id}`,'row_B']);
  await page.locator(`.titleText[data-id="${draft.id}"]`).press('Escape');
  await page.locator('#row_A').click(); await page.keyboard.press('Insert');
  draft=await page.evaluate(()=>({id:draftTaskId,parentId:itemById(draftTaskId).parentId,rows:[...document.querySelectorAll('#body tr:not(.blank)')].map(x=>x.id)}));
  expect(draft.parentId).toBe('A'); expect(draft.rows).toEqual(['row_A','row_A1',`row_${draft.id}`,'row_B']);
});

test('INPUT-08, INPUT-09, INPUT-10: ドラフト位置固定・フォーカス・Esc分岐',async({page})=>{
  await setData(page,[task('A','A'),task('B','B',{sortOrder:2000})]); await page.locator('#row_A').click(); await page.keyboard.press('Enter');
  let draftId=await page.evaluate(()=>draftTaskId),row=page.locator(`#row_${draftId}`),before=await row.evaluate(e=>e.rowIndex);
  await row.locator('.titleText').fill('位置固定ドラフト'); await row.locator('.titleText').press('Enter');
  await expect.poll(()=>page.evaluate(()=>draftStage)).toBe('due'); expect(await page.locator(`#row_${draftId}`).evaluate(e=>e.rowIndex)).toBe(before);
  expect(await page.evaluate(id=>{const i=data.items.findIndex(x=>x.id===id);return document.activeElement===document.getElementById('d'+i)},draftId)).toBeTruthy();
  await page.keyboard.press('Escape'); expect(await page.evaluate(id=>({exists:!!itemById(id),draftTaskId,due:itemById(id)?.due}),draftId)).toEqual({exists:true,draftTaskId:'',due:''});
  await page.locator('#row_A').click(); await page.keyboard.press('Insert'); draftId=await page.evaluate(()=>draftTaskId); await page.locator(`#row_${draftId} .titleText`).press('Escape');
  expect(await page.evaluate(id=>({exists:!!itemById(id),draftTaskId}),draftId)).toEqual({exists:false,draftTaskId:''});
});

test('INPUT-12, INPUT-13: 半角・全角d/Dと数字を日付へ変換',async({page})=>{
  for(const [keys,days] of [['d0',0],['d1',1],['d9',9],['ｄ１',1],['Ｄ１',1]]){
    const due=page.locator('#b_due'); await due.fill(''); await due.pressSequentially(keys); await expect(due).toHaveValue(addDaysText(days));
  }
});

test('INPUT-16: 通常のタイトル・概要編集でdショートカットを誤発動しない',async({page})=>{
  await setData(page,[task('edit','編集対象',{summary:'初期概要'})]);
  const title=page.locator('#row_edit .titleText'),summary=page.locator('#row_edit .sum');
  await title.fill('半角dと全角ｄを含むタイトル'); await expect(title).toHaveText('半角dと全角ｄを含むタイトル');
  await summary.fill('概要 d Ｄ ｄ の通常入力'); await expect(summary).toHaveText('概要 d Ｄ ｄ の通常入力');
  expect(await page.evaluate(()=>({armed:dateShortcutArmed,hint:shortcutHint.classList.contains('show')}))).toEqual({armed:false,hint:false});
});

test('INPUT-19: 新規IDはt-形式で既存IDと重複しない',async({page})=>{
  await setData(page,[task('t-existing-fixed','既存')]); const id1=await blankCreate(page,'新規1'),id2=await blankCreate(page,'新規2');
  expect(id1).toMatch(/^t-.+/); expect(id2).toMatch(/^t-.+/); expect(id1).not.toBe(id2); expect(new Set(['t-existing-fixed',id1,id2]).size).toBe(3);
  expect(await page.evaluate(()=>data.items.map(x=>x.id))).toEqual(['t-existing-fixed',id1,id2]);
});

test('SEARCH-08: 非表示結果はCancelで条件維持、OKだけ全表示へ変更して選択',async({page})=>{
  await setData(page,[task('open','表示中'),task('hidden','非表示の完了タスク',{completed:true})]);
  await page.getByRole('button',{name:'🔎 タスク検索'}).click(); await page.locator('#taskSearchInput').fill('非表示の完了タスク');
  let message=await dialogFrom(page,()=>page.locator('.taskSearchResult').click(),false); expect(message).toContain('現在の表示条件では非表示');
  expect(await page.evaluate(()=>({view,selectedTaskId,filterSize:filterStates.size}))).toEqual({view:'open',selectedTaskId:'',filterSize:0}); await expect(page.locator('#row_hidden')).toHaveCount(0);
  message=await dialogFrom(page,()=>page.locator('.taskSearchResult').click(),true); expect(message).toContain('「すべて」');
  await expect.poll(()=>page.evaluate(()=>({view,selectedTaskId,filterSize:filterStates.size}))).toEqual({view:'all',selectedTaskId:'hidden',filterSize:0});
  await expect(page.locator('#row_hidden')).toHaveClass(/selectedRow/); await expect(page.locator('#taskSearchPopup')).toBeVisible();
});

test('REG-04: 繰返しなし完了では次回タスクを生成しない',async({page})=>{
  await setData(page,[task('once','単発',{due:'2026-08-15'})]); await page.locator('#vAll').click(); await page.locator('#row_once .doneBtn').click();
  expect(await page.evaluate(()=>data.items.map(x=>({id:x.id,completed:x.completed})))).toEqual([{id:'once',completed:true}]);
});

test('REG-05: 繰返しあり完了で次回期限の未完了タスクを1件生成',async({page})=>{
  await setData(page,[task('weekly','週次',{due:'2026-08-15',repeat:'毎週'})]); await page.locator('#vAll').click(); await page.locator('#row_weekly .doneBtn').click();
  const result=await page.evaluate(()=>data.items.map(x=>({id:x.id,title:x.title,due:x.due,repeat:x.repeat,completed:x.completed})));
  expect(result).toHaveLength(2); expect(result.find(x=>x.id==='weekly')).toMatchObject({due:'2026-08-15',completed:true});
  const next=result.find(x=>x.id!=='weekly'); expect(next).toMatchObject({title:'週次',due:'2026-08-22',repeat:'毎週',completed:false}); expect(next.id).toMatch(/^t-.+/);
});

test('REG-06: 期限なし繰返し完了では生成せず通知',async({page})=>{
  await setData(page,[task('repeat-no-due','期限なし繰返し',{repeat:'毎月'})]); await page.locator('#vAll').click(); await page.locator('#row_repeat-no-due .doneBtn').click();
  expect(await page.evaluate(()=>data.items.map(x=>({id:x.id,completed:x.completed,due:x.due})))).toEqual([{id:'repeat-no-due',completed:true,due:''}]);
  await expect(page.locator('#toast')).toContainText('期限がないため次回タスクは作成していません');
});
