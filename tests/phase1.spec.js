const { test, expect } = require('playwright/test');
const path = require('node:path');

const {APP:app}=require('./helpers/app-target');
const isV250=(app.includes('v250')||app.includes('v260')),isV240=app.includes('v240'),isTaskDetail=app.includes('task_detail_phase'),isV230=app.includes('v230')||isTaskDetail,isPbl002=app.includes('pbl002_'),isV220=app.includes('v220_dev')||isPbl002||isV230||isV240||isV250,expectedSchema=isV250?'2.5':isV220?'2.2':'2.0';
const expectedProduct=app.includes('v260')?'ASANYA v2.6.0':isV250?'ASANYA v2.5.0':isV240?'ASANYA v2.4.0':isV230?'ASANYA v2.3.0':isPbl002?'ASANYA v2.2.0':isV220?'ASANYA v2.2.0-dev':app.includes('v211_dev')?'ASANYA v2.1.1-dev':app.includes('v211')?'ASANYA v2.1.1':app.includes('v210')?'ASANYA v2.1.0':'ASANYA v2.0.0';
const fixture = name => path.join(__dirname, 'fixtures', name);

async function open(page) {
  await page.goto(app);
  await page.evaluate(async () => {
    localStorage.clear();
    if (indexedDB.databases) for (const db of await indexedDB.databases()) indexedDB.deleteDatabase(db.name);
  });
  await page.reload();
}

async function loadItems(page, items, schema = '1.5') {
  await page.evaluate(async ({ items, schema }) => {
    await applyJsonObject({ schema_version: schema, items }, 'Playwright', 'phase1.json', null, { remember: false, writePermissionGranted: false });
  }, { items, schema });
}

async function setData(page, items) {
  await loadItems(page, items.map((x, i) => ({ state: '', completed: false, parentId: '', due: '', sortOrder: (i + 1) * 1000, dependencies: [], ...x })));
}

async function titles(page) { return await page.evaluate(() => mode === 'team') ? page.locator('#ganttView .ganttRow[data-task-id] .titleText').allTextContents() : page.locator('#body tr:not(.blank) .titleText').allTextContents(); }
async function columns(page) { return page.locator('#head th').evaluateAll(nodes => nodes.map(node => node.dataset.c)); }
async function alertFrom(page, action) {
  const dialog = page.waitForEvent('dialog');
  const actionResult = action();
  const d = await dialog;
  const msg = d.message();
  await d.accept();
  await actionResult;
  return msg;
}

test.beforeEach(async ({ page }) => open(page));

test('UI-01～UI-04, UI-08, SAVE-07: 基準版スモーク', async ({ page }) => {
  await expect(page).toHaveTitle(expectedProduct);
  await expect(page.locator('h1')).toContainText(expectedProduct);
  expect(await page.evaluate(() => CURRENT_SCHEMA_VERSION)).toBe(expectedSchema);
  await expect(page.getByRole('button', { name: '新しいDBを始める', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '既存DB読込', exact: true })).toBeVisible();
  await expect(page.locator('#dbSaveBtn')).toBeHidden();
  await expect(page.locator('#listView')).toBeHidden();
  await expect(page.getByText('JSON貼付読込', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => ({loaded:dbDataLoaded,items:data.items,dirty,saveState}))).toEqual({loaded:false,items:[],dirty:false,saveState:'unloaded'});
  await page.evaluate(() => localStorage.setItem('items', JSON.stringify([{ id: 'poison', title: '復元禁止' }])));
  await page.reload();
  expect(await page.evaluate(() => data.items.some(x => x.id === 'poison'))).toBeFalsy();
});

test('DB-07～DB-09, DB-11: テストJSONの拒否・互換読込・ID保持', async ({ page }) => {
  await setData(page, [{ id: 'baseline', title: '現在DB' }]);
  for (const [name, expected] of [['phase1-invalid-no-items.json', 'baseline'], [isV250?'phase1-future-v250.json':isV220?'phase1-future-v220.json':'phase1-future.json', 'baseline']]) {
    const dialog = page.waitForEvent('dialog');
    await page.locator('#jsonFile').setInputFiles(fixture(name));
    await (await dialog).accept();
    expect(await page.evaluate(() => data.items.map(x => x.id))).toEqual([expected]);
  }
  await page.locator('#jsonFile').setInputFiles(fixture('phase1-old.json'));
  await expect.poll(() => page.evaluate(() => data.items[0]?.id)).toBe('legacy-fixed-id');
  expect(await page.evaluate(() => loadedSchemaVersion)).toBe('1.1');
  expect(await page.evaluate(() => persistableData())).toMatchObject({ schema_version: expectedSchema, items: [{ id: 'legacy-fixed-id' }] });
});

