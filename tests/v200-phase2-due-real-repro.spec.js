const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

async function fresh(page,mode){
  await page.setViewportSize({width:1180,height:520}); await page.goto(APP);
  await page.evaluate(()=>localStorage.clear()); await page.reload();
  await page.evaluate(mode=>{
    const make=(id,due,sortOrder)=>({id,parentId:'',state:'未着手',impact:'',title:id,owner:'',due,planned_duration_days:1,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder});
    const items=[make('TARGET',addDays(ymd(),-60),1000),...Array.from({length:55},(_,i)=>make(`T${i+1}`,addDays(ymd(),-30+i),(i+2)*1000))];
    applyJsonObject({schema_version:'2.0',items},'real-repro','real-repro.json',null,{remember:false,writePermissionGranted:false});
    setMode(mode); if(mode==='personal')setSortMode('date');
  },mode); await page.waitForTimeout(80);
}

const target=(page,mode)=>page.locator(mode==='team'?'.ganttRow[data-task-id="TARGET"]':'#row_TARGET');
async function finalPosition(row){return row.evaluate(el=>{const r=el.getBoundingClientRect(),s=taskVerticalScroller(el),p=s===document.scrollingElement||s===document.documentElement||s===document.body,b=rcUsableVerticalBounds(s,p);return{top:r.top,bottom:r.bottom,center:(r.top+r.bottom)/2,usableTop:b.top,usableBottom:b.bottom}})}

async function installTrace(page,mode){
  await page.evaluate(({mode})=>{
    const id='TARGET',row=()=>mode==='team'?document.querySelector('.ganttRow[data-task-id="TARGET"]'):document.getElementById('row_TARGET');
    window.__dueRealTrace=[]; let start=performance.now(),sawAnimation=false,endedAt=null,doneResolve;
    const state=(label,detail='')=>{const r=row()?.getBoundingClientRect(),active=document.activeElement;__dueRealTrace.push({t:+(performance.now()-start).toFixed(2),label,detail,pageY:scrollY,listTop:listView.scrollTop,ganttTop:ganttView.scrollTop,docHeight:document.documentElement.scrollHeight,bodyHeight:document.body.scrollHeight,rowTop:r?.top??null,rowBottom:r?.bottom??null,animating:!!row()?.classList.contains('sortMoveAnimating'),active:active?.id||active?.className||active?.tagName||''})};
    const wrap=(owner,name,label)=>{const base=owner[name];owner[name]=function(...args){state(label,JSON.stringify(args).slice(0,160));return base.apply(this,args)}};
    wrap(window,'scrollTo','api:window.scrollTo');wrap(window,'scrollBy','api:window.scrollBy');wrap(Element.prototype,'scrollIntoView','api:scrollIntoView');wrap(HTMLElement.prototype,'focus','api:focus');wrap(HTMLElement.prototype,'blur','api:blur');
    addEventListener('scroll',()=>state('event:window-scroll'),true);
    new MutationObserver(()=>{const active=!!row()?.classList.contains('sortMoveAnimating');if(active&&!sawAnimation){sawAnimation=true;state('mutation:flip-start')}else if(sawAnimation&&!active&&!endedAt){endedAt=performance.now();state('mutation:flip-end')}}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
    window.__dueRealDone=new Promise(resolve=>doneResolve=resolve);state('before-nine');
    const frame=()=>{state('raf');if(endedAt&&performance.now()-endedAt>=120){state('after-cleanup-100ms');doneResolve(__dueRealTrace);return}if(performance.now()-start>5000){state('trace-timeout');doneResolve(__dueRealTrace);return}requestAnimationFrame(frame)};requestAnimationFrame(frame);
  },{mode});
}

for(const mode of['personal','team'])test(`PHASE2-DUE-REAL-REPRO ${mode}: actual d9 has stable pre-FLIP viewport and centered final target`,async({page},testInfo)=>{
  await fresh(page,mode); const row=target(page,mode); await row.evaluate(el=>el.scrollIntoView({block:'center'})); await row.locator('.dueTxt').click(); const input=row.locator('input[type="text"][id^="d"]'); await input.press('d');
  await installTrace(page,mode); await input.press('9'); const trace=await page.evaluate(()=>__dueRealDone); await testInfo.attach(`${mode}-scroll-timeline.json`,{body:JSON.stringify(trace,null,2),contentType:'application/json'});
  const before=trace.find(x=>x.label==='before-nine'),start=trace.find(x=>x.label==='mutation:flip-start'),end=trace.find(x=>x.label==='mutation:flip-end');
  console.log('DUE_REAL_TIMELINE '+mode+' '+JSON.stringify(trace.filter(x=>x.label!=='raf')));
  expect(start,'FLIP must start').toBeTruthy(); expect(end,'FLIP must finish').toBeTruthy();
  expect(Math.abs(start.pageY-before.pageY)).toBeLessThanOrEqual(2);expect(Math.abs(start.listTop-before.listTop)).toBeLessThanOrEqual(2);expect(Math.abs(start.ganttTop-before.ganttTop)).toBeLessThanOrEqual(2);
  const final=await row.evaluate(el=>{const r=el.getBoundingClientRect(),s=taskVerticalScroller(el),p=s===document.scrollingElement||s===document.documentElement||s===document.body,b=rcUsableVerticalBounds(s,p);return{top:r.top,bottom:r.bottom,center:(r.top+r.bottom)/2,usableTop:b.top,usableBottom:b.bottom,selected:el.classList.contains('selectedRow')||el.classList.contains('ganttSelected'),attention:el.classList.contains('sortAttention')}});
  expect(final.top).toBeGreaterThanOrEqual(final.usableTop-1);expect(final.bottom).toBeLessThanOrEqual(final.usableBottom+1);
  expect(Math.abs(final.center-(final.usableTop+final.usableBottom)/2)).toBeLessThanOrEqual((final.usableBottom-final.usableTop)*0.2);
  expect(final.selected).toBe(true);expect(final.attention).toBe(true);
});

for(const mode of['personal','team'])test(`PHASE2-DUE-REAL-VISIBLE ${mode}: fully visible destination does not force post-FLIP scroll`,async({page})=>{
  await fresh(page,mode);await page.evaluate(()=>{itemById('TARGET').due=addDays(ymd(),5);render()});const row=target(page,mode);await row.evaluate(el=>el.scrollIntoView({block:'center'}));await row.locator('.dueTxt').click();const input=row.locator('input[type="text"][id^="d"]');await input.press('d');await installTrace(page,mode);const before=await page.evaluate(()=>({pageY:scrollY,listTop:listView.scrollTop,ganttTop:ganttView.scrollTop}));await input.press('9');const trace=await page.evaluate(()=>__dueRealDone);const flipEnd=trace.find(y=>y.label==='mutation:flip-end');expect(trace.some(x=>x.label==='mutation:flip-start')).toBe(true);expect(trace.filter(x=>x.label==='raf'&&x.t<flipEnd.t).every(x=>Math.abs(x.pageY-before.pageY)<=2)).toBe(true);await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4000}).toBe(0);expect(await page.evaluate(()=>({pageY:scrollY,listTop:listView.scrollTop,ganttTop:ganttView.scrollTop}))).toEqual(before);const final=await finalPosition(row);expect(final.top).toBeGreaterThanOrEqual(final.usableTop);expect(final.bottom).toBeLessThanOrEqual(final.usableBottom)
});

