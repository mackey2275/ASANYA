const {test,expect}=require('playwright/test');
const {installFsAccessMock}=require('./helpers/fs-access-mock');

const {APP:app}=require('./helpers/app-target');
const isV250=app.includes('v250');
const task=(id,title=id)=>({id,parentId:'',state:'',title,completed:false,due:'',sortOrder:1000,dependencies:[]});
const json=items=>JSON.stringify({schema_version:isV250?'2.5':'1.5',...(isV250?{workspace_info_markdown:''}:{}),items});

async function boot(page){
  await installFsAccessMock(page);
  await page.goto(app);
  await page.evaluate(async()=>{localStorage.clear();if(indexedDB.databases)for(const db of await indexedDB.databases())indexedDB.deleteDatabase(db.name);});
  await page.reload();
}
async function makeFile(page,id,options={}){await page.evaluate(({id,options})=>__fsMock.create(id,options),{id,options});}
async function makeDirectory(page,id,options={}){await page.evaluate(({id,options})=>{__fsMock.createDirectory(id,options);__fsMock.queueDirectory(id)},{id,options});}
async function readButton(page){return(await page.locator('#dbStartScreen').isVisible())?page.locator('#startDbReadBtn'):page.locator('#dbReadBtn')}
async function beginRestore(page,id,name){
  await page.evaluate(({id,name})=>{
    const handle=__fsMock.handle(id);
    getLastDbRecord=async()=>({name,handle});
    window.__restorePromise=restoreLastDbOnStartup();
  },{id,name});
}

test.beforeEach(async({page})=>boot(page));

test('v2 Access DB読込導線: 未読込start screenは強調、キャンセルと失敗でも維持',async({page})=>{
  const button=page.locator('#startDbReadBtn');await expect(button).toHaveText('既存DB読込');await expect(button).toHaveClass(/dbStartChoice/);
  const colors=await button.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,border:getComputedStyle(el).borderColor}));expect(colors).toEqual({background:'rgb(255, 255, 255)',color:'rgb(36, 86, 166)',border:'rgb(158, 182, 220)'});
  await expect(page.locator('#dbSaveBtn')).toBeHidden();await expect(page.locator('#startNewDbBtn')).toBeVisible();
  await button.click();await expect(button).toHaveText('既存DB読込');await expect(button).toHaveClass(/dbStartChoice/);
  await makeFile(page,'broken',{name:'broken.json',text:'{"schema_version":"1.5","items":'});await page.evaluate(()=>__fsMock.queueOpen('broken'));
  const pending=page.waitForEvent('dialog');const click=button.click();const dialog=await pending;expect(dialog.message()).toContain('JSON読込に失敗');await dialog.accept();await click;
  await expect(button).toHaveText('既存DB読込');await expect(button).toHaveClass(/dbStartChoice/);expect(await page.evaluate(()=>dbDataLoaded)).toBe(false);
});

test('v1.5.7 DB読込導線: 正常読込後は通常の別DB読込、キャンセルでも維持',async({page})=>{
  await makeFile(page,'loaded',{name:'loaded.json',text:json([task('loaded-task')])});await page.evaluate(()=>__fsMock.queueOpen('loaded'));await (await readButton(page)).click();await expect(page.locator('#dbLoadingBack')).toBeHidden();const button=page.locator('#dbReadBtn');
  await expect(button).toHaveText('別DB読込');await expect(button).not.toHaveClass(/dbLoadPrimary/);await expect(page.locator('#dbSaveBtn')).toHaveText('現在DBのコピーを保存');await expect(page.locator('#newDbBtn')).toBeVisible();expect(await page.evaluate(()=>({loaded:dbDataLoaded,id:currentDbHandle.__mockId}))).toEqual({loaded:true,id:'loaded'});
  await button.click();await expect(button).toHaveText('別DB読込');await expect(button).not.toHaveClass(/dbLoadPrimary/);expect(await page.evaluate(()=>data.items.map(x=>x.id))).toEqual(['loaded-task']);
});

test('v1.5.7 選択ボタン: オレンジを淡くして選択ロジックを維持',async({page})=>{
  await page.evaluate(items=>applyJsonObject({schema_version:'1.8',items},'test','ui.json',null,{remember:false}),[task('A')]);
  for(const id of ['#vOpen','#mPersonal','#sTree']){await expect(page.locator(id)).toHaveClass(/on/);const style=await page.locator(id).evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,border:getComputedStyle(el).borderColor}));expect(style).toEqual({background:'rgb(255, 240, 191)',color:'rgb(96, 76, 0)',border:'rgb(229, 199, 107)'})}
  await page.locator('#vAll').click();await expect(page.locator('#vAll')).toHaveClass(/on/);await expect(page.locator('#vOpen')).not.toHaveClass(/on/);
});

