const {test,expect}=require('playwright/test');
const fs=require('node:fs');
const {APP,APP_FS_PATH}=require('./helpers/app-target');
const isV250=APP.includes('v250'),isV240=APP.includes('v240'),isV230=APP.includes('v230')||APP.includes('task_detail_phase'),isPbl002=APP.includes('pbl002_'),expectedSchema=isV250?'2.5':APP.includes('v220')||isPbl002||isV230||isV240?'2.2':'2.0',expectedProduct=isV250?'ASANYA v2.5.0':isV240?'ASANYA v2.4.0':isV230?'ASANYA v2.3.0':APP.includes('v220_dev')?'ASANYA v2.2.0-dev':APP.includes('v220')||isPbl002?'ASANYA v2.2.0':APP.includes('v211_dev')?'ASANYA v2.1.1-dev':APP.includes('v211')?'ASANYA v2.1.1':APP.includes('v210')?'ASANYA v2.1.0':'ASANYA v2.0.0';
const task=(id,extra={})=>({id,parentId:'',state:'',impact:'',title:id,owner:'owner',due:'2026-08-20',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,planned_duration_days:1,...extra});
async function fresh(page,items){await page.setViewportSize({width:1680,height:900});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(xs=>applyJsonObject({schema_version:'1.9',items:xs},'release','release.json',null,{remember:false,writePermissionGranted:false}),items);await page.evaluate(()=>setMode('team'));await page.waitForTimeout(60)}

test('release static branding, schema, help, favicon and compatibility IDs',async({page})=>{
  const html=fs.readFileSync(APP_FS_PATH,'utf8');
  expect(html).not.toMatch(/ASANA風|v2\.0\.0-dev|Schema:\s*1\.8|schema_versionは1\.8|Alt\+T＝ToDo|Alt\+P＝Project/);
  for(const key of['asana_style_task_manager_handles_v1','asana-task-db','asana-copy-save','asana-new-db-save'])expect(html).toContain(key);
  await page.goto(APP); await expect(page).toHaveTitle(expectedProduct); const h=page.locator('h1'); await expect(h).toContainText(expectedProduct);
  const circles=h.locator('svg[aria-hidden="true"] circle'); await expect(circles).toHaveCount(3); await expect(circles.first()).toHaveAttribute('fill','#22d34f');
  await expect(h.locator('.schemaMeta')).toHaveText('schema_version '+expectedSchema);
  await expect(h.locator('svg')).toHaveCSS('transform',/matrix\(1, 0, 0, 1, 0, -2\)/);
});

test('release parent subtree is front in both directions; displaced row stays behind',async({page})=>{
  await fresh(page,[task('Q',{sortOrder:1000}),task('P',{sortOrder:2000}),task('C',{parentId:'P'}),task('G',{parentId:'C'})]);
  await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='P'),-1));
  for(const id of['P','C','G'])await expect(page.locator(`.ganttRow[data-task-id="${id}"]`)).toHaveClass(/sortMovePrimary/);
  await expect(page.locator('.ganttRow[data-task-id="Q"]')).toHaveClass(/sortMoveDisplaced/); await expect(page.locator('.sortMovePrimary').first()).toHaveCSS('transition-duration','1.12s');
  await page.waitForTimeout(2300); await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='P'),1));
  for(const id of['P','C','G'])await expect(page.locator(`.ganttRow[data-task-id="${id}"]`)).toHaveClass(/sortMovePrimary/);
  await page.screenshot({path:'test-results/asanya-release-subtree-flip.png'});
});

test('release basic render uses Schema 1.9 and ordinary Project render has no viewport twitch',async({page})=>{
  const items=Array.from({length:36},(_,i)=>task(`T${i+1}`,{due:`2026-08-${String((i%20)+1).padStart(2,'0')}`,sortOrder:(i+1)*1000})); await fresh(page,items);
  await page.evaluate(()=>renderedTaskRow('T16').scrollIntoView({block:'center'})); const before=await page.evaluate(()=>({y:scrollY,top:renderedTaskRow('T16').getBoundingClientRect().top,schema:data.schema_version}));
  await page.evaluate(()=>{const i=data.items.findIndex(x=>x.id==='T16');chg(i,'owner','changed');render()}); await page.waitForTimeout(120); const after=await page.evaluate(()=>({y:scrollY,top:renderedTaskRow('T16').getBoundingClientRect().top,schema:data.schema_version}));
expect(before.schema).toBe(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)); expect(after.schema).toBe(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)); expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(1); expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(1);
});
