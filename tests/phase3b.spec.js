const {test,expect}=require('playwright/test');
const {installFsAccessMock}=require('./helpers/fs-access-mock');

const {APP:app}=require('./helpers/app-target');
const task=(id,title=id,extra={})=>({id,parentId:'',state:'',title,completed:false,due:'',sortOrder:1000,dependencies:[],...extra});
const json=items=>JSON.stringify({schema_version:app.includes('v250')?'2.5':'1.5',...(app.includes('v250')?{workspace_info_markdown:''}:{}),items});

async function boot(page){
  await installFsAccessMock(page);await page.goto(app);
  await page.evaluate(async()=>{localStorage.clear();if(indexedDB.databases)for(const db of await indexedDB.databases())indexedDB.deleteDatabase(db.name);});await page.reload();
  await page.evaluate(()=>applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items:[]},'Playwright','phase3b.json',null,{remember:false,writePermissionGranted:false}));
}
async function setData(page,items){await page.evaluate(async items=>applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items},'Playwright','phase3b.json',null,{remember:false,writePermissionGranted:false}),items);}
async function makeFile(page,id,name,text){await page.evaluate(({id,name,text})=>__fsMock.create(id,{name,text}),{id,name,text});}
async function queueOpen(page,id){await page.evaluate(id=>__fsMock.queueOpen(id),id);}
async function openDb(page,id){await queueOpen(page,id);await page.locator('#dbReadBtn').click();await expect(page.locator('#dbLoadingBack')).toBeHidden();}
async function snapshot(page,id){return page.evaluate(id=>__fsMock.snapshot(id).text,id);}
async function dialogFrom(page,action,accept=true){const pending=page.waitForEvent('dialog'),result=action(),d=await pending,msg=d.message();accept?await d.accept():await d.dismiss();await result;return msg;}
async function startDraft(page,key='Enter'){await page.evaluate(()=>selectTask('A'));await page.keyboard.press(key);return page.evaluate(()=>draftTaskId);}

test.beforeEach(async({page})=>boot(page));

test('DB-13, DB-14: コピー履歴表示と履歴だけの削除',async({page})=>{
  await makeFile(page,'source','current.json',json([task('t1','コピー対象')]));await makeFile(page,'copy','saved-copy.json','');await openDb(page,'source');
  await page.evaluate(()=>__fsMock.queueSave('copy'));await page.getByRole('button',{name:'現在DBのコピーを保存'}).click();
  await expect(page.locator('.latestCopyBtn')).toHaveText('saved-copy.json');expect(await page.evaluate(()=>lastCopy.handle.__mockId)).toBe('copy');
  const before=await snapshot(page,'copy');await page.locator('.latestCopyBtn').locator('xpath=..').locator('.historyRemove').click();
  await expect(page.locator('.latestCopyBtn')).toHaveCount(0);expect(await page.evaluate(()=>lastCopy)).toBeNull();expect(await snapshot(page,'copy')).toBe(before);
  await expect(page.locator('#toast')).toContainText('JSONファイルは削除していません');
});

test('DB-15: 最近使用DBの履歴だけを削除',async({page})=>{
  await makeFile(page,'one','one.json',json([task('one-task')]));await makeFile(page,'two','two.json',json([task('two-task')]));await openDb(page,'one');await openDb(page,'two');
  // The JS mock handle is not structured-cloneable like a native
  // FileSystemFileHandle. Register a handle-less recent entry, which is also a
  // supported production history state (the file must be reselected to open).
  await page.evaluate(()=>touchRecentDb('one.json',null));
  const oneBefore=await snapshot(page,'one'),twoBefore=await snapshot(page,'two');const recent=page.locator('.recentDbBtn',{hasText:'one.json'});await expect(recent).toBeVisible();
  await recent.locator('xpath=..').locator('.historyRemove').click();await expect(page.locator('.recentDbBtn',{hasText:'one.json'})).toHaveCount(0);
  expect(await snapshot(page,'one')).toBe(oneBefore);expect(await snapshot(page,'two')).toBe(twoBefore);await expect(page.locator('.dbName')).toHaveText('two.json');
});

