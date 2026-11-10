const {test,expect}=require('playwright/test');
const {APP,TARGET_SCHEMA_VERSION}=require('./helpers/app-target');

const task=(id,parentId='',sortOrder=1000)=>({id,parentId,title:id,state:'未着手',owner:'',due:'2026-09-10',planned_duration_days:3,summary:'概要',repeat:'',recurrence_rule:null,recurrence_schedule_date:null,completed:false,dependencies:[],sortOrder,impact_level:1});

async function boot(page,displayMode='todo-tree',width=1280){
  await page.setViewportSize({width,height:760});
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(({items,displayMode})=>{applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items,snapshots:[]},'pbl018','pbl018.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(displayMode);clearUndoHistory('pbl018');dirty=false},{items:[task('ROOT'),task('CHILD','ROOT',2000),task('OTHER','',3000)],displayMode});
}

test('PBL018-SCHEMA-01 visible and runtime current Schema are both the candidate Schema',async({page})=>{
  await page.goto(APP);
  expect(TARGET_SCHEMA_VERSION,'ASANYA_TEST_SCHEMA_VERSION must explicitly identify the current candidate').toBeTruthy();
  const expected=TARGET_SCHEMA_VERSION;
  await expect(page.locator('#schemaMeta')).toHaveText('schema_version '+expected);
  expect(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)).toBe(expected);
  expect(await page.evaluate(()=>serializeCurrentSchemaDatabase([]).schema_version)).toBe(expected);
});

test('PBL018-PLACEMENT-01 Help is the single far-right control in the ASANYA header and survives refresh',async({page})=>{
  await boot(page);
  const measure=()=>page.evaluate(()=>{const triggers=[...document.querySelectorAll('#helpTrigger')],header=document.querySelector('body>h1'),trigger=triggers[0],hr=header?.getBoundingClientRect(),tr=trigger?.getBoundingClientRect(),brand=header?.querySelector('span:not(.schemaMeta)')?.getBoundingClientRect();return{count:triggers.length,parent:trigger?.parentElement===header,last:header?.lastElementChild===trigger,brandRight:brand?.right,triggerLeft:tr?.left,rightGap:hr&&tr?hr.right-tr.right:null,oldRowHasTrigger:!!document.querySelector('#shortcutHelpRow #helpTrigger')}});
  let placement=await measure();expect(placement).toMatchObject({count:1,parent:true,last:true,oldRowHasTrigger:false});expect(placement.triggerLeft).toBeGreaterThan(placement.brandRight);expect(Math.abs(placement.rightGap)).toBeLessThanOrEqual(1);
  await page.evaluate(()=>refreshDbStatus());placement=await measure();expect(placement).toMatchObject({count:1,parent:true,last:true,oldRowHasTrigger:false});expect(Math.abs(placement.rightGap)).toBeLessThanOrEqual(1);
});

