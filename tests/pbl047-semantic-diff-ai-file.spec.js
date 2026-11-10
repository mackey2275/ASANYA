const {test,expect}=require('playwright/test');
const fs=require('node:fs');
const {installFsAccessMock}=require('./helpers/fs-access-mock');
const {APP,TARGET_PRODUCT_VERSION,TARGET_SCHEMA_VERSION}=require('./helpers/app-target');

const CURRENT_PRODUCT_VERSION=TARGET_PRODUCT_VERSION||'3.2.1';
const CURRENT_SCHEMA_VERSION_TARGET=TARGET_SCHEMA_VERSION||'3.2';
const MARKDOWN_PREFIX='# ASANYA Semantic Diff Analysis\n\n';
const REFERENCE_DATE='After Snapshot reference date: 2026-10-23 (derived from captured_at in the Markdown export environment\'s local timezone; the Snapshot creation timezone is not stored)\n\n';
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
  await expect(page).toHaveTitle(`ASANYA v${CURRENT_PRODUCT_VERSION}`);await expect(page.locator('#schemaMeta')).toContainText(CURRENT_SCHEMA_VERSION_TARGET);
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
function expectedMarkdown(diff,instruction){return MARKDOWN_PREFIX+REFERENCE_DATE+instruction+DIFF_SEPARATOR+JSON.stringify(diff,null,2)+MARKDOWN_SUFFIX}
function jsonFromMarkdown(markdown){const match=markdown.match(/# Semantic Diff\n\n```json\n([\s\S]*?)\n```\n$/);if(!match)throw new Error('Semantic Diff JSON fence is missing');return JSON.parse(match[1])}

test.beforeEach(async({page})=>boot(page));

test('PBL047-F1 action is available in the existing comparison drawer without replacing PBL-042 controls',async({page})=>{
  await compare(page);await expect(page.locator('#snapshotOutputSaveAnalysis')).toBeVisible();await expect(page.locator('#snapshotOutputSaveAnalysis')).toHaveText('AI分析用ファイルを保存');for(const selector of['#snapshotOutputAiTab','#snapshotOutputJsonTab','#snapshotOutputAi','#snapshotOutputJson','#snapshotOutputReset','#snapshotOutputCopy','#snapshotOutputClose'])expect(await page.locator(selector).count(),selector).toBe(1);
});

test('PBL047-F2/F3/F4/F5/F6 one download contains the current canonical instruction then the complete parseable Semantic Diff',async({page})=>{
  await compare(page);const diff=await page.evaluate(()=>structuredClone(snapshotComparisonState.semanticDiff)),instruction=await page.evaluate(()=>SEMANTIC_DIFF_AI_ANALYSIS_INSTRUCTION);expect(instruction).toContain('意味未解決');expect(instruction).toContain('After Snapshot');const downloaded=await downloadAnalysis(page);expect(downloaded.filename).toBe('asanya_diff_2026-10-16_2026-10-23.md');expect(downloaded.text.length).toBeGreaterThan(instruction.length);expect(downloaded.text).toBe(expectedMarkdown(diff,instruction));expect(jsonFromMarkdown(downloaded.text)).toEqual(diff);expect(downloaded.text.indexOf(instruction)).toBeLessThan(downloaded.text.indexOf('# Semantic Diff'));expect(diff.summary).toEqual({total_tasks:5,added:1,deleted:1,changed:3,unchanged:0});expect(diff.tasks.map(entry=>entry.change_type)).toEqual(['added','changed','deleted','changed','changed']);expect(downloaded.text).toContain('省略してはいけない2行目');expect(downloaded.text).toContain('dependency_type_changed');
});

test('PBL047-F11 analysis instruction retains seven sections and separates supported Due meaning, overdue, and Human questions',async({page})=>{const instruction=await page.evaluate(()=>SEMANTIC_DIFF_AI_ANALYSIS_INSTRUCTION);for(const heading of['## 1. 全体サマリー','## 2. 完了した仕事','## 3. 新規流入','## 4. 優先度の変化','## 5. 実質延期候補','## 6. 定例ロール','## 7. Humanに確認したい点'])expect(instruction).toContain(heading);for(const phrase of['実質的な期限延期','実行予定・作業日程の変更','親TaskのFocus日更新','通常のRecurring roll','その他、意味を特定できる日付変更','意味未解決','planned_start_changed','親子Dueが同時に動いたことだけではFocus日更新とせず','After Snapshotに存在する全Task','unchanged Task','変更のないDueも時間経過で期限超過','後ろへ動いたDueも期限超過が続く','completed === true','state === \'中止\'','参照日がUnavailable','意味未解決だけを理由に質問してはいけません','回答によって分析または次の判断・行動が実質的に変わる場合に限り','低影響または運用上重要でない未解決変更は、質問せず'])expect(instruction).toContain(phrase);expect((instruction.match(/^## \d\./gm)||[])).toHaveLength(7)});

test('PBL047-F12 reference date uses local calendar date and invalid timestamp never falls back to today',async({page})=>{const result=await page.evaluate(()=>({boundary:snapshotAnalysisReferenceDate({comparison:{after:{captured_at:'2026-10-22T15:30:00.000Z'}}}),missing:snapshotAnalysisReferenceDate({comparison:{after:{}}}),invalid:snapshotAnalysisReferenceDate({comparison:{after:{captured_at:'invalid'}}})}));expect(result.boundary).toContain('2026-10-23');expect(result.missing).toContain('Unavailable');expect(result.invalid).toContain('Unavailable');expect(result.missing).not.toMatch(/2026-\d\d-\d\d/)});

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
