const { test, expect } = require('playwright/test');
const { installFsAccessMock } = require('./helpers/fs-access-mock');

const {APP:app}=require('./helpers/app-target');
const currentFixtureSchema=app.includes('pbl022')?'3.0':(app.includes('v250')||app.includes('v260')||app.includes('v270'))?'2.5':'2.0';
const json = (items, schema=currentFixtureSchema) => JSON.stringify({ schema_version:schema, ...((schema==='2.5'||schema==='3.0')?{workspace_info_markdown:''}:{}), items });
const task = (id, title=id, extra={}) => ({ id, parentId:'', state:'', title, completed:false, due:'', sortOrder:1000, dependencies:[], ...extra });

async function boot(page) {
  await installFsAccessMock(page);
  await page.goto(app);
  await page.evaluate(async () => { localStorage.clear(); if(indexedDB.databases) for(const db of await indexedDB.databases()) indexedDB.deleteDatabase(db.name); });
  await page.reload();
}
async function makeFile(page, id, name, text, options={}) { await page.evaluate(({id,name,text,options}) => __fsMock.create(id,{name,text,...options}), {id,name,text,options}); }
async function queueOpen(page,id) { await page.evaluate(id => __fsMock.queueOpen(id), id); }
async function dbReadButton(page) { return (await page.locator('#dbStartScreen').isVisible()) ? page.locator('#startDbReadBtn') : page.locator('#dbReadBtn'); }
async function openDb(page,id) {
  await queueOpen(page,id); await (await dbReadButton(page)).click();
  await expect(page.locator('#dbLoadingBack')).toBeHidden();
}
async function fileJson(page,id) { return page.evaluate(id => JSON.parse(__fsMock.snapshot(id).text), id); }
async function calls(page) { return page.evaluate(() => __fsMock.calls()); }
async function selectTask(page,id) { await page.evaluate(taskId => window.selectTask(taskId), id); }
async function moveButton(page) { await page.getByRole('button',{name:'↗ 選択タスクを別DBへ移動'}).click(); }
async function sourceItems() {
  return [task('A','A'), task('A1','A1',{parentId:'A'}), task('A11','A11',{parentId:'A1'}), task('A2','A2',{parentId:'A'}), task('B','B')];
}
async function prepareMove(page, items, targetItems=[]) {
  if (!items) items=await sourceItems();
  await makeFile(page,'source','source.json',json(items)); await makeFile(page,'target','target.json',json(targetItems)); await openDb(page,'source');
}

test.beforeEach(async ({page}) => boot(page));

test('DB-01, DB-03, DB-05: picker経由の正常DB読込と最低表示時間', async ({page}) => {
  await makeFile(page,'db','phase2-normal.json',json([task('loaded','読込済み')])); await queueOpen(page,'db');
  const started=Date.now(); const click=(await dbReadButton(page)).click();
  await expect(page.locator('#dbLoadingBack')).toBeVisible(); await expect(page.locator('#dbLoadingFile')).toHaveText('phase2-normal.json');
  await click; await expect(page.locator('#dbLoadingBack')).toBeHidden(); expect(Date.now()-started).toBeGreaterThanOrEqual(450);
await expect(page.locator('.dbName')).toHaveText('phase2-normal.json'); await expect(page.locator('#toast')).toContainText('DB読込成功');
  expect(await page.evaluate(() => data.items.map(x=>x.id))).toEqual(['loaded']);
});

test('DB-06: 壊れたJSONは1回で拒否しpickerを再度開かない', async ({page}) => {
  await makeFile(page,'broken','broken.json','{"items":'); await queueOpen(page,'broken');
  const dialog=page.waitForEvent('dialog'); const click=(await dbReadButton(page)).click(); const d=await dialog;
  expect(d.message()).toContain('JSON読込に失敗'); await d.accept(); await click;
  expect((await calls(page)).filter(x=>x.op==='showOpenFilePicker')).toHaveLength(1); await expect(page.locator('.dbName')).toHaveText('未読込');
});

test('DB-10, DB-11: 現行Schemaを編集して実ハンドルへ保存しIDを保持', async ({page}) => {
  await makeFile(page,'old','old.json',json([task('legacy-fixed-id','旧タイトル')])); await openDb(page,'old');
  await page.locator('#row_legacy-fixed-id .titleText').fill('編集後タイトル'); await page.locator('h1').click();
  expect(await page.evaluate(() => requestDbSave({allowDownload:false,source:'test'}))).toBeTruthy();
const saved=await fileJson(page,'old'); expect(saved.schema_version).toBe(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)); expect(saved.items[0]).toMatchObject({id:'legacy-fixed-id',title:'編集後タイトル'});
});

