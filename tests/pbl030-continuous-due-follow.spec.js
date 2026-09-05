const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const make=(id,due,sortOrder,extra={})=>({id,parentId:'',state:'未着手',impact_level:1,title:id,owner:'',due,planned_duration_days:1,summary:'summary',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder,...extra});
const row=(page,mode,id='TARGET')=>page.locator(mode==='team'?`.ganttRow[data-task-id="${id}"]`:`#row_${id}`);

async function boot(page,{mode='personal',targetOffset=-60,targetExtra={},detail=true}={}){
  await page.setViewportSize({width:1180,height:500});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({mode,targetOffset,targetExtra,detail})=>{
    const mk=(id,due,sortOrder,extra={})=>({id,parentId:'',state:'未着手',impact_level:1,title:id,owner:'',due,planned_duration_days:1,summary:'summary',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder,...extra});
    const items=[mk('BOUNDARY-PAST',addDays(ymd(),-180),500),mk('TARGET',addDays(ymd(),targetOffset),1000,targetExtra),...Array.from({length:70},(_,i)=>mk(`T${i+1}`,addDays(ymd(),-35+i),(i+2)*1000)),mk('BOUNDARY-FUTURE',addDays(ymd(),500),99000)];
    applyJsonObject({schema_version:'2.5',items},'pbl030','pbl030.json',null,{remember:false,writePermissionGranted:false});
    setView('all');if(mode==='personal'){setMode('personal');setSortMode('date')}else{projectDetailVisible=detail;setMode('team')}clearUndoHistory('pbl030');dirty=false;saveState='saved';
  },{mode,targetOffset,targetExtra,detail});await page.waitForTimeout(80);
}

