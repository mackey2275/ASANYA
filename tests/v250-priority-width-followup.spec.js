const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',title:id,state:'未着手',owner:'',due:'2026-08-28',planned_duration_days:3,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level:2,...extra});

async function boot(page,mode='personal',items=[task('A')]){
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(({mode,items})=>{
    applyJsonObject({schema_version:'2.5',workspace_info_markdown:'',items},'priority-width','priority-width.json',null,{remember:false,writePermissionGranted:false});
    setView('all');setMode(mode);clearUndoHistory('priority-width');dirty=false;
  },{mode,items});
}

test('PBL017-FOLLOWUP-01 approved defaults, minimum, header, and model stay exact',async({page})=>{
  await boot(page);
  expect(await page.evaluate(()=>({
    schema:CURRENT_SCHEMA_VERSION,
    todo:{impact:DEF.impact,title:DEF.title},
    project:{impact:PROJECT_COL_DEFAULTS.impact,title:PROJECT_COL_DEFAULTS.title,minImpact:PROJECT_COL_MINS.impact},
    field:Object.prototype.hasOwnProperty.call(itemById('A'),'impact_level'),
    legacy:Object.prototype.hasOwnProperty.call(itemById('A'),'impact')
  }))).toEqual({schema:'2.5',todo:{impact:56,title:424},project:{impact:56,title:424,minImpact:56},field:true,legacy:false});

  let labels=(await page.locator('#head th').allTextContents()).map(x=>x.trim());
  expect(labels).toContain('優先度');expect(labels).not.toContain('影響度');
  await page.evaluate(()=>setMode('team'));
  labels=(await page.locator('#ganttView .ganttHeader th').allTextContents()).map(x=>x.trim());
  expect(labels.slice(labels.indexOf('子'),labels.indexOf('ステータス')+1)).toEqual(['子','優先度','ステータス']);
  await page.locator('.ganttRow[data-task-id="A"] .taskDetailOpenBtn').click();
  await expect(page.locator('#taskDetailPane')).toContainText('影響度');
});

test('PBL017-FOLLOWUP-02 ToDo and Project render approved widths without shrinking stars',async({page})=>{
  await boot(page);
  const todo=await page.evaluate(()=>{
    const rect=el=>el.getBoundingClientRect().width,impactIndex=cols().indexOf('impact'),titleIndex=cols().indexOf('title'),normal=document.querySelector('#body tr[id^="row_"]'),draft=document.querySelector('#blank'),cell=normal.children[impactIndex],host=cell.querySelector('.impactStars');
    const style=getComputedStyle(cell);return {headerImpact:rect(document.querySelector('#head th[data-c="impact"]')),cellImpact:rect(cell),draftImpact:rect(draft.children[impactIndex]),headerTitle:rect(document.querySelector('#head th[data-c="title"]')),cellTitle:rect(normal.children[titleIndex]),stars:rect(host),buttons:[...host.querySelectorAll('.impactStar')].map(rect),paddingLeft:style.paddingLeft,paddingRight:style.paddingRight};
  });
  for(const value of [todo.headerImpact,todo.cellImpact,todo.draftImpact])expect(value).toBeCloseTo(56,1);for(const value of [todo.headerTitle,todo.cellTitle])expect(value).toBeCloseTo(424,1);expect(todo.stars).toBe(51);expect(todo.buttons).toEqual([17,17,17]);expect(todo.paddingLeft).toBe('2px');expect(todo.paddingRight).toBe('2px');

  await page.evaluate(()=>setMode('team'));
  const metrics=await page.evaluate(()=>{
    const row=document.querySelector('.ganttRow[data-task-id="A"]');
    const cell=[...row.querySelectorAll('.projectInfoTable td')].find(td=>td.querySelector('.impactStars'));
    const host=cell.querySelector('.impactStars'),buttons=[...host.querySelectorAll('.impactStar')];
    const cellRect=cell.getBoundingClientRect(),hostRect=host.getBoundingClientRect();
    const col=k=>parseFloat(getComputedStyle(document.querySelector(`.ganttHeader col[data-c="${k}"]`)).width);
    const rect=el=>el.getBoundingClientRect().width,impactIndex=cols().indexOf('impact'),titleIndex=cols().indexOf('title'),cells=[...row.querySelectorAll('.projectInfoTable td')],draft=[...document.querySelector('.projectTopDraftRow .projectInfoTable tr').children];
    return {impact:col('impact'),title:col('title'),headerImpact:rect(document.querySelector('.ganttHeader th[data-c="impact"]')),cellImpact:rect(cells[impactIndex]),draftImpact:rect(draft[impactIndex]),headerTitle:rect(document.querySelector('.ganttHeader th[data-c="title"]')),cellTitle:rect(cells[titleIndex]),count:buttons.length,text:buttons.map(x=>x.textContent).join(''),buttonWidths:buttons.map(rect),wrap:getComputedStyle(host).whiteSpace,overflow:getComputedStyle(cell).overflow,padding:getComputedStyle(cell).padding,scrollWidth:cell.scrollWidth,clientWidth:cell.clientWidth,hostLeft:hostRect.left,hostRight:hostRect.right,cellLeft:cellRect.left,cellRight:cellRect.right,rowHeight:row.getBoundingClientRect().height};
  });
  for(const value of [metrics.impact,metrics.headerImpact,metrics.cellImpact,metrics.draftImpact])expect(value).toBeCloseTo(56,1);for(const value of [metrics.title,metrics.headerTitle,metrics.cellTitle])expect(value).toBeCloseTo(424,1);
  expect(metrics.count).toBe(3);expect(metrics.text).toBe('★★☆');expect(metrics.buttonWidths).toEqual([17,17,17]);expect(metrics.wrap).toBe('nowrap');expect(metrics.overflow).toBe('visible');expect(metrics.padding).toBe('2px');
  expect(metrics.hostLeft).toBeGreaterThanOrEqual(metrics.cellLeft);expect(metrics.hostRight).toBeLessThanOrEqual(metrics.cellRight);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);expect(metrics.rowHeight).toBeLessThan(40);

  const stars=page.locator('.ganttRow[data-task-id="A"] .impactStar');
  await stars.nth(2).focus();await expect(stars.nth(2)).toBeFocused();
  await stars.nth(2).press('Enter');
  expect(await page.evaluate(()=>({level:itemById('A').impact_level,undo:undoStack.length}))).toEqual({level:3,undo:1});
});

