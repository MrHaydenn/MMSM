// Execute the actual UI functions and event handlers in a minimal DOM harness.
// These tests cover behavior/markup, not browser layout or rendering.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../mmsm/static/app.js'),'utf8');
function harness(){
 const elements=new Map(),handlers=new Map(),timers=new Map();let timerId=0;
 function element(){return {innerHTML:'',textContent:'',hidden:false,open:false,disabled:false,scrollTop:0,attributes:{},dataset:{},setAttribute(k,v){this.attributes[k]=v;},showModal(){this.open=true;},close(){this.open=false;},classList:{contains(){return false;}}};}
 for(const id of ['app','toast','modal','activity-popover','unread','download-count','search-results','content','breadcrumb'])elements.set('#'+id,element());
 const triggers=['downloads','notifications'].map(kind=>({...element(),dataset:{action:kind+'-popup'}}));
 const document={readyState:'loading',hidden:false,activeElement:null,querySelector:s=>{
  if(s.startsWith('[data-install=')){if(!elements.has(s))elements.set(s,element());return elements.get(s);}
  return elements.get(s)||null;
 },querySelectorAll:s=>s==='.activity-trigger'?triggers:[],addEventListener:(name,fn)=>{handlers.set(name,fn);}};
 class FormData {constructor(form){this.data=form.values;}get(k){return this.data[k]??null;}[Symbol.iterator](){return Object.entries(this.data)[Symbol.iterator]();}}
 const context=vm.createContext({document,console,URL,FormData,Set,Map,JSON,Number,Date,Promise,CSS:{escape:s=>s},setInterval(){},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
 vm.runInContext(source,context);
 const run=code=>vm.runInContext(code,context);
 run("user={id:'owner',username:'Hayden',role:'owner'};csrf='csrf';");
 return {run,context,document,elements,handlers,timers,form:(kind,values)=>({dataset:{form:kind},values,querySelector(){return element();},closest(){return null;},reset(){}})};
}
const sample={id:'s1',name:'Test world',loader:'fabric',loader_version:'0.16',minecraft:'1.20.1',port:25565,memory_mb:6144,sleep:true,idle_minutes:15,status:'running',mods:[],launch:{java_major:17},metrics:{ram:1073741824}};

test('RAM forms display GB and convert fractional GB to compatible stored MB',()=>{
 const h=harness();assert.equal(h.run("memoryToMB('6.5')"),6656);
 assert.equal(h.run("memoryToMB('0.5')"),512);
 assert.throws(()=>h.run("memoryToMB('Infinity')"));assert.throws(()=>h.run("memoryToMB('0.1')"));
 const html=h.run("memoryField('memory_gb',6144)");
 assert.match(html,/allocation \(GB\)/);assert.match(html,/value="6"/);assert.match(html,/step="any"/);
 assert.equal(h.run('ram(536870912)'), '0.5 GB');
});

test('navigation moves activity and username to the header with a Servers entry',()=>{
 const h=harness();h.run('shell()');const html=h.elements.get('#app').innerHTML;
 const sidebar=html.split('</aside>')[0],header=html.split('<header')[1];
 assert.match(sidebar,/data-route="servers"/);
 assert.doesNotMatch(sidebar,/data-route="downloads"|data-route="notifications"|Hayden/);
 assert.match(header,/downloads-popup/);assert.match(header,/notifications-popup/);assert.match(header,/Account settings for Hayden/);
 assert.doesNotMatch(html,/Connected to manager|data-action="password"|data-action="logout"/);
});

test('Stop sends the request directly without a confirmation dialog',async()=>{
 const h=harness();h.run("calls=[];api=async(...args)=>{calls.push(args);return {};};render=async()=>{};");
 await h.run("perform('server-stop','s1',{})");
 assert.equal(h.run("calls[0][0]"),'/servers/s1/stop');assert.equal(h.elements.get('#modal').open,false);
});

test('Kill uses an explicit warning and performs the force-kill after its action',async()=>{
 const h=harness();h.run("calls=[];api=async(...args)=>{calls.push(args);return {};};refreshServerPanels=async()=>{};");
 await h.run("perform('server-kill','s1',{})");
 assert.equal(h.run('calls.length'),0);assert.match(h.elements.get('#modal').innerHTML,/without saving the world/);
 await h.run("perform('confirm-server-kill','s1',{})");assert.equal(h.run('calls[0][0]'),'/servers/s1/kill');
});

test('download popup auto-opens, closes after completion, and retains history',()=>{
 const h=harness();h.run("reconcileDownloads([{id:'d1',name:'mod.jar',status:'downloading',bytes:5,total:10}])");
 assert.equal(h.run('popoverKind'),'downloads');assert.equal(h.elements.get('#activity-popover').hidden,false);
 assert.match(h.elements.get('#activity-popover').innerHTML,/mod.jar/);
 h.run("reconcileDownloads([{id:'d1',name:'mod.jar',status:'completed',bytes:10,total:10}])");
 const id=h.run('downloadCloseTimer');assert.ok(id);h.timers.get(id)();
 assert.equal(h.run('popoverKind'),null);assert.equal(h.run('downloadRows.length'),1);
 h.run("openPopover('downloads')");assert.match(h.elements.get('#activity-popover').innerHTML,/completed/);
});

test('manual downloads popup remains open and click-away closes notifications',async()=>{
 const h=harness();h.run("openPopover('downloads');reconcileDownloads([])");assert.equal(h.run('downloadCloseTimer'),null);
 h.run("closePopover();openPopover('notifications')");
 await h.handlers.get('click')({target:{closest(){return null;}}});
 assert.equal(h.run('popoverKind'),null);assert.equal(h.elements.get('#activity-popover').hidden,true);
});

test('dismissing an active batch does not reopen it on the next transfer',()=>{
 const h=harness();h.run("reconcileDownloads([{id:'a',status:'downloading'}]);closePopover();reconcileDownloads([{id:'a',status:'completed'},{id:'b',status:'downloading'}]);");
 assert.equal(h.run('popoverKind'),null);
 h.run("reconcileDownloads([{id:'a',status:'completed'},{id:'b',status:'completed'}]);reconcileDownloads([{id:'c',status:'downloading'}]);");
 assert.equal(h.run('popoverKind'),'downloads');
});

test('fast downloads still open the popup and later batches can auto-close',()=>{
 const h=harness();h.run("reconcileDownloads([]);reconcileDownloads([{id:'a',status:'completed'}]);");
 assert.equal(h.run('popoverKind'),'downloads');
 h.timers.get(h.run('downloadCloseTimer'))();
 h.run("reconcileDownloads([{id:'b',status:'downloading'}]);reconcileDownloads([{id:'b',status:'completed'}]);");
 assert.ok(h.run('downloadCloseTimer'));h.timers.get(h.run('downloadCloseTimer'))();assert.equal(h.run('popoverKind'),null);
});

test('search pagination uses offsets and renders icons, version controls and install',async()=>{
 const h=harness();h.context.server=sample;
 h.run("route='server';tab='mods';sid='s1';currentServer=server;modSearch={sid:'s1',query:'sodium',type:'mod',page:0};calls=[];api=async(url)=>{calls.push(url);return url.startsWith('/modrinth/search')?{total_hits:37,hits:[{project_id:'p1',title:'Example',description:'A mod',icon_url:'https://cdn.modrinth.com/icon.png',downloads:12,author:'A',versions:['1.20.1','1.21']}]}:{latest_id:'v1',versions:[{id:'v1',project_id:'p1',version_number:'1',version_type:'release',game_versions:['1.20.1']}]};};");
 await h.run('searchMods(null,2)');
 assert.match(h.run('calls[0]'),/offset=24&limit=12/);assert.match(h.run('calls[0]'),/q=sodium/);
 const html=h.elements.get('#search-results').innerHTML;
 assert.match(html,/Page 3 of 4/);assert.match(html,/cdn.modrinth.com\/icon.png/);assert.match(html,/data-action="mod-page"/);
 const control=h.run('modVersionControl(modSearch.hits[0])');assert.match(control,/data-action="mod-versions"/);assert.doesNotMatch(control,/<select/);assert.equal(h.run('modSearch.hits[0].latestId'),'v1');assert.ok(h.run("calls.some(p=>p.startsWith('/modrinth/compatible'))"));assert.match(control,/>Install</);
});

test('project-card install asks the backend for the latest compatible version without a modal',async()=>{
 const h=harness();h.context.server=sample;
 h.run("route='server';tab='mods';sid='s1';currentServer=server;modSearch={type:'mod',hits:[{project_id:'p1',selectedVersion:'v2',title:'Example',versions:[{id:'v2',version_number:'2'}]}]};calls=[];api=async(...args)=>{calls.push(args);return {};};beginInstall=()=>{};");
 await h.run("perform('mod-card-install','p1',{})");
 assert.equal(h.run('calls[0][0]'),'/servers/s1/project-install');assert.equal(h.run('calls[0][2].project_id'),'p1');assert.equal(h.run('calls[0][2].version_id'),undefined);assert.equal(h.elements.get('#modal').open,false);
});

test('installed update badges name the server Minecraft version and escape content',()=>{
 const h=harness();h.context.server={...sample,mods:[{project_id:'p',name:'<script>',version:'1',enabled:true,update:{id:'v2',name:'2'}}]};
 const html=h.run('installedMods(server)');assert.match(html,/Update: 2 · Minecraft 1.20.1/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(h.run("projectImage('https://evil.example/icon.png','mod')"),/<img/);
});

test('file manager includes upload and per-file deletion, not recursive folder deletion',()=>{
 const h=harness();h.run("filePath='mods'");
 const html=h.run("filesBody({entries:[{name:'mod.jar',directory:false,symlink:false,size:20},{name:'folder',directory:true,symlink:false,size:0}]})");
 assert.match(html,/Upload files/);assert.match(html,/type="file" multiple/);assert.match(html,/data-action="file-delete" data-id="mods\/mod.jar"/);assert.doesNotMatch(html,/data-action="file-delete" data-id="mods\/folder"/);
});

test('account settings contains logout and password fields, not topbar controls',()=>{
 const h=harness();h.run('accountSettingsModal()');const html=h.elements.get('#modal').innerHTML;
 assert.match(html,/Hayden/);assert.match(html,/data-action="logout"/);assert.match(html,/Current password/);assert.match(html,/Save password/);
});

test('creation submit converts GB before calling the existing server API',async()=>{
 const h=harness();h.run("calls=[];api=async(...args)=>{calls.push(args);return {id:'new'};};navigate=async()=>{};beginInstall=()=>{};");
 await h.handlers.get('submit')({preventDefault(){},target:h.form('create-server',{name:'New',memory_gb:'6.5',port:'25566',loader:'fabric',minecraft:'1.20.1',loader_version:'0.16',eula:'on'})});
 assert.equal(h.run('calls[0][2].memory_mb'),6656);assert.equal(h.run("'memory_gb' in calls[0][2]"),false);
});

test('a failed binary-file open preserves the folder used for uploads',async()=>{
 const h=harness();h.run("filePath='mods';render=async()=>{throw new Error('Binary file');};");
 await assert.rejects(h.run("perform('file-open','mods/example.jar',{dataset:{}})"),/Binary file/);
 assert.equal(h.run('filePath'),'mods');
});

test('missing version IDs never compare equal to an absent installed modpack',()=>{
 const h=harness();h.context.sample=sample;h.run('currentServer=sample');
 const html=h.run("modVersionControl({project_id:'p',title:'Demo',compatibleVersions:[],latestId:undefined})");
 assert.doesNotMatch(html,/>Installed</);assert.match(html,/No compatible server versions/);assert.match(html,/disabled/);
 const available=h.run("modVersionControl({project_id:'p',title:'Demo',compatibleVersions:[{id:'v1',project_id:'p',version_number:'One'}],latestId:'v1'})");
 assert.match(available,/>Install</);assert.doesNotMatch(available,/disabled/);
 h.run("currentServer={...sample,mods:[{project_id:'p',version_id:'v1'}]}");
 assert.match(h.run("modVersionControl({project_id:'p',title:'Demo',compatibleVersions:[{id:'v1',project_id:'p',version_number:'One'}],latestId:'v1'})"),/>Installed</);
});
test('incomplete upstream version objects show a recoverable error instead of blank installed entries',async()=>{
 const h=harness();h.context.sample=sample;
 h.run("currentServer=sample;sid=sample.id;route='server';tab='mods';modSearch={sid,sequence:1,type:'mod',hits:[{project_id:'p',title:'Demo'}]};api=async()=>({versions:[{game_versions:['1.20.1']}]})");
 await h.run('hydrateModCards(1)');assert.match(h.run("modSearch.hits[0].versionError"),/incomplete/);
 assert.doesNotMatch(h.run('modVersionControl(modSearch.hits[0])'),/>Installed</);
});
test('installed and discovery tabs are separate and status circles/icons are consistent',()=>{
 const h=harness();h.context.sample={...sample,icon:true};
 h.run('currentServer=sample;sid=sample.id;modView="installed"');
 assert.match(h.run('modsBody(sample)'),/Installed projects/);assert.doesNotMatch(h.run('modsBody(sample)'),/id="search-results"/);
 h.run('modView="discover"');assert.match(h.run('modsBody(sample)'),/id="search-results"/);assert.doesNotMatch(h.run('modsBody(sample)'),/id="installed-mods"/);
 for(const fn of ['serverHeader(sample)','serverCard(sample)','serversPage([sample])']){
  const html=h.run(fn);assert.match(html,/status-circle running/);assert.match(html,/\/api\/servers\/s1\/icon/);
 }
 assert.doesNotMatch(h.run('serverHeader(sample)'),/Your servers/);assert.match(h.run('serverHeader(sample)'),/Restart/);
});
test('settings exposes global EULA acceptance and appearance and player notifications expose actions',()=>{
 const h=harness();h.context.defaults={web_port:3000,running_web_port:3000,default_memory_mb:4096};
 assert.match(h.run('settingsPage(defaults)'),/name="auto_eula"/);
 assert.match(h.run('settingsPage(defaults)'),/name="theme"/);
 assert.match(h.run("notificationActions({kind:'whitelist',id:'n',payload:{name:'Steve'}})"),/request-approve/);
 assert.match(h.run("notificationActions({kind:'runtime',id:'n',server_id:'s1',payload:{tab:'config'}})"),/Review server update/);
 assert.match(h.run("notificationActions({kind:'whitelist',id:'n',resolved:1})"),/Resolved/);
});
test('account server checkboxes default selected and preserve an explicit restricted scope',async()=>{
 const h=harness();h.context.rows=[{id:'a',name:'A'},{id:'b',name:'B'}];
 h.run("api=async path=>path.includes('archive')?[]:rows");await h.run('accountModal()');
 let html=h.elements.get('#modal').innerHTML;assert.equal((html.match(/name="server_access"[^>]*checked/g)||[]).length,2);
 await h.run("accountModal({id:'u',username:'limited',role:'viewer',server_ids:['a']})");
 html=h.elements.get('#modal').innerHTML;assert.equal((html.match(/name="server_access"[^>]*checked/g)||[]).length,1);
});
test('backup schedule forms offer intervals and selected backup rules',()=>{
 const h=harness();h.run("backupData={rules:[{id:'r',name:'Daily',keep:7,path:'Backups/Test'}],schedules:[],history:[]}");
 h.run('scheduleModal()');const html=h.elements.get('#modal').innerHTML;
 for(const value of ['seconds','days','weeks','restart','backup'])assert.match(html,new RegExp('value="'+value+'"'));
 assert.match(html,/value="r"/);assert.match(html,/name="every"/);
});
test('retrying malformed mod versions clears stale empty arrays and fetches valid versions',async()=>{
 const h=harness();h.context.sample=sample;
 h.run("currentServer=sample;sid=sample.id;route='server';tab='mods';modSearch={sid,sequence:1,type:'mod',hits:[{project_id:'p',title:'Demo',versions:['1.20.1'],compatibleVersions:[],versionError:'incomplete'}]};api=async()=>({latest_id:'v1',versions:[{id:'v1',project_id:'p',version_number:'1.0',game_versions:['1.20.1']}]}) ");
 await h.run("loadProjectVersions(modSearch.hits[0])");
 assert.equal(h.run('modSearch.hits[0].latestId'),'v1');assert.equal(h.run('modSearch.hits[0].versionError'),null);
 assert.match(h.run('modVersionControl(modSearch.hits[0])'),/1.0/);
});
test('deselecting a server disables unrestricted access and account submission preserves the chosen scope',async()=>{
 const h=harness();let all={checked:true};
 await h.handlers.get('change')({target:{name:'server_access',checked:false,dataset:{},closest(){return {querySelector(){return all;}}}}});assert.equal(all.checked,false);
 h.context.saved=[];h.run('api=async(path,method,data)=>{saved.push({path,method,data});return {}};render=async()=>{}');
 let form=h.form('account',{username:'test',role:'admin',password:'correct-horse-battery'});form.querySelectorAll=()=>[{value:'a'}];
 await h.handlers.get('submit')({preventDefault(){},target:form});assert.deepEqual(JSON.parse(h.run('JSON.stringify(saved[0].data.server_ids)')),['a']);
 form=h.form('account',{username:'full',role:'admin',password:'correct-horse-battery',all_servers:'on'});
 await h.handlers.get('submit')({preventDefault(){},target:form});assert.equal(h.run('saved[1].data.server_ids'),null);
});

test('version modal lists compatible versions and installs the chosen version',async()=>{
 const h=harness();h.context.sample=sample;h.elements.set('#versions-loading',{});
 h.run("sid='s1';currentServer=sample;modSearch={sid:'s1',type:'mod',hits:[{project_id:'p',title:'Project',versions:['1.20.1']}]};api=async()=>({latest_id:'new',versions:[{id:'new',project_id:'p',name:'Newest',version_number:'2.0',version_type:'release',published:100},{id:'old',project_id:'p',name:'Older',version_number:'1.0',version_type:'beta',published:50}]})");
 await h.run('projectVersionsModal(modSearch.hits[0])');const html=h.elements.get('#modal').innerHTML;
 assert.match(html,/2.0/);assert.match(html,/1.0/);assert.match(html,/mod-version-install/);assert.doesNotMatch(html,/<select/);
 h.run('saved=[];api=async(...args)=>{saved.push(args);return {version:"1.0"}};beginInstall=()=>{}');
 await h.run("perform('mod-version-install',JSON.stringify({project_id:'p',version_id:'old',type:'mod',server_id:'s1'}),{})");
 assert.equal(h.run('saved[0][0]'),'/servers/s1/project-install');assert.equal(h.run('saved[0][2].version_id'),'old');assert.equal(h.elements.get('#modal').open,false);
});
test('download popup includes all active transfers and only three finished entries with full history navigation',()=>{
 const h=harness();h.context.rows=[...Array.from({length:8},(_,i)=>({id:String(i),status:'completed',name:'file'+i})),{id:'active',status:'downloading',name:'Active'}];
 assert.equal(h.run('popupDownloads(rows).length'),4);
 h.run('downloadRows=rows;openPopover("downloads")');const html=h.elements.get('#activity-popover').innerHTML;
 assert.match(html,/Active/);assert.match(html,/file2/);assert.doesNotMatch(html,/file3/);assert.match(html,/View all history/);
});
test('dashboard starts with statistics and puts Create beside Your servers',()=>{
 const h=harness();h.context.data={minecraft:{players:0,cpu:0,ram:0,rx_rate:0,tx_rate:0},host:{cpu:0,ram_used:0,ram_total:1},other:{cpu:0,ram:0},servers:[]};
 const html=h.run('renderDashboard(data,[])');assert.ok(html.startsWith('<div class="stats">'));assert.doesNotMatch(html,/Your server room|Good to see/);
 assert.ok(html.indexOf('Your servers')<html.indexOf('Create server'));assert.match(html,/section-head/);
});
test('server sections follow the requested order and lifecycle colors are explicit',()=>{
 const h=harness();h.context.sample=sample;const html=h.run('serverHeader(sample)');
 const names=['overview','console','files','properties','players','mods','backups','config'];let previous=-1;
 for(const name of names){const i=html.indexOf('data-tab="'+name+'"');assert.ok(i>previous,name);previous=i;}
 assert.match(html,/server-tabs/);assert.match(html,/control-stop/);assert.match(html,/control-restart/);assert.match(html,/control-kill/);
});
test('whole-card click and keyboard open the server, while nested controls keep their own action',async()=>{
 const h=harness();h.run('visits=[];navigate=async(...args)=>visits.push(args)');const card={dataset:{serverCard:'s1'}};
 await h.handlers.get('click')({target:{closest:selector=>selector==='[data-server-card]'?card:null}});
 assert.equal(h.run('visits[0][1]'),'s1');
 let prevented=false;h.handlers.get('keydown')({key:'Enter',preventDefault(){prevented=true;},target:{matches:()=>true,dataset:{serverCard:'s2'}}});assert.ok(prevented);assert.equal(h.run('visits[1][1]'),'s2');
 h.run('actions=[];perform=async(action,id)=>actions.push([action,id])');const stop={dataset:{action:'server-stop',id:'s1'}};
 await h.handlers.get('click')({target:{closest:selector=>selector==='button'?stop:selector==='[data-server-card]'?card:null}});
 assert.equal(h.run('visits.length'),2);assert.equal(h.run('actions[0][0]'),'server-stop');
});
test('historical analytics use daily player-hours and bytes instead of live stats',()=>{
 const h=harness();h.context.history={days:30,totals:{player_hours:12,rx_bytes:1024,tx_bytes:2048},series:[{ts:100,player_hours:1,rx_bytes:100,tx_bytes:20},{ts:86500,player_hours:2,rx_bytes:200,tx_bytes:40}],servers:[],first_sample:100};
 const html=h.run('renderAnalytics(history)');assert.match(html,/Combined player time/);assert.match(html,/Network bandwidth used/);assert.match(html,/Month/);assert.doesNotMatch(html,/class="stats"|CPU usage|Memory usage/);
});
test('server deletion requires an explicit name form and targets only that server',async()=>{
 const h=harness();h.context.sample=sample;h.run('currentServer=sample;calls=[];api=async(...args)=>{calls.push(args);return {deleted:true}};navigate=async()=>{}');
 await h.run("featureAction('server-delete','s1',{})");assert.match(h.elements.get('#modal').innerHTML,/confirm_name/);assert.match(h.elements.get('#modal').innerHTML,/worlds, mods/);
 await h.run("featureSubmit('delete-server',{id:'s1',confirm_name:'Test world'},{})");assert.equal(h.run('calls[0][1]'),'DELETE');assert.equal(h.run('calls[0][2].confirm_name'),'Test world');
});

test('crash and sleep indicators, live status and requested simplifications render',()=>{
 const h=harness();h.context.sample={...sample,status:'crashed',error:'Exit code 1'};
 const header=h.run('serverHeader(sample)');assert.match(header,/Copy error logs/);assert.match(header,/role="status"/);assert.match(header,/Mods &amp; Plugins|Mods & Plugins/);
 assert.match(h.run("statusDot({status:'sleeping'})"),/<svg/);assert.match(h.run("statusDot({status:'crashed'})"),/<svg/);
 assert.doesNotMatch(h.run('serverCard(sample)'),/>Manage</);
 h.run('shell()');const sidebar=h.elements.get('#app').innerHTML;
 assert.ok(sidebar.indexOf('data-route="archive"')<sidebar.indexOf('data-route="analytics"'));assert.doesNotMatch(sidebar,/draggable|Workspace/);
});
test('live property filter hides fields without disabling their submitted values',()=>{
 const h=harness(),fields=[{textContent:'max-players',hidden:false},{textContent:'difficulty',hidden:false}];
 h.document.querySelectorAll=()=>fields;
 h.handlers.get('input')({target:{id:'properties-search',value:' PLAYERS '}});
 assert.equal(fields[0].hidden,false);assert.equal(fields[1].hidden,true);
 h.handlers.get('input')({target:{id:'properties-search',value:''}});assert.ok(fields.every(f=>!f.hidden));
});
test('auto-scroll toggle preserves scroll position while disabled',async()=>{
 const h=harness(),el={textContent:'',setAttribute(){}};h.context.el=el;
 h.elements.set('#console',{scrollTop:15,scrollHeight:1000,textContent:''});
 await h.run("perform('console-scroll','',el)");assert.equal(h.run('consoleAutoScroll'),false);
 h.context.sample=sample;h.run("route='server';sid='s1';tab='console';api=async path=>path.endsWith('/logs')?{lines:['new output']}:sample");
 await h.run('refreshServerPanels()');assert.equal(h.elements.get('#console').scrollTop,15);
 await h.run("perform('console-scroll','',el)");assert.equal(h.elements.get('#console').scrollTop,1000);
});
test('installed Change version works before any search and offers Modrinth links',async()=>{
 const h=harness();h.context.sample={...sample,mods:[{project_id:'p',name:'Test mod',version_id:'old'}]};h.elements.set('#versions-loading',{});
 h.run("currentServer=sample;sid='s1';modSearch=null;api=async()=>({latest_id:'new',versions:[{id:'new',version_number:'2.0',project_id:'p',published:100}]})");
 assert.match(h.run('installedMods(sample)'),/https:\/\/modrinth.com\/project\/p/);
 await h.run("perform('installed-versions','p',{})");assert.match(h.elements.get('#modal').innerHTML,/2.0/);assert.match(h.elements.get('#modal').innerHTML,/mod-version-install/);
});
test('copy error logs uses clipboard and offers selectable fallback on insecure HTTP',async()=>{
 const h=harness();h.context.navigator={clipboard:{writeText:async text=>{h.context.copied=text;}}};
 h.run("api=async()=>({text:'Crash <log>'})");await h.run("copyErrorLogs('s1')");assert.equal(h.context.copied,'Crash <log>');
 h.context.navigator={};let selected=false;h.elements.set('#copy-logs',{focus(){},select(){selected=true;}});
 await h.run("copyErrorLogs('s1')");assert.ok(selected);assert.match(h.elements.get('#modal').innerHTML,/Crash &lt;log&gt;/);
});
test('folder deletion is explicit and discovery exposes sort and plugin options',async()=>{
 const h=harness();h.context.sample=sample;h.run("currentServer=sample;user.role='owner';modView='discover'");
 const html=h.run('modsBody(sample)');assert.match(html,/value="downloads" selected/);assert.match(html,/value="plugin"/);
 const files=h.run("filesBody({entries:[{name:'world',directory:true}],path:''})");assert.match(files,/folder-delete/);assert.doesNotMatch(files,/Up one level/);
 h.run("calls=[];api=async(...args)=>{calls.push(args);return {backup:'recovery'}};render=async()=>{};sid='s1'");
 await h.run("perform('confirm-folder-delete','world',{})");assert.equal(h.run('calls[0][2].directory'),true);
});
test('navigation is fixed and drag handlers/preferences code are removed',()=>{
 const h=harness();h.run('shell()');assert.doesNotMatch(h.elements.get('#app').innerHTML,/draggable|Drag to reorder|Workspace/);
 assert.equal(h.handlers.has('dragstart'),false);assert.doesNotMatch(source,/moveNav|navOrder|\/preferences/);
});
test('compact status remains and Back is before the server title',()=>{
 const h=harness();h.context.sample={...sample,status:'stopped'};const html=h.run('serverHeader(sample)');
 assert.doesNotMatch(html,/server-status-bar/);assert.match(html,/class="status stopped" role="status"[^>]*><span class="status-circle stopped"/);
 assert.ok(html.indexOf('Back to servers')<html.indexOf('server-title'));
});
test('Modrinth search is inline before type selector and vanilla explains incompatibility',()=>{
 const h=harness();h.context.sample=sample;h.run("modView='discover'");const html=h.run('modsBody(sample)');
 assert.ok(html.indexOf('id="mod-query"')<html.indexOf('mod-search-button'));assert.ok(html.indexOf('mod-search-button')<html.indexOf('name="type"'));
 assert.match(h.run("modsBody({...sample,loader:'vanilla'})"),/Fabric, NeoForge, or Forge/);
});
test('vanilla catalog hides redundant loader build and restores it for Fabric',async()=>{
 const h=harness();const group={hidden:false};
 h.elements.set('#f-loader_version',{innerHTML:'',closest:()=>group});h.elements.set('#f-minecraft',{innerHTML:''});h.elements.set('#modalerror',{textContent:''});h.elements.get('#modal').open=true;
 h.run("api=async()=>({minecraft:['1.21.1'],versions:['1.21.1']})");
 await h.run("loadCatalog('vanilla')");assert.equal(group.hidden,true);
 await h.run("loadCatalog('fabric')");assert.equal(group.hidden,false);
});
test('Settings offers themes and wrapper update actions without color pickers',()=>{
 const h=harness();h.context.defaults={web_port:3000,default_memory_mb:4096};const html=h.run('settingsPage(defaults)');
 assert.match(html,/name="theme"/);assert.doesNotMatch(html,/type="color"|accent_color/);assert.match(html,/wrapper-check/);assert.match(html,/wrapper-install/);assert.match(html,/name="update_feed"/);
});
test('installed projects distinguish local uploads, dependencies and switches',()=>{
 const h=harness();h.context.sample={...sample,mods:[{project_id:'main',name:'Main',version:'1',enabled:true,requires_project_ids:['lib']},{project_id:'lib',name:'Library',version:'2',enabled:true,requires_project_ids:[]},{project_id:'local-1',name:'Custom',version:'Local file',enabled:false,source:'local'}]};
 const html=h.run('installedMods(sample)');assert.match(html,/Upload JAR/);assert.match(html,/source-label modrinth/);assert.match(html,/source-label third-party/);assert.match(html,/Required by: Main/);assert.match(html,/Requires: Library/);assert.match(html,/role="switch"/);
 const local=html.slice(html.indexOf('<h3>Custom'));assert.doesNotMatch(local,/modrinth.com\/project\/local|installed-versions/);assert.doesNotMatch(html,/data-action="toggle-mod"/);
});
test('switch writes desired enabled state and restores its value on failure',async()=>{
 const h=harness();h.run("sid='s1';calls=[];api=async(...args)=>{calls.push(args);return {}};refreshServerPanels=async()=>{}");
 const input={dataset:{modToggle:'local-1'},checked:true,disabled:false};await h.handlers.get('change')({target:input});
 assert.equal(h.run('calls[0][2].enabled'),true);assert.equal(h.run('calls[0][0]'),'/servers/s1/mods-toggle');assert.equal(input.disabled,false);
 h.run("api=async()=>{throw new Error('Stop the server first')}");input.checked=false;await h.handlers.get('change')({target:input});assert.equal(input.checked,true);assert.equal(input.disabled,false);
});
test('sign out closes account dialog and clears UI session even if already expired',async()=>{
 const h=harness();h.elements.get('#modal').open=true;
 h.run("api=async()=>({ok:true})");await h.run("perform('logout','',{})");
 assert.equal(h.run('user'),null);assert.equal(h.run('csrf'),null);assert.equal(h.elements.get('#modal').open,false);
 h.run("user={id:'u',role:'owner'};csrf='old';api=async()=>{const e=new Error('Please sign in');e.status=401;throw e}");
 await h.run("perform('logout','',{})");assert.equal(h.run('user'),null);assert.match(h.elements.get('#app').innerHTML,/Sign in/);
});

test('port override retries only after explicit confirmation',async()=>{
 const h=harness();h.context.confirm=()=>true;const calls=[];
 h.context.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return calls.length===1?{ok:false,status:409,json:async()=>({error:'PORT_CONFLICT: Create anyway?'})}:{ok:true,status:201,json:async()=>({id:'new'})};};
 await h.run("api('/servers','POST',{port:25565})");assert.equal(calls.length,2);assert.equal(calls[1].allow_port_conflict,true);
});
test('sync edit confirmation retries with explicit unlink header and cancel sends no retry',async()=>{
 const h=harness();let calls=[];h.context.confirm=()=>true;
 h.context.fetch=async(url,options)=>{calls.push(options);return calls.length===1?{ok:false,status:409,json:async()=>({error:'SYNC_CONFLICT: Disconnect?'})}:{ok:true,status:200,json:async()=>({saved:true})};};
 await h.run("api('/servers/s1/files','PUT',{path:'config/a',content:'new'})");assert.equal(calls[1].headers['X-MMSM-Unlink-Sync'],'true');
 calls=[];h.context.confirm=()=>false;await assert.rejects(h.run("api('/servers/s1/files','PUT',{})"));assert.equal(calls.length,1);
});
test('sync and DNS tabs expose controls and escape names',()=>{
 const h=harness();h.context.sample=sample;assert.match(h.run('serverHeader(sample)'),/data-tab="syncs"/);assert.match(h.run('serverHeader(sample)'),/data-tab="address"/);
 const html=h.run("syncPanel({sources:[{id:'s',name:'<source>',loader:'fabric',minecraft:'1.2',folders:['config']}],rule:null})");assert.match(html,/&lt;source&gt;/);assert.match(html,/name="runtime"/);assert.match(html,/name="folders"/);
 const address=h.run("addressPanel({configured:false,value:{},records:[]},sample)");assert.match(address,/Configure your DNS zone/);assert.match(address,/does not|not published DNS/);
});
