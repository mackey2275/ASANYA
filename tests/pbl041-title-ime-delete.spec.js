const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',state:'未着手',impact_level:1,title:id,owner:'',due:'2026-09-10',planned_duration_days:1,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,...extra});

async function boot(page,mode='personal',extra={}){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(async({mode,item})=>{await applyJsonObject({schema_version:CURRENT_SCHEMA_VERSION,workspace_info_markdown:'',items:[item],...(CURRENT_SCHEMA_VERSION==='3.2'?{snapshots:[]}:{})},'pbl041','pbl041.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode(mode);selectTask('A');clearUndoHistory('pbl041');dirty=false},{mode,item:task('A',extra)});
}

const title=(page,mode)=>page.locator(mode==='team'?'.ganttRow[data-task-id="A"] .titleText':'#row_A .titleText');
const state=page=>page.evaluate(()=>{const x=itemById('A');return{completed:x.completed,state:x.state,actual_start:x.actual_start,actual_end:x.actual_end,undo:undoStack.length,redo:redoStack.length,count:data.items.length}});

test('PBL041-01 Delete outside editing preserves completion and reopen contract',async({page})=>{
  await boot(page);await page.keyboard.press('Delete');expect(await state(page)).toMatchObject({completed:true,undo:1,count:1});
  await page.keyboard.press('Delete');expect(await state(page)).toMatchObject({completed:false,undo:2,count:1});
});

test('PBL041-05 F2 title Enter/Escape and Undo/Redo remain unchanged',async({page})=>{
  await boot(page);await page.keyboard.press('F2');let editor=title(page,'personal');await editor.fill('変更後');await editor.press('Enter');expect(await page.evaluate(()=>itemById('A').title)).toBe('変更後');await page.keyboard.press('Control+z');expect(await page.evaluate(()=>itemById('A').title)).toBe('A');await page.keyboard.press('Control+y');expect(await page.evaluate(()=>itemById('A').title)).toBe('変更後');await page.keyboard.press('F2');editor=title(page,'personal');await editor.fill('取消値');await editor.press('Escape');expect(await page.evaluate(()=>itemById('A').title)).toBe('変更後');
});

test('PBL041-06 active title retains Search-key ownership',async({page})=>{
  await boot(page);const editor=title(page,'personal');await editor.focus();const before=await state(page);await page.keyboard.press('s');await expect(page.locator('#taskSearchPopup')).toBeHidden();expect(await state(page)).toEqual(before);
});

for(const [label,mode] of [['ToDo','personal'],['Project','team']]){
  test(`PBL041-02 ${label} ordinary title Delete remains text editing only`,async({page})=>{
    await boot(page,mode);const editor=title(page,mode);await editor.focus();await editor.evaluate(el=>{el.textContent='ABCDE';const selection=getSelection(),range=document.createRange();range.selectNodeContents(el);range.collapse(true);selection.removeAllRanges();selection.addRange(range)});const before=await state(page);await page.keyboard.press('Delete');expect(await state(page)).toEqual(before);await expect(editor).toHaveText('BCDE');
  });

  test(`PBL041-03 ${label} composition Delete remains local with normal IME signals`,async({page})=>{
    await boot(page,mode);const editor=title(page,mode);await editor.focus();await editor.dispatchEvent('compositionstart',{data:'日'});const result=await editor.evaluate(el=>{const ev=new KeyboardEvent('keydown',{key:'Delete',code:'Delete',keyCode:229,isComposing:true,bubbles:true,cancelable:true});el.dispatchEvent(ev);return{prevented:ev.defaultPrevented,active:imeCompositionTarget===el}});expect(result).toEqual({prevented:false,active:true});expect(await state(page)).toMatchObject({completed:false,undo:0,count:1});await editor.dispatchEvent('compositionend',{data:'日'});
  });

  test(`PBL041-04 ${label} explicit composition blocks mismatched-target Delete and cleans up`,async({page})=>{
    await boot(page,mode);const editor=title(page,mode);const guarded=await editor.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));const ev=new KeyboardEvent('keydown',{key:'Delete',code:'Delete',keyCode:46,isComposing:false,bubbles:true,cancelable:true});document.body.dispatchEvent(ev);return{prevented:ev.defaultPrevented,active:imeCompositionTarget===el}});expect(guarded).toEqual({prevented:false,active:true});expect(await state(page)).toMatchObject({completed:false,undo:0,count:1});
    await editor.dispatchEvent('compositionend',{data:''});expect(await page.evaluate(()=>imeCompositionTarget)).toBeNull();await page.keyboard.press('Delete');expect(await state(page)).toMatchObject({completed:true,undo:1,count:1});
  });
}