test('v2 Access 新しいDB: CancelはA不変、成功時だけ空Bへ直接移行',async({page})=>{
  await makeFile(page,'source',{name:'source.json',text:json([task('source-task')])});await page.evaluate(()=>__fsMock.queueOpen('source'));await (await readButton(page)).click();await expect(page.locator('#dbLoadingBack')).toBeHidden();
  const sourceBefore=await page.evaluate(()=>__fsMock.snapshot('source').text);await page.locator('#newDbBtn').click();await page.locator('#newDbNameCancel').click();
  expect(await page.evaluate(()=>({loaded:dbDataLoaded,name:currentDbName,ids:data.items.map(x=>x.id)}))).toEqual({loaded:true,name:'source.json',ids:['source-task']});expect(await page.evaluate(()=>__fsMock.snapshot('source').text)).toBe(sourceBefore);
  await makeDirectory(page,'new-dir');await page.locator('#newDbBtn').click();await page.locator('#newDbNameInput').fill('new-db');await page.locator('#newDbNameNext').click();await page.locator('#newDbFolderNext').click();await expect.poll(()=>page.evaluate(()=>currentDbName)).toBe('new-db.json');const newId=await page.evaluate(()=>__fsMock.directoryEntries('new-dir')[0][1]);
expect(await page.evaluate(id=>JSON.parse(__fsMock.snapshot(id).text),newId)).toEqual(isV250?{schema_version:'2.5',workspace_info_markdown:'',items:[]}:app.includes('v220_dev')||app.includes('pbl002_')||app.includes('v230')||app.includes('v240')||app.includes('task_detail_phase')?{schema_version:'2.2',workspace_info_markdown:'',items:[]}:{schema_version:'2.0',items:[]});await expect(page.locator('#dbReadBtn')).toHaveText('別DB読込');await expect(page.locator('#dbSaveBtn')).toHaveText('現在DBのコピーを保存');await expect(page.locator('#newDbBtn')).toBeVisible();
});

test('v1.5.7 新しいDB: 未保存変更の保存失敗時は現在DBを維持',async({page})=>{
  await makeFile(page,'source',{name:'dirty-source.json',text:json([task('source-task','保存前')])});await page.evaluate(()=>__fsMock.queueOpen('source'));await (await readButton(page)).click();await expect(page.locator('#dbLoadingBack')).toBeHidden();
  await page.evaluate(()=>{chg(0,'title','未保存の編集');__fsMock.configure('source',{failWrite:true})});await page.locator('#newDbBtn').click();
  await expect.poll(()=>page.evaluate(()=>saveState)).toBe('error');expect(await page.evaluate(()=>({loaded:dbDataLoaded,name:currentDbName,id:currentDbHandle.__mockId,title:data.items[0].title,dirty}))).toEqual({loaded:true,name:'dirty-source.json',id:'source',title:'未保存の編集',dirty:true});await expect(page.locator('#newDbBtn')).toBeVisible();
});

test('v1.5.7 DB読込導線: fallback読込はハンドルなしでも読込済み',async({page})=>{
  await page.locator('#jsonFile').setInputFiles({name:'fallback.json',mimeType:'application/json',buffer:Buffer.from(json([task('fallback-task')]))});await expect(page.locator('#dbLoadingBack')).toBeHidden();
  await expect(page.locator('#dbReadBtn')).toHaveText('別DB読込');await expect(page.locator('#dbReadBtn')).not.toHaveClass(/dbLoadPrimary/);
  expect(await page.evaluate(()=>({loaded:dbDataLoaded,handle:currentDbHandle,name:currentDbName,ids:data.items.map(x=>x.id)}))).toEqual({loaded:true,handle:null,name:'fallback.json',ids:['fallback-task']});
});

test('v1.5.7 UI-05: KPIのラベルと件数は同一行構造',async({page})=>{
  await page.evaluate(items=>applyJsonObject({schema_version:'1.5',items},'Playwright','kpi.json',null,{remember:false,writePermissionGranted:false}),[task('open'),{...task('late'),due:'2020-01-01'}]);
  const cards=page.locator('#kpis .card');await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).locator('.cn')).toHaveText('未完了');await expect(cards.nth(0).locator('.cv')).toHaveText('2件');
  await expect(cards.nth(1).locator('.cn')).toHaveText('期限超過');await expect(cards.nth(1).locator('.cv')).toHaveText('1件');
  for(let i=0;i<2;i++){const layout=await cards.nth(i).evaluate(el=>({display:getComputedStyle(el).display,tags:[...el.children].map(x=>x.tagName),tops:[...el.children].map(x=>Math.round(x.getBoundingClientRect().top))}));expect(layout.display).toBe('flex');expect(layout.tags).toEqual(['SPAN','SPAN']);expect(Math.abs(layout.tops[0]-layout.tops[1])).toBeLessThanOrEqual(5)}
});

