const {test,expect}=require('playwright/test');
const {installFsAccessMock}=require('./helpers/fs-access-mock');
const {APP,TARGET_SCHEMA_VERSION}=require('./helpers/app-target');

const schema=TARGET_SCHEMA_VERSION||'3.2';
const task=(id,title=id,sortOrder=1000)=>({id,parentId:'',state:'未着手',title,owner:'',due:'',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder,impact_level:0});
const json=items=>JSON.stringify({schema_version:schema,workspace_info_markdown:'',items,snapshots:[]});

async function boot(page,items=[task('A','更新前')]){
  await installFsAccessMock(page);
  await page.goto(APP);
  await page.evaluate(async()=>{localStorage.clear();if(indexedDB.databases)for(const db of await indexedDB.databases())indexedDB.deleteDatabase(db.name)});
  await page.reload();
  await page.evaluate(({text})=>__fsMock.create('db',{name:'shared.json',text}),{text:json(items)});
  await page.evaluate(()=>__fsMock.queueOpen('db'));
  const open=await page.locator('#dbStartScreen').isVisible()?page.locator('#startDbReadBtn'):page.locator('#dbReadBtn');
  await open.click();
  await expect(page.locator('#dbLoadingBack')).toBeHidden();
}

async function externalUpdate(page,items=[task('B','外部更新後')]){
  await page.evaluate(text=>__fsMock.mutate('db',text),json(items));
  expect(await page.evaluate(()=>checkExternalUpdate())).toBe(true);
}

test.beforeEach(async({page})=>boot(page));

test('PBL032-01 外部更新がなければ固定通知を表示しない',async({page})=>{
  await expect(page.locator('#externalUpdateNotice')).toBeHidden();
  expect(await page.evaluate(()=>({conflictDetected,dirty,ids:data.items.map(item=>item.id)}))).toEqual({conflictDetected:false,dirty:false,ids:['A']});
});

test('PBL032-02 ヘッダー外へスクロールしても外部更新通知と直接更新操作を固定表示する',async({page})=>{
  await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='1800px';document.body.appendChild(spacer);window.scrollTo(0,900)});
  await externalUpdate(page);
  const notice=page.locator('#externalUpdateNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('外部でDBが更新されました');
  await expect(notice.getByRole('button',{name:'最新状態に更新'})).toBeVisible();
  expect(await notice.evaluate(el=>getComputedStyle(el).position)).toBe('fixed');
  expect((await page.locator('#dbStatus').boundingBox()).y).toBeLessThan(0);
  const before=await page.evaluate(()=>data.items.map(item=>item.id));
  await page.evaluate(()=>{setMode('team');window.scrollTo(0,1300)});
  await page.waitForTimeout(100);
  await expect(notice).toBeVisible();
  expect(await page.evaluate(()=>data.items.map(item=>item.id))).toEqual(before);
});

test('PBL032-03 固定通知から既存の安全な再読込経路を実行して通知を解消する',async({page})=>{
  await externalUpdate(page);
  await page.getByRole('button',{name:'最新状態に更新'}).click();
  await expect.poll(()=>page.evaluate(()=>data.items.map(item=>item.id))).toEqual(['B']);
  await expect(page.locator('#row_B .titleText')).toHaveText('外部更新後');
  await expect(page.locator('#externalUpdateNotice')).toBeHidden();
  expect(await page.evaluate(()=>({conflictDetected,dirty,saveState,currentDbName}))).toEqual({conflictDetected:false,dirty:false,saveState:'saved',currentDbName:'shared.json'});
});

test('PBL032-04 未保存変更は確認なしに破棄せず、取消後も競合と通知を維持する',async({page})=>{
  await page.evaluate(()=>chg(0,'title','自分の未保存変更'));
  await externalUpdate(page);
  await expect(page.locator('#externalUpdateNotice')).toHaveClass(/conflict/);
  await page.getByRole('button',{name:'最新状態に更新'}).click();
  await expect(page.locator('.externalRefreshDialog')).toBeVisible();
  await page.getByRole('button',{name:'キャンセル'}).click();
  expect(await page.evaluate(()=>({title:itemById('A').title,dirty,conflictDetected,saveState}))).toEqual({title:'自分の未保存変更',dirty:true,conflictDetected:true,saveState:'conflict'});
  await expect(page.locator('#externalUpdateNotice')).toBeVisible();
  expect(JSON.parse(await page.evaluate(()=>__fsMock.snapshot('db').text)).items[0].id).toBe('B');
  await page.getByRole('button',{name:'最新状態に更新'}).click();
  await page.getByRole('button',{name:'破棄して最新状態に更新'}).click();
  await expect.poll(()=>page.evaluate(()=>data.items.map(item=>item.id))).toEqual(['B']);
  await expect(page.locator('#externalUpdateNotice')).toBeHidden();
});

test('PBL032-05 未確定editorも確認対象にし、既存ヘッダー操作も同じ再読込経路を使う',async({page})=>{
  await externalUpdate(page,[task('C','ヘッダー更新後')]);
  const title=page.locator('#row_A .titleText');
  await title.click();
  await title.fill('未確定入力');
  expect(await page.evaluate(()=>dirty)).toBe(false);
  await page.getByRole('button',{name:'最新状態に更新'}).click();
  await expect(page.locator('.externalRefreshDialog')).toBeVisible();
  await page.getByRole('button',{name:'キャンセル'}).click();
  await expect(page.locator('#externalUpdateNotice')).toBeVisible();
  expect(await page.evaluate(()=>({title:itemById('A').title,dirty,conflictDetected}))).toEqual({title:'未確定入力',dirty:true,conflictDetected:true});
  await page.locator('#dbStatus').getByRole('button',{name:'最新DBを再読込'}).click();
  await expect(page.locator('.externalRefreshDialog')).toBeVisible();
  await page.getByRole('button',{name:'破棄して最新状態に更新'}).click();
  await expect.poll(()=>page.evaluate(()=>data.items.map(item=>item.id))).toEqual(['C']);
  await expect(page.locator('#externalUpdateNotice')).toBeHidden();
});
