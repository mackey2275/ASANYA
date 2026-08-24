const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,due,sortOrder,parentId='')=>({id,parentId,state:'未着手',impact:'',title:id,owner:'',due,planned_duration_days:1,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder});

async function boot(page,{sortMove=false}={}){
  await page.setViewportSize({width:1280,height:600});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({sortMove})=>{const xs=[];for(let i=0;i<80;i++)xs.push(taskForTest(`R${i}`,addDays(ymd(),i-40),(i+1)*1000));function taskForTest(id,due,sortOrder,parentId=''){return{id,parentId,state:'未着手',impact:'',title:id,owner:'',due,planned_duration_days:1,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder}}if(sortMove){xs[40].id='TARGET';xs[40].title='TARGET';xs[40].due=addDays(ymd(),35)}else{xs[40].id='PARENT';xs[40].title='PARENT';xs.splice(41,0,taskForTest('TARGET','',1000,'PARENT'))}applyJsonObject({schema_version:'2.0',items:xs},'v211-ime','v211-ime.json',null,{remember:false,writePermissionGranted:false});setMode('team');setView('open')},{sortMove});
  const row=page.locator('.ganttRow[data-task-id="TARGET"]');await row.evaluate(el=>el.scrollIntoView({block:'center',behavior:'auto'}));await page.waitForTimeout(100);await row.locator('.dueTxt').click();return{row,input:row.locator('.ganttDueText')};
}

async function beginTrace(page){await page.evaluate(()=>{window.__imeHotfixTrace={save:0,render:0};const saveBase=saveDueText;saveDueText=function(...args){window.__imeHotfixTrace.save++;return saveBase.apply(this,args)};const renderBase=render;render=function(...args){window.__imeHotfixTrace.render++;return renderBase.apply(this,args)}})}

async function composeShortcut(input,d='ｄ',digit='１'){
  await input.evaluate((el,{d,digit})=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value=d;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:d,inputType:'insertCompositionText',isComposing:true}));el.value=d+digit;el.dispatchEvent(new InputEvent('input',{bubbles:true,data:digit,inputType:'insertCompositionText',isComposing:true}))},{d,digit});
}

test('V211-IME-A: ASCII d1 no-sort keeps the established keydown path and viewport',async({page})=>{
  const{row,input}=await boot(page);await beginTrace(page);const before=await page.evaluate(()=>({y:scrollY,index:displaySortIndex('TARGET')}));await input.press('d');await input.press('1');await page.waitForTimeout(80);
  expect(await page.evaluate(()=>({due:itemById('TARGET').due,index:displaySortIndex('TARGET'),trace:__imeHotfixTrace,y:scrollY}))).toEqual({due:await page.evaluate(()=>addDays(ymd(),1)),index:before.index,trace:{save:1,render:1},y:before.y});await expect(row).not.toHaveClass(/sortMoveAnimating/);
});

test('V211-IME-B: full-width composition no-sort waits for compositionend and commits once',async({page})=>{
  const{row,input}=await boot(page);await beginTrace(page);const before=await page.evaluate(()=>({y:scrollY,index:displaySortIndex('TARGET'),due:itemById('TARGET').due}));await composeShortcut(input);
  expect(await page.evaluate(el=>({due:itemById('TARGET').due,trace:__imeHotfixTrace,inputConnected:document.contains(el),focused:document.activeElement===el,pending:dueImeShortcutPending&&{digit:dueImeShortcutPending.digit,finishingRequested:dueImeShortcutPending.finishingRequested}}),await input.elementHandle())).toEqual({due:before.due,trace:{save:0,render:0},inputConnected:true,focused:false,pending:{digit:1,finishingRequested:true}});
  const immediate=await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'１'}));return{due:itemById('TARGET').due,trace:{...__imeHotfixTrace},connected:document.contains(el),scheduled:!!dueImeShortcutPending?.commitScheduled}});
  expect(immediate).toEqual({due:before.due,trace:{save:0,render:0},connected:true,scheduled:true});await page.waitForTimeout(80);
  expect(await page.evaluate(()=>({due:itemById('TARGET').due,index:displaySortIndex('TARGET'),trace:__imeHotfixTrace,y:scrollY,pending:dueImeShortcutPending,history:undoStack.length}))).toEqual({due:await page.evaluate(()=>addDays(ymd(),1)),index:before.index,trace:{save:1,render:1},y:before.y,pending:null,history:1});await expect(row).not.toHaveClass(/sortMoveAnimating/);
});