test('v1.5.7 DB-02: 最近使用DB切替にもファイル名付き読込表示と最低時間',async({page})=>{
  await makeFile(page,'recent',{name:'recent.json',text:json([task('recent-task')])});
  await page.evaluate(async()=>{await applyJsonObject({schema_version:'1.8',items:[{id:'current',title:'current'}]},'test','current.json',null,{remember:false});recentDbs=[{name:'recent.json',handle:__fsMock.handle('recent'),updatedAt:Date.now()}];refreshDbStatus()});
  const started=Date.now();await page.locator('.recentDbBtn',{hasText:'recent.json'}).click();
  await expect(page.locator('#dbLoadingBack')).toBeVisible();await expect(page.locator('#dbLoadingFile')).toHaveText('recent.json');
  await expect(page.locator('#dbLoadingBack')).toBeHidden();expect(Date.now()-started).toBeGreaterThanOrEqual(450);
  await expect(page.locator('.dbName')).toHaveText('recent.json');expect(await page.evaluate(()=>data.items.map(x=>x.id))).toEqual(['recent-task']);
});

test('v1.5.7 SAVE-03: grantedなら前回DBを操作なしで中央表示付き自動再開',async({page})=>{
  await makeFile(page,'last',{name:'last.json',text:json([task('last-task')]),readPermission:'granted',writePermission:'granted'});
  const started=Date.now();await beginRestore(page,'last','last.json');await expect(page.locator('#dbLoadingBack')).toBeVisible();await expect(page.locator('#dbLoadingFile')).toHaveText('last.json');
  await expect(page.locator('#dbLoadingBack')).toBeHidden();expect(Date.now()-started).toBeGreaterThanOrEqual(450);
  await expect(page.getByRole('button',{name:'前回DBを再開'})).toHaveCount(0);await expect(page.locator('.dbName')).toHaveText('last.json');
  await expect(page.locator('#dbReadBtn')).toHaveText('別DB読込');await expect(page.locator('#dbReadBtn')).not.toHaveClass(/dbLoadPrimary/);
  expect(await page.evaluate(()=>({ids:data.items.map(x=>x.id),requests:__fsMock.calls().filter(x=>x.op==='requestPermission').length}))).toEqual({ids:['last-task'],requests:0});
});

test('v2 Access SAVE-03: prompt・拒否は編集画面へ入らずstart screenを維持',async({page})=>{
  await makeFile(page,'prompt',{name:'prompt.json',text:json([task('prompt-task')]),readPermission:'prompt',writePermission:'prompt',requestWriteResult:'granted'});
  await beginRestore(page,'prompt','prompt.json');await page.evaluate(()=>window.__restorePromise);await expect(page.locator('#dbStartScreen')).toBeVisible();await expect(page.getByRole('button',{name:'前回DBを再開'})).toHaveCount(1);
  expect(await page.evaluate(()=>__fsMock.calls().filter(x=>x.op==='requestPermission').length)).toBe(0);expect(await page.evaluate(()=>({loaded:dbDataLoaded,items:data.items,dirty,saveState}))).toEqual({loaded:false,items:[],dirty:false,saveState:'resume'});

  await page.reload();await makeFile(page,'denied',{name:'denied.json',text:json([task('must-not-load')]),readPermission:'prompt',writePermission:'prompt',requestReadResult:'denied',requestWriteResult:'denied'});await beginRestore(page,'denied','denied.json');
  await page.evaluate(()=>window.__restorePromise);expect(await page.evaluate(()=>({handle:currentDbHandle,remembered:rememberedDbHandle?.__mockId,writePermissionGranted,saveState,loaded:data.items.some(x=>x.id==='must-not-load')}))).toEqual({handle:null,remembered:'denied',writePermissionGranted:false,saveState:'resume',loaded:false});
  await expect(page.locator('#dbStartScreen')).toBeVisible();await expect(page.getByRole('button',{name:'前回DBを再開'})).toHaveCount(1);await expect(page.locator('.askBack')).toHaveCount(0);
});