test('VIEW-01～VIEW-08: 表示、モード、フィルタ、並び', async ({ page }) => {
  test.setTimeout(60_000);
  await page.locator('#jsonFile').setInputFiles(fixture('phase1-current.json'));
  await expect.poll(() => page.evaluate(() => data.items.length)).toBe(5);
  await page.locator('#vOpen').click(); expect(await titles(page)).toEqual(expect.arrayContaining(['親タスク', '子タスク', '状態完了', 'ブランク状態']));
  await page.locator('#vDone').click(); expect(await titles(page)).toEqual(['フラグ完了']);
  await page.locator('#vAll').click(); expect(await titles(page)).toHaveLength(5);
  const todoColumns = await columns(page), todoTitles = await titles(page);
  await page.locator('#mTeam').click(); await expect(page.locator('th')).toContainText(['ステータス']);
  const projectColumns = await columns(page);
  expect(projectColumns).not.toEqual(todoColumns); const projectTitles=await titles(page);expect(projectTitles).toHaveLength(todoTitles.length);expect(projectTitles).toEqual(expect.arrayContaining(todoTitles));
  await page.getByRole('button', { name: /^未着手 / }).click(); await page.getByRole('button', { name: /^進行中 / }).click();
  expect(await titles(page)).toEqual(expect.arrayContaining(['親タスク', '子タスク', 'フラグ完了']));
  await page.getByRole('button', { name: /^未着手 / }).click(); await page.getByRole('button', { name: /^進行中 / }).click();
  await expect(page.getByRole('button', { name: /^全 / })).toHaveClass(/on/);
  await page.getByRole('button', { name: /^ブランク / }).click(); await page.getByRole('button', { name: /^未着手 / }).click();
  expect(await titles(page)).toEqual(expect.arrayContaining(['ブランク状態', '親タスク']));
  await page.getByRole('button', { name: /^全 / }).click(); expect(await page.evaluate(() => filterStates.size)).toBe(0);
  await page.getByRole('button', { name: /^未着手 / }).click(); await page.locator('#mPersonal').click();
  expect(await columns(page)).toEqual(todoColumns); expect(await titles(page)).toHaveLength(5);
  await page.locator('#mTeam').click(); expect(await page.evaluate(() => [...filterStates])).toEqual(['未着手']);
  await page.getByRole('button', { name: /^全 / }).click();
  await expect(page.locator('#sDate')).toBeDisabled();expect(await page.evaluate(() => sortMode)).toBe('tree');await page.locator('#sTree').click();expect(await titles(page)).toHaveLength(5);
});

test('VIEW-08: ツリー順と日付順の実際の並び', async ({ page }) => {
  await setData(page, [
    { id:'parent-late', title:'親・期限後', due:'2026-08-20', sortOrder:1000 },
    { id:'child-early', parentId:'parent-late', title:'子・期限前', due:'2026-08-01', sortOrder:1000 },
    { id:'root-middle', title:'独立・期限中', due:'2026-08-10', sortOrder:2000 }
  ]);
  await page.locator('#vAll').click();
  await page.locator('#sTree').click(); expect(await titles(page)).toEqual(['独立・期限中', '親・期限後', '子・期限前']);
  await page.locator('#sDate').click(); expect(await titles(page)).toEqual(['子・期限前', '独立・期限中', '親・期限後']);
});

test('VIEW-09, HIER-01～HIER-10: 文脈行と論理完了・階層表示', async ({ page }) => {
  const yesterday = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  await setData(page, [
    { id:'p', title:'親', state:'未着手' }, { id:'c', parentId:'p', title:'子', state:'進行中' }, { id:'g', parentId:'c', title:'孫', state:'完了', completed:false },
    { id:'flag', title:'Flag完了', state:'未着手', completed:true, due:yesterday }, { id:'logical', title:'State完了', state:'完了', completed:false, due:yesterday },
    { id:'late', title:'期限超過', state:'進行中', due:yesterday }
  ]);
  expect(await page.evaluate(() => [isLogicallyComplete(itemById('flag')), isLogicallyComplete(itemById('logical'))])).toEqual(isV250?[false,true]:[true,true]);
  await page.locator('#mTeam').click(); await page.getByRole('button', { name: /^進行中 / }).click();
  await expect(page.locator('#row_p')).toHaveClass(/contextRow/); await expect(page.locator('#row_g')).toHaveClass(/contextRow/);
  await page.getByRole('button', { name: /^全 / }).click();
  await expect(page.locator('#row_p .relationTrigger').first()).toHaveClass(/treePending/);
  await expect(page.locator('#row_p .sortBadge')).toHaveText('[1/2]');
  await expect(page.locator('#row_logical .late')).toHaveCount(0); expect(await page.locator('#row_late .late').count()).toBeGreaterThan(0);
  await page.evaluate(() => { itemById('p').completed = true; render(); }); await expect(page.locator('#row_p .relationTrigger').first()).toHaveClass(isV250?/treePending/:/treeWarn/);
  await page.evaluate(() => { itemById('c').state='完了'; render(); }); await expect(page.locator('#row_p .relationTrigger').first()).not.toHaveClass(/treePending/);
});