async function position(page,mode,id='TARGET'){return row(page,mode,id).evaluate(el=>{const r=el.getBoundingClientRect(),s=taskVerticalScroller(el),p=s===document.scrollingElement||s===document.documentElement||s===document.body,b=rcUsableVerticalBounds(s,p);return{top:r.top,bottom:r.bottom,center:(r.top+r.bottom)/2,usableTop:b.top,usableBottom:b.bottom,y:scrollY,listTop:listView.scrollTop,ganttTop:ganttView.scrollTop}})}
async function center(page,mode,id='TARGET'){await row(page,mode,id).evaluate(el=>el.scrollIntoView({block:'center'}));await page.waitForTimeout(40)}
async function trace(page,mode,id='TARGET'){
  await page.evaluate(({mode,id})=>{const getRow=()=>mode==='team'?document.querySelector(`.ganttRow[data-task-id="${id}"]`):document.getElementById('row_'+id);window.__pbl030={started:performance.now(),beforeY:scrollY,flipStart:null,flipEnd:null,scrolls:[]};addEventListener('scroll',()=>{if(__pbl030.flipEnd!==null)__pbl030.scrolls.push({t:performance.now()-__pbl030.started,y:scrollY})},true);new MutationObserver(()=>{const on=!!getRow()?.classList.contains('sortMoveAnimating');if(on&&__pbl030.flipStart===null)__pbl030.flipStart=performance.now()-__pbl030.started;if(!on&&__pbl030.flipStart!==null&&__pbl030.flipEnd===null)__pbl030.flipEnd=performance.now()-__pbl030.started}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']})},{mode,id});
}
async function editDue(page,mode,value,id='TARGET'){const r=row(page,mode,id);await r.locator('.dueTxt').click();const input=r.locator('input[type=text][id^="d"]');await input.fill(value);await input.press('Enter')}
async function settle(page){await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4500}).toBe(0);await expect.poll(()=>page.evaluate(()=>rcActiveDueFollow===null),{timeout:1500,intervals:[10,20,40]}).toBe(true)}
function expectSmooth(t){const ys=[...new Set(t.scrolls.map(x=>Math.round(x.y*10)/10))];expect(t.flipStart).not.toBeNull();expect(t.flipEnd).not.toBeNull();expect(ys.length).toBeGreaterThanOrEqual(2);expect(ys[0]).not.toBe(ys.at(-1));const direction=Math.sign(ys.at(-1)-ys[0]),steps=ys.slice(1).map((y,i)=>y-ys[i]).filter(delta=>Math.abs(delta)>.1);expect(steps.every(delta=>Math.sign(delta)===direction)).toBe(true)}

for(const scenario of[
  {name:'long downward',start:-60,end:30,dir:1},
  {name:'long upward',start:60,end:-30,dir:-1}
])test(`PBL030 ${scenario.name} keeps FLIP locked then smoothly follows`,async({page})=>{
  await boot(page,{targetOffset:scenario.start});await center(page,'personal');await trace(page,'personal');const before=await position(page,'personal');await editDue(page,'personal',await page.evaluate(n=>addDays(ymd(),n),scenario.end));await expect(row(page,'personal')).toHaveClass(/sortMoveAnimating/);await page.waitForTimeout(300);expect(Math.abs((await position(page,'personal')).y-before.y)).toBeLessThanOrEqual(2);await settle(page);const out=await page.evaluate(()=>__pbl030);expectSmooth(out);expect(Math.sign(out.scrolls.at(-1).y-out.beforeY)).toBe(scenario.dir);const final=await position(page,'personal');expect(final.top).toBeGreaterThanOrEqual(final.usableTop-1);expect(final.bottom).toBeLessThanOrEqual(final.usableBottom+1)
});

test('PBL030 slight outside uses smooth minimum follow, not centering',async({page})=>{
  await boot(page,{targetOffset:7});const r=row(page,'personal');await r.evaluate(el=>{el.scrollIntoView({block:'center'});const q=el.getBoundingClientRect(),s=taskVerticalScroller(el),p=s===document.scrollingElement||s===document.documentElement||s===document.body,b=rcUsableVerticalBounds(s,p),d=q.bottom-(b.bottom-4);if(p)scrollBy(0,d);else s.scrollTop+=d});await trace(page,'personal');await editDue(page,'personal',await page.evaluate(()=>addDays(ymd(),10)));await settle(page);const out=await page.evaluate(()=>__pbl030);expectSmooth(out);const final=await position(page,'personal'),usableCenter=(final.usableTop+final.usableBottom)/2;expect(final.bottom).toBeLessThanOrEqual(final.usableBottom+1);expect(Math.abs(final.center-usableCenter)).toBeGreaterThan((final.usableBottom-final.usableTop)*.1)
});

test('PBL030 visible destination causes no post-FLIP scroll',async({page})=>{
  await boot(page,{targetOffset:5});await center(page,'personal');await trace(page,'personal');const before=await position(page,'personal');await editDue(page,'personal',await page.evaluate(()=>addDays(ymd(),7)));await expect(row(page,'personal')).toHaveClass(/sortMoveAnimating/);await settle(page);const out=await page.evaluate(()=>__pbl030);expect(out.flipEnd).not.toBeNull();expect(out.scrolls).toHaveLength(0);expect((await position(page,'personal')).y).toBeCloseTo(before.y,0)
});

for(const detail of[true,false])test(`PBL030 Project ${detail?'detail':'simple'} shares follow and preserves horizontal positions`,async({page})=>{
  await boot(page,{mode:'team',targetOffset:-60,detail});await center(page,'team');await page.evaluate(()=>{ganttView.scrollLeft=Math.min(80,ganttView.scrollWidth-ganttView.clientWidth);projectOuterScrollLeft=ganttView.scrollLeft;setGanttTimelineScroll(240);document.querySelector('.ganttScrollDock')?.scrollTo({left:ganttTimelineScrollLeft})});const horizontal=await page.evaluate(()=>({outer:ganttView.scrollLeft,timeline:ganttTimelineScrollLeft}));await trace(page,'team');await editDue(page,'team',await page.evaluate(()=>addDays(ymd(),30)));await settle(page);expectSmooth(await page.evaluate(()=>__pbl030));const horizontalAfter=await page.evaluate(()=>({outer:ganttView.scrollLeft,timeline:ganttTimelineScrollLeft}));expect(horizontalAfter.outer).toBe(horizontal.outer);expect(horizontalAfter.timeline).toBeCloseTo(horizontal.timeline,6);const summary=await row(page,'team').locator('.sum').count();expect(summary).toBe(detail?1:0)
});

test('PBL030 D→E and D→digit converge on the same post-FLIP follow',async({page})=>{
  await boot(page,{targetOffset:-60});await center(page,'personal');await page.evaluate(()=>selectTask('TARGET'));await trace(page,'personal');await page.keyboard.press('D');await page.keyboard.press('E');const input=row(page,'personal').locator('input[type=text][id^="d"]');await input.fill(await page.evaluate(()=>addDays(ymd(),30)));await input.press('Enter');await settle(page);expectSmooth(await page.evaluate(()=>__pbl030));
  await boot(page,{targetOffset:30});await center(page,'personal');await page.evaluate(()=>selectTask('TARGET'));await trace(page,'personal');await page.keyboard.press('d');await page.keyboard.press('1');const quick=row(page,'personal').locator('input[type=text][id^="d"]');if(await quick.isVisible())await quick.press('Enter');await settle(page);expectSmooth(await page.evaluate(()=>__pbl030))
});

test('PBL030 Due Undo and Redo use symmetric smooth follow',async({page})=>{
  await boot(page,{targetOffset:-60});await center(page,'personal');await editDue(page,'personal',await page.evaluate(()=>addDays(ymd(),30)));await settle(page);await trace(page,'personal');await page.keyboard.press('Control+z');await expect(row(page,'personal')).toHaveAttribute('data-sort-move-kind','due-undo');await settle(page);expectSmooth(await page.evaluate(()=>__pbl030));await trace(page,'personal');await page.keyboard.press('Control+y');await expect(row(page,'personal')).toHaveAttribute('data-sort-move-kind','due-redo');await settle(page);expectSmooth(await page.evaluate(()=>__pbl030))
});

test('PBL030 user wheel interrupts the short follow without snap-back',async({page})=>{
  await boot(page,{targetOffset:-60});await center(page,'personal');await editDue(page,'personal',await page.evaluate(()=>addDays(ymd(),30)));await expect.poll(()=>page.evaluate(()=>rcActiveDueFollow!==null),{timeout:4500,intervals:[5,10,20]}).toBe(true);await page.mouse.wheel(0,-80);await expect.poll(()=>page.evaluate(()=>rcActiveDueFollow===null),{timeout:500,intervals:[5,10]}).toBe(true);const y=await page.evaluate(()=>scrollY);await page.waitForTimeout(220);expect(await page.evaluate(()=>scrollY)).toBeCloseTo(y,0)
});

test('PBL030 reduced motion keeps immediate safe follow',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await boot(page,{targetOffset:-60});await center(page,'personal');await trace(page,'personal');await editDue(page,'personal',await page.evaluate(()=>addDays(ymd(),30)));await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:1000}).toBe(0);expect(await page.evaluate(()=>rcActiveDueFollow)).toBeNull();const final=await position(page,'personal');expect(final.top).toBeGreaterThanOrEqual(final.usableTop-1);expect(final.bottom).toBeLessThanOrEqual(final.usableBottom+1)
});

