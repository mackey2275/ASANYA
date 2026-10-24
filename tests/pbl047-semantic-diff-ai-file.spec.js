const {test,expect}=require('playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {installFsAccessMock}=require('./helpers/fs-access-mock');
const {APP,TARGET_PRODUCT_VERSION,TARGET_SCHEMA_VERSION}=require('./helpers/app-target');

const CURRENT_PRODUCT_VERSION=TARGET_PRODUCT_VERSION||'3.2.1';
const CURRENT_SCHEMA_VERSION_TARGET=TARGET_SCHEMA_VERSION||'3.2';
const pblText=fs.readFileSync(path.resolve(__dirname,'../pbl/items/PBL-047.md'),'utf8');
const canonicalMatch=pblText.match(/## Canonical analysis instruction[\s\S]*?```text\r?\n([\s\S]*?)\r?\n```/);
if(!canonicalMatch)throw new Error('PBL-047 canonical analysis instruction is missing');
const CANONICAL_INSTRUCTION=canonicalMatch[1].replace(/\r\n/g,'\n');
const MARKDOWN_PREFIX='# ASANYA Semantic Diff Analysis\n\n';
const DIFF_SEPARATOR='\n\n---\n\n# Semantic Diff\n\n```json\n';
const MARKDOWN_SUFFIX='\n```\n';

const task=(id,extra={})=>({id,parentId:'',state:'',impact_level:0,title:id,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
const snapshot=(id,capturedAt,items)=>({snapshot_id:id,captured_at:capturedAt,product_version:CURRENT_PRODUCT_VERSION,schema_version:'3.2',snapshot_format_version:'1.0',items});
const beforeSnapshot=(capturedAt='2026-10-16T08:00:00.000Z')=>snapshot('before',capturedAt,[
  task('P',{title:'架空Project',impact_level:2,due:'2026-10-20'}),
  task('CHANGED',{parentId:'P',title:'変更前',summary:'変更前の完全な概要',impact_level:1,due:'2026-10-22',dependencies:[{task_id:'P',type:'finish_to_start'}]}),
  task('DELETED',{title:'削除対象',owner:'Before Owner'}),
  task('RECUR',{title:'定例',repeat:'毎週',due:'2026-10-16',recurrence_rule:{type:'weekly',weekdays:[5]},recurrence_schedule_date:'2026-10-16'})
]);
const afterSnapshot=(capturedAt='2026-10-23T08:00:00.000Z')=>snapshot('after',capturedAt,[
  task('P',{title:'架空Project',impact_level:3,due:'2026-10-27'}),
  task('CHANGED',{parentId:'P',title:'変更後',summary:'変更後の完全な概要\n省略してはいけない2行目',impact_level:3,due:'2026-10-29',owner:'After Owner',completed:true,dependencies:[{task_id:'P',type:'finish_to_finish'}]}),
  task('ADDED',{parentId:'P',title:'新規追加',summary:'完全な追加Task evidence',due:'2026-10-24'}),
  task('RECUR',{title:'定例',repeat:'毎週',due:'2026-10-23',recurrence_rule:{type:'weekly',weekdays:[5]},recurrence_schedule_date:'2026-10-23'})
]);

async function boot(page,snapshots=[beforeSnapshot(),afterSnapshot()]){
  await installFsAccessMock(page);await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await expect(page).toHaveTitle(`ASANYA v${CURRENT_PRODUCT_VERSION}`);expect(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)).toBe(CURRENT_SCHEMA_VERSION_TARGET);
  await page.evaluate(async snapshots=>{const root={schema_version:'3.2',workspace_info_markdown:'',items:[{id:'LIVE',parentId:'',state:'',impact_level:0,title:'Live',owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1}],snapshots},text=JSON.stringify(root),handle=__fsMock.create('primary',{name:'primary.json',text,writePermission:'granted'}),file=await handle.getFile();await applyJsonObject(root,'pbl047',file.name,handle,{remember:false,writePermissionGranted:true,fileText:text,fileModified:file.lastModified,fileSize:file.size});clearUndoHistory('pbl047');dirty=false;refreshDbStatus()},snapshots);
}
async function compare(page){
  await page.locator('#snapshotCompareBtn').click();
  await page.locator('input[name="snapshotCompareTarget"][value="before"]').check();
  await page.locator('input[name="snapshotCompareTarget"][value="after"]').check();
  await page.locator('.snapshotComparisonDialog [data-action="accept"]').click();
  await expect(page.locator('#snapshotOutputDrawer')).toHaveClass(/open/);
}
async function downloadAnalysis(page){
  const event=page.waitForEvent('download');
  await page.locator('#snapshotOutputSaveAnalysis').click();
  const download=await event,pathName=await download.path();
  return{filename:download.suggestedFilename(),text:fs.readFileSync(pathName,'utf8')};
}
function expectedMarkdown(diff){return MARKDOWN_PREFIX+CANONICAL_INSTRUCTION+DIFF_SEPARATOR+JSON.stringify(diff,null,2)+MARKDOWN_SUFFIX}
function jsonFromMarkdown(markdown){const match=markdown.match(/# Semantic Diff\n\n```json\n([\s\S]*?)\n```\n$/);if(!match)throw new Error('Semantic Diff JSON fence is missing');return JSON.parse(match[1])}

test.beforeEach(async({page})=>boot(page));

test('PBL047-F1 action is available in the existing comparison drawer without replacing PBL-042 controls',async({page})=>{
  await compare(page);await expect(page.locator('#snapshotOutputSaveAnalysis')).toBeVisible();await expect(page.locator('#snapshotOutputSaveAnalysis')).toHaveText('AI分析用ファイルを保存');for(const selector of['#snapshotOutputAiTab','#snapshotOutputJsonTab','#snapshotOutputAi','#snapshotOutputJson','#snapshotOutputReset','#snapshotOutputCopy','#snapshotOutputClose'])expect(await page.locator(selector).count(),selector).toBe(1);
});

test('PBL047-F2/F3/F4/F5/F6 one download contains exact canonical instruction then the complete parseable Semantic Diff',async({page})=>{
  await compare(page);const diff=await page.evaluate(()=>structuredClone(snapshotComparisonState.semanticDiff));expect(await page.evaluate(()=>SEMANTIC_DIFF_AI_ANALYSIS_INSTRUCTION)).toBe(CANONICAL_INSTRUCTION);const downloaded=await downloadAnalysis(page);expect(downloaded.filename).toBe('asanya_diff_2026-10-16_2026-10-23.md');expect(downloaded.text.length).toBeGreaterThan(CANONICAL_INSTRUCTION.length);expect(downloaded.text).toBe(expectedMarkdown(diff));expect(jsonFromMarkdown(downloaded.text)).toEqual(diff);expect(downloaded.text.indexOf(CANONICAL_INSTRUCTION)).toBeLessThan(downloaded.text.indexOf('# Semantic Diff'));expect(diff.summary).toEqual({total_tasks:5,added:1,deleted:1,changed:3,unchanged:0});expect(diff.tasks.map(entry=>entry.change_type)).toEqual(['added','changed','deleted','changed','changed']);expect(downloaded.text).toContain('省略してはいけない2行目');expect(downloaded.text).toContain('dependency_type_changed');
});

test('PBL047-F7 download does not mutate Tasks, Snapshots, Diff, persistence, dirty, or Undo/Redo',async({page})=>{
  await compare(page);const before=await page.evaluate(()=>({data:JSON.stringify(data),diff:JSON.stringify(snapshotComparisonState.semanticDiff),dirty,undo:JSON.stringify(undoStack),redo:JSON.stringify(redoStack),writes:__fsMock.snapshot('primary').writeCount,text:__fsMock.snapshot('primary').text}));await downloadAnalysis(page);await expect(page.locator('#snapshotOutputDrawer')).toHaveClass(/open/);expect(await page.evaluate(()=>({data:JSON.stringify(data),diff:JSON.stringify(snapshotComparisonState.semanticDiff),dirty,undo:JSON.stringify(undoStack),redo:JSON.stringify(redoStack),writes:__fsMock.snapshot('primary').writeCount,text:__fsMock.snapshot('primary').text}))).toEqual(before);
});

test('PBL047-F8 edited AI/JSON buffers and copy semantics remain intact while export uses canonical generated Diff',async({page})=>{
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>{window.__copied=text;return Promise.resolve()}}}));await compare(page);const originalDiff=await page.evaluate(()=>structuredClone(snapshotComparisonState.semanticDiff)),ai=page.locator('#snapshotOutputAi'),json=page.locator('#snapshotOutputJson');await ai.fill('user edited AI');await page.locator('#snapshotOutputCopy').click();expect(await page.evaluate(()=>window.__copied)).toBe('user edited AI');await page.locator('#snapshotOutputJsonTab').click();await json.fill('{"user":"edited JSON"}');await page.locator('#snapshotOutputCopy').click();expect(await page.evaluate(()=>window.__copied)).toBe('{"user":"edited JSON"}');const downloaded=await downloadAnalysis(page);expect(jsonFromMarkdown(downloaded.text)).toEqual(originalDiff);await expect(ai).toHaveValue('user edited AI');await expect(json).toHaveValue('{"user":"edited JSON"}');
});

test('PBL047-F9 filename remains deterministic and Windows-safe across years',async({page})=>{
  await boot(page,[beforeSnapshot('2026-12-31T23:30:00.000Z'),afterSnapshot('2027-01-01T00:30:00.000Z')]);await compare(page);const first=await downloadAnalysis(page);expect(first.filename).toBe('asanya_diff_2026-12-31_2027-01-01.md');expect(first.filename).toMatch(/^[A-Za-z0-9_.-]+\.md$/);await page.locator('#snapshotOutputClose').click();await compare(page);const second=await downloadAnalysis(page);expect(second.filename).toBe(first.filename);
});

test('PBL047-F10 repeated download creates fresh URLs, revokes each, and preserves identical output',async({page})=>{
  await compare(page);await page.evaluate(()=>{const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.__pbl047Urls={created:[],revoked:[]};URL.createObjectURL=blob=>{const url=create(blob);window.__pbl047Urls.created.push(url);return url};URL.revokeObjectURL=url=>{window.__pbl047Urls.revoked.push(url);revoke(url)}});const first=await downloadAnalysis(page),second=await downloadAnalysis(page);expect(second).toEqual(first);await expect.poll(()=>page.evaluate(()=>window.__pbl047Urls)).toEqual(expect.objectContaining({created:expect.any(Array),revoked:expect.any(Array)}));const urls=await page.evaluate(()=>window.__pbl047Urls);expect(urls.created).toHaveLength(2);expect(new Set(urls.created).size).toBe(2);expect(urls.revoked).toEqual(urls.created);
});
