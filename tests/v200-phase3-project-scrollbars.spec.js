const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const addDate=i=>`2026-${String(8+Math.floor((i-1)/25)).padStart(2,'0')}-${String((i-1)%25+1).padStart(2,'0')}`;
const make=(id,i)=>({id,parentId:'',state:'未着手',impact:'',title:`Project task ${i}`,owner:'Owner',due:addDate(i),planned_duration_days:3,summary:'wide summary '.repeat(8),repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:i*1000});
async function boot(page){
  await page.setViewportSize({width:1000,height:560});await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  const items=Array.from({length:64},(_,i)=>make(`P${i+1}`,i+1));
  await page.evaluate(items=>{applyJsonObject({schema_version:'2.0',items},'phase3','phase3.json',null,{remember:false,writePermissionGranted:false});setMode('team')},items);
  await expect(page.locator('.projectOuterScrollDock')).toBeVisible();
  await page.locator('.projectOuterScrollDock').evaluate(el=>{el.scrollLeft=Math.min(900,el.scrollWidth-el.clientWidth);el.dispatchEvent(new Event('scroll'))});
  await expect(page.locator('.ganttScrollDock')).toBeVisible();
}
async function geometry(page){return page.evaluate(()=>{const schedule=document.querySelector('.ganttScrollDock').getBoundingClientRect(),outer=document.querySelector('.projectOuterScrollDock').getBoundingClientRect(),gantt=document.getElementById('ganttView').getBoundingClientRect();return{schedule:{top:schedule.top,bottom:schedule.bottom},outer:{top:outer.top,bottom:outer.bottom},gantt:{top:gantt.top,bottom:gantt.bottom},y:scrollY}})}

test('PHASE3-SCROLL-01: top/middle/bottomでschedule上・overall下の固定dockが利用可能',async({page})=>{
  await boot(page);
  for(const ratio of[0,.5,1]){await page.evaluate(r=>window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*r),ratio);await page.waitForTimeout(80);await expect(page.locator('.ganttScrollDock')).toBeVisible();await expect(page.locator('.projectOuterScrollDock')).toBeVisible();const g=await geometry(page);expect(g.schedule.top).toBeLessThan(g.outer.top);expect(g.schedule.bottom).toBeLessThanOrEqual(g.outer.top+1);expect(g.outer.bottom).toBeLessThanOrEqual(561)}
});

test('PHASE3-SCROLL-02: overall dockとProject outer scrollLeftが双方向同期しrender後も維持',async({page})=>{
  await boot(page);const before=await page.locator('#ganttView .ganttCanvas').boundingBox();
  await page.locator('.projectOuterScrollDock').evaluate(el=>{el.scrollLeft=700;el.dispatchEvent(new Event('scroll'))});await expect.poll(()=>page.evaluate(()=>ganttView.scrollLeft)).toBe(700);const moved=await page.locator('#ganttView .ganttCanvas').boundingBox();expect(Math.round(moved.x-before.x)).toBe(200);
  await page.evaluate(()=>{ganttView.scrollLeft=650;ganttView.dispatchEvent(new Event('scroll'))});await expect.poll(()=>page.locator('.projectOuterScrollDock').evaluate(el=>el.scrollLeft)).toBe(650);
  await page.locator('.ganttRow[data-task-id="P2"]').click();await expect.poll(()=>page.evaluate(()=>ganttView.scrollLeft)).toBe(650);await expect.poll(()=>page.locator('.projectOuterScrollDock').evaluate(el=>el.scrollLeft)).toBe(650)
});

test('PHASE3-SCROLL-03: schedule dockはtimelineだけを動かしheader/body/Today lineを同期',async({page})=>{
  await boot(page);const outer=await page.evaluate(()=>ganttView.scrollLeft);await page.locator('.ganttScrollDock').evaluate(el=>{el.scrollLeft=210;el.dispatchEvent(new Event('scroll'))});await expect.poll(()=>page.evaluate(()=>ganttTimelineScrollLeft)).toBe(210);expect(await page.evaluate(()=>ganttView.scrollLeft)).toBe(outer);
  const transforms=await page.evaluate(()=>({head:document.querySelector('.ganttHeader .ganttTimeline').style.transform,body:document.querySelector('.ganttRow[data-task-id] .ganttTimeline').style.transform,today:document.querySelector('.ganttTodayColumn').style.transform}));expect(transforms.head).toContain('-210px');expect(transforms.body).toBe(transforms.head);expect(transforms.today).toBe(transforms.head)
});

test('PHASE3-SCROLL-04: native overall barを隠し、usable viewportとTOPをdock stackより上に置く',async({page})=>{
  await boot(page);await page.evaluate(()=>window.scrollTo(0,700));await page.waitForTimeout(100);
  const result=await page.evaluate(()=>{const gantt=document.getElementById('ganttView'),s=document.querySelector('.ganttScrollDock').getBoundingClientRect(),top=document.getElementById('backToTopBtn').getBoundingClientRect(),bounds=rcUsableVerticalBounds(document.scrollingElement,true);return{scrollbarWidth:getComputedStyle(gantt).scrollbarWidth,sTop:s.top,topBottom:top.bottom,boundsBottom:bounds.bottom}});
  expect(result.scrollbarWidth).toBe('none');expect(result.boundsBottom).toBeLessThanOrEqual(result.sTop+1);expect(result.topBottom).toBeLessThanOrEqual(result.sTop-8)
});

test('PHASE3-SCROLL-05: stacked docks下でもDue FLIPの可視領域判定が両dockを除外',async({page})=>{
  await boot(page);const row=page.locator('.ganttRow[data-task-id="P1"]');await row.evaluate(el=>el.scrollIntoView({block:'center'}));const before=await page.evaluate(()=>scrollY);await row.locator('.dueTxt').click();const input=row.locator('.ganttDueText');await input.fill('2026-10-20');await input.press('Enter');await expect(row).toHaveClass(/sortMoveAnimating/);await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:4000}).toBe(0);
  const final=await row.evaluate(el=>{const r=el.getBoundingClientRect(),b=rcUsableVerticalBounds(document.scrollingElement,true),dock=document.querySelector('.ganttScrollDock').getBoundingClientRect();return{top:r.top,bottom:r.bottom,bottomBound:b.bottom,dockTop:dock.top,pageY:scrollY}});expect(final.bottom).toBeLessThanOrEqual(final.bottomBound+1);expect(final.bottomBound).toBeLessThanOrEqual(final.dockTop+1);expect(final.pageY).not.toBe(before)
});