test('SAVE-01, SAVE-02: 2秒後の自動保存と再読込後の永続化', async ({page}) => {
  await makeFile(page,'db','autosave.json',json([task('t1','保存前')])); await openDb(page,'db');
  await page.locator('#row_t1 .titleText').fill('自動保存後'); await page.locator('h1').click();
  await expect.poll(() => fileJson(page,'db').then(x=>x.items[0].title), {timeout:5000}).toBe('自動保存後');
  await queueOpen(page,'db'); await page.getByRole('button',{name:'別DB読込'}).click(); await expect(page.locator('#row_t1 .titleText')).toHaveText('自動保存後');
});

test('SAVE-05: 未保存変更と外部更新の競合で自動保存を停止', async ({page}) => {
  await makeFile(page,'db','conflict.json',json([task('t1','元データ')])); await openDb(page,'db');
  await page.evaluate(() => { chg(0,'title','自分の未保存変更'); __fsMock.mutate('db', JSON.stringify({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items:[{id:'external',title:'外部更新',impact_level:0}]})); });
  expect(await page.evaluate(() => checkExternalUpdate())).toBeTruthy();
  expect(await page.evaluate(() => ({conflictDetected,dirty,saveState}))).toEqual({conflictDetected:true,dirty:true,saveState:'conflict'});
  await expect(page.locator('.externalAlert')).toContainText('自動保存は停止');
  await page.waitForTimeout(2200); const disk=await fileJson(page,'db'); expect(disk.items[0].id).toBe('external');
});

test('SAVE-06: 外部更新だけの状態から最新DBを安全に再読込', async ({page}) => {
  await makeFile(page,'db','external-only.json',json([task('before','更新前')])); await openDb(page,'db');
  await page.evaluate(() => __fsMock.mutate('db', JSON.stringify({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items:[{id:'after',parentId:'',state:'',title:'外部更新後',impact_level:0,completed:false,due:'',sortOrder:1000,dependencies:[]}]})));
  expect(await page.evaluate(() => checkExternalUpdate())).toBeTruthy();
  expect(await page.evaluate(() => ({conflictDetected,dirty,saveState}))).toEqual({conflictDetected:true,dirty:false,saveState:'external'});
  await page.getByRole('button',{name:'最新DBを再読込'}).click();
  await expect.poll(() => page.evaluate(() => data.items.map(x=>x.id))).toEqual(['after']);
  await expect(page.locator('#row_after .titleText')).toHaveText('外部更新後');
  expect(await page.evaluate(() => ({conflictDetected,dirty,currentDbName}))).toEqual({conflictDetected:false,dirty:false,currentDbName:'external-only.json'});
});

test('DB-12: コピー保存は別ハンドルへ書き、現在DBを切り替えない', async ({page}) => {
  await makeFile(page,'source','current.json',json([task('t1','コピー対象')])); await makeFile(page,'copy','copy.json',''); await openDb(page,'source');
  await page.evaluate(() => __fsMock.queueSave('copy')); await page.getByRole('button',{name:'現在DBのコピーを保存'}).click();
  expect((await fileJson(page,'copy')).items[0].id).toBe('t1'); expect(await page.evaluate(() => currentDbHandle.__mockId)).toBe('source');
  await expect(page.locator('.dbName')).toHaveText('current.json');
});

for (const selected of ['A','A1','A11']) {
  const id={A:'MOVE-01',A1:'MOVE-02',A11:'MOVE-03'}[selected];
  test(`${id}: ${selected}選択時にA階層一式を移動`, async ({page}) => {
    await prepareMove(page); await selectTask(page,selected); await queueOpen(page,'target');
    page.once('dialog',d=>d.accept()); await moveButton(page);
    await expect.poll(() => fileJson(page,'target').then(x=>x.items.length)).toBe(4);
    expect((await fileJson(page,'target')).items.map(x=>x.id).sort()).toEqual(['A','A1','A11','A2']);
    expect((await fileJson(page,'source')).items.map(x=>x.id)).toEqual(['B']); expect(await page.evaluate(() => currentDbHandle.__mockId)).toBe('source');
  });
}

test('MOVE-04: 移動後もトップレベル化と全parentId関係を維持', async ({page}) => {
  await prepareMove(page); await selectTask(page,'A11'); await queueOpen(page,'target'); page.once('dialog',d=>d.accept()); await moveButton(page);
  const moved=(await fileJson(page,'target')).items; const parents=Object.fromEntries(moved.map(x=>[x.id,x.parentId]));
  expect(parents).toEqual({A:'',A1:'A',A11:'A1',A2:'A'});
  expect(moved.map(x=>x.id).sort()).toEqual(['A','A1','A11','A2']);
});

