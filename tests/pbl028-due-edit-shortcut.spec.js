const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',state:'未着手',impact_level:0,title:id,owner:'',due:'2026-09-10',planned_duration_days:1,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});

async function boot(page,mode='personal'){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({items,mode})=>{applyJsonObject({schema_version:'2.5',workspace_info_markdown:'',items},'pbl028','pbl028.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);clearUndoHistory('pbl028');dirty=false;saveState='saved';selectTask('A')},{items:[task('A'),task('B',{due:'2026-09-20',sortOrder:2000})],mode});
}

const dueInput=(page,mode='personal')=>mode==='team'?page.locator('.ganttRow[data-task-id="A"] .ganttDueText'):page.locator('#row_A #d0');
async function pressShortcutKey(page,key){if(/^[\x20-\x7e]$/.test(key)){await page.keyboard.press(key);return}await page.evaluate(key=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})),key)}

test('PBL028-01 D→E opens the selected task normal Due editor without mutation',async({page})=>{
  await boot(page);const before=await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}));await page.keyboard.press('D');await page.keyboard.press('E');const input=dueInput(page);await expect(input).toBeVisible();await expect(input).toBeFocused();await expect(input).toHaveValue(await page.evaluate(()=>editDateText('2026-09-10')));expect(await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}))).toEqual(before);
});

test('PBL028-02 lowercase and full-width D/E variants share the same command',async({page})=>{
  for(const [d,e] of [['d','e'],['Ｄ','Ｅ'],['ｄ','ｅ']]){await boot(page);await pressShortcutKey(page,d);await pressShortcutKey(page,e);await expect(dueInput(page)).toBeFocused()}
});

test('PBL028-03 Project uses the existing unified Due editor',async({page})=>{
  await boot(page,'team');await page.keyboard.press('D');await page.keyboard.press('E');const input=dueInput(page,'team');await expect(input).toBeVisible();await expect(input).toBeFocused();await expect(input).toHaveValue(await page.evaluate(()=>editDateText('2026-09-10')));
});

test('PBL028-04 D→0/1/9 and full-width digit behavior remain unchanged',async({page})=>{
  for(const [d,n,days] of [['D','0',0],['d','1',1],['Ｄ','９',9]]){await boot(page);await pressShortcutKey(page,d);await pressShortcutKey(page,n);const input=dueInput(page);await expect(input).toBeFocused();await expect(input).toHaveValue(await page.evaluate(days=>editDateText(addDays(ymd(),days)),days));expect(await page.evaluate(()=>undoStack.length)).toBe(0)}
});

test('PBL028-05 F2 remains Title edit and Enter remains sibling draft creation',async({page})=>{
  await boot(page);await page.keyboard.press('F2');await expect(page.locator('#row_A .titleText')).toBeFocused();await page.locator('#row_A .titleText').press('Escape');await page.evaluate(()=>selectTask('A'));await page.keyboard.press('Enter');expect(await page.evaluate(()=>({draft:!!draftTaskId,kind:draftKind,parent:itemById(draftTaskId)?.parentId||''}))).toEqual({draft:true,kind:'same',parent:''});
});

test('PBL028-06 no selected task is a complete no-op',async({page})=>{
  await boot(page);await page.evaluate(()=>{selectedTaskId='';render()});const before=await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}));await page.keyboard.press('D');await page.keyboard.press('E');await expect(page.locator('#row_A .dateEdit:visible,#row_B .dateEdit:visible')).toHaveCount(0);expect(await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty,selected:selectedTaskId}))).toEqual({...before,selected:''});
});

test('PBL028-07 active input, textarea and contenteditable retain D/E typing ownership',async({page})=>{
  await boot(page);const title=page.locator('#row_A .titleText');await title.focus();await title.pressSequentially('DE');await expect(title).toContainText('DE');await expect(dueInput(page)).toBeHidden();await page.locator('#workspaceInfoPanel .workspaceInfoDisplay').click();const area=page.locator('#workspaceInfoEditor');await area.fill('DE');await expect(area).toHaveValue('DE');await expect(dueInput(page)).toBeHidden();await page.locator('#row_A .dueTxt').click();const input=dueInput(page);await input.fill('DE');await expect(input).toHaveValue('DE');await expect(input).toBeFocused();
});

test('PBL028-08 composition D/E-like events do not invoke the global command',async({page})=>{
  await boot(page);await page.locator('body').evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Ｄ',code:'KeyD',isComposing:true,keyCode:229,bubbles:true,cancelable:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Ｅ',code:'KeyE',isComposing:true,keyCode:229,bubbles:true,cancelable:true}))});await expect(dueInput(page)).toBeHidden();expect(await page.evaluate(()=>dateShortcutArmed)).toBe(false);await page.locator('body').dispatchEvent('compositionend',{data:'ＤＥ'});
});

test('PBL028-09 cancel/no-op preserves task, history and dirty state',async({page})=>{
  await boot(page);const before=await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}));await page.keyboard.press('D');await page.keyboard.press('E');await dueInput(page).press('Escape');expect(await page.evaluate(()=>({json:JSON.stringify(data.items),undo:undoStack.length,dirty}))).toEqual(before);await expect(dueInput(page)).toBeHidden();
});

test('PBL028-10 commit uses existing Due save and one Undo/Redo entry',async({page})=>{
  await boot(page);await page.keyboard.press('D');await page.keyboard.press('E');let input=dueInput(page);await input.fill('2026/9/25');await input.press('Enter');expect(await page.evaluate(()=>({due:itemById('A').due,undo:undoStack.length,dirty}))).toEqual({due:'2026-09-25',undo:1,dirty:true});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-09-10');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').due)).toBe('2026-09-25');
});