test('HIER-03, HIER-05, HIER-08: 完了状態の統一解除・未完了孫・直接子の完了数', async ({ page }) => {
  await setData(page, [
    { id:'dual-flag', title:'二重完了・フラグ解除', state:'完了', completed:true },
    { id:'dual-state', title:'二重完了・状態解除', state:'完了', completed:true },
    { id:'p-grand', title:'未完了孫を持つ親' },
    { id:'c-done', parentId:'p-grand', title:'完了している子', state:'完了', completed:false },
    { id:'g-open', parentId:'c-done', title:'未完了の孫' },
    { id:'p-count', title:'直接子の集計親' },
    { id:'c-state-done', parentId:'p-count', title:'状態だけ完了の直接子', state:'完了', completed:false }
  ]);
  await page.locator('#vAll').click(); await page.locator('#mTeam').click();
  await page.locator('#row_dual-flag .doneBtn').click();
  expect(await page.evaluate(() => ({ completed:itemById('dual-flag').completed, state:itemById('dual-flag').state, logical:isLogicallyComplete(itemById('dual-flag')) }))).toEqual(isV250?{ completed:false, state:'完了', logical:true }:{ completed:false, state:'', logical:false });
  await page.locator('#row_dual-state select').first().selectOption({ label:'未着手' });
  expect(await page.evaluate(() => ({ completed:itemById('dual-state').completed, state:itemById('dual-state').state, logical:isLogicallyComplete(itemById('dual-state')) }))).toEqual(isV250?{ completed:true, state:'未着手', logical:false }:{ completed:false, state:'未着手', logical:false });
  await expect(page.locator('#row_p-grand .relationTrigger').first()).toHaveClass(/treePending/);
  await expect(page.locator('#row_p-count .sortBadge')).toHaveText('[0/1]');
});

test('HIER-11～HIER-12: 親子完了制約', async ({ page }) => {
  await setData(page, [{id:'p',title:'親'}, {id:'c',parentId:'p',title:'子'}]);
  let msg = await alertFrom(page, () => page.locator('#row_p .doneBtn').click()); expect(msg).toContain(isV250?'未解決の子・孫タスク':'未完了の子・孫タスク');
  await page.evaluate(() => { itemById('p').completed=true; itemById('c').completed=true; setView('all'); });
  msg = await alertFrom(page, () => page.locator('#row_c .doneBtn').click()); expect(msg).toContain(isV250?'先に親・祖先を再オープン':'先に親・祖先を未完了へ戻してください');
});

