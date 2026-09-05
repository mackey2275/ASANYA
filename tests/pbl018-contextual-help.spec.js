const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,parentId='',sortOrder=1000)=>({id,parentId,title:id,state:'未着手',owner:'',due:'2026-09-10',planned_duration_days:3,summary:'概要',repeat:'',recurrence_rule:null,recurrence_schedule_date:null,completed:false,dependencies:[],sortOrder,impact_level:1});

async function boot(page,displayMode='todo-tree',width=1280){
  await page.setViewportSize({width,height:760});
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(({items,displayMode})=>{applyJsonObject({schema_version:'3.0',workspace_info_markdown:'',items},'pbl018','pbl018.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(displayMode);clearUndoHistory('pbl018');dirty=false},{items:[task('ROOT'),task('CHILD','ROOT',2000),task('OTHER','',3000)],displayMode});
}

test('PBL018-SCHEMA-01 visible and runtime current Schema are both 3.0',async({page})=>{
  await page.goto(APP);
  await expect(page.locator('#schemaMeta')).toHaveText('schema_version 3.0');
  expect(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)).toBe('3.0');
  expect(await page.evaluate(()=>serializeCurrentSchemaDatabase([]).schema_version)).toBe('3.0');
});

test('PBL018-PLACEMENT-01 Help is the single far-right control in the ASANYA header and survives refresh',async({page})=>{
  await boot(page);
  const measure=()=>page.evaluate(()=>{const triggers=[...document.querySelectorAll('#helpTrigger')],header=document.querySelector('body>h1'),trigger=triggers[0],hr=header?.getBoundingClientRect(),tr=trigger?.getBoundingClientRect(),brand=header?.querySelector('span:not(.schemaMeta)')?.getBoundingClientRect();return{count:triggers.length,parent:trigger?.parentElement===header,last:header?.lastElementChild===trigger,brandRight:brand?.right,triggerLeft:tr?.left,rightGap:hr&&tr?hr.right-tr.right:null,oldRowHasTrigger:!!document.querySelector('#shortcutHelpRow #helpTrigger')}});
  let placement=await measure();expect(placement).toMatchObject({count:1,parent:true,last:true,oldRowHasTrigger:false});expect(placement.triggerLeft).toBeGreaterThan(placement.brandRight);expect(Math.abs(placement.rightGap)).toBeLessThanOrEqual(1);
  await page.evaluate(()=>refreshDbStatus());placement=await measure();expect(placement).toMatchObject({count:1,parent:true,last:true,oldRowHasTrigger:false});expect(Math.abs(placement.rightGap)).toBeLessThanOrEqual(1);
});

test('PBL018-TRIGGER-01 Help remains available in all four views and guide wording stays exact',async({page})=>{
  await boot(page);
  const expected='ショートカット: T＝ToDo ツリー順　P＝Project 詳細　1/2＝同family内切替　S＝検索（Alt+Sも可）　Enter＝同階層に追加　Insert＝子を追加　Delete＝終了／再オープン　F2＝タイトル編集　D→E＝期限編集　D→0〜9＝今日〜9日後　Alt+T＝TOP';
  for(const mode of ['todo-tree','todo-date','project-detail','project-simple']){
    await page.evaluate(mode=>setDisplayMode(mode),mode);
    await expect(page.locator('#helpTrigger')).toBeVisible();
    await expect(page.locator('#shortcutHelp')).toHaveText(expected);
    if(mode.startsWith('project'))await expect(page.locator('#shortcutHelp')).toBeHidden();else await expect(page.locator('#shortcutHelp')).toBeVisible();
  }
});

test('PBL018-OPEN-01 trigger, close button and Escape restore focus with correct ARIA',async({page})=>{
  await boot(page);const trigger=page.locator('#helpTrigger'),popover=page.locator('#helpPopover');
  await trigger.click();await expect(popover).toBeVisible();await expect(page.locator('#helpClose')).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','true');
  await trigger.click();await expect(popover).toBeHidden();await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
  await trigger.click();await page.locator('#helpClose').click();await expect(popover).toBeHidden();await expect(trigger).toBeFocused();
  await trigger.click();await page.keyboard.press('Escape');await expect(popover).toBeHidden();await expect(trigger).toBeFocused();
});

test('PBL018-OPEN-02 outside click closes without forcing focus back to trigger',async({page})=>{
  await boot(page);await page.locator('#helpTrigger').click();await page.locator('#workspaceInfoPanel').click();await expect(page.locator('#helpPopover')).toBeHidden();await expect(page.locator('#workspaceInfoEditor')).toBeFocused();await expect(page.locator('#helpTrigger')).not.toBeFocused();
});

test('PBL018-GUARD-01 app shortcuts are inert while Help is open and Tab remains available',async({page})=>{
  await boot(page);await page.evaluate(()=>{selectTask('ROOT');window.scrollTo(0,500)});const baseline=await page.evaluate(()=>({mode:displayModeKey(),count:data.items.length,done:itemById('ROOT').completed,draft:draftTaskId,search:getComputedStyle(taskSearchPopup).display,scroll:scrollY}));
  for(const key of ['t','p','1','2','s','Enter','Insert','Delete','F2','d','e','0','Alt+s','Alt+t']){await page.locator('#helpTrigger').click();await page.keyboard.press(key);expect(await page.locator('#helpPopover').isVisible()).toBe(true);await page.locator('#helpTrigger').click()}
  const after=await page.evaluate(()=>({mode:displayModeKey(),count:data.items.length,done:itemById('ROOT').completed,draft:draftTaskId,search:getComputedStyle(taskSearchPopup).display,scroll:scrollY}));expect(after).toEqual(baseline);
  await page.locator('#helpTrigger').click();await page.keyboard.press('Tab');await expect(page.locator('#helpPopover')).toBeVisible();
});

test('PBL018-CONTEXT-01 ToDo shows Common, ToDo and Shortcuts only',async({page})=>{
  await boot(page,'todo-tree');await page.locator('#helpTrigger').click();await expect(page.locator('[data-help-section="common"]')).toBeVisible();await expect(page.locator('[data-help-section="todo"]')).toBeVisible();await expect(page.locator('[data-help-section="project"]')).toHaveCount(0);await expect(page.locator('[data-help-section="shortcuts"]')).toBeVisible();
});

test('PBL018-CONTEXT-02 Project shows Common, Project and Shortcuts and preserves Task Detail',async({page})=>{
  await boot(page,'project-detail');await page.locator('#ganttView .ganttRow[data-task-id="ROOT"] .taskDetailOpenBtn').click();const detailId=await page.evaluate(()=>taskDetailPaneTaskId);await page.locator('#helpTrigger').click();await expect(page.locator('[data-help-section="project"]')).toBeVisible();await expect(page.locator('[data-help-section="todo"]')).toHaveCount(0);await expect(page.locator('#taskDetailPane')).toBeVisible();expect(await page.evaluate(()=>taskDetailPaneTaskId)).toBe(detailId);expect(Number(await page.locator('#helpPopover').evaluate(el=>getComputedStyle(el).zIndex))).toBeGreaterThan(Number(await page.locator('#taskDetailPane').evaluate(el=>getComputedStyle(el).zIndex)));
});

test('PBL018-CONTENT-01 approved concepts are present and internal recurrence terms are absent',async({page})=>{
  await boot(page);await page.locator('#helpTrigger').click();const todo=await page.locator('#helpPopover').innerText();for(const text of ['状態','終了／再オープン','OR','AND','同じ階層に追加','1つ下の階層に追加','今日以降の最初の予定','必要な祖先','T','Alt+T'])expect(todo).toContain(text);expect(todo).not.toContain('recurrence_schedule_date');expect(todo).not.toContain('繰返し基準日');await page.keyboard.press('Escape');await page.evaluate(()=>setDisplayMode('project-simple'));await page.locator('#helpTrigger').click();const project=await page.locator('#helpPopover').innerText();for(const text of ['概要列','期限マーカー','マイルストーン','今日線','完了後に着手','完了順序のみ'])expect(project).toContain(text);
});

test('PBL018-GEOMETRY-01 popover stays inside wide and narrow viewports without page overflow',async({page})=>{
  for(const width of [1280,480]){await boot(page,'todo-tree',width);const beforeOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);await page.locator('#helpTrigger').click();const geometry=await page.evaluate(()=>{const r=helpPopover.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,viewport:[innerWidth,innerHeight],pageOverflow:document.documentElement.scrollWidth-innerWidth,scrollable:helpPopover.scrollHeight>helpPopover.clientHeight}});expect(geometry.left).toBeGreaterThanOrEqual(8);expect(geometry.top).toBeGreaterThanOrEqual(8);expect(geometry.right).toBeLessThanOrEqual(geometry.viewport[0]-8);expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport[1]-8);expect(geometry.pageOverflow).toBeLessThanOrEqual(beforeOverflow+1);if(width===480)expect(geometry.scrollable).toBe(true)}
});

test('PBL018-GEOMETRY-02 Project horizontal scroll does not move the Help trigger',async({page})=>{
  await boot(page,'project-detail');const before=await page.locator('#helpTrigger').evaluate(el=>el.getBoundingClientRect().left);await page.evaluate(()=>{ganttView.scrollLeft=Math.min(400,ganttView.scrollWidth-ganttView.clientWidth);ganttView.dispatchEvent(new Event('scroll'))});const after=await page.locator('#helpTrigger').evaluate(el=>el.getBoundingClientRect().left);expect(after).toBeCloseTo(before,1);
});