test('PBL030 selection and Task Detail stay on the moved task',async({page})=>{
  await boot(page,{targetOffset:-60});await center(page,'personal');await page.evaluate(()=>{selectTask('TARGET');openTaskDetailPane('TARGET')});await editDue(page,'personal',await page.evaluate(()=>addDays(ymd(),30)));await settle(page);expect(await page.evaluate(()=>({selectedTaskId,taskDetailPaneTaskId,taskDetailPaneOpen}))).toEqual({selectedTaskId:'TARGET',taskDetailPaneTaskId:'TARGET',taskDetailPaneOpen:true});await expect(page.locator('#taskDetailPane')).toContainText('TARGET')
});

test('PBL030 recurring Close keeps same ID and naturally uses the Due follow path',async({page})=>{
  await boot(page,{targetOffset:-60,targetExtra:{repeat:'毎年',recurrence_rule:{type:'yearly',month:7,day:5}}});await center(page,'personal');const before=await page.evaluate(()=>({count:data.items.length,id:itemById('TARGET').id,due:itemById('TARGET').due}));await trace(page,'personal');await row(page,'personal').locator('.doneBtn').click();await expect(row(page,'personal')).toHaveAttribute('data-sort-move-kind','due');await settle(page);expectSmooth(await page.evaluate(()=>__pbl030));const after=await page.evaluate(()=>({count:data.items.length,id:itemById('TARGET').id,due:itemById('TARGET').due,completed:itemById('TARGET').completed}));expect(after.count).toBe(before.count);expect(after.id).toBe(before.id);expect(after.due).not.toBe(before.due);expect(after.completed).toBe(false)
});

test('PBL030 missing target at follow time safely no-ops',async({page})=>{
  await boot(page);const before=await page.evaluate(()=>scrollY);await page.evaluate(()=>rcFollowDueTaskAfterFlip('missing-task'));expect(await page.evaluate(()=>({y:scrollY,active:rcActiveDueFollow}))).toEqual({y:before,active:null})
});