test('MOVE-05: 移動対象部分木内部の依存関係を維持', async ({page}) => {
  const items=await sourceItems(); items.find(x=>x.id==='A2').dependencies=[{task_id:'A1',type:'finish_to_start'}];
  items.find(x=>x.id==='A11').dependencies=[{task_id:'A',type:'finish_to_finish'}];
  await prepareMove(page,items); await selectTask(page,'A'); await queueOpen(page,'target'); page.once('dialog',d=>d.accept()); await moveButton(page);
  const moved=(await fileJson(page,'target')).items; expect(moved.find(x=>x.id==='A2').dependencies).toEqual([{task_id:'A1',type:'finish_to_start'}]);
  expect(moved.find(x=>x.id==='A11').dependencies).toEqual([{task_id:'A',type:'finish_to_finish'}]);
});

test('MOVE-06, MOVE-08: 境界依存警告を表示しキャンセル時は双方不変', async ({page}) => {
  const items=await sourceItems(); items.find(x=>x.id==='B').dependencies=[{task_id:'A',type:'finish_to_start'}]; await prepareMove(page,items);
  const sourceBefore=await fileJson(page,'source'), targetBefore=await fileJson(page,'target'); await selectTask(page,'A'); await queueOpen(page,'target');
  page.once('dialog',d=>d.accept()); const moving=moveButton(page); await expect(page.locator('.ask.danger')).toBeVisible();
  await expect(page.locator('.ask.danger')).toContainText('依存関係が削除されます'); await expect(page.locator('.ask.danger')).toContainText('A → B（完了後に着手）');
  await page.locator('#dcancel').click(); await moving; expect(await fileJson(page,'source')).toEqual(sourceBefore); expect(await fileJson(page,'target')).toEqual(targetBefore);
});

test('MOVE-09: 境界依存を双方から削除して移動', async ({page}) => {
  const items=await sourceItems(); items.find(x=>x.id==='B').dependencies=[{task_id:'A',type:'finish_to_start'}]; await prepareMove(page,items);
  await selectTask(page,'A'); await queueOpen(page,'target'); page.once('dialog',d=>d.accept()); const moving=moveButton(page);
  await page.locator('#dok').click(); await moving; expect((await fileJson(page,'source')).items[0].dependencies).toEqual([]);
  expect((await fileJson(page,'target')).items.flatMap(x=>x.dependencies||[])).toEqual([]);
});

test('MOVE-10, MOVE-11, MOVE-14: 同一DB・重複ID・新Schemaを無変更で拒否', async ({page}) => {
  await prepareMove(page); await selectTask(page,'A');
  await queueOpen(page,'source'); let dialog=page.waitForEvent('dialog'); let moving=moveButton(page); let d=await dialog; expect(d.message()).toContain('現在DB自身'); await d.accept(); await moving;
  await makeFile(page,'duplicate','duplicate.json',json([task('A','既存A')])); await queueOpen(page,'duplicate'); dialog=page.waitForEvent('dialog'); moving=moveButton(page); d=await dialog; expect(d.message()).toContain('同じID'); await d.accept(); await moving;
await makeFile(page,'future','future.json',json([], '9.0')); await queueOpen(page,'future'); dialog=page.waitForEvent('dialog'); moving=moveButton(page); d=await dialog; expect(d.message()).toContain('このバージョンでは扱えません'); await d.accept(); await moving;
  expect((await fileJson(page,'source')).items).toHaveLength(5); expect((await calls(page)).filter(x=>x.op==='requestPermission'&&x.id==='future')).toHaveLength(0);
});

test('MOVE-15: 現行Schema移動先へ安全に移動し既存データを維持', async ({page}) => {
  const existing=[task('legacy-existing','既存データ',{owner:'既存担当',summary:'既存概要'})];
  await makeFile(page,'source','source.json',json(await sourceItems())); await makeFile(page,'legacy-target','legacy-target.json',json(existing)); await openDb(page,'source');
  await selectTask(page,'A'); await queueOpen(page,'legacy-target'); page.once('dialog',d=>d.accept()); await moveButton(page);
  const saved=await fileJson(page,'legacy-target'); expect(saved.schema_version).toBe(await page.evaluate(()=>CURRENT_SCHEMA_VERSION));
  expect(saved.items.find(x=>x.id==='legacy-existing')).toMatchObject({id:'legacy-existing',title:'既存データ',owner:'既存担当',summary:'既存概要'});
  expect(saved.items.map(x=>x.id).sort()).toEqual(['A','A1','A11','A2','legacy-existing']);
});