for(const mode of['personal','team'])test(`PHASE2-DUE-REAL-NEAREST ${mode}: slightly off-screen destination gets only minimum follow`,async({page})=>{
  await fresh(page,mode);await page.evaluate(()=>{itemById('TARGET').due=addDays(ymd(),7);render()});const row=target(page,mode);await row.evaluate(el=>{el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect(),s=taskVerticalScroller(el),p=s===document.scrollingElement||s===document.documentElement||s===document.body,b=rcUsableVerticalBounds(s,p),delta=r.bottom-(b.bottom-4);if(p)window.scrollBy({top:delta,behavior:'auto'});else s.scrollTop+=delta});const before=await page.evaluate(()=>scrollY);await row.locator('.dueTxt').click();const input=row.locator('input[type="text"][id^="d"]');await input.press('d');await input.press('9');await expect(row).toHaveClass(/sortMoveAnimating/);await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4000}).toBe(0);const after=await page.evaluate(()=>scrollY),final=await finalPosition(row),usableCenter=(final.usableTop+final.usableBottom)/2;expect(after-before).toBeGreaterThan(5);expect(after-before).toBeLessThan((final.usableBottom-final.usableTop)*.5);expect(final.top).toBeGreaterThanOrEqual(final.usableTop-1);expect(final.bottom).toBeLessThanOrEqual(final.usableBottom+1);expect(Math.abs(final.center-usableCenter)).toBeGreaterThan((final.usableBottom-final.usableTop)*.2)
});

test('PHASE2-DUE-REAL-UNDO/REDO Due history remains centered and manual timing identity is isolated',async({page})=>{
  await fresh(page,'personal');const row=target(page,'personal');await row.evaluate(el=>el.scrollIntoView({block:'center'}));await row.locator('.dueTxt').click();const input=row.locator('input[type="text"][id^="d"]');await input.press('d');await input.press('9');await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4000}).toBe(0);const changed=await page.evaluate(()=>itemById('TARGET').due);await page.keyboard.press('Control+z');await expect(row).toHaveAttribute('data-sort-move-kind','due-undo');await expect(row).toHaveCSS('transition-duration','2.24s');await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4000}).toBe(0);expect(await page.evaluate(()=>itemById('TARGET').due)).toBe(await page.evaluate(()=>addDays(ymd(),-60)));let final=await finalPosition(row);expect(Math.abs(final.center-(final.usableTop+final.usableBottom)/2)).toBeLessThanOrEqual(12);await page.keyboard.press('Control+y');await expect(row).toHaveAttribute('data-sort-move-kind','due-redo');await expect(row).toHaveCSS('transition-duration','2.24s');await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4000}).toBe(0);expect(await page.evaluate(()=>itemById('TARGET').due)).toBe(changed);final=await finalPosition(row);expect(Math.abs(final.center-(final.usableTop+final.usableBottom)/2)).toBeLessThanOrEqual(12)
});
