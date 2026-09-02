const {test,expect}=require('playwright/test');
const {APP_FILE_URL:APP}=require('./helpers/app-target');
const task=(i)=>({id:`TOP-${i}`,parentId:'',state:'未着手',impact:'',title:`Scroll task ${i}`,owner:'Owner',due:`2026-${String(1+Math.floor((i-1)/28)).padStart(2,'0')}-${String(1+(i-1)%28).padStart(2,'0')}`,planned_duration_days:3,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:i*1000});

async function boot(page){
  await page.setViewportSize({width:900,height:500});
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(async xs=>{await applyJsonObject({schema_version:'1.8',items:xs},'top-test','top-test.json',null,{remember:false,writePermissionGranted:false});},Array.from({length:120},(_,i)=>task(i+1)));
}
async function scrollDown(page){
  await page.evaluate(()=>window.scrollTo(0,650));
  await expect(page.locator('#backToTopBtn')).toHaveClass(/show/);
}

test('TOP-01: Start/上部では非表示、ToDo・Project List・Ganttで表示してsmoothに先頭へ戻る',async({page})=>{
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await expect(page.locator('#backToTopBtn')).not.toHaveClass(/show/);
  await boot(page);
  for(const openView of [
    async()=>page.evaluate(()=>setMode('personal')),
    async()=>{await page.evaluate(()=>setMode('team'))},
    async()=>{await page.evaluate(()=>setMode('team'))}
  ]){
    await openView();await scrollDown(page);
    await page.evaluate(()=>{const original=window.scrollTo.bind(window);window.__topScrollCalls=[];window.scrollTo=(...args)=>{window.__topScrollCalls.push(args[0]);return original(...args)}});
    await page.locator('#backToTopBtn').click();
    expect(await page.evaluate(()=>window.__topScrollCalls.at(-1))).toEqual({top:0,behavior:'smooth'});
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(5);
    await expect(page.locator('#backToTopBtn')).not.toHaveClass(/show/);
  }
});

test('TOP-02: Gantt dock・toastと重ならず、横scroll/resizeや履歴・保存状態へ影響しない',async({page})=>{
  await boot(page);await page.evaluate(()=>setMode('team'));await page.locator('.ganttRow[data-task-id="TOP-60"]').scrollIntoViewIfNeeded();await page.evaluate(()=>syncUnifiedDockGeometry());
  const dock=page.locator('.ganttScrollDock');await expect(dock).toHaveCount(1);const dockVisible=await dock.isVisible();
  const before=await page.evaluate(()=>({dirty,undo:undoStack.length,redo:redoStack.length,timer:!!autoSaveTimer,x:ganttTimelineScrollLeft}));
  await page.evaluate(()=>setGanttTimelineScroll(240));const horizontal=await page.evaluate(()=>ganttTimelineScrollLeft);
  let boxes=dockVisible?await Promise.all([page.locator('#backToTopBtn').boundingBox(),dock.boundingBox()]):null;if(boxes)expect(boxes[0].y+boxes[0].height).toBeLessThan(boxes[1].y);
  await page.evaluate(()=>toastMsg('位置確認'));await page.waitForTimeout(30);const toastBox=await page.locator('#toast').boundingBox();const buttonBox=await page.locator('#backToTopBtn').boundingBox();expect(buttonBox.y+buttonBox.height).toBeLessThan(toastBox.y);
  await page.setViewportSize({width:760,height:560});await page.waitForTimeout(30);boxes=await dock.isVisible()?await Promise.all([page.locator('#backToTopBtn').boundingBox(),dock.boundingBox()]):null;if(boxes)expect(boxes[0].y+boxes[0].height).toBeLessThan(boxes[1].y);
  await page.locator('#backToTopBtn').click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(5);
  const after=await page.evaluate(()=>({dirty,undo:undoStack.length,redo:redoStack.length,timer:!!autoSaveTimer,x:ganttTimelineScrollLeft}));
  expect(after).toEqual({...before,x:horizontal});
});

test('FAVICON-02: data URI SVGは∵方向の鮮やかな緑の大きな3 circleを持つ',async({page})=>{
  await page.goto(APP);const href=await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href).toContain('data:image/svg+xml');const svg=decodeURIComponent(href.split(',')[1]);
  expect((svg.match(/<circle /g)||[])).toHaveLength(3);expect(svg).toContain("fill='#22d34f'");expect((svg.match(/r='10'/g)||[])).toHaveLength(3);
  expect(svg).toContain("cx='18' cy='21'");expect(svg).toContain("cx='46' cy='21'");expect(svg).toContain("cx='32' cy='46'");
});

test('SUMMARY-HOVER-01: ToDo/Project List概要hoverはtipを出さずGantt tooltipは維持',async({page})=>{
  await boot(page);const tip=page.locator('#tip');
  for(const [mode,selector] of [['personal','#row_TOP-1 .sum'],['team','.ganttRow[data-task-id="TOP-1"] .sum']]){await page.evaluate(mode=>setMode(mode),mode);const summary=page.locator(selector);await summary.hover();await page.waitForTimeout(30);await expect(tip).toBeHidden();expect(await summary.getAttribute('onmouseenter')).toBeNull();expect(await summary.getAttribute('onmousemove')).toBeNull()}
  await page.evaluate(()=>setMode('team'));const bar=page.locator('#ganttView .ganttBar:not(.summary)').first();expect(await bar.getAttribute('data-gantt-tip')).toContain('計画');await bar.evaluate(el=>{const clip=document.querySelector('.ganttHeader .ganttTimelineClip'),left=parseFloat(el.style.left)||0;if(clip)setGanttTimelineScroll(Math.max(0,left-clip.clientWidth/2))});await bar.hover();await expect(page.locator('#ganttCustomTip')).toBeVisible();
  await page.evaluate(()=>setMode('team'));const before=await page.evaluate(()=>({dirty,undo:undoStack.length}));await scrollDown(page);await page.evaluate(()=>document.querySelector('#row_TOP-1 .sum').dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})));await expect(tip).toBeHidden();await page.locator('#backToTopBtn').click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(5);expect(await page.evaluate(()=>({dirty,undo:undoStack.length}))).toEqual(before);
});