test('V211-IME-C: full-width composition sort-move starts normal FLIP without premature scroll',async({page})=>{
  const{row,input}=await boot(page,{sortMove:true});await beginTrace(page);const before=await page.evaluate(()=>({y:scrollY,index:displaySortIndex('TARGET')}));await composeShortcut(input,'Ｄ','９');expect(await page.evaluate(()=>({trace:__imeHotfixTrace,index:displaySortIndex('TARGET'),y:scrollY}))).toEqual({trace:{save:0,render:0},index:before.index,y:before.y});
  await input.dispatchEvent('compositionend',{data:'９'});await expect.poll(()=>page.evaluate(()=>__imeHotfixTrace.save)).toBe(1);expect(await page.evaluate(beforeIndex=>({due:itemById('TARGET').due,moved:displaySortIndex('TARGET')!==beforeIndex,trace:__imeHotfixTrace,y:scrollY}),before.index)).toEqual({due:await page.evaluate(()=>addDays(ymd(),9)),moved:true,trace:{save:1,render:1},y:before.y});await expect(row).toHaveClass(/sortMoveAnimating/);
});

test('V211-IME-D: separate full-width compositions arm first and commit only after digit compositionend',async({page})=>{
  const{input}=await boot(page);await beginTrace(page);await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value='ｄ';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'ｄ',inputType:'insertCompositionText',isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'ｄ'}))});expect(await page.evaluate(()=>({armed:dateShortcutArmed,trace:__imeHotfixTrace,due:itemById('TARGET').due}))).toEqual({armed:true,trace:{save:0,render:0},due:''});
  await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value='１';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'１',inputType:'insertCompositionText',isComposing:true}))});expect(await page.evaluate(()=>__imeHotfixTrace.save)).toBe(0);await input.dispatchEvent('compositionend',{data:'１'});await expect.poll(()=>page.evaluate(()=>__imeHotfixTrace.save)).toBe(1);expect(await page.evaluate(()=>({due:itemById('TARGET').due,trace:__imeHotfixTrace,pending:dueImeShortcutPending}))).toEqual({due:await page.evaluate(()=>addDays(ymd(),1)),trace:{save:1,render:1},pending:null});
});

test('V211-IME-E: changed or deleted completed candidate is invalidated before compositionend',async({page})=>{
  const{input}=await boot(page);await beginTrace(page);const before=await page.evaluate(()=>({due:itemById('TARGET').due,y:scrollY,history:undoStack.length}));await composeShortcut(input,'ｄ','０');expect(await page.evaluate(()=>dueImeShortcutPending?.finishingRequested)).toBe(true);
  await input.evaluate(el=>{el.value='';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:null,inputType:'deleteContentBackward',isComposing:true}))});expect(await page.evaluate(()=>dueImeShortcutPending)).toBe(null);await input.dispatchEvent('compositionend',{data:''});await page.waitForTimeout(50);expect(await page.evaluate(()=>({due:itemById('TARGET').due,y:scrollY,history:undoStack.length,trace:__imeHotfixTrace,pending:dueImeShortcutPending}))).toEqual({...before,trace:{save:0,render:0},pending:null});
});

test('V211-IME-F: same-value today shortcut exits safely without FLIP or scroll',async({page})=>{
  let{row,input}=await boot(page);await page.evaluate(()=>{itemById('TARGET').due=ymd();render()});await row.locator('.dueTxt').click();input=row.locator('.ganttDueText');await beginTrace(page);const before=await page.evaluate(()=>({y:scrollY,index:displaySortIndex('TARGET'),due:itemById('TARGET').due}));await composeShortcut(input,'ｄ','0');expect(await page.evaluate(()=>__imeHotfixTrace)).toEqual({save:0,render:0});await input.dispatchEvent('compositionend',{data:'0'});await page.waitForTimeout(50);expect(await page.evaluate(()=>({y:scrollY,index:displaySortIndex('TARGET'),due:itemById('TARGET').due,trace:__imeHotfixTrace}))).toEqual({...before,trace:{save:1,render:1}});await expect(row).not.toHaveClass(/sortMoveAnimating/);await expect(input).toBeHidden();
});

test('V211-IME-G: candidate invalidated after compositionend is a no-op in the scheduled macrotask',async({page})=>{
  const{input}=await boot(page);await beginTrace(page);const before=await page.evaluate(()=>({due:itemById('TARGET').due,y:scrollY,history:undoStack.length}));await composeShortcut(input,'ｄ','０');
  const immediate=await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'０'}));const scheduled=!!dueImeShortcutPending?.commitScheduled;el.value='';return{scheduled,pending:!!dueImeShortcutPending,due:itemById('TARGET').due,trace:{...__imeHotfixTrace}}});
  expect(immediate).toEqual({scheduled:true,pending:true,due:before.due,trace:{save:0,render:0}});await page.waitForTimeout(50);expect(await page.evaluate(()=>({due:itemById('TARGET').due,y:scrollY,history:undoStack.length,trace:__imeHotfixTrace,pending:dueImeShortcutPending}))).toEqual({...before,trace:{save:0,render:0},pending:null});
});
