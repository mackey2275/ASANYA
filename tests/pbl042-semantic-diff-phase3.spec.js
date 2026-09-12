const {test,expect}=require('playwright/test');
const {installFsAccessMock}=require('./helpers/fs-access-mock');
const {APP}=require('./helpers/app-target');

const task=(id,extra={})=>({id,parentId:'',state:'',impact_level:0,title:id,owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1000,...extra});
const snapshot=(id,at,items)=>({snapshot_id:id,captured_at:at,product_version:'3.2.0',schema_version:'3.2',snapshot_format_version:'1.0',items});
const old=(items)=>snapshot('old','2026-09-10T00:00:00.000Z',items),newer=(items)=>snapshot('new','2026-09-11T00:00:00.000Z',items);
const generate=(page,a,b,generatedAt='2026-09-11T12:34:56.000Z')=>page.evaluate(({a,b,generatedAt})=>buildSemanticDiff(a,b,{generatedAt}),{a,b,generatedAt});

test.beforeEach(async({page})=>{await installFsAccessMock(page);await page.goto(APP);await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page).toHaveTitle('ASANYA v3.2.0');expect(await page.evaluate(()=>({schema:CURRENT_SCHEMA_VERSION,version:SEMANTIC_DIFF_VERSION}))).toEqual({schema:'3.2',version:'0.1'})});

test('PBL042-P3-01 identical/add/delete/change mixed union has exact counts and task-id ordering',async({page})=>{
  const diff=await generate(page,old([task('z'),task('d'),task('c',{title:'before'})]),newer([task('z'),task('a'),task('c',{title:'after'})]));
  expect(diff.summary).toEqual({total_tasks:4,added:1,deleted:1,changed:1,unchanged:1});expect(diff.tasks.map(x=>[x.task_id,x.change_type])).toEqual([['a','added'],['c','changed'],['d','deleted'],['z','unchanged']]);
  expect(diff.tasks[0]).toMatchObject({before:null,after:task('a'),changes:[{type:'task_added',field:null,before:null,after:'a'}]});expect(diff.tasks[2]).toMatchObject({before:task('d'),after:null,changes:[{type:'task_deleted'}]});expect(diff.tasks[3]).toHaveProperty('current');expect(diff.tasks[3].changes).toEqual([]);
});

test('PBL042-P3-02 completed/reopened use completed while status remains independent and ordered',async({page})=>{
  let diff=await generate(page,old([task('A',{state:'未着手'})]),newer([task('A',{state:'完了',completed:true})]));expect(diff.tasks[0].changes.map(x=>[x.type,x.field])).toEqual([['task_completed','completed'],['status_changed','state']]);
  diff=await generate(page,old([task('A',{state:'完了',completed:true})]),newer([task('A',{state:'進行中',completed:false})]));expect(diff.tasks[0].changes.map(x=>x.type)).toEqual(['task_reopened','status_changed']);
  diff=await generate(page,old([task('A',{state:'未着手',completed:false})]),newer([task('A',{state:'完了',completed:false})]));expect(diff.tasks[0].changes.map(x=>x.type)).toEqual(['status_changed']);
});

test('PBL042-P3-03 hierarchy movement uses each snapshot graph and paths are cycle/missing-parent safe',async({page})=>{
  const before=[task('A',{title:'Project A'}),task('B',{parentId:'A',title:'Parent B'}),task('T',{parentId:'B',title:'Task'})],after=[task('C',{title:'Project C'}),task('T',{parentId:'C',title:'Task'})],diff=await generate(page,old(before),newer(after)),entry=diff.tasks.find(x=>x.task_id==='T');
  expect(entry.changes[0]).toMatchObject({type:'hierarchy_moved',field:'parentId',before:'B',after:'C'});expect(entry.context_before).toEqual({path_ids:['A','B','T'],path_titles:['Project A','Parent B','Task'],path:'Project A > Parent B > Task'});expect(entry.context_after.path).toBe('Project C > Task');
  const robust=await generate(page,old([task('M',{parentId:'missing'}),task('X',{parentId:'Y'}),task('Y',{parentId:'X'})]),newer([task('M',{parentId:'missing'}),task('X',{parentId:'Y'}),task('Y',{parentId:'X'})]));expect(robust.tasks.find(x=>x.task_id==='M').context_current.path_ids).toEqual(['M']);expect(robust.tasks.find(x=>x.task_id==='X').context_current.path_ids).toEqual(['Y','X']);
});