test('MOVE-16: 移動先選択後の外部更新を検知して双方を変更せず中止', async ({page}) => {
  const targetBefore=json([task('target-before','移動先既存')]); const targetAfter=json([task('external-added','外部更新データ')]);
  await makeFile(page,'source','source.json',json(await sourceItems()));
  await makeFile(page,'target','target.json',targetBefore,{mutateAfterGetFileCall:1,mutateText:targetAfter}); await openDb(page,'source');
  const sourceBefore=await fileJson(page,'source'); await selectTask(page,'A'); await queueOpen(page,'target');
  const dialogs=[]; page.on('dialog',async d=>{dialogs.push(d.message()); await d.accept();}); await moveButton(page);
  await expect.poll(()=>dialogs.some(x=>x.includes('選択後に更新'))).toBeTruthy();
  expect(await fileJson(page,'source')).toEqual(sourceBefore); expect(await fileJson(page,'target')).toEqual(JSON.parse(targetAfter));
  expect((await calls(page)).filter(x=>['createWritable','write','close'].includes(x.op)&&x.id==='target')).toHaveLength(0);
});

test('MOVE-12, MOVE-13: ドラフト中・外部更新競合中はpicker前に拒否', async ({page}) => {
  await prepareMove(page); await page.evaluate(() => { selectedTaskId='A'; startDraftTask('child'); }); await moveButton(page); await expect(page.locator('#toast')).toContainText('新規タスクの入力を完了または取消');
  await page.evaluate(() => { cancelDraftTask(draftTaskId); selectedTaskId='A'; conflictDetected=true; saveState='conflict'; refreshDbStatus(); }); await moveButton(page); await expect(page.locator('#toast')).toContainText('外部更新を解消');
  expect((await calls(page)).filter(x=>x.op==='showOpenFilePicker')).toHaveLength(1);
});

test('移動元保存失敗: 移動先ロールバック成功／失敗を区別してデータ損失を通知', async ({page}) => {
  await prepareMove(page); await page.evaluate(() => __fsMock.configure('source',{failCreateWritable:true})); await selectTask(page,'A'); await queueOpen(page,'target');
  const dialogs=[]; page.on('dialog',async d=>{dialogs.push(d.message()); await d.accept();}); await moveButton(page);
  await expect.poll(()=>dialogs.length).toBeGreaterThanOrEqual(2); expect(dialogs.at(-1)).toContain('移動先への追加も取り消しました'); expect((await fileJson(page,'target')).items).toEqual([]);
  await page.evaluate(() => { __fsMock.configure('source',{failCreateWritable:false}); }); await openDb(page,'source');
  await page.evaluate(() => { __fsMock.configure('source',{failCreateWritable:true}); __fsMock.configure('target',{failCreateOnCall:4}); });
  await selectTask(page,'A'); await queueOpen(page,'target'); dialogs.length=0; await moveButton(page);
  await expect.poll(()=>dialogs.length).toBeGreaterThanOrEqual(2); expect(dialogs.at(-1)).toContain('ロールバックにも失敗'); expect((await fileJson(page,'target')).items.length).toBeGreaterThan(0);
});

test('モック障害注入: 権限拒否とcreate/write/close失敗を独立再現', async ({page}) => {
  await makeFile(page,'f','failures.json',json([]),{readPermission:'denied',writePermission:'prompt',requestWriteResult:'denied'});
  expect(await page.evaluate(async()=>({r:await __fsMock.handle('f').queryPermission({mode:'read'}),w:await __fsMock.handle('f').requestPermission({mode:'readwrite'})}))).toEqual({r:'denied',w:'denied'});
  await makeFile(page,'grant','grant.json',json([]),{readPermission:'granted',writePermission:'prompt',requestWriteResult:'granted'});
  expect(await page.evaluate(async()=>({r:await __fsMock.handle('grant').queryPermission({mode:'read'}),requested:await __fsMock.handle('grant').requestPermission({mode:'readwrite'}),after:await __fsMock.handle('grant').queryPermission({mode:'readwrite'})}))).toEqual({r:'granted',requested:'granted',after:'granted'});
  for (const key of ['failCreateWritable','failWrite','failClose']) {
    await page.evaluate(key => __fsMock.configure('f',{failCreateWritable:false,failWrite:false,failClose:false,[key]:true}), key);
    expect(await page.evaluate(async()=>{try{const w=await __fsMock.handle('f').createWritable();await w.write('x');await w.close();return''}catch(e){return e.message}})).toContain('mock');
  }
});
