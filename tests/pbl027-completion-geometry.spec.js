const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',state:'',impact_level:0,title:id,owner:'担当者',due:'2026-10-10',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});

async function setup(page,date=false){
  await page.setViewportSize({width:1100,height:600});
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(({item,date})=>{applyJsonObject({schema_version:'3.0',items:[item]},'geometry','geometry.json',null,{remember:false,writePermissionGranted:false});setMode('personal');setSortMode(date?'date':'tree');setView('all');clearUndoHistory('geometry');dirty=false},{item:task('ROW',{title:'階層付きの長いタイトル',parentId:'P'}),date});
}

async function geometry(page){return page.locator('#row_ROW').evaluate(row=>{
  const box=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{top:r.top,bottom:r.bottom,left:r.left,width:r.width,height:r.height,lineHeight:s.lineHeight,fontSize:s.fontSize,fontWeight:s.fontWeight,padding:s.padding,border:s.borderWidth,verticalAlign:s.verticalAlign,display:s.display,alignItems:s.alignItems}};
  return{row:box(row),cell:box(row.querySelector('.doneBtn').closest('td')),button:box(row.querySelector('.doneBtn')),title:box(row.querySelector('.titleText')),due:box(row.querySelector('.dueTxt'))};
})}

function expectStable(actual,expected){
  for(const part of['row','cell','button','title','due'])for(const key of['top','bottom','height'])expect(Math.abs(actual[part][key]-expected[part][key])).toBeLessThan(0.6);
  expect(actual.button.width).toBeCloseTo(expected.button.width,1);
}

test('PBL027-GEOMETRY-01 ToDo tree completion and reopen preserve layout boxes',async({page})=>{
  await setup(page,false);const open=await geometry(page);await page.locator('#row_ROW .doneBtn').click();const closed=await geometry(page);await page.locator('#row_ROW .doneBtn').click();const reopened=await geometry(page);
  expectStable(closed,open);expectStable(reopened,open);
});

test('PBL027-GEOMETRY-02 ToDo date completion and reopen preserve layout boxes',async({page})=>{
  await setup(page,true);const open=await geometry(page);await page.locator('#row_ROW .doneBtn').click();const closed=await geometry(page);await page.locator('#row_ROW .doneBtn').click();const reopened=await geometry(page);
  expectStable(closed,open);expectStable(reopened,open);
});

test('PBL027-GEOMETRY-03 exit visual preserves source inner vertical geometry',async({page})=>{
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(item=>{applyJsonObject({schema_version:'3.0',items:[item]},'geometry','geometry.json',null,{remember:false,writePermissionGranted:false});setMode('personal');setSortMode('date');setView('open')},task('ROW',{title:'長いタイトル'}));
  const read=locator=>locator.evaluate(row=>{const box=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return{row:box(row),cell:box(row.querySelector('.doneBtn').closest('td')),button:box(row.querySelector('.doneBtn')),title:box(row.querySelector('.titleText')),due:box(row.querySelector('.dueTxt'))}});
  const source=await read(page.locator('#row_ROW'));await page.locator('#row_ROW .doneBtn').click();const ghost=await read(page.locator('.pbl027ExitGhost[data-task-id="ROW"] tr'));
  for(const part of['button','title','due'])for(const key of['top','bottom','height'])expect(Math.abs(ghost[part][key]-source[part][key])).toBeLessThan(0.6);
  expect(Math.abs(ghost.row.height-source.row.height)).toBeLessThan(0.6);expect(Math.abs(ghost.cell.height-source.cell.height)).toBeLessThan(0.6);expect(ghost.button.width).toBeCloseTo(source.button.width,1);
});

test('PBL027-GEOMETRY-04 selected hover and keyboard focus do not alter completion geometry',async({page})=>{
  await setup(page,false);await page.evaluate(()=>{selectedTaskId='ROW';render()});await page.locator('#row_ROW').hover();await page.locator('#row_ROW .doneBtn').focus();const open=await geometry(page);await page.locator('#row_ROW .doneBtn').press('Enter');const closed=await geometry(page);expectStable(closed,open);
});