test('PBL042-P3-04 due add/remove/change and planned start derivation cover due, duration, both, unavailable',async({page})=>{
  const cases=[
    [task('A',{due:'2026-09-10',planned_duration_days:3}),task('A',{due:'2026-09-12',planned_duration_days:3}),['due_changed','planned_start_changed']],
    [task('A',{due:'2026-09-10',planned_duration_days:3}),task('A',{due:'2026-09-10',planned_duration_days:5}),['planned_duration_changed','planned_start_changed']],
    [task('A',{due:'2026-09-10',planned_duration_days:3}),task('A',{due:'2026-09-14',planned_duration_days:2}),['due_changed','planned_duration_changed','planned_start_changed']],
    [task('A'),task('A',{due:'2026-09-10'}),['due_changed']],
    [task('A',{due:'2026-09-10'}),task('A'),['due_changed']]
  ];
  for(const [a,b,types] of cases){const diff=await generate(page,old([a]),newer([b]));expect(diff.tasks[0].changes.map(x=>x.type)).toEqual(types)}
  const derived=(await generate(page,old([task('A',{due:'2026-09-10',planned_duration_days:3})]),newer([task('A',{due:'2026-09-12',planned_duration_days:3})]))).tasks[0].changes.find(x=>x.type==='planned_start_changed');expect(derived).toEqual({type:'planned_start_changed',field:'planned_start',before:'2026-09-08',after:'2026-09-10',derived_from:['due','planned_duration_days']});
});

test('PBL042-P3-05 actual, owner, impact, status, title and full Summary facts preserve values',async({page})=>{
  const long='長い概要\n'.repeat(200),a=task('A',{actual_start:'2026-09-01',actual_start_source:'system',owner:'Sato',impact_level:1,state:'未着手',title:'旧',summary:long}),b=task('A',{actual_start:'2026-09-02',actual_start_source:'user',actual_end:'2026-09-03',actual_end_source:'user',owner:'',impact_level:3,state:'進行中',title:'新',summary:''}),changes=(await generate(page,old([a]),newer([b]))).tasks[0].changes;
  expect(changes.map(x=>x.type)).toEqual(['actual_start_changed','actual_end_changed','actual_start_source_changed','actual_end_source_changed','owner_changed','impact_level_changed','status_changed','title_changed','summary_changed']);expect(changes.find(x=>x.type==='summary_changed')).toMatchObject({before:long,after:''});expect(changes.find(x=>x.type==='actual_end_changed')).toMatchObject({before:null,before_present:false,after:'2026-09-03',after_present:true});
});

test('PBL042-P3-06 dependencies add/remove/type-change are semantic and array reorder is unchanged',async({page})=>{
  const before=task('S',{dependencies:[{task_id:'A',type:'finish_to_start'},{task_id:'B',type:'finish_to_finish'}]}),after=task('S',{dependencies:[{task_id:'A',type:'finish_to_finish'},{task_id:'C',type:'finish_to_start'}]}),changes=(await generate(page,old([before]),newer([after]))).tasks[0].changes;
  expect(changes).toEqual([{type:'dependency_type_changed',field:'dependencies',task_id:'A',before:'finish_to_start',after:'finish_to_finish'},{type:'dependency_removed',field:'dependencies',task_id:'B',before:{task_id:'B',type:'finish_to_finish'},after:null},{type:'dependency_added',field:'dependencies',task_id:'C',before:null,after:{task_id:'C',type:'finish_to_start'}}]);
  const reorder=await generate(page,old([before]),newer([task('S',{dependencies:[...before.dependencies].reverse()})]));expect(reorder.tasks[0]).toMatchObject({change_type:'unchanged',changes:[]});expect(reorder.summary.unchanged).toBe(1);expect(reorder.tasks[0]).toHaveProperty('before');
});

test('PBL042-P3-07 recurrence enabled/disabled/pattern/rule/base changes use canonical fields',async({page})=>{
  const enabled=task('R',{repeat:'毎週',recurrence_rule:{type:'weekly',weekdays:[1]},recurrence_schedule_date:'2026-09-14'}),disabled=task('R');let types=(await generate(page,old([disabled]),newer([enabled]))).tasks[0].changes.map(x=>x.type);expect(types).toEqual(['recurrence_enabled','recurrence_rule_changed','recurrence_base_date_changed']);
  types=(await generate(page,old([enabled]),newer([disabled]))).tasks[0].changes.map(x=>x.type);expect(types).toEqual(['recurrence_disabled','recurrence_rule_changed','recurrence_base_date_changed']);
  const changed=task('R',{repeat:'毎月',recurrence_rule:{type:'monthly',mode:'date',day:20},recurrence_schedule_date:'2026-10-20'});types=(await generate(page,old([enabled]),newer([changed]))).tasks[0].changes.map(x=>x.type);expect(types).toEqual(['recurrence_pattern_changed','recurrence_rule_changed','recurrence_base_date_changed']);
});