test('PBL018-TRIGGER-01 Help remains available in all four views and guide wording stays exact',async({page})=>{
  await boot(page);
  const expected='ショートカット: T＝ToDo ツリー順　(ToDo時) 1/2＝ツリー順 / 日付順 切替　P＝Project 詳細　(Project時) 1/2＝詳細表示 / 簡易表示 切替　S＝検索（Alt+Sも可）　Enter＝同階層に追加　Insert＝子を追加　Delete＝終了／再オープン　F2＝タイトル編集　↑/↓＝前後のタスクへ移動　Ctrl+Z＝元に戻す　Ctrl+Y/Ctrl+Shift+Z＝やり直す　D→E＝期限編集　D→0〜9＝今日〜9日後　Alt+T＝TOP';
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

test('PBL018-OPEN-02 clicking outside the Help surface closes it without restoring focus to the trigger',async({page})=>{
  await boot(page);await page.locator('#helpTrigger').click();await page.mouse.click(8,8);await expect(page.locator('#helpPopover')).toBeHidden();await expect(page.locator('#helpTrigger')).not.toBeFocused();
});

test('PBL018-GUARD-01 app shortcuts are inert while Help is open and Tab remains available',async({page})=>{
  await boot(page);await page.evaluate(()=>{selectTask('ROOT');window.scrollTo(0,500)});const baseline=await page.evaluate(()=>({mode:displayModeKey(),selected:selectedTaskId,count:data.items.length,done:itemById('ROOT').completed,draft:draftTaskId,search:getComputedStyle(taskSearchPopup).display,scroll:scrollY,undo:undoStack.length,redo:redoStack.length}));
  for(const key of ['t','p','1','2','s','Enter','Insert','Delete','F2','ArrowUp','ArrowDown','Control+z','Control+y','Control+Shift+z','d','e','0','Alt+s','Alt+t']){await page.locator('#helpTrigger').click();await page.keyboard.press(key);expect(await page.locator('#helpPopover').isVisible()).toBe(true);await page.locator('#helpTrigger').click()}
  const after=await page.evaluate(()=>({mode:displayModeKey(),selected:selectedTaskId,count:data.items.length,done:itemById('ROOT').completed,draft:draftTaskId,search:getComputedStyle(taskSearchPopup).display,scroll:scrollY,undo:undoStack.length,redo:redoStack.length}));expect(after).toEqual(baseline);
  await page.locator('#helpTrigger').click();await page.keyboard.press('Tab');await expect(page.locator('#helpPopover')).toBeVisible();
});

test('PBL018-CONTEXT-01 landing cards and persistent navigation share the seven exact categories and destinations',async({page})=>{
  const titles=['タスクを追加・編集する','ToDoモードで使う','Projectモードで使う','変化をAIで分析する','案件をAIで探索する','データを保存する','ショートカット'];
  const descriptions=['タスクの追加・編集と親子タスクの追加','ToDo画面の特徴と使い方','Project画面の特徴と使い方','Snapshot AI分析','Copilot用スクリプト生成','DBデータ保存・読込と外部更新',null];
  const keys=['task','todo','project','diff','copilot','data','shortcuts'];
  await boot(page,'todo-tree');await page.locator('#helpTrigger').click();const nav=page.locator('#helpNav');expect(await nav.locator('[data-help-nav]').allTextContents()).toEqual(titles);await expect(page.locator('[data-help-landing="true"]')).toBeVisible();const cards=page.locator('.helpLandingCard');await expect(cards).toHaveCount(7);expect(await cards.locator('strong').allTextContents()).toEqual(titles);
  for(let i=0;i<7;i++){const card=cards.nth(i);if(descriptions[i]===null)await expect(card.locator('span')).toHaveCount(0);else await expect(card.locator('span')).toHaveText(descriptions[i]);expect(await nav.locator('[data-help-nav]').nth(i).getAttribute('data-help-nav')).toBe(keys[i]);await card.click();await expect(page.locator(`[data-help-section="${keys[i]}"]`)).toBeVisible();await expect(nav.locator(`[data-help-nav="${keys[i]}"]`)).toHaveAttribute('aria-current','page');await expect(page.locator('.helpContentNav')).toHaveCount(0);await page.locator('#helpHome').click();await expect(page.locator('[data-help-landing="true"]')).toBeVisible()}
  const wide=cards.first();expect(await wide.evaluate(el=>getComputedStyle(el).gridColumnStart)).toBe('1');expect(await wide.evaluate(el=>getComputedStyle(el).gridColumnEnd)).toBe('-1');
});

test('PBL018-CONTENT-02 all category and landing targets are valid, unique, and reusable across repeated navigation',async({page})=>{
  await boot(page);await page.locator('#helpTrigger').click();const audit=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id),keys=new Set([...document.querySelectorAll('#helpNav [data-help-nav]')].map(node=>node.dataset.helpNav)),targets=[...document.querySelectorAll('#helpPopover [data-help-target]')].map(node=>node.dataset.helpTarget);return{uniqueIds:ids.length===new Set(ids).size,validTargets:targets.every(key=>keys.has(key)),targetCount:document.querySelectorAll('[data-help-landing] [data-help-target]').length}});expect(audit).toEqual({uniqueIds:true,validTargets:true,targetCount:7});for(let cycle=0;cycle<2;cycle++)for(const key of ['task','todo','project','diff','copilot','data','shortcuts']){await page.locator(`[data-help-nav="${key}"]`).click();await expect(page.locator(`[data-help-section="${key}"]`)).toBeVisible();await expect(page.locator(`[data-help-nav="${key}"]`)).toHaveAttribute('aria-current','page');await expect(page.locator('[data-help-section]')).toHaveCount(1);await expect(page.locator('.helpContentNav')).toHaveCount(0)}
});

test('PBL018-NAV-01 both Help home controls return from every category without closing Help',async({page})=>{
  await boot(page);await page.locator('#helpTrigger').click();const categories=['task','todo','project','diff','copilot','data','shortcuts'];
  for(const key of categories){await page.locator(`[data-help-nav="${key}"]`).click();await page.locator('#helpHome').click();await expect(page.locator('[data-help-landing="true"]')).toBeVisible();await expect(page.locator('#helpPopover')).toBeVisible();await page.locator(`[data-help-nav="${key}"]`).click();const title=page.getByRole('button',{name:'ASANYA ヘルプ'});await title.focus();await expect(title).toBeFocused();await title.click();await expect(page.locator('[data-help-landing="true"]')).toBeVisible();await expect(page.locator('#helpPopover')).toBeVisible()}
  await expect(page.locator('#helpHome')).toHaveText('ヘルプトップへ');
});

