const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,parentId='',sortOrder=1000)=>({id,parentId,title:id,state:'未着手',owner:'',due:'',planned_duration_days:null,summary:`summary-${id}`,repeat:'',completed:false,dependencies:[],sortOrder,impact_level:2});
async function boot(page,items,mode='personal'){
  await page.setViewportSize({width:1280,height:720});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,mode})=>{applyJsonObject({schema_version:'2.5',workspace_info_markdown:'',items},'pbl026','pbl026.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);setSortMode('tree');clearUndoHistory('pbl026');dirty=false},{items,mode});
}
async function shortcutDraft(page,origin,key){await page.evaluate(id=>selectTask(id),origin);await page.locator('#mPersonal').focus();await page.keyboard.press(key);await expect.poll(()=>page.evaluate(()=>draftTaskId)).not.toBe('');return page.evaluate(()=>draftTaskId)}
async function titleStart(page,id){return page.locator(`#row_${id} .titleText`).evaluate(el=>el.getBoundingClientRect().left)}
async function commitPersonalDraft(page,id,title){const editor=page.locator(`#row_${id} .titleText`);await expect(editor).toBeFocused();await editor.fill(title);await editor.press('Enter');const due=page.locator(`#row_${id} .dateEdit input[type="text"]`);await expect(due).toBeFocused();await due.press('Enter');await expect.poll(()=>page.evaluate(()=>draftTaskId)).toBe('')}

test('PBL026-01 Enter sibling drafts align at root, child, and grandchild depth',async({page})=>{
  await boot(page,[task('ROOT'),task('CHILD','ROOT'),task('GRAND','CHILD')]);
  const measured={};for(const id of ['ROOT','CHILD','GRAND']){const expected=await titleStart(page,id),draft=await shortcutDraft(page,id,'Enter'),actual=await titleStart(page,draft);measured[id]={existing:expected,draft:actual};expect(Math.abs(actual-expected)).toBeLessThanOrEqual(1);expect(await page.evaluate(id=>itemById(id).parentId,draft)).toBe(await page.evaluate(id=>itemById(id).parentId,id));await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>draftTaskId)).toBe('')}console.log('PBL026_GEOMETRY',JSON.stringify(measured));
});

test('PBL026-02 Insert keeps existing child semantics and aligns at root and child origins',async({page})=>{
  await boot(page,[task('ROOT'),task('CHILD','ROOT')]);
  const measured={};for(const id of ['ROOT','CHILD']){const draft=await shortcutDraft(page,id,'Insert'),parent=await page.evaluate(id=>itemById(id).parentId,draft);expect(parent).toBe(id);const depthReference=id==='ROOT'?'CHILD':null,actual=await titleStart(page,draft);measured[id]={draft:actual};if(depthReference){measured[id].existing=await titleStart(page,depthReference);expect(Math.abs(actual-measured[id].existing)).toBeLessThanOrEqual(1)}else expect(await page.evaluate(id=>ancestorsOf(itemById(id)).length,draft)).toBe(2);await page.keyboard.press('Escape')}console.log('PBL026_INSERT_GEOMETRY',JSON.stringify(measured));
});

test('PBL026-03 Enter commit preserves parent and sibling tail sort placement',async({page})=>{
  await boot(page,[task('P'),task('A','P',1000),task('B','P',2000)]);const draft=await shortcutDraft(page,'A','Enter');expect(await page.evaluate(id=>({parent:itemById(id).parentId,order:itemById(id).sortOrder}),draft)).toEqual({parent:'P',order:3000});await commitPersonalDraft(page,draft,'NEW');expect(await page.evaluate(id=>({parent:itemById(id).parentId,order:itemById(id).sortOrder,title:itemById(id).title}),draft)).toEqual({parent:'P',order:3000,title:'NEW'});expect(await page.evaluate(()=>undoStack.length)).toBe(1)
});

test('PBL026-04 Insert commit, focus, typing, and Escape retain existing behavior',async({page})=>{
  await boot(page,[task('P')]);const draft=await shortcutDraft(page,'P','Insert');await expect(page.locator(`#row_${draft} .titleText`)).toBeFocused();await commitPersonalDraft(page,draft,'CHILD NEW');expect(await page.evaluate(id=>itemById(id).parentId,draft)).toBe('P');const cancelled=await shortcutDraft(page,draft,'Enter');await page.keyboard.press('Escape');expect(await page.evaluate(id=>itemById(id),cancelled)).toBeUndefined();expect(await page.evaluate(id=>data.items.filter(x=>x.id===id).length,cancelled)).toBe(0)
});

test('PBL026-05 Project task-add menu child action shares aligned placeholder geometry without changing columns',async({page})=>{
  await boot(page,[task('P'),task('C','P')],'team');const expected=await titleStart(page,'C');await page.locator('#row_P .taskAddBtn').click();await page.getByRole('menuitem',{name:'1つ下の階層に追加'}).click();const draft=await page.evaluate(()=>draftTaskId);expect(await page.evaluate(id=>itemById(id).parentId,draft)).toBe('P');expect(Math.abs(await titleStart(page,draft)-expected)).toBeLessThanOrEqual(1);expect(await page.evaluate(()=>({priority:PROJECT_COL_DEFAULTS.impact,title:PROJECT_COL_DEFAULTS.title,close:PROJECT_COL_DEFAULTS.done}))).toEqual({priority:56,title:424,close:31});await page.keyboard.press('Escape')
});

test('PBL026-06 PBL-023 terminology/semantics and PBL-024/025 selectors remain intact',async({page})=>{
  await boot(page,[task('A')]);await expect(page.locator('#vOpen')).toHaveText('未終了');await expect(page.locator('#head th').first()).toHaveText('終了');await page.evaluate(()=>changeState(0,'完了'));expect(await page.evaluate(()=>({state:itemById('A').state,completed:itemById('A').completed}))).toEqual({state:'完了',completed:false});await page.evaluate(()=>setMode('team'));await expect(page.locator('.ganttRow[data-task-id="A"] .sum')).toBeVisible();await expect(page.locator('.ganttRow[data-task-id="A"] .taskDetailOpenBtn')).toBeVisible();expect(await page.evaluate(()=>CURRENT_SCHEMA_VERSION)).toBe(APP.includes('pbl022')?'3.0':'2.5')
});
