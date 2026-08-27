const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
const expectedProduct=APP.includes('v240')?'ASANYA v2.4.0':APP.includes('v230')||APP.includes('task_detail_phase')?'ASANYA v2.3.0':APP.includes('v220_dev')?'ASANYA v2.2.0-dev':'ASANYA v2.2.0';

const task=(id='T1')=>({id,parentId:'',state:'未着手',impact:'',title:id,owner:'',due:'',planned_duration_days:null,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000});
async function boot(page,markdown='',schema='2.2'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({markdown,schema,item})=>applyJsonObject({schema_version:schema,...(markdown===null?{}:{workspace_info_markdown:markdown}),items:[item]},'workspace-info','info.json',null,{remember:false,writePermissionGranted:false}),{markdown,schema,item:task()});
}
const panel=page=>page.locator('#workspaceInfoPanel');

test('INFO-DATA-01: Schema 2.0 missing field loads as empty and canonical save uses Schema 2.2',async({page})=>{
  await boot(page,null,'2.0');await expect(panel(page).locator('.workspaceInfoDisplay')).toHaveClass(/empty/);
  expect(await page.evaluate(()=>persistableData())).toMatchObject({schema_version:'2.2',workspace_info_markdown:'',items:[{id:'T1'}]});
});

test('INFO-EDIT-01: click, Enter newline, Ctrl+Enter commit and blur is one logical commit',async({page})=>{
  await boot(page,'開始');await panel(page).locator('.workspaceInfoDisplay').click();const editor=page.locator('#workspaceInfoEditor');
  await editor.evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));await editor.press('Enter');await editor.type('日本語 **情報**');
  const before=await page.evaluate(()=>dataRevision);await editor.press('Control+Enter');
  await expect(editor).toHaveCount(0);expect(await page.evaluate(()=>({text:data.workspace_info_markdown,revision:dataRevision,dirty}))).toEqual({text:'開始\n日本語 **情報**',revision:before+1,dirty:true});
});

test('INFO-EDIT-02: Escape keeps editor/text and later blur commits it',async({page})=>{
  await boot(page,'原文');await page.evaluate(()=>{dirty=false;saveState='saved'});await panel(page).locator('.workspaceInfoDisplay').click();const editor=page.locator('#workspaceInfoEditor');await editor.fill('保持する\n複数行');await editor.press('Escape');
  await expect(editor).toBeVisible();await expect(editor).toHaveValue('保持する\n複数行');expect(await page.evaluate(()=>({text:data.workspace_info_markdown,dirty}))).toEqual({text:'原文',dirty:false});
  await page.locator('h1').click();expect(await page.evaluate(()=>({text:data.workspace_info_markdown,dirty}))).toEqual({text:'保持する\n複数行',dirty:true});
});

test('INFO-MD-01: safe Markdown renders headings, lists, emphasis, links, quote and code',async({page})=>{
  await boot(page,'# 見出し\n- 項目\n1. 番号\n**太字** *斜体* [OpenAI](https://openai.com)\n> 引用\n`code`\n```\n<x>\n```\n<img src=x onerror="window.__xss=1">');
  const display=panel(page).locator('.workspaceInfoDisplay');await expect(display.locator('h1')).toHaveText('見出し');await expect(display.locator('ul li')).toHaveText('項目');await expect(display.locator('ol li')).toHaveText('番号');await expect(display.locator('strong')).toHaveText('太字');await expect(display.locator('em')).toHaveText('斜体');await expect(display.locator('a')).toHaveAttribute('href','https://openai.com');await expect(display.locator('blockquote')).toContainText('引用');await expect(display.locator('pre code')).toContainText('<x>');await expect(display.locator('img')).toHaveCount(0);expect(await page.evaluate(()=>window.__xss)).toBeUndefined();
});

test('INFO-MODE-01: ToDo and Project share one panel/content and KPI row stays below header',async({page})=>{
  await boot(page,'共通情報');await expect(panel(page)).toContainText('共通情報');await page.locator('#mTeam').click();await expect(panel(page)).toContainText('共通情報');
  expect(await page.evaluate(()=>document.getElementById('workspaceHeaderGrid').compareDocumentPosition(document.getElementById('kpis'))&Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();await page.locator('#mPersonal').click();await expect(panel(page)).toContainText('共通情報');
});

test('INFO-LAYOUT-01: desktop stretches to left header, no expand control, long content scrolls internally',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await boot(page,Array.from({length:60},(_,i)=>`- 長い情報 ${i+1}`).join('\n'));for(const mode of['personal','team']){await page.evaluate(mode=>setMode(mode),mode);const geometry=await page.evaluate(()=>{const leftEl=document.querySelector('.workspaceHeaderLeft'),left=leftEl.getBoundingClientRect(),right=document.getElementById('workspaceInfoPanel').getBoundingClientRect(),visible=[...leftEl.children].filter(el=>getComputedStyle(el).display!=='none'&&el.getClientRects().length),last=visible.at(-1).getBoundingClientRect(),kpi=document.getElementById('kpis').getBoundingClientRect(),display=document.querySelector('.workspaceInfoDisplay');return{leftBottom:left.bottom,rightBottom:right.bottom,lastBottom:last.bottom,kpiTop:kpi.top,scrollHeight:display.scrollHeight,clientHeight:display.clientHeight}});expect(Math.abs(geometry.leftBottom-geometry.rightBottom)).toBeLessThanOrEqual(1);expect(Math.abs(geometry.lastBottom-geometry.rightBottom)).toBeLessThanOrEqual(1);expect(geometry.kpiTop).toBeGreaterThanOrEqual(geometry.rightBottom);expect(geometry.kpiTop-geometry.rightBottom).toBeLessThanOrEqual(10);expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight)}await expect(panel(page).locator('.workspaceInfoToggle')).toHaveCount(0);expect(await page.evaluate(()=>Object.hasOwn(persistableData(),'workspace_info_expanded'))).toBe(false);
});

