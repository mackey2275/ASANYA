const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');
const task=(id,title=id,extra={})=>({id,parentId:'',state:'',impact:'',title,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
async function boot(page,items){await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(items=>applyJsonObject({schema_version:'1.8',items},'test','ux.json',null,{remember:false,writePermissionGranted:false}),items);await page.locator('#mTeam').click()}
async function gantt(page){await expect(page.locator('#ganttView')).toBeVisible()}

test('GANTT-SELECTION-01: 最後に操作した行を再描画なしで選択しeditorとInsertを維持',async({page})=>{
  await boot(page,[task('A','parent A',{due:'2026-08-10',planned_duration_days:1}),task('B','parent B',{due:'2026-08-20',planned_duration_days:2,sortOrder:2000})]);await gantt(page);
  await page.locator('.ganttRow[data-task-id="A"] .ganttTaskName').click({position:{x:5,y:5}});
  await page.locator('.ganttRow[data-task-id="B"] .ganttPlanned').click();
  await expect(page.locator('.ganttRow[data-task-id="B"] .ganttPlanned input')).toBeFocused();
  expect(await page.evaluate(()=>selectedTaskId)).toBe('B');
  await page.keyboard.press('Escape');await page.keyboard.press('Insert');
  expect(await page.evaluate(()=>itemById(draftTaskId).parentId)).toBe('B');
});

test('GANTT-HIERARCHY-VISUAL-01: Projectは従来prefix、title不変、子barは8px、子背景を表示',async({page})=>{
  await boot(page,[task('P','Parent',{due:'2026-08-20',planned_duration_days:10}),task('C','Child',{parentId:'P',due:'2026-08-15',planned_duration_days:3}),task('G','Grand',{parentId:'C',due:'2026-08-12',planned_duration_days:2})]);
  expect(await page.locator('#row_C .childMark')).toHaveText('└');expect(await page.locator('#row_G .childMark').first()).toHaveText('└');
  expect(await page.evaluate(()=>data.items.map(x=>x.title))).toEqual(['Parent','Child','Grand']);await gantt(page);
  expect(await page.locator('.ganttRow[data-task-id="C"] .childMark')).toHaveText('└');expect(await page.locator('.ganttRow[data-task-id="G"] .childMark')).toHaveText('└');
  const heights=await page.evaluate(()=>['P','C','G'].map(id=>getComputedStyle(document.querySelector(`.ganttRow[data-task-id="${id}"] .ganttBar`)).height));expect(heights).toEqual(['16px','8px','8px']);
  await expect(page.locator('.ganttRow[data-task-id="P"]')).not.toHaveClass(/ganttDescendant/);await expect(page.locator('.ganttRow[data-task-id="C"]')).toHaveClass(/ganttDescendant/);
});

test('GANTT-PLAN-STATE-01: 保留は紫の中実、中止は灰色の中空、summaryは点線',async({page})=>{
  await boot(page,[task('P','summary parent'),task('H','hold',{parentId:'P',state:'保留',due:'2026-08-10',planned_duration_days:2}),task('X','cancel',{state:'中止',due:'2026-08-12',planned_duration_days:2,sortOrder:3000})]);await gantt(page);
  const style=await page.evaluate(()=>{const h=getComputedStyle(document.querySelector('.ganttRow[data-task-id="H"] .ganttBar')),x=getComputedStyle(document.querySelector('.ganttRow[data-task-id="X"] .ganttBar'));return{holdBg:h.backgroundColor,cancelBg:x.backgroundColor,cancelBorder:x.borderColor,summary:document.querySelector('.ganttRow[data-task-id="P"] .ganttBar')?.className}});
  expect(style.holdBg).not.toBe('rgba(0, 0, 0, 0)');expect(style.cancelBg).toBe('rgba(0, 0, 0, 0)');expect(style.summary).toContain('summary');
});

test('STATUS-GUARD-01: 完了実績を保持して確認し、nonblankからblankを禁止',async({page})=>{
  await boot(page,[task('D','done',{state:'完了',actual_start:'2026-08-01',actual_end:'2026-08-02',actual_start_source:'user',actual_end_source:'user'})]);
  await page.evaluate(()=>{window.__confirmCalls=0;window.confirm=()=>{window.__confirmCalls++;return false};changeState(0,'進行中')});
  expect(await page.evaluate(()=>({state:itemById('D').state,end:itemById('D').actual_end,calls:window.__confirmCalls}))).toEqual({state:'完了',end:'2026-08-02',calls:1});
  await page.evaluate(()=>{window.confirm=()=>true;changeState(0,'進行中')});
  expect(await page.evaluate(()=>({state:itemById('D').state,end:itemById('D').actual_end,source:itemById('D').actual_end_source}))).toEqual({state:'進行中',end:'2026-08-02',source:'user'});
  await page.evaluate(()=>changeState(0,''));
  expect(await page.evaluate(()=>itemById('D').state)).toBe('進行中');
});

test('SEARCH-GANTT-01: 検索結果からGantt行を選択・縦移動・planへ横移動・一時強調',async({page})=>{
  const items=[];for(let i=0;i<18;i++)items.push(task('T'+i,'Task '+i,{due:`2026-12-${String(i+1).padStart(2,'0')}`,planned_duration_days:2,sortOrder:(i+1)*1000}));await boot(page,items);await gantt(page);
  await page.locator('#taskSearchBtn').click();await page.locator('#taskSearchInput').fill('Task 17');await page.locator('.taskSearchResult').click();
  const target=page.locator('.ganttRow[data-task-id="T17"]');await expect(target).toHaveClass(/ganttSelected/);await expect(target).toHaveClass(/searchAttention/);expect(await page.evaluate(()=>selectedTaskId)).toBe('T17');await page.waitForTimeout(3000);await expect(target).toHaveClass(/searchAttention/);await page.locator('.ganttRow[data-task-id="T0"] .ganttTaskName').click({position:{x:5,y:5}});await expect(target).not.toHaveClass(/searchAttention/);
});

test('HIERARCHY-MODE-01: ToDo日付順だけ－/－－、ツリー順とProjectは従来表示',async({page})=>{
  await boot(page,[task('P','Parent'),task('C','Child',{parentId:'P'}),task('G','Grand',{parentId:'C'}),task('GG','Great',{parentId:'G'})]);await page.locator('#mPersonal').click();await page.locator('#sDate').click();
  expect(await page.locator('#row_P .dateHierarchyPrefix')).toHaveCount(0);expect(await page.locator('#row_C .dateHierarchyPrefix')).toHaveText('－');expect(await page.locator('#row_G .dateHierarchyPrefix')).toHaveText('－－');expect(await page.locator('#row_GG .dateHierarchyPrefix')).toHaveText('－－');
  expect(await page.evaluate(()=>data.items.map(x=>x.title))).toEqual(['Parent','Child','Grand','Great']);await page.locator('#sTree').click();expect(await page.locator('.dateHierarchyPrefix')).toHaveCount(0);expect(await page.locator('#row_G .childMark').first()).toHaveText('└');
  await page.locator('#mTeam').click();expect(await page.locator('.dateHierarchyPrefix')).toHaveCount(0);expect(await page.locator('#row_G .childMark').first()).toHaveText('└');
});

test('BACKGROUND-SELECTED-01: top-level通常・子灰色・selected水色を優先',async({page})=>{
  await boot(page,[task('P','Parent'),task('C','Child',{parentId:'P'}),task('L','Leaf',{sortOrder:3000})]);await gantt(page);
  const colors=await page.evaluate(()=>Object.fromEntries(['P','C','L'].map(id=>[id,getComputedStyle(document.querySelector(`.ganttRow[data-task-id="${id}"] .ganttLeftPane`)).backgroundColor])));expect(colors.P).toBe(colors.L);expect(colors.C).not.toBe(colors.P);
  await page.locator('.ganttRow[data-task-id="P"] .ganttTaskName').click({position:{x:5,y:5}});const selected=await page.locator('.ganttRow[data-task-id="P"] .ganttLeftPane').evaluate(e=>getComputedStyle(e).backgroundColor);expect(selected).not.toBe(colors.P);await page.locator('.ganttRow[data-task-id="C"] .ganttTaskName').click({position:{x:5,y:5}});await expect(page.locator('.ganttRow[data-task-id="C"]')).toHaveClass(/ganttSelected/);
});

test('ACTUAL-STATUS-GUARD-02: 完了中end clear禁止、解除後有効、進行中から未着手を確認',async({page})=>{
  await boot(page,[task('D','Done',{state:'完了',actual_start:'2026-08-01',actual_end:'2026-08-02',actual_start_source:'user',actual_end_source:'user'}),task('R','Running',{state:'進行中',actual_start:'2026-08-03',actual_start_source:'user',sortOrder:2000})]);await gantt(page);
  await expect(page.locator('.actualEditBtn')).toHaveCount(0);await page.evaluate(()=>openTaskDetailPane('D'));let end=page.locator('#taskDetailPane').getByRole('textbox',{name:'実績終了',exact:true});await end.fill('');await end.press('Enter');expect(await page.evaluate(()=>itemById('D').actual_end)).toBe('2026-08-02');await page.evaluate(()=>{window.confirm=()=>true;changeState(data.items.findIndex(x=>x.id==='D'),'進行中')});expect(await page.evaluate(()=>itemById('D').actual_end)).toBe('2026-08-02');end=page.locator('#taskDetailPane').getByRole('textbox',{name:'実績終了',exact:true});await end.fill('');await end.press('Enter');expect(await page.evaluate(()=>itemById('D').actual_end)).toBeUndefined();
  await page.evaluate(()=>{window.__ok=false;window.confirm=()=>window.__ok;changeState(data.items.findIndex(x=>x.id==='R'),'未着手')});expect(await page.evaluate(()=>itemById('R').state)).toBe('進行中');await page.evaluate(()=>{window.__ok=true;changeState(data.items.findIndex(x=>x.id==='R'),'未着手')});expect(await page.evaluate(()=>({state:itemById('R').state,start:itemById('R').actual_start,source:itemById('R').actual_start_source}))).toEqual({state:'未着手',start:'2026-08-03',source:'user'});
});

test('STATUS-OPTIONS-02: blank optionはblank taskだけList/Ganttに表示',async({page})=>{
  await boot(page,[task('B','Blank'),task('N','Started',{state:'未着手',sortOrder:2000})]);expect(await page.locator('#row_B select').first().locator('option[value=""]')).toHaveCount(1);expect(await page.locator('#row_N select').first().locator('option[value=""]')).toHaveCount(0);await page.locator('#row_B select').first().selectOption('未着手');expect(await page.locator('#row_B select').first().locator('option[value=""]')).toHaveCount(0);await gantt(page);expect(await page.locator('.ganttRow[data-task-id="B"] .ganttState option[value=""]')).toHaveCount(0);expect(await page.locator('.ganttRow[data-task-id="N"] .ganttState option[value=""]')).toHaveCount(0);
});

test('GANTT-COMPACT-02: rowとstatusをコンパクトに保ちbar/actualをclipしない',async({page})=>{
  await boot(page,[task('P','Parent',{state:'進行中',due:'2026-08-20',planned_duration_days:5,actual_start:'2026-08-01'}),task('C','Child',{parentId:'P',state:'進行中',due:'2026-08-15',planned_duration_days:2,actual_start:'2026-08-02'})]);await gantt(page);const sizes=await page.evaluate(()=>{const row=document.querySelector('.ganttRow[data-task-id="P"]'),select=row.querySelector('.ganttState select'),bar=row.querySelector('.ganttBar'),actual=row.querySelector('.actualLine');return{row:row.getBoundingClientRect().height,select:select.getBoundingClientRect().height,bar:bar.getBoundingClientRect(),actual:actual.getBoundingClientRect(),clip:row.querySelector('.ganttTimelineClip').getBoundingClientRect()}});expect(sizes.row).toBeLessThanOrEqual(29);expect(sizes.select).toBeLessThanOrEqual(21);expect(sizes.bar.top).toBeGreaterThanOrEqual(sizes.clip.top);expect(sizes.actual.bottom).toBeLessThanOrEqual(sizes.clip.bottom+1);
});

test('TODO-DATE-SORT-01: 新規期限確定後に移動先へ追従・選択・attentionを維持',async({page})=>{
  await boot(page,[task('late','Late',{due:'2026-08-30'}),task('later','Later',{due:'2026-09-01',sortOrder:2000})]);await page.locator('#mPersonal').click();await page.locator('#sDate').click();await page.locator('#b_title').first().fill('New early');await page.locator('#b_title').first().press('Enter');await page.locator('#b_due').fill('2026-08-01');await page.locator('#b_due').press('Enter');const id=await page.evaluate(()=>selectedTaskId);expect(id).toMatch(/^t-/);await expect(page.locator('#row_'+id)).toHaveClass(/selectedRow/);await expect(page.locator('#row_'+id)).toHaveClass(/sortAttention/);await page.waitForTimeout(2000);await expect(page.locator('#row_'+id)).toHaveClass(/sortAttention/);await page.locator('#row_late .titleText').click();await expect(page.locator('#row_'+id)).not.toHaveClass(/sortAttention/);
});

test('COMPOSITE-UX-01: selection・guard・search・sort・ToDo draftを同一sessionで分離',async({page})=>{
  await boot(page,[task('P','Parent',{due:'2026-08-20',planned_duration_days:5}),task('C','Child',{parentId:'P',due:'2026-08-15',planned_duration_days:2}),task('O','Other',{due:'2026-08-30',planned_duration_days:1,sortOrder:3000})]);await gantt(page);
  await page.locator('.ganttRow[data-task-id="C"] .ganttTaskName').click({position:{x:5,y:5}});await page.locator('.ganttRow[data-task-id="C"] .ganttState select').selectOption('進行中');expect(await page.evaluate(()=>itemById('C').actual_start)).toBeTruthy();const back=page.locator('.ganttRow[data-task-id="C"] .ganttState select').selectOption('未着手'),dialog=await page.waitForEvent('dialog');await dialog.dismiss();await back;expect(await page.evaluate(()=>itemById('C').state)).toBe('進行中');
  await page.locator('#taskSearchBtn').click();await page.locator('#taskSearchInput').fill('Other');await page.locator('.taskSearchResult').click();await expect(page.locator('.ganttRow[data-task-id="O"]')).toHaveClass(/searchAttention/);await page.locator('.ganttRow[data-task-id="O"] .ganttDue .dueTxt').click();const due=page.locator('.ganttRow[data-task-id="O"] .ganttDueText');await due.fill('2026-08-01');await due.press('Enter');
  await page.locator('#mPersonal').click();await page.locator('#sDate').click();await page.locator('#b_title').first().fill('Composite new');await page.locator('#b_title').first().press('Enter');await page.locator('#b_due').fill('2026-08-02');await page.locator('#b_due').press('Enter');const id=await page.evaluate(()=>selectedTaskId);await expect(page.locator('#row_'+id)).toHaveClass(/sortAttention/);await page.keyboard.press('Insert');expect(await page.evaluate(id=>({parent:itemById(draftTaskId)?.parentId,draft:!!draftTaskId,ime:imeCompositionTarget,search:searchAttentionTaskId}),id)).toEqual({parent:id,draft:true,ime:null,search:''});
});
