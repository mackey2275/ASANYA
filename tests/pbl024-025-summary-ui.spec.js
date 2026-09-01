const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,title,parentId='',extra={})=>({
  id,parentId,title,state:'未着手',owner:'',due:'2026-09-10',planned_duration_days:3,
  summary:`summary-${id}`,repeat:'',completed:false,dependencies:[],sortOrder:1000,
  impact_level:2,...extra
});

async function boot(page,items,mode='team'){
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(({items,mode})=>{
    applyJsonObject({schema_version:'2.5',workspace_info_markdown:'',items},'pbl024-025','pbl024-025.json',null,{remember:false,writePermissionGranted:false});
    setView('all');setMode(mode);clearUndoHistory('pbl024-025');dirty=false;
  },{items,mode});
}

async function openSummary(page,id){
  await page.locator(`.ganttRow[data-task-id="${id}"] .sum`).click();
  await expect(page.locator('.summaryModal')).toBeVisible();
}

test('PBL024-01 Project Summary identifies root, child, and grandchild safely',async({page})=>{
  const items=[
    task('R','Root <safe> & name'),
    task('C','Child "quoted"','R'),
    task('G','Grandchild > current','C')
  ];
  await boot(page,items);
  for(const [id,text,current] of [
    ['R','Root <safe> & name','Root <safe> & name'],
    ['C','Root <safe> & name ＞ Child "quoted"','Child "quoted"'],
    ['G','Root <safe> & name ＞ Child "quoted" ＞ Grandchild > current','Grandchild > current']
  ]){
    await openSummary(page,id);
    const path=page.locator('.summaryModalPath');
    await expect(path).toHaveText(text);
    await expect(path.locator('.summaryModalPathCurrent')).toHaveCount(1);
    await expect(path.locator('.summaryModalPathCurrent')).toHaveText(current);
    await expect(path.locator('a,button,script')).toHaveCount(0);
    await expect(page.locator('#summaryModalText')).toBeFocused();
    await page.locator('#summaryModalCancel').click();
  }
});

test('PBL024-02 long hierarchy wraps inside the modal and keeps modal interactions intact',async({page})=>{
  await page.setViewportSize({width:720,height:600});
  const long='非常に長いプロジェクト階層タイトルを使って折り返し表示を確認するための文字列';
  await boot(page,[task('R',long),task('C',long+' 子','R'),task('G',long+' 孫','C')]);
  await openSummary(page,'G');
  const geometry=await page.evaluate(()=>{
    const p=document.querySelector('.summaryModalPath'),m=document.querySelector('.summaryModal'),s=getComputedStyle(p);
    const pr=p.getBoundingClientRect(),mr=m.getBoundingClientRect();
    return{whiteSpace:s.whiteSpace,overflowWrap:s.overflowWrap,pathRight:pr.right,modalRight:mr.right,scrollWidth:p.scrollWidth,clientWidth:p.clientWidth};
  });
  expect(geometry.whiteSpace).toBe('normal');
  expect(geometry.overflowWrap).toBe('anywhere');
  expect(geometry.pathRight).toBeLessThanOrEqual(geometry.modalRight+1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);

  await page.locator('#summaryModalText').fill('blur must not save');
  await page.locator('#summaryModalText').evaluate(el=>el.blur());
  await expect(page.locator('.summaryModal')).toBeVisible();
  expect(await page.evaluate(()=>itemById('G').summary)).toBe('summary-G');
  await page.locator('#summaryModalText').focus();
  await page.locator('#summaryModalText').press('Escape');
  expect(await page.evaluate(()=>({summary:itemById('G').summary,undo:undoStack.length}))).toEqual({summary:'summary-G',undo:0});

  await openSummary(page,'G');
  await page.locator('#summaryModalText').fill('saved once');
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('.summaryModal')).toHaveCount(0);
  expect(await page.evaluate(()=>({summary:itemById('G').summary,undo:undoStack.length}))).toEqual({summary:'saved once',undo:1});
  await page.evaluate(()=>performUndo());
  expect(await page.evaluate(()=>itemById('G').summary)).toBe('summary-G');
});

test('PBL024-03 path is Project-modal-only and does not leak into ToDo, Task Detail, or draft UI',async({page})=>{
  await boot(page,[task('R','Root'),task('C','Child','R')]);
  await expect(page.locator('.summaryModalPath')).toHaveCount(0);
  await page.locator('.ganttRow[data-task-id="C"] .taskDetailOpenBtn').click();
  await expect(page.locator('#taskDetailPane')).toBeVisible();
  await expect(page.locator('#taskDetailPane .summaryModalPath')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>setMode('personal'));
  await expect(page.locator('#row_C .sum')).toBeVisible();
  await page.locator('#row_C .sum').click();
  await expect(page.locator('.summaryModal')).toHaveCount(0);
  await expect(page.locator('.summaryModalPath')).toHaveCount(0);
});

test('PBL025-01 completed Project summary stays gray without strike-through while titles and ToDo remain unchanged',async({page})=>{
  const items=[task('D','Completed Project','',{completed:true,state:'完了'}),task('O','Open Project')];
  await boot(page,items);
  const project=await page.evaluate(()=>{
    const row=document.querySelector('.ganttRow[data-task-id="D"]');
    const title=row.querySelector('.ganttTaskTitle'),summary=row.querySelector('.sum span');
    const normal=document.querySelector('.ganttRow[data-task-id="O"] .sum span');
    return{titleLine:getComputedStyle(title).textDecorationLine,summaryLine:getComputedStyle(summary).textDecorationLine,summaryColor:getComputedStyle(summary).color,normalColor:getComputedStyle(normal).color,data:itemById('D')};
  });
  expect(project.titleLine).toContain('line-through');
  expect(project.summaryLine).not.toContain('line-through');
  expect(project.summaryColor).not.toBe(project.normalColor);
  expect(project.data).toMatchObject({completed:true,state:'完了',summary:'summary-D'});

  await page.evaluate(()=>setMode('personal'));
  const todo=await page.evaluate(()=>{
    const row=document.querySelector('#row_D'),summary=row.querySelector('.sum span'),title=row.querySelector('.titleText');
    return{summaryLine:getComputedStyle(summary).textDecorationLine,titleLine:getComputedStyle(title).textDecorationLine};
  });
  expect(todo.summaryLine).toContain('line-through');
  expect(todo.titleLine).toContain('line-through');
});

test('PBL017-PROTECTION defaults and visible headers remain 56 / 424 and 優先度',async({page})=>{
  await boot(page,[task('A','Geometry')]);
  const values=await page.evaluate(()=>({schema:CURRENT_SCHEMA_VERSION,todo:[DEF.impact,DEF.title],project:[PROJECT_COL_DEFAULTS.impact,PROJECT_COL_DEFAULTS.title,PROJECT_COL_MINS.impact]}));
  expect(values).toEqual({schema:'2.5',todo:[56,424],project:[56,424,56]});
  const headers=(await page.locator('.ganttHeader th').allTextContents()).map(x=>x.trim());
  expect(headers).toContain('優先度');expect(headers).not.toContain('影響度');
});