test('INFO-HEADER-01: product appears once, schema is beside title, normal DB status is compact plain text',async({page})=>{
  await page.setViewportSize({width:1440,height:800});await boot(page,'情報');await expect(page.locator('h1')).toContainText(expectedProduct);await expect(page.locator('h1 .schemaMeta')).toHaveText('schema_version 2.2');await expect(page.getByText(expectedProduct,{exact:true})).toHaveCount(1);await expect(page.locator('.info')).toHaveCount(0);await page.evaluate(()=>updateJsonStatus('前回DBを自動再開しました: taskdb.json'));const status=page.locator('#jsonStatus');await expect(status).toContainText('前回DBを自動再開しました');expect(await status.evaluate(el=>{const s=getComputedStyle(el);return{border:s.borderStyle,background:s.backgroundColor,padTop:parseFloat(s.paddingTop),padBottom:parseFloat(s.paddingBottom),marginTop:parseFloat(s.marginTop),marginBottom:parseFloat(s.marginBottom),height:el.getBoundingClientRect().height}})).toMatchObject({border:'none',background:'rgba(0, 0, 0, 0)',padTop:0,padBottom:0,marginTop:3,marginBottom:6});expect(await status.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(24);await page.evaluate(()=>updateJsonStatus('JSON読込エラー: broken'));await expect(status).toHaveClass(/statusError/);
});

test('INFO-LAYOUT-02: second wide viewport aligns and editor fills the panel',async({page})=>{
  await page.setViewportSize({width:1600,height:900});await boot(page,'編集');const display=panel(page).locator('.workspaceInfoDisplay');await display.click();const boxes=await page.evaluate(()=>{const left=document.querySelector('.workspaceHeaderLeft').getBoundingClientRect(),panel=document.getElementById('workspaceInfoPanel').getBoundingClientRect(),editor=document.getElementById('workspaceInfoEditor').getBoundingClientRect(),kpi=document.getElementById('kpis').getBoundingClientRect();return{leftBottom:left.bottom,panelBottom:panel.bottom,panelTop:panel.top,editorBottom:editor.bottom,editorTop:editor.top,kpiTop:kpi.top}});expect(Math.abs(boxes.leftBottom-boxes.panelBottom)).toBeLessThanOrEqual(1);expect(Math.abs(boxes.editorTop-boxes.panelTop)).toBeLessThanOrEqual(1);expect(Math.abs(boxes.editorBottom-boxes.panelBottom)).toBeLessThanOrEqual(1);expect(boxes.kpiTop).toBeGreaterThanOrEqual(boxes.panelBottom);
});

test('INFO-DATA-02: exact Unicode round-trip and DB independence',async({page})=>{
  await boot(page,'日本語🌱\n# DB-A');const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(persistableData())));await page.evaluate(()=>applyJsonObject({schema_version:'2.2',workspace_info_markdown:'DB-B',items:[]},'B','b.json',null,{remember:false}));await expect(panel(page)).toContainText('DB-B');await page.evaluate(saved=>applyJsonObject(saved,'A','a.json',null,{remember:false}),saved);expect(await page.evaluate(()=>data.workspace_info_markdown)).toBe('日本語🌱\n# DB-A');
});

test('INFO-UNDO-01: information edit stays outside task Undo/Redo and task Undo still works',async({page})=>{
  await boot(page,'old');await page.evaluate(()=>clearUndoHistory('info-test'));await panel(page).locator('.workspaceInfoDisplay').click();await page.locator('#workspaceInfoEditor').fill('new');await page.locator('#workspaceInfoEditor').press('Control+Enter');expect(await page.evaluate(()=>undoStack.length)).toBe(0);
  await page.evaluate(()=>chg(0,'title','changed'));expect(await page.evaluate(()=>undoStack.length)).toBe(1);await page.keyboard.press('Control+z');expect(await page.evaluate(()=>({title:itemById('T1').title,info:data.workspace_info_markdown}))).toEqual({title:'T1',info:'new'});
});

test('INFO-LINK-01: clicking a rendered link does not enter edit mode',async({page})=>{
  await boot(page,'[link](https://example.com)');await panel(page).locator('a').click({modifiers:['Control']});await expect(page.locator('#workspaceInfoEditor')).toHaveCount(0);
});

test('INFO-RESPONSIVE-01: narrow width stacks header without hiding panel',async({page})=>{
  await page.setViewportSize({width:760,height:700});await boot(page,'情報');await expect(panel(page)).toBeVisible();expect(await page.locator('#workspaceHeaderGrid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);const height=await panel(page).evaluate(el=>el.getBoundingClientRect().height);expect(height).toBeGreaterThanOrEqual(220);expect(height).toBeLessThanOrEqual(240);
});
