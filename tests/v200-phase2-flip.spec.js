const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',state:'未着手',impact:'',title:id,owner:'',due:'2026-08-20',planned_duration_days:1,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});

async function fresh(page){
  await page.setViewportSize({width:1200,height:700});
  await page.goto(APP); await page.evaluate(()=>localStorage.clear()); await page.reload();
  await page.evaluate(items=>applyJsonObject({schema_version:'2.0',items},'phase2','phase2.json',null,{remember:false,writePermissionGranted:false}),[
    task('A',{sortOrder:1000}),task('B',{sortOrder:2000}),task('FAR',{due:'2030-08-20',sortOrder:3000})
  ]);
  await page.evaluate(()=>setMode('team')); await page.waitForTimeout(60);
}

async function startManualUp(page){
  await page.evaluate(()=>moveItem(data.items.findIndex(x=>x.id==='B'),-1));
  await expect(page.locator('.sortMovePrimary')).toHaveClass(/sortMoveAnimating/);
}

test('PHASE2-FLIP-01 manual reorder uses 1120ms and horizontal-dominant wheel preserves FLIP',async({page})=>{
  await fresh(page); await startManualUp(page); const primary=page.locator('.sortMovePrimary');
  await expect(primary).toHaveAttribute('data-sort-move-kind','manual-order');
  await expect(primary).toHaveCSS('transition-duration','1.12s');
  const before=await page.evaluate(()=>ganttTimelineScrollLeft);
  await page.locator('#ganttView').dispatchEvent('wheel',{deltaX:180,deltaY:20,bubbles:true,cancelable:true});
  await expect.poll(()=>page.evaluate(()=>ganttTimelineScrollLeft)).toBeGreaterThan(before);
  await expect(primary).toHaveClass(/sortMoveAnimating/);
  await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:3000}).toBe(0);
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['B','A','FAR']);
  expect(await page.locator('.ganttRow[data-task-id]').evaluateAll(rows=>new Set(rows.map(r=>r.dataset.taskId)).size)).toBe(3);
  expect(await page.evaluate(()=>({a:itemById('A').sortOrder,b:itemById('B').sortOrder}))).toEqual({a:2000,b:1000});
});

test('PHASE2-FLIP-02 clear vertical intent keeps existing interruption behavior',async({page})=>{
  await fresh(page); await startManualUp(page);
  await page.locator('#ganttView').dispatchEvent('wheel',{deltaX:10,deltaY:160,bubbles:true,cancelable:true});
  await expect(page.locator('.sortMoveAnimating')).toHaveCount(0);
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['B','A','FAR']);
});

test('PHASE2-FLIP-03 Shift+wheel horizontal path scrolls and does not cancel manual FLIP',async({page})=>{
  await fresh(page); await startManualUp(page); const before=await page.evaluate(()=>ganttTimelineScrollLeft);
  await page.locator('#ganttView').dispatchEvent('wheel',{deltaX:0,deltaY:140,shiftKey:true,bubbles:true,cancelable:true});
  await expect.poll(()=>page.evaluate(()=>ganttTimelineScrollLeft)).toBeGreaterThan(before);
  await expect(page.locator('.sortMoveAnimating').first()).toBeVisible();
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['B','A','FAR']);
});

test('PHASE2-FLIP-04 manual reorder Undo and Redo retain 1120ms and logical order',async({page})=>{
  await fresh(page); await startManualUp(page); await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:3000}).toBe(0);
  expect(await page.evaluate(()=>undoStack.at(-1).actionType)).toBe('manual_order');
  await page.keyboard.press('Control+z'); await expect(page.locator('.sortMovePrimary')).toHaveCSS('transition-duration','1.12s');
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['A','B','FAR']);
  await expect.poll(()=>page.locator('.sortMoveAnimating').count(),{timeout:3000}).toBe(0);
  await page.keyboard.press('Control+y'); await expect(page.locator('.sortMovePrimary')).toHaveCSS('transition-duration','1.12s');
  expect(await page.evaluate(()=>projectPlannedVisible().map(p=>p.x.id))).toEqual(['B','A','FAR']);
});
