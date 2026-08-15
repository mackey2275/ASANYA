const {test,expect}=require('playwright/test');
const APP='/asana_style_task_manager_v200_dev.html';
const task=(id,extra={})=>({id,parentId:'',state:'',impact:'',title:id,owner:'owner',due:'2026-08-20',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,planned_duration_days:1,...extra});
async function fresh(page,items,mode='team'){
  await page.setViewportSize({width:1680,height:900});
  await page.goto(APP); await page.evaluate(()=>localStorage.clear()); await page.reload();
  await page.evaluate(xs=>applyJsonObject({schema_version:'1.9',items:xs},'targeted','targeted.json',null,{remember:false,writePermissionGranted:false}),items);
  await page.evaluate(m=>setMode(m),mode); await page.waitForTimeout(60);
}
const many=()=>Array.from({length:36},(_,i)=>task(`T${i+1}`,{due:`2026-08-${String((i%20)+1).padStart(2,'0')}`,sortOrder:(i+1)*1000}));
async function anchor(page,id='T16'){return page.evaluate(id=>{const row=renderedTaskRow(id),r=row.getBoundingClientRect();return{y:scrollY,top:r.top,ganttTop:document.getElementById('ganttView').getBoundingClientRect().top,ganttScroll:document.getElementById('ganttView').scrollTop,listScroll:document.getElementById('listView').scrollTop,active:document.activeElement?.className||document.activeElement?.id||'',sticky:!!document.querySelector('.viewportStickyHeader[style*="display: block"]')}},id)}

test('VJ-001..005 ordinary Project renders preserve logical visible-row Y',async({page})=>{
  await fresh(page,many()); await page.evaluate(()=>renderedTaskRow('T16').scrollIntoView({block:'center'}));
  const before=await anchor(page);
  await page.evaluate(()=>{const i=data.items.findIndex(x=>x.id==='T16');chg(i,'owner','changed');render();changePlannedDuration(i,'1');render();itemById('T16').summary='changed';render()});
  await page.waitForTimeout(120); const after=await anchor(page);
  expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(1); expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(1);
});

test('ZA-001/003 upward FLIP keeps primary in front for exactly 2240ms',async({page})=>{
  await fresh(page,['A','B','C','D'].map((id,i)=>task(id,{due:`2026-08-0${i+1}`,sortOrder:(i+1)*1000})));
  const rows=await page.evaluate(()=>{const before=displaySortIndex('D');sortMoveAnimationArmed='target';itemById('D').due='2026-07-31';applyPostSortMove('D',before);render();sortMoveAnimationArmed='';return Array.from(document.querySelectorAll('.sortMoveAnimating')).map(r=>({id:r.dataset.taskId,primary:r.classList.contains('sortMovePrimary'),z:getComputedStyle(r).zIndex,duration:r.style.transition}))});
  const primary=rows.find(x=>x.id==='D'),others=rows.filter(x=>x.id!=='D'); expect(primary.primary).toBe(true); expect(Number(primary.z)).toBeGreaterThan(Math.max(...others.map(x=>Number(x.z))));
  await page.waitForTimeout(40); await expect(page.locator('.sortMovePrimary')).toHaveCSS('transition-duration','2.24s');
});

test('MO-001..004 Project arrows use effective-start, sortOrder, and boundary is viewport no-op',async({page})=>{
  await fresh(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000}),task('C',{sortOrder:3000})]);
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['A','B','C']);
  await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='B'),-1));
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['B','A','C']);
  await page.waitForTimeout(40); await expect(page.locator('.sortMovePrimary')).toHaveCount(1);
  await page.waitForTimeout(2300); const before=await anchor(page,'B'); await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='B'),-1)); const after=await anchor(page,'B'); expect(after.y).toBe(before.y); expect(after.top).toBe(before.top);
});

test('MO-002/006/007 manual down moves a parent block with descendants',async({page})=>{
  await fresh(page,[task('P',{sortOrder:1000}),task('C',{parentId:'P',sortOrder:1000}),task('G',{parentId:'C',sortOrder:1000}),task('Q',{sortOrder:2000})]);
  await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='P'),1));
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['Q','P','C','G']);
  const deltas=await page.locator('.sortMoveAnimating').evaluateAll(rows=>Object.fromEntries(rows.map(r=>[r.dataset.taskId,Number(r.dataset.sortMoveDelta)])));
  expect(deltas.P).toBe(deltas.C); expect(deltas.C).toBe(deltas.G);
  for(const id of['P','C','G'])await expect(page.locator(`.ganttRow[data-task-id="${id}"]`)).toHaveClass(/sortMovePrimary/);
  await expect(page.locator('.ganttRow[data-task-id="Q"]')).toHaveClass(/sortMoveDisplaced/);
  await page.waitForTimeout(500); await page.screenshot({path:'test-results/rc-final-manual-parent-flip.png'});
});

test('ZA-FINAL-001..005 upward subtree is front, displaced row behind, leaf remains sole primary',async({page})=>{
  await fresh(page,[task('Q',{sortOrder:1000}),task('P',{sortOrder:2000}),task('C',{parentId:'P'}),task('G',{parentId:'C'})]);
  const y=await page.evaluate(()=>scrollY); await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='P'),-1));
  for(const id of['P','C','G'])await expect(page.locator(`.ganttRow[data-task-id="${id}"]`)).toHaveClass(/sortMovePrimary/);
  await expect(page.locator('.ganttRow[data-task-id="Q"]')).toHaveClass(/sortMoveDisplaced/);
  await expect(page.locator('.sortMovePrimary').first()).toHaveCSS('transition-duration','2.24s'); expect(await page.evaluate(()=>scrollY)).toBe(y);
  await page.waitForTimeout(2300); await fresh(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000})]); await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='B'),-1));
  await expect(page.locator('.sortMovePrimary')).toHaveCount(1); await expect(page.locator('.sortMoveDisplaced')).toHaveCount(1);
});

test('MO-005 ToDo same-parent/same-due manual ordering remains intact',async({page})=>{
  await fresh(page,[task('A',{sortOrder:1000}),task('B',{sortOrder:2000}),task('X',{due:'2026-08-21',sortOrder:3000})],'personal');
  await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='B'),-1));
  expect(await page.evaluate(()=>moveGroup(data.items.findIndex(x=>x.id==='A')).map(p=>p.x.id))).toEqual(['B','A']);
  expect(await page.evaluate(()=>itemById('X').sortOrder)).toBe(3000);
});