test('PBL018-CONTEXT-02 Project Help navigation preserves Task Detail and remains above it',async({page})=>{
  await boot(page,'project-detail');await page.locator('#ganttView .ganttRow[data-task-id="ROOT"] .taskDetailOpenBtn').click();const detailId=await page.evaluate(()=>taskDetailPaneTaskId);await page.locator('#helpTrigger').click();await page.locator('[data-help-nav="project"]').click();await expect(page.locator('[data-help-section="project"]')).toBeVisible();await expect(page.locator('#taskDetailPane')).toBeVisible();expect(await page.evaluate(()=>taskDetailPaneTaskId)).toBe(detailId);expect(Number(await page.locator('#helpPopover').evaluate(el=>getComputedStyle(el).zIndex))).toBeGreaterThan(Number(await page.locator('#taskDetailPane').evaluate(el=>getComputedStyle(el).zIndex)));
});

test('PBL018-CONTENT-01 current user concepts are organized by their Help category without internal recurrence fields',async({page})=>{
  await boot(page);await page.locator('#helpTrigger').click();const category=async key=>{await page.locator(`[data-help-nav="${key}"]`).click();return page.locator(`[data-help-section="${key}"]`).innerText()};const taskHelp=await category('task');for(const text of ['同じ階層に追加','1つ下の階層に追加','タイトルを入力','期限欄','保存状態'])expect(taskHelp).toContain(text);const todo=await category('todo');for(const text of ['状態','終了／再オープン','OR','AND','ツリー順','日付順','必要な祖先','同じタスクと配下のチェックリスト','チェックリスト'])expect(todo).toContain(text);expect(todo).not.toContain('recurrence_schedule_date');expect(todo).not.toContain('繰返し基準日');const project=await category('project');for(const text of ['概要列','期限マーカー','マイルストーン','今日線','完了後に着手','完了順序のみ'])expect(project).toContain(text);const diff=await category('diff');for(const text of ['Before','After','読取専用','完全なSemantic Diff'])expect(diff).toContain(text);const copilot=await category('copilot');for(const text of ['検索キーワード','回答の長さ','ASANYA内で資料検索は行いません','タスク行','期限・担当・状態・概要'])expect(copilot).toContain(text);
});

test('PBL018-GEOMETRY-01 navigation and content have independent scroll regions without viewport overflow',async({page})=>{
  for(const width of [1280,480]){await boot(page,'todo-tree',width);await page.setViewportSize({width,height:480});const beforeOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);await page.locator('#helpTrigger').click();await page.locator('[data-help-nav="diff"]').click();const geometry=await page.evaluate(()=>{const r=helpPopover.getBoundingClientRect(),nav=helpPopover.querySelector('#helpNav'),content=helpPopover.querySelector('#helpContent');return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,viewport:[innerWidth,innerHeight],pageOverflow:document.documentElement.scrollWidth-innerWidth,navWidth:nav.clientWidth,navScrollWidth:nav.scrollWidth,navHeight:nav.clientHeight,navScrollHeight:nav.scrollHeight,contentWidth:content.clientWidth,contentHeight:content.clientHeight,contentScrollHeight:content.scrollHeight}});expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.top).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(geometry.viewport[0]);expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport[1]);expect(geometry.pageOverflow).toBeLessThanOrEqual(beforeOverflow+1);expect(geometry.contentWidth).toBeGreaterThan(0);expect(geometry.contentScrollHeight).toBeGreaterThan(geometry.contentHeight);if(width===480)expect(geometry.navScrollWidth).toBeGreaterThan(geometry.navWidth)}
  await boot(page,'todo-tree',1280);await page.setViewportSize({width:1280,height:300});await page.locator('#helpTrigger').click();const navScroll=await page.locator('#helpNav').evaluate(el=>el.scrollHeight>el.clientHeight);expect(navScroll).toBe(true);
});

test('PBL018-GEOMETRY-02 Project horizontal scroll does not move the Help trigger',async({page})=>{
  await boot(page,'project-detail');const before=await page.locator('#helpTrigger').evaluate(el=>el.getBoundingClientRect().left);await page.evaluate(()=>{ganttView.scrollLeft=Math.min(400,ganttView.scrollWidth-ganttView.clientWidth);ganttView.dispatchEvent(new Event('scroll'))});const after=await page.locator('#helpTrigger').evaluate(el=>el.getBoundingClientRect().left);expect(after).toBeCloseTo(before,1);
});