test('PBL017-FOLLOWUP-03 Project top and child drafts keep the same 56px alignment',async({page})=>{
  await boot(page,'team',[task('P')]);
  const widths=await page.evaluate(()=>{
    const width=(root,key)=>parseFloat(getComputedStyle(document.querySelector(`${root} col[data-c="${key}"]`)).width);
    return {header:width('.ganttHeader','impact'),top:width('.projectTopDraftRow','impact'),row:width('.ganttRow[data-task-id="P"]','impact')};
  });
  expect(widths).toEqual({header:56,top:56,row:56});
  await page.evaluate(()=>{selectTask('P');startDraftTask('child')});
  const id=await page.evaluate(()=>draftTaskId);
  const child=await page.locator(`.ganttRow[data-task-id="${id}"] col[data-c="impact"]`).evaluate(el=>parseFloat(getComputedStyle(el).width));
  expect(child).toBe(56);
});

test('PBL017-FOLLOWUP-04 only legacy defaults migrate; custom widths are preserved',async({page})=>{
  await page.goto(APP);await page.evaluate(()=>{localStorage.clear();localStorage.setItem('yos_cols_v114',JSON.stringify({impact:178,title:500}));localStorage.setItem('yos_project_cols_v1',JSON.stringify({impact:90,title:450}))});await page.reload();
  expect(await page.evaluate(()=>({todo:widths,project:projectWidths}))).toMatchObject({todo:{impact:56,title:424},project:{impact:56,title:424}});
  await page.evaluate(()=>{localStorage.setItem('yos_cols_v114',JSON.stringify({impact:106.8,title:428.8}));localStorage.setItem('yos_project_cols_v1',JSON.stringify({impact:64,title:424}))});await page.reload();
  expect(await page.evaluate(()=>({todo:widths,project:projectWidths}))).toMatchObject({todo:{impact:56,title:424},project:{impact:56,title:424}});
  await page.evaluate(()=>{localStorage.setItem('yos_cols_v114',JSON.stringify({impact:132,title:470}));localStorage.setItem('yos_project_cols_v1',JSON.stringify({impact:82,title:390}))});await page.reload();
  expect(await page.evaluate(()=>({todo:widths,project:projectWidths}))).toMatchObject({todo:{impact:132,title:470},project:{impact:82,title:390}});
});
