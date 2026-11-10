const {test,expect}=require('playwright/test');
const {APP,TARGET_PRODUCT_VERSION,TARGET_SCHEMA_VERSION}=require('./helpers/app-target');

const task=(id,parentId='',sortOrder=1000,extra={})=>({id,parentId,title:id,state:'未着手',owner:'',due:'2026-10-25',planned_duration_days:2,summary:'',repeat:'',completed:false,dependencies:[],sortOrder,impact_level:1,...extra});

async function boot(page,displayMode='todo-tree',items=[task('ROOT'),task('CHILD','ROOT',2000),task('OTHER','',3000)]){
  await page.setViewportSize({width:1280,height:760});
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(({items,displayMode})=>{applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items,snapshots:[]},'pbl048','pbl048.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode(displayMode);clearUndoHistory('pbl048');dirty=false},{items,displayMode});
  await page.locator('#helpTrigger').click();
}

async function sectionText(page,key){await page.locator(`[data-help-nav="${key}"]`).click();return page.locator(`[data-help-section="${key}"]`).innerText()}

test('PBL048-IDENTITY-01 explicit target is current v3.2.3 / Schema 3.2',async({page})=>{
  expect(TARGET_PRODUCT_VERSION,'ASANYA_TEST_PRODUCT_VERSION must explicitly identify the current formal artifact').toBe('3.2.3');
  expect(TARGET_SCHEMA_VERSION,'ASANYA_TEST_SCHEMA_VERSION must explicitly identify the current candidate').toBe('3.2');
  await page.goto(APP);
  await expect(page).toHaveTitle('ASANYA v'+TARGET_PRODUCT_VERSION);
  await expect(page.locator('body>h1')).toContainText('ASANYA v'+TARGET_PRODUCT_VERSION);
  await expect(page.locator('#schemaMeta')).toHaveText('schema_version '+TARGET_SCHEMA_VERSION);
  expect(await page.evaluate(()=>({title:APP_TITLE,schema:CURRENT_SCHEMA_VERSION,snapshot:buildManualSnapshot('2026-10-25T00:00:00.000Z').product_version}))).toEqual({title:'ASANYA v3.2.3',schema:'3.2',snapshot:'3.2.3'});
});

test('PBL048-HELP-01 Snapshot, Semantic Diff, editable display and canonical AI file are clearly distinguished',async({page})=>{
  await boot(page);const snapshot=await sectionText(page,'diff');
  for(const text of ['作成時点のタスク状態','作成後の変更には追従しません','各DBに最大5件','保存済みSnapshotを2件','保存時刻の古い方','新しい方をAfter','読取専用','タスクや保存済みSnapshotは変更しません','タスクIDを基準','追加・削除・状態','階層','期限／計画／実績','依存関係','繰返し','AI分析用Markdownを使う','AI分析用ファイルを保存','ASANYAの分析指示','完全なSemantic Diff','画面上の編集内容はファイルには入りません','画面からコピーしてください','保存したMarkdown','CopilotなどのAIサービス'])expect(snapshot).toContain(text);
  for(const text of ['Snapshotを作る','2つのSnapshotを比べる','AI分析用Markdownを使う','CopilotなどのAIサービス','保存したMarkdown','会話に添付'])expect(snapshot).toContain(text);
  for(const text of ['Dueが後ろへ動いただけでは','実質的な期限延期','期限超過','Humanへの確認','意味が未解決','After Snapshot時点','Snapshot作成時のタイムゾーン','期限の延期'])expect(snapshot).not.toContain(text);
  expect(snapshot).not.toContain('export元');
});

test('PBL048-HELP-08 Task creation Help starts with the real top-row workflow and preserves editing and hierarchy guidance',async({page})=>{
  await boot(page);const text=await sectionText(page,'task');expect(text.indexOf('新しいタスクを追加する')).toBeLessThan(text.indexOf('既存のタスクを編集する'));for(const phrase of ['一覧の一番上','ここに書くと新規追加','タイトルを入力','Enterを押すと期限欄へ移動','入力行の外へ移動すると登録','期限欄でEnter','登録用の別ボタンや確認画面はありません','既存のタスクを編集する','入力を確定すると画面に反映','親にするタスクの「＋」','1つ下の階層に追加','親を共有する別のタスク','子タスクの下にさらに子'])expect(text).toContain(phrase);
});

test('PBL048-HELP-02 external update explains stale display, no presence/merge/reload, and local-edit protection',async({page})=>{
  await boot(page);const common=await sectionText(page,'data');
  for(const text of ['DB読込','既存のJSON DB','新しいDBを始める','アクセス許可が必要','未保存の変更がある状態で別のDBへ切り替える'])expect(common).toContain(text);
  for(const text of ['前回読み込んだ後','元のDBファイルが変わった','他の人が現在入力中','示すものではありません','最新状態より古い可能性','自動では統合されず','勝手に再読込もしません','競合した未保存変更','元のファイルへ自動保存されません','最新の状態に更新','元のDBファイルを読み直します','未保存の変更や編集中の入力','破棄する前に確認','キャンセルすれば現在の内容と通知は残ります','この画面の未保存内容を破棄'])expect(common).toContain(text);
  expect(common).not.toContain('localの未保存内容');
});

test('PBL048-HELP-03 unified Help keeps detailed Memo semantics in the Project section',async({page})=>{
  await boot(page,'todo-tree');const taskHelp=await sectionText(page,'task'),todo=await sectionText(page,'todo'),project=await sectionText(page,'project');expect(taskHelp).not.toContain('「メモ」はProject階層');expect(todo).not.toContain('「メモ」はProject階層');
  for(const text of ['Project階層','参考情報や見出し','現在の作業対象として扱わない','Projectには表示','ToDoには表示されず','未終了件数','期限超過','情報は保持・表示','親子の日程集計','計画上の矛盾判定','依存関係の前工程／後工程','繰返しには設定できません','通常タスクの子孫','子を持てます','配下もメモ','メモの下に通常タスクを追加・移動'])expect(project).toContain(text);
  expect(project).not.toContain('activeな作業対象');
});

test('PBL048-HELP-04 recurrence keeps Due/schedule/catch-up guidance and adds same-record checklist rollover',async({page})=>{
  await boot(page);const common=await sectionText(page,'todo');
  for(const text of ['今回の期限だけを変更','次回以降の繰返し予定は移動しません','今日以降の最初の予定','別の新規タスクを作るのではなく','同じタスクと配下のチェックリスト','未終了・状態未設定','実績開始日・終了日は消去','今回の繰返し予定から次回予定までの日数分','期限なしのまま','タイトル・概要・担当・計画日数・階層','チェックリスト内の依存関係は保持','階層の内外をまたぐ依存関係','入れ子の繰返しは設定できません'])expect(common).toContain(text);
});

test('PBL048-RELEVANT-01 current candidate keeps recurring checklist rollover semantics described by Help',async({page})=>{
  const items=[
    task('R','',1000,{due:'2026-10-31',repeat:'毎月',recurrence_rule:{type:'monthly',mode:'date',day:31},recurrence_schedule_date:'2026-10-31',completed:true,state:'完了',actual_start:'2026-10-01'}),
    task('C','R',2000,{due:'2026-11-02',completed:true,state:'完了',actual_end:'2026-10-20'}),
    task('G','C',3000,{due:'',completed:true,state:'完了',actual_start:'2026-10-10',dependencies:[{task_id:'C',type:'finish_to_start'}]})
  ];
  await boot(page,'todo-tree',items);await page.keyboard.press('Escape');
  const result=await page.evaluate(()=>{const beforeIds=data.items.map(task=>task.id);const ok=rolloverRecurringTask(itemById('R'));return{ok,beforeIds,afterIds:data.items.map(task=>task.id),root:itemById('R'),child:itemById('C'),grand:itemById('G')}});
  expect(result.ok).toBe(true);expect(result.afterIds).toEqual(result.beforeIds);
  expect(result.root).toMatchObject({due:'2026-11-30',recurrence_schedule_date:'2026-11-30',completed:false,state:''});
  expect(result.child).toMatchObject({due:'2026-12-02',completed:false,state:''});
  expect(result.grand).toMatchObject({due:'',completed:false,state:'',dependencies:[{task_id:'C',type:'finish_to_start'}]});
  for(const item of [result.root,result.child,result.grand]){expect(item.actual_start).toBeUndefined();expect(item.actual_end).toBeUndefined()}
});

test('PBL048-HELP-05 unified Help keeps hierarchy collapse guidance in both labeled sections',async({page})=>{
  await boot(page,'todo-tree');const todo=await sectionText(page,'todo'),project=await sectionText(page,'project');expect(todo).toContain('▶ / ▼');expect(todo).toContain('展開／折りたたみ');expect(project).toContain('▶ / ▼');expect(project).toContain('親タスクの子・孫タスクを展開／折りたたみ');
});

test('PBL048-HELP-06 all four view modes render the same landing, category navigation and selected Help content',async({page})=>{
  let expected='';for(const mode of ['todo-tree','todo-date','project-detail','project-simple']){await boot(page,mode);expect(await page.locator('#helpNav [data-help-nav]').evaluateAll(nodes=>nodes.map(node=>node.textContent))).toEqual(['タスクを追加・編集する','ToDoモードで使う','Projectモードで使う','変化をAIで分析する','案件をAIで探索する','データを保存する','ショートカット']);const landing=await page.locator('[data-help-landing="true"]').innerText();if(!expected)expected=landing;else expect(landing).toBe(expected);await page.locator('[data-help-target="diff"]').click();expect(await page.locator('[data-help-section="diff"]').innerText()).toContain('AI分析用Markdown');await expect(page.locator('[data-help-nav="diff"]')).toHaveAttribute('aria-current','page')}
});

test('PBL048-HELP-07 Copilot Help matches prompt generation and does not claim ASANYA performs searches',async({page})=>{
  await boot(page);const text=await sectionText(page,'copilot');for(const phrase of ['画面右端に縦向き','「Copilot」タブをクリック','Copilotサイドバーを開きます','タスク行をクリック','「選択タスク」にタイトル','期限・担当・状態・概要','検索キーワードを入力・調整','出力目的','検索対象','回答の長さ','自由指示','自動で更新','コピーアイコン','指示文をコピーしてCopilotへ貼り付けます','ASANYA内で資料検索は行いません'])expect(text).toContain(phrase);expect(text.indexOf('画面右端に縦向き')).toBeLessThan(text.indexOf('タスク行をクリック'));
});

test('PBL048-STACK-01 Copilot header close remains unobscured while its sidebar is open',async({page})=>{
  await boot(page);await page.keyboard.press('Escape');await page.evaluate(()=>selectTask('ROOT'));await page.locator('#copilotTab').click();const panel=page.locator('#copilotPanel'),close=panel.locator('.cpHead button');await expect(panel).toHaveClass(/open/);await expect(close).toBeVisible();await expect(close).toBeInViewport();await expect(page.locator('#cpTitle')).toHaveText('ROOT');
  const stacking=await page.evaluate(()=>{const panel=document.getElementById('copilotPanel'),help=document.getElementById('helpTrigger'),tab=document.getElementById('copilotTab'),close=panel.querySelector('.cpHead button'),r=close.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{helpZ:Number(getComputedStyle(help).zIndex),panelZ:Number(getComputedStyle(panel).zIndex),tabZ:Number(getComputedStyle(tab).zIndex),closeReceivesPointer:hit===close||close.contains(hit),hit:hit?.id||hit?.className||hit?.tagName}});expect(stacking).toMatchObject({helpZ:1180,panelZ:1190,tabZ:1200});expect(stacking.closeReceivesPointer,JSON.stringify(stacking)).toBe(true);
  await page.locator('#cpQuery').fill('予算確認');await expect(page.locator('#cpQuery')).toHaveValue('予算確認');await page.locator('input[name="cpIntent"][value="summary"]').check();await expect(page.locator('input[name="cpIntent"][value="summary"]')).toBeChecked();await close.click();await expect(panel).not.toHaveClass(/open/);await page.locator('#helpTrigger').click();await expect(page.locator('#helpPopover')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#helpPopover')).toBeHidden();
});

test('PBL048-SHORTCUT-01 Help and persistent guide synchronize Undo, Redo and task navigation without reviving Alt+M/I',async({page})=>{
  await boot(page);const help=await sectionText(page,'shortcuts'),guide=await page.locator('#shortcutHelp').innerText();
  for(const text of ['T','ToDo ツリー順','(ToDo時) 1 / 2','ツリー順 / 日付順 切替','P','Project 詳細','(Project時) 1 / 2','詳細表示 / 簡易表示 切替','Ctrl+Z','Ctrl+Y / Ctrl+Shift+Z','↑ / ↓','元に戻す（Undo）','やり直す（Redo）','前後のタスクへ移動'])expect(help).toContain(text);
  for(const text of ['T＝ToDo ツリー順','(ToDo時) 1/2＝ツリー順 / 日付順 切替','P＝Project 詳細','(Project時) 1/2＝詳細表示 / 簡易表示 切替','Ctrl+Z＝元に戻す','Ctrl+Y/Ctrl+Shift+Z＝やり直す','↑/↓＝前後のタスクへ移動'])expect(guide).toContain(text);
  for(const obsolete of ['ToDo時 1 / 2','Project時 1 / 2'])expect(help).not.toContain(obsolete);
  for(const obsolete of ['ToDo時 1/2＝','Project時 1/2＝'])expect(guide).not.toContain(obsolete);
  for(const target of [help,guide])expect(target).not.toContain('family');
  for(const text of ['Alt+M','Alt+I']){expect(help).not.toContain(text);expect(guide).not.toContain(text)}
});

test('PBL048-SCOPE-01 Help does not claim deferred or unreleased features',async({page})=>{
  await boot(page,'project-detail');let help='';for(const key of await page.locator('#helpNav [data-help-nav]').evaluateAll(nodes=>nodes.map(node=>node.dataset.helpNav))){await page.locator(`[data-help-nav="${key}"]`).click();help+=await page.locator(`[data-help-section="${key}"]`).innerText()}
  for(const text of ['クリティカルパス','依存線を表示','自動スケジューリング','Impact Level 0','兄弟タスクをドラッグ','概要編集欄を横へ移動'])expect(help).not.toContain(text);
});