test('DB-17, DB-18: 保存場所確認のキャンセル・別JSON選択でDB不変',async({page})=>{
  await makeFile(page,'current','current.json',json([task('current-task')]));await makeFile(page,'other','other.json',json([task('other-task')]));await openDb(page,'current');
  const original=await page.evaluate(()=>({name:currentDbName,id:currentDbHandle.__mockId,items:data.items.map(x=>x.id)}));
  let msg=await dialogFrom(page,()=>page.getByRole('button',{name:'保存場所を確認'}).click());expect(msg).toContain('ファイルを選択する必要はありません');expect(msg).toContain('DBが切り替わることはありません');
  expect(await page.evaluate(()=>({name:currentDbName,id:currentDbHandle.__mockId,items:data.items.map(x=>x.id)}))).toEqual(original);
  await queueOpen(page,'other');msg=await dialogFrom(page,()=>page.getByRole('button',{name:'保存場所を確認'}).click());expect(msg).toContain('DBが切り替わることはありません');
  expect(await page.evaluate(()=>({name:currentDbName,id:currentDbHandle.__mockId,items:data.items.map(x=>x.id)}))).toEqual(original);await expect(page.locator('.dbName')).toHaveText('current.json');
});

test('INPUT-03: 最上段タイトルから空期限Enterで確定',async({page})=>{
  await page.locator('#b_title').fill('期限なし新規');await page.locator('#b_title').press('Enter');await page.locator('#b_due').press('Enter');
  expect(await page.evaluate(()=>data.items.map(x=>({title:x.title,due:x.due})))).toEqual([{title:'期限なし新規',due:''}]);
});

test('INPUT-07: ＋子はInsertと同じ子ドラフトを生成',async({page})=>{
  await setData(page,[task('A','親A'),task('B','B',{sortOrder:2000})]);await page.locator('#row_A .childBtn').click();
  const result=await page.evaluate(()=>({draftTaskId,parentId:itemById(draftTaskId).parentId,kind:draftKind,rows:[...document.querySelectorAll('#body tr:not(.blank)')].map(x=>x.id)}));
  expect(result.parentId).toBe('A');expect(result.kind).toBe('child');expect(result.rows).toEqual(['row_A',`row_${result.draftTaskId}`,'row_B']);
});

test('INPUT-11: ドラフト空期限Enterで期限なし確定',async({page})=>{
  await setData(page,[task('A')]);const id=await startDraft(page);const title=page.locator(`#row_${id} .titleText`);await title.fill('空期限ドラフト');await title.press('Enter');
  const index=await page.evaluate(id=>data.findIndex?data.findIndex(x=>x.id===id):data.items.findIndex(x=>x.id===id),id).catch(()=>page.evaluate(id=>data.items.findIndex(x=>x.id===id),id));
  await page.locator(`#d${index}`).press('Enter');expect(await page.evaluate(id=>({draftTaskId,exists:!!itemById(id),due:itemById(id).due,title:itemById(id).title}),id)).toEqual({draftTaskId:'',exists:true,due:'',title:'空期限ドラフト'});
});

test('INPUT-14, INPUT-15: D待機の時間切れとEsc解除',async({page})=>{
  await setData(page,[task('A')]);await page.evaluate(()=>selectTask('A'));await page.keyboard.press('d');expect(await page.evaluate(()=>dateShortcutArmed)).toBeTruthy();await expect(page.locator('#shortcutHint')).toHaveClass(/show/);
  await page.waitForTimeout(2100);expect(await page.evaluate(()=>dateShortcutArmed)).toBeFalsy();await expect(page.locator('#shortcutHint')).not.toHaveClass(/show/);
  await page.keyboard.press('D');expect(await page.evaluate(()=>dateShortcutArmed)).toBeTruthy();await page.keyboard.press('Escape');expect(await page.evaluate(()=>dateShortcutArmed)).toBeFalsy();await expect(page.locator('#shortcutHint')).not.toHaveClass(/show/);
});

test('INPUT-17, INPUT-18: 1行Enter確定と概要Shift+Enter改行',async({page})=>{
  await setData(page,[task('edit','旧タイトル',{summary:'旧概要'})]);const title=page.locator('#row_edit .titleText');await title.fill('新タイトル');await title.press('Enter');
  await expect.poll(()=>page.evaluate(()=>itemById('edit').title)).toBe('新タイトル');
  let summary=page.locator('#row_edit .sum');await summary.fill('1行目');await summary.press('Shift+Enter');await summary.pressSequentially('2行目');expect((await summary.innerText()).replace(/\r/g,'')).toContain('1行目\n2行目');
  await summary.press('Enter');await expect.poll(()=>page.evaluate(()=>itemById('edit').summary.replace(/\r/g,''))).toContain('1行目\n2行目');
});

