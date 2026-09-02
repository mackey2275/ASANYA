const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',state:'未着手',impact_level:2,title:id,owner:'Alice',due:'2026-09-10',planned_duration_days:1,summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});

async function boot(page,width=1440){
  await page.setViewportSize({width,height:800});
  await page.goto(APP);
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.evaluate(xs=>{applyJsonObject({schema_version:'2.5',items:xs},'followup','followup.json',null,{remember:false,writePermissionGranted:false});setView('all');setMode('personal');clearUndoHistory('followup');dirty=false;saveState='saved';selectTask('A')},[task('A'),task('B',{owner:'Bob',sortOrder:2000})]);
}

test('PBL020-FOLLOWUP-01 closed Priority keeps 108px geometry and exposes the full label',async({page})=>{
  await boot(page);
  const result=await page.locator('#priorityFilterSelect').evaluate(el=>{
    const style=getComputedStyle(el),rect=el.getBoundingClientRect(),owner=document.getElementById('ownerFilterButton').getBoundingClientRect();
    const probe=document.createElement('canvas').getContext('2d');
    probe.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text=el.options[el.selectedIndex].text;
    const usable=rect.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth)-18;
    return{label:text,width:rect.width,height:rect.height,ownerHeight:owner.height,fontSize:style.fontSize,paddingRight:style.paddingRight,textWidth:probe.measureText(text).width,usable,order:Boolean(el.compareDocumentPosition(document.getElementById('ownerFilterButton'))&Node.DOCUMENT_POSITION_FOLLOWING)};
  });
  expect(result.label).toBe('優先度: すべて');
  expect(result.width).toBeCloseTo(108,0);
  expect(result.order).toBe(true);
  expect(Math.abs(result.height-result.ownerHeight)).toBeLessThanOrEqual(4);
  expect(result.fontSize).toBe('10px');
  expect(parseFloat(result.paddingRight)).toBeLessThan(20);
  expect(result.usable).toBeGreaterThan(result.textWidth);
});

test('PBL020-FOLLOWUP-02 filtering and responsive wrapping remain intact',async({page})=>{
  await boot(page,760);
  const geometry=await page.evaluate(()=>{const group=document.getElementById('pbl020Filters').getBoundingClientRect(),priority=document.getElementById('priorityFilterSelect').getBoundingClientRect(),owner=document.getElementById('ownerFilterButton').getBoundingClientRect();return{groupRight:group.right,viewport:innerWidth,sameRow:Math.abs(priority.y-owner.y)<3}});
  expect(geometry.groupRight).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.sameRow).toBe(true);
  await page.evaluate(()=>{ownerFilterValues=new Set(['Alice','Bob']);setPriorityFilter(2)});
  expect(await page.evaluate(()=>visible().map(row=>row.x.id))).toEqual(['A','B']);
  await page.evaluate(()=>setPriorityFilter(3));
  expect(await page.evaluate(()=>visible().map(row=>row.x.id))).toEqual([]);
});

test('PBL029-FOLLOWUP-01 Due guide uses the approved explicit order and wording',async({page})=>{
  await boot(page);
  const text=await page.locator('#shortcutHelp').innerText();
  expect(text).toContain('D→E＝期限編集');
  expect(text).toContain('D→0〜9＝今日〜9日後');
  expect(text.indexOf('D→E＝期限編集')).toBeLessThan(text.indexOf('D→0〜9＝今日〜9日後'));
  expect(text).not.toContain('（全角可）');
  expect(text).not.toContain('Alt+M');
  expect(text).not.toContain('Alt+I');
});

test('PBL029-FOLLOWUP-02 shortcut behavior remains unchanged',async({page})=>{
  await boot(page);
  await page.keyboard.press('d');await page.keyboard.press('e');await expect(page.locator('#row_A #d0')).toBeFocused();
  await boot(page);await page.keyboard.press('d');await page.keyboard.press('1');await expect(page.locator('#row_A #d0')).toBeFocused();
  await boot(page);await page.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Ｄ',bubbles:true,cancelable:true})));await page.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'１',bubbles:true,cancelable:true})));await expect(page.locator('#row_A #d0')).toBeFocused();
  await boot(page);await page.keyboard.press('s');await expect(page.locator('#taskSearchPopup')).toBeVisible();
  await boot(page);await page.keyboard.press('p');expect(await page.evaluate(()=>displayModeKey())).toBe('project-detail');
  await page.keyboard.press('t');expect(await page.evaluate(()=>displayModeKey())).toBe('todo-tree');
  await page.keyboard.press('F2');await expect(page.locator('#row_A .titleText')).toBeFocused();
});