test('PBL042-P3-08 sortOrder-only difference is unchanged with raw evidence',async({page})=>{const diff=await generate(page,old([task('A',{sortOrder:1000})]),newer([task('A',{sortOrder:9000})])),entry=diff.tasks[0];expect(entry).toMatchObject({change_type:'unchanged',before:{sortOrder:1000},after:{sortOrder:9000},changes:[]});expect(diff.summary).toEqual({total_tasks:1,added:0,deleted:0,changed:0,unchanged:1})});

test('PBL042-P3-09 generic persisted source/asana/history differences are never lost and preserve null',async({page})=>{const diff=await generate(page,old([task('A',{source:'ASANA',asana_task_id:'1',history:[null]})]),newer([task('A',{source:'',asana_task_id:'2',history:[]})])),changes=diff.tasks[0].changes;expect(changes.map(x=>[x.type,x.field])).toEqual([['field_changed','asana_task_id'],['field_changed','history'],['field_changed','source']]);expect(changes.find(x=>x.field==='history').before).toEqual([null])});

test('PBL042-P3-10 caller order normalizes by captured_at and equal time rejects',async({page})=>{const a=old([task('A',{title:'old'})]),b=newer([task('A',{title:'new'})]),forward=await generate(page,a,b),reverse=await generate(page,b,a);expect(reverse).toEqual(forward);expect(forward.comparison.before.snapshot_id).toBe('old');expect(forward.comparison.after.snapshot_id).toBe('new');const equal=snapshot('equal','2026-09-10T00:00:00.000Z',[task('A')]);await expect(generate(page,a,equal)).rejects.toThrow(/同一/)});

test('PBL042-P3-11 compatibility rejects unsupported format, Schema, and invalid input',async({page})=>{const valid=old([task('A')]);for(const candidate of [{...valid,snapshot_format_version:'2.0'},{...valid,schema_version:'3.1'},{...valid,items:null}])await expect(generate(page,candidate,newer([task('A')]))).rejects.toThrow()});

test('PBL042-P3-12 engine is pure across inputs, live runtime, persistence, dirty and Undo',async({page})=>{
  const a=old([task('A')]),b=newer([task('A',{title:'changed'})]),inputA=JSON.stringify(a),inputB=JSON.stringify(b);await page.evaluate(async()=>{const root={schema_version:'3.2',workspace_info_markdown:'live',items:[{id:'LIVE',parentId:'',state:'',impact_level:0,title:'Live',owner:'',due:'',summary:'',repeat:'',completed:false,source:'',asana_task_id:'',history:[],dependencies:[],sortOrder:1}],snapshots:[]},text=JSON.stringify(root),handle=__fsMock.create('primary',{name:'primary.json',text,writePermission:'granted'}),file=await handle.getFile();await applyJsonObject(root,'pure',file.name,handle,{remember:false,writePermissionGranted:true,fileText:text,fileModified:file.lastModified,fileSize:file.size});clearUndoHistory('pure')});const before=await page.evaluate(()=>({data:JSON.stringify(data),dirty,undo:undoStack.length,redo:redoStack.length,writes:__fsMock.snapshot('primary').writeCount}));await generate(page,a,b);expect(JSON.stringify(a)).toBe(inputA);expect(JSON.stringify(b)).toBe(inputB);expect(await page.evaluate(()=>({data:JSON.stringify(data),dirty,undo:undoStack.length,redo:redoStack.length,writes:__fsMock.snapshot('primary').writeCount}))).toEqual(before);
});

test('PBL042-P3-13 generated_at injection and representative change order are deterministic',async({page})=>{
  const a=task('A',{parentId:'P',due:'2026-09-10',planned_duration_days:2,owner:'A',impact_level:1,state:'未着手',title:'A',summary:'A',dependencies:[{task_id:'P',type:'finish_to_start'}],source:'x'}),b=task('A',{parentId:'',due:'2026-09-12',planned_duration_days:3,owner:'B',impact_level:2,state:'進行中',title:'B',summary:'B',dependencies:[],source:'y',completed:true}),first=await generate(page,old([task('P'),a]),newer([b]),'2026-09-11T09:00:00.000Z'),second=await generate(page,old([task('P'),a]),newer([b]),'2026-09-11T09:00:00.000Z');expect(second).toEqual(first);expect(first.generated_at).toBe('2026-09-11T09:00:00.000Z');expect(first.tasks.find(x=>x.task_id==='A').changes.map(x=>x.type)).toEqual(['task_completed','hierarchy_moved','due_changed','planned_duration_changed','planned_start_changed','owner_changed','impact_level_changed','status_changed','title_changed','summary_changed','dependency_removed','field_changed']);
});