test('SEARCH-01～SEARCH-04: タイトル・階層・担当検索と結果メタ情報',async({page})=>{
  await setData(page,[task('parent','親プロジェクト',{owner:'親担当'}),task('child','固有の子タスク',{parentId:'parent',owner:'山田太郎',due:'2026-08-15',state:'進行中'}),task('other','別件')]);
  await page.getByRole('button',{name:'🔎 タスク検索'}).click();const input=page.locator('#taskSearchInput');
  await input.fill('固有の子');await expect(page.locator('.taskSearchResult')).toHaveCount(1);await expect(page.locator('.taskSearchPath')).toHaveText('親プロジェクト > 固有の子タスク');
  await input.fill('親プロジェクト');await expect(page.locator('.taskSearchPath',{hasText:'親プロジェクト > 固有の子タスク'})).toBeVisible();
  await input.fill('山田太郎');await expect(page.locator('.taskSearchResult')).toHaveCount(1);await expect(page.locator('.taskSearchMeta')).toContainText('担当: 山田太郎');await expect(page.locator('.taskSearchMeta')).toContainText('期限:');await expect(page.locator('.taskSearchMeta')).toContainText('状態: 進行中');
});

test('SEARCH-05, SEARCH-06: 検索結果から連続ジャンプして選択',async({page})=>{
  await setData(page,[task('first','検索一件目'),task('second','検索二件目',{sortOrder:2000})]);await page.getByRole('button',{name:'🔎 タスク検索'}).click();const input=page.locator('#taskSearchInput');
  await input.fill('検索一件目');await page.locator('.taskSearchResult').click();await expect(page.locator('#row_first')).toHaveClass(/selectedRow/);await expect(page.locator('#taskSearchPopup')).toBeVisible();
  await input.fill('検索二件目');await page.locator('.taskSearchResult').click();await expect(page.locator('#row_second')).toHaveClass(/selectedRow/);expect(await page.evaluate(()=>selectedTaskId)).toBe('second');await expect(page.locator('#taskSearchPopup')).toBeVisible();
});

test('SEARCH-07: 外側クリックとEscで検索を閉じる',async({page})=>{
  await setData(page,[task('one','検索対象')]);await page.getByRole('button',{name:'🔎 タスク検索'}).click();await expect(page.locator('#taskSearchPopup')).toBeVisible();await page.locator('h1').click();await expect(page.locator('#taskSearchPopup')).toBeHidden();
  await page.getByRole('button',{name:'🔎 タスク検索'}).click();await expect(page.locator('#taskSearchPopup')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#taskSearchPopup')).toBeHidden();
});

test('REG-01～REG-03: ToDo関係アイコン・切替案内・Project同一タスク編集',async({page})=>{
  await setData(page,[task('A','前工程'),task('B','後工程',{dependencies:[{task_id:'A',type:'finish_to_start'}],sortOrder:2000})]);await page.locator('#mPersonal').click();
  const icon=page.locator('#row_B .relationTrigger');await expect(icon).toBeVisible();await icon.click();await expect(page.locator('.todoProjectGuide')).toContainText('依存関係の設定・変更はProjectで行います');expect(await page.evaluate(()=>mode)).toBe('personal');
  await page.getByRole('button',{name:'Projectに切り替えて設定'}).click();await expect.poll(()=>page.evaluate(()=>mode)).toBe('team');await expect(page.locator('#relationPopup')).toBeVisible();await expect(page.locator('.relationTask')).toHaveText('後工程');
  await expect(page.getByRole('button',{name:'＋ 前工程を追加'})).toBeVisible();await expect(page.getByRole('button',{name:'＋ 後工程を追加'})).toBeVisible();
});

test('REG-07: 列幅変更を再起動後も保持',async({page})=>{
  const handle=page.locator('th[data-c="title"] .rs'),box=await handle.boundingBox();const before=await page.evaluate(()=>widths.title);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2);await page.mouse.up();
  const resized=await page.evaluate(()=>({width:widths.title,stored:JSON.parse(localStorage.getItem(COLKEY)).title}));expect(resized.width).toBeGreaterThanOrEqual(before+75);expect(resized.stored).toBe(resized.width);
  await page.reload();expect(await page.evaluate(()=>widths.title)).toBe(resized.width);expect(await page.locator('col[data-c="title"]').evaluate(e=>parseInt(e.style.width,10))).toBe(resized.width);
});
