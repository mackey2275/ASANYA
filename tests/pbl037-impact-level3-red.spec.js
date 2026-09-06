const {test,expect}=require('playwright/test');
const {APP}=require('./helpers/app-target');

const task=(id,impact_level,extra={})=>({id,parentId:'',title:id,state:'未着手',owner:'',due:'2026-09-20',planned_duration_days:2,summary:'',repeat:'',completed:false,dependencies:[],sortOrder:1000,impact_level,...extra});
async function boot(page){
  await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.evaluate(items=>{applyJsonObject({schema_version:'3.1',workspace_info_markdown:'',items},'pbl037','pbl037.json',null,{remember:false,writePermissionGranted:false});setView('all');setDisplayMode('todo-tree');clearUndoHistory('pbl037');dirty=false},[task('L2',2),task('L3',3,{sortOrder:2000}),task('DONE',3,{completed:true,sortOrder:3000}),task('MEMO',3,{state:'メモ',sortOrder:4000})]);
}
const stars=(page,id)=>page.locator(`#row_${id} .impactStars .impactStar`);

test('PBL037-TODO Level 3 uses semantic red stars while Level 2 stays unchanged',async({page})=>{
  await boot(page);await expect(stars(page,'L3')).toHaveCount(3);await expect(page.locator('#row_L3 .impactStar.impactLevel3')).toHaveCount(3);expect(await stars(page,'L3').first().evaluate(el=>getComputedStyle(el).color)).toBe('rgb(180, 35, 24)');await expect(page.locator('#row_L2 .impactStar.impactLevel3')).toHaveCount(0);expect(await stars(page,'L2').first().evaluate(el=>getComputedStyle(el).color)).toBe('rgb(224, 166, 0)');await expect(page.locator('#row_DONE .impactStar.impactLevel3')).toHaveCount(3)
});

test('PBL037-PROJECT Project Detail, Simple, and Memo share Level 3 styling',async({page})=>{
  await boot(page);for(const display of ['project-detail','project-simple']){await page.evaluate(display=>setDisplayMode(display),display);for(const id of ['L3','DONE','MEMO'])await expect(page.locator(`.ganttRow[data-task-id="${id}"] .impactStar.impactLevel3`)).toHaveCount(3);await expect(page.locator('.ganttRow[data-task-id="L2"] .impactStar.impactLevel3')).toHaveCount(0)}
});

test('PBL037-DYNAMIC 2 to 3 applies red and 3 to 2 removes it immediately',async({page})=>{
  await boot(page);await stars(page,'L2').nth(2).click();expect(await page.evaluate(()=>itemById('L2').impact_level)).toBe(3);await expect(page.locator('#row_L2 .impactStar.impactLevel3')).toHaveCount(3);await stars(page,'L2').nth(1).click();expect(await page.evaluate(()=>itemById('L2').impact_level)).toBe(2);await expect(page.locator('#row_L2 .impactStar.impactLevel3')).toHaveCount(0)
});

test('PBL037-DETAIL Task Detail uses the shared Level 3 class and updates dynamically',async({page})=>{
  await boot(page);await page.locator('#row_L2 .taskDetailOpenBtn').click();const detail=page.locator('#taskDetailPane .taskDetailImpactStars .impactStar');await expect(page.locator('#taskDetailPane .taskDetailImpactStars .impactStar.impactLevel3')).toHaveCount(0);await detail.nth(2).click();await expect(page.locator('#taskDetailPane .taskDetailImpactStars .impactStar.impactLevel3')).toHaveCount(3);expect(await page.evaluate(()=>itemById('L2').impact_level)).toBe(3);await page.locator('#taskDetailPane .taskDetailImpactStars .impactStar').nth(1).click();await expect(page.locator('#taskDetailPane .taskDetailImpactStars .impactStar.impactLevel3')).toHaveCount(0);expect(await page.evaluate(()=>itemById('L2').impact_level)).toBe(2)
});

test('PBL037-DATA visual rendering changes no persistence shape or extra history',async({page})=>{
  await boot(page);const before=await page.evaluate(()=>({keys:Object.keys(itemById('L3')).sort(),json:JSON.stringify(persistableData()),undo:undoStack.length}));await page.evaluate(()=>render());expect(await page.evaluate(()=>({keys:Object.keys(itemById('L3')).sort(),json:JSON.stringify(persistableData()),undo:undoStack.length}))).toEqual(before)
});