test('DEP-01～DEP-09: FS/FFの開始・解決状態変更制約', async ({ page }) => {
  await setData(page, [{id:'a',title:'A'}, {id:'b',title:'B',dependencies:[{task_id:'a',type:'finish_to_start'}]}]);
  await page.locator('#vAll').click();
  await page.locator('#mTeam').click();
  let msg = await alertFrom(page, () => page.locator('#row_b select').first().selectOption({label:'進行中'})); expect(msg).toContain('前工程が未完了');
  msg = await alertFrom(page, () => page.locator('#row_b .doneBtn').click()); expect(msg).toContain('未完了の前工程');
  await page.locator('#row_a select').first().selectOption({label:'完了'}); await page.locator('#row_b select').first().selectOption({label:'進行中'}); await expect(page.locator('#row_b select').first()).toHaveValue('進行中');
  await page.evaluate(()=>{delete itemById('a').actual_end;delete itemById('a').actual_end_source;render()});await page.locator('#row_a select').first().selectOption({label:'未着手'});expect(await page.evaluate(()=>({a:itemById('a').state,b:itemById('b').state}))).toEqual({a:'未着手',b:'進行中'});
  const backToUnstarted=page.locator('#row_b select').first().selectOption({label:'未着手'}),actualStartDialog=await page.waitForEvent('dialog');expect(actualStartDialog.message()).toContain('実績開始日');await actualStartDialog.accept();await backToUnstarted;
  expect(await page.evaluate(() => itemById('a').state)).toBe('未着手');
  await page.evaluate(() => { itemById('b').dependencies=[{task_id:'a',type:'finish_to_finish'}]; render(); });
  await page.locator('#row_b select').first().selectOption({label:'進行中'}); await expect(page.locator('#row_b select').first()).toHaveValue('進行中');
  msg = await alertFrom(page, () => page.locator('#row_b select').first().selectOption({label:'完了'})); expect(msg).toContain('未完了の前工程');
  await page.locator('#row_a select').first().selectOption({label:'完了'}); await page.locator('#row_b select').first().selectOption({label:'完了'});
  await page.evaluate(()=>{delete itemById('a').actual_end;delete itemById('a').actual_end_source;render()});await page.locator('#row_a select').first().selectOption({label:'未着手'});expect(await page.evaluate(()=>({a:itemById('a').state,b:itemById('b').state}))).toEqual({a:'未着手',b:'完了'});
});

test('DEP-08: FFで後工程進行中なら前工程を未完了化できる', async ({ page }) => {
  await setData(page, [
    { id:'a', title:'A', completed:true },
    { id:'b', title:'B', state:'進行中', dependencies:[{task_id:'a',type:'finish_to_finish'}] }
  ]);
  await page.locator('#vAll').click(); await page.locator('#mTeam').click();
  await page.locator('#row_a .doneBtn').click();
  expect(await page.evaluate(() => ({ aCompleted:itemById('a').completed, bState:itemById('b').state }))).toEqual({ aCompleted:false, bState:'進行中' });
});

test('DEP-10～DEP-14機械判定部: 条件変更・自己依存・階層を含む循環・文言', async ({ page }) => {
  await setData(page, [{id:'a',title:'A'}, {id:'b',title:'B',state:'進行中',dependencies:[{task_id:'a',type:'finish_to_finish'}]}, {id:'c',title:'C',dependencies:[{task_id:'b',type:'finish_to_start'}]}]);
  let msg = await alertFrom(page, () => page.evaluate(() => { document.getElementById('relEditType')?.remove();relationOpenId='b'; relationEditPredId='a'; relationEditSuccId='b'; document.body.insertAdjacentHTML('beforeend','<select id="relEditType"><option value="finish_to_start" selected></option></select>'); commitDependencyTypeEdit('a','b'); }));
  expect(msg).toContain('前工程が未完了'); expect(msg).not.toContain('論理的');
  await page.evaluate(() => { document.getElementById('relEditType')?.remove(); itemById('b').dependencies[0].type='finish_to_start'; relationOpenId='b'; relationEditPredId='a'; relationEditSuccId='b'; document.body.insertAdjacentHTML('beforeend','<select id="relEditType"><option value="finish_to_finish" selected></option></select>'); commitDependencyTypeEdit('a','b'); });
  expect(await page.evaluate(() => itemById('b').dependencies[0].type)).toBe('finish_to_finish');
  await page.evaluate(() => {
    document.getElementById('relEditType')?.remove(); document.getElementById('relType')?.remove(); relationOpenId='a'; relationSelectedTaskId='a'; relationFormDirection='predecessor';
    document.body.insertAdjacentHTML('beforeend','<select id="relType"><option value="finish_to_start" selected></option></select>'); addDependencyFromForm();
  });
  await expect(page.locator('#toast')).toContainText('同じタスク自身'); expect(await page.evaluate(() => itemById('a').dependencies)).toEqual([]);
  await page.evaluate(() => { document.getElementById('relType')?.remove(); });
  await setData(page, [{id:'parent',title:'親'}, {id:'child',parentId:'parent',title:'子'}]);
  msg = await alertFrom(page, () => page.evaluate(() => {
    document.getElementById('relType')?.remove(); relationOpenId='child'; relationSelectedTaskId='parent'; relationFormDirection='predecessor';
    document.body.insertAdjacentHTML('beforeend','<select id="relType"><option value="finish_to_start" selected></option></select>'); addDependencyFromForm();
  }));
  expect(msg).toContain('循環依存'); expect(msg).toContain('親 → 子 → 親');
  expect(await page.evaluate(() => itemById('child').dependencies)).toEqual([]);
});
