'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 cube:'M12 3 3 8v9l9 5 9-5V8L12 3Zm0 9 9-4M12 12 3 8m9 4v10M7.5 5.5l9 5',
 dashboard:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
 server:'M4 3h16v7H4zM4 14h16v7H4zM7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6',
 chart:'M4 3v17h17M8 15l4-5 4 3 5-7',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3',
 users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a6 6 0 0 1 12 0v3m2-17a4 4 0 0 1 0 8m2 3a5 5 0 0 1 4 5v1',
 archive:'M3 3h18v5H3zM5 8v13h14V8M10 12h4',
 cpu:'M7 7h10v10H7zM9 1v3m6-3v3M9 20v3m6-3v3M1 9h3m-3 6h3m16-6h3m-3 6h3',
 memory:'M3 6h18v12H3zM7 9v5m5-5v5m5-5v5M6 18v3m4-3v3m4-3v3m4-3v3',
 network:'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
 upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
 plus:'M12 5v14M5 12h14',play:'m8 4 12 8-12 8V4',stop:'M5 5h14v14H5z',
 moon:'M20 14a9 9 0 0 1-10-11 9 9 0 1 0 10 11',
 broken:'m10 14 4-4M8 3v3M3 8h3M16 21v-3M21 16h-3M7 14l-2 2a3 3 0 0 0 4 4l2-2M13 6l2-2a3 3 0 0 1 4 4l-2 2',
 arrow:'m9 5 7 7-7 7',back:'m15 5-7 7 7 7',close:'m6 6 12 12M6 18 18 6',
 refresh:'M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2',
 folder:'M3 5h7l2 3h9v12H3V5',file:'M5 3h9l5 5v13H5zM14 3v6h5',
 logout:'M9 3H3v18h6M9 12h12m-4-4 4 4-4 4',terminal:'m4 6 5 5-5 5m8 1h8',check:'m5 12 4 4L19 6'
};
const icon = name => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.server}"/></svg>`;
const bytes = value => value == null ? '—' : value >= 1073741824 ? (value / 1073741824).toFixed(1) + ' GiB' : value >= 1048576 ? (value / 1048576).toFixed(1) + ' MiB' : value >= 1024 ? (value / 1024).toFixed(1) + ' KiB' : Math.round(value) + ' B';
const pct = v => v == null ? '—' : v.toFixed(1) + '%';
const date = v => v ? new Date(v * 1000).toLocaleString() : 'Never';
let user, csrf, route = 'dashboard', sid = null, tab = 'overview', currentServer, dashboard, settings, filePath = '', routeEpoch = 0;
let toastTimer, polling = false, consoleAutoScroll=true;
let popoverKind=null,popoverAutomatic=false,downloadCloseTimer=null,downloadsSuppressed=false,activityPolling=false;
let downloadRows=[],notificationRows=[],seenDownloadIds=null,downloadHistoryPage=0,analyticsDays=7;
const pendingInstallServers=new Set();
let modSearch=null,modSequence=0,modView='installed',appearance={logo:false};
let backupData={rules:[],schedules:[],history:[]};
const globalAdmin=()=>admin() && (user.role==='owner'||user.server_ids==null);
const formatGB=value=>Number(value).toFixed(2).replace(/\.?0+$/,'');
const ram=value=>value==null?'—':formatGB(value/1073741824)+' GB';
function memoryToMB(gb) {
 const value=Number(gb);
 if(!Number.isFinite(value)||value<0.5||value>256)throw new Error('Memory must be between 0.5 and 256 GB.');
 return Math.round(value*1024);
}
function memoryField(name,mb){return field('Memory allocation (GB)',name,mb/1024,'number','0.5–256 GB. Fractional values are supported.','min="0.5" max="256" step="any" required');}

const admin = () => ['owner','admin'].includes(user?.role);
const operator = () => user && user.role !== 'viewer';
async function api(path, method = 'GET', body) {
 const response = await fetch('/api' + path, {method, credentials:'same-origin', headers:{'Content-Type':'application/json', ...(csrf ? {'X-CSRF-Token':csrf} : {})}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
 const data = await response.json();
 if (!response.ok) { if (response.status === 401 && path !== '/login') { user = null; showAuth(false); } const error=new Error(data.error || 'Request failed');error.status=response.status;throw error; }
 return data;
}
function toast(message, error = false) { clearTimeout(toastTimer); const el = $('#toast'); el.textContent = message; el.className = 'show' + (error ? ' error' : ''); toastTimer = setTimeout(() => {el.className = '';}, error ? 10000 : 5000); }
const avatar = () => user?.avatar?`<img src="/api/assets/avatar?v=${user.avatar}" alt="Profile picture">`:esc(user?.username?.[0]?.toUpperCase()||'');
const statusDot=s=>`<span class="status-circle ${esc(s.status)}" title="${esc(s.status)}" aria-label="${esc(s.status)}">${s.status==='sleeping'?icon('moon'):s.status==='crashed'?icon('broken'):''}</span>`;
const serverImage=s=>s.icon?`<img class="server-image" src="/api/servers/${s.id}/icon?v=${s.icon_version||0}" alt="${esc(s.name)} server icon">`:icon('cube');
const brand = () => `<div class="brand"><div class="brandmark">${appearance.logo?'<img src="/api/assets/logo" alt="MMSM logo">':icon('cube')}</div><div>MMSM<small>YOUR WORLDS. MANAGED.</small></div></div>`;
const button = (label, action, id='', cls='', ico='') => `<button type="button" class="button ${cls} ${action==='server-stop'?'control-stop':action==='server-restart'?'control-restart':action==='server-kill'?'control-kill':''}" data-action="${action}" ${id ? `data-id="${esc(id)}"` : ''}>${ico ? icon(ico) : ''}${esc(label)}</button>`;
function showAuth(setup) {
 routeEpoch++; closePopover(false); $('#modal').close();
 $('#app').innerHTML = `<main class="auth"><div class="authbox">${brand()}<div class="panel"><div class="eyebrow">${setup ? 'Make yourself at home' : 'Welcome back'}</div><h1>${setup ? 'Your server room starts here.' : 'Sign in to your server room.'}</h1><p>${setup ? 'Create the owner account for this MMSM installation. Only administrators can add accounts after setup.' : 'Your worlds, players, and everything in between.'}</p><form data-form="${setup ? 'setup' : 'login'}">${setup ? field('Setup token','token','','text','Copy the token from the MMSM terminal.') : ''}${field('Username','username','','text')}${field('Password','password','','password',setup ? 'At least 12 characters.' : '')}<div id="autherror"></div><button class="button primary" type="submit">${setup ? 'Create owner account' : 'Sign in'} ${icon('arrow')}</button></form></div><p class="authfooter">MrHaydenn’s Minecraft Server Manager<br>Built for the worlds you call home.</p></div></main>`;
}
function field(label,name,value='',type='text',hint='',extra='') { return `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${type === 'password' ? 'autocomplete="current-password"' : ''} ${extra}>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`; }
function selectField(label,name,options,value,extra='') { return `<div class="field"><label for="f-${name}">${esc(label)}</label><select id="f-${name}" name="${name}" ${extra}>${options.map(o => {const [v,l] = Array.isArray(o) ? o : [o,o]; return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`;}).join('')}</select></div>`; }
function shell() {
 const nav = [['dashboard','dashboard','Overview'],['servers','server','Servers'],...(admin() ? [['archive','archive','Archive']] : []),['analytics','chart','Analytics'],...(globalAdmin() ? [['accounts','users','Accounts'],['settings','settings','Settings']] : [])];
 $('#app').innerHTML = `<div class="shell"><aside class="sidebar">${brand()}<nav class="navgroup">${nav.map(([r,i,t])=>`<button class="nav ${route===r?'active':''}" data-route="${r}">${icon(i)}${t}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="localbadge">MMSM 0.7.3</div></div></aside><main class="main"><header class="topbar"><div class="crumb"><span class="mobilebrand">MMSM /</span>${icon('server')}<b id="breadcrumb">Overview</b></div><div class="topright">${operator()?`<button class="icon-button activity-trigger" data-action="downloads-popup" title="Downloads" aria-label="Downloads" aria-expanded="false" aria-controls="activity-popover">${icon('download')}<span class="count-badge" id="download-count"></span></button>`:''}<button class="icon-button activity-trigger" data-action="notifications-popup" title="Notifications" aria-label="Notifications" aria-expanded="false" aria-controls="activity-popover">${icon('bell')}<span class="count-badge" id="unread"></span></button><button class="account-trigger" data-action="account-settings" aria-label="Account settings for ${esc(user.username)}"><span class="avatar">${avatar()}</span><span class="account-label"><strong>${esc(user.username)}</strong><small>${esc(user.role)}</small></span>${icon('settings')}</button></div><section id="activity-popover" class="activity-popover" role="dialog" aria-label="Activity" hidden></section></header><div class="content" id="content"></div></main></div>`;
 updateActivityBadges();
}
async function navigate(next, serverId=null, nextTab='overview') {
 closePopover(); route = next; sid = serverId; tab = nextTab; filePath = ''; modView='installed'; modSearch=null;modSequence++; const epoch = ++routeEpoch;
 shell(); $('#breadcrumb').textContent = next === 'server' ? 'Server details' : ({dashboard:'Overview',servers:'Servers',analytics:'Analytics',downloads:'Downloads',notifications:'Notifications',archive:'Archive',accounts:'Accounts',settings:'Settings'}[next] || next);
 $('#content').innerHTML = '<div class="loading">Loading your workspace…</div>';
 try { await render(epoch); } catch(e) { if(epoch===routeEpoch && user) $('#content').innerHTML = `<div class="errorbox">${esc(e.message)}</div>${button('Retry','retry','','','refresh')}`; }
}
async function render(epoch=routeEpoch) {
 const requestedRoute=route, requestedSid=sid, requestedTab=tab;
 let html;
 if(requestedRoute==='analytics')html=renderAnalytics(await api('/analytics?days='+analyticsDays));
 else if(requestedRoute==='downloads')html=downloadsHistoryPage(await api('/download-history?page='+downloadHistoryPage));
 else if (requestedRoute === 'dashboard') {
  const d = await api('/dashboard');
  if(epoch!==routeEpoch)return;
  dashboard = d; html = renderDashboard(d);
 } else if (requestedRoute === 'servers') html=serversPage(await api('/servers'));
 else if (requestedRoute === 'server') {
  const s = await api('/servers/'+requestedSid);
  if(epoch!==routeEpoch)return;
  currentServer=s;
  const body = await serverBody(s);
  if(epoch!==routeEpoch)return;
  html=serverHeader(s)+body;
 } else if (requestedRoute === 'archive') html = archivePage(await api('/servers?archive=true'));
 else if (requestedRoute === 'settings') { settings = await api('/settings'); html = settingsPage(settings); }
 else if (requestedRoute === 'accounts') html = accountsPage(await api('/users'));
 if (epoch !== routeEpoch || !user) return;
 $('#content').innerHTML = html;
 const consoleEl = $('#console'); if(consoleEl&&consoleAutoScroll) consoleEl.scrollTop = consoleEl.scrollHeight;
 if(requestedRoute==='server'&&requestedTab==='mods') {
  if(modSearch?.sid!==requestedSid) modSearch={sid:requestedSid, query:'', type:currentServer.loader==='paper'?'plugin':'mod', page:0, total:0, hits:[], loaded:false};
  void hydrateInstalledIcons(currentServer,epoch);
  if(modView==='discover'){if(modSearch.loaded) {renderModResults(); hydrateModCards(modSearch.sequence);} else await searchMods(null,0);}
 }
}
function heading(title,desc,actions='',eye='Workspace') { return `<div class="pagehead"><div><div class="eyebrow">${esc(eye)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="actions">${actions}</div></div>`; }
function bar(mc,other,total) { const a = total ? Math.min(100,100*(mc||0)/total) : 0; const b = total ? Math.min(100-a,100*(other||0)/total) : 0; return `<svg class="stat-bar" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect class="emptybar" width="100" height="5" rx="2"/><rect class="mc" width="${a}" height="5" rx="2"/><rect class="other" x="${a}" width="${b}" height="5"/></svg>`; }
function stat(label,value,foot,ico,extra='') { return `<div class="stat"><div class="stat-top"><span>${label}</span>${icon(ico)}</div><div class="stat-value">${value}</div>${extra}<div class="stat-foot">${foot}</div></div>`; }
function stats(d) {
 const m=d.minecraft,h=d.host,o=d.other;
 return `<div class="stats">${stat('Players online',String(m.players),`${d.servers.filter(s=>s.status==='running').length} running / ${d.servers.length} active servers${m.unknown_players ? ' • '+m.unknown_players+' unknown' : ''}`,'users')}${stat('CPU usage',pct(h.cpu),`<span class="accent">${pct(m.cpu)} Minecraft</span><span class="blue">${pct(o.cpu)} ${user.server_ids!=null?'other / unassigned':'other'}</span>`,'cpu',bar(m.cpu,o.cpu,100))}${stat('Memory usage',`${ram(h.ram_used)} <small>/ ${ram(h.ram_total)}</small>`,`<span class="accent">${ram(m.ram)} Minecraft</span><span class="blue">${ram(o.ram)} ${user.server_ids!=null?'other / unassigned':'other'}</span>`,'memory',bar(m.ram,o.ram,h.ram_total))}${stat('Minecraft traffic',`${bytes(m.rx_rate + m.tx_rate)}<small>/s</small>`,`↓ ${bytes(m.rx_rate)}/s &nbsp; ↑ ${bytes(m.tx_rate)}/s`,'network')}</div>`;
}
function chart(rows, keys, labels, formatter=pct) {
 if (rows.length < 2 || !rows.some(r=>keys.some(k=>r[k] != null))) return '<div class="chartempty">Collecting history. Samples appear every 5 seconds.</div>';
 const max = Math.max(1,...rows.flatMap(r=>keys.map(k=>r[k]||0)))*1.1, w=500,h=112,x=48;
 const polylines = keys.map((k,j)=>`<polyline class="chartline ${j?'secondary':''}" points="${rows.map((r,i)=>`${x+i*(w-x)/(rows.length-1)},${h-(r[k]||0)/max*(h-10)}`).join(' ')}"/>`).join('');
 return `<svg class="chart" role="img" aria-label="${esc(labels.join(' and '))} history" viewBox="0 0 520 150" preserveAspectRatio="none">${[0,.5,1].map(v=>`<line class="chartgrid" x1="${x}" y1="${h-v*(h-10)}" x2="500" y2="${h-v*(h-10)}"/><text x="0" y="${h-v*(h-10)+4}">${esc(formatter(max*v))}</text>`).join('')}${polylines}<text x="48" y="142">${esc(new Date(rows[0].ts*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</text><text x="457" y="142">Now</text></svg><div class="legend">${labels.map((l,i)=>`<span><i class="${i?'secondary':''}"></i>${esc(l)}</span>`).join('')}</div>`;
}
function historyPanels(h, global=false) { return `<div class="charts"><section class="panel"><div class="panelhead"><h2>CPU over time</h2><span class="tag">Last 24 hours</span></div>${chart(h,global?['cpu','host_cpu']:['cpu'],global?['Minecraft','Whole system']:['Minecraft'])}</section><section class="panel"><div class="panelhead"><h2>Memory over time</h2><span class="tag">Last 24 hours</span></div>${chart(h,global?['ram','host_ram']:['ram'],global?['Minecraft','Whole system']:['Minecraft'],ram)}</section></div>`; }
function serverCard(s) {
 const m=s.metrics||{};
 return `<article class="servercard" data-server-card="${esc(s.id)}" tabindex="0" role="link" aria-label="Manage ${esc(s.name)}"><div class="cardbody"><div class="cardtitle"><div class="servericon ${esc(s.loader)}">${serverImage(s)}</div><span class="status ${esc(s.status)}">${statusDot(s)}${esc(s.status)}</span></div><button class="card-name" data-action="open-server" data-id="${s.id}">${statusDot(s)}${esc(s.name)}</button><div class="serverversion">${esc(s.loader)} <span class="muted">/</span> ${esc(s.minecraft)} <span class="muted">·</span> ${s.sleep?(s.manual_stop?'Sleep paused by Stop':'Sleep enabled'):'Always available'}</div>${s.error?`<div class="errorbox">${esc(s.error)}</div>`:''}<div class="serverfacts"><div><label>PLAYERS</label><strong>${m.players??'—'} online</strong></div><div><label>MEMORY</label><strong>${ram(m.ram)} <span class="muted">/ ${formatGB(s.memory_mb/1024)} GB</span></strong></div><div><label>CPU</label><strong>${pct(m.cpu)}</strong></div><div><label>NETWORK</label><strong>${bytes((m.rx_rate||0)+(m.tx_rate||0))}/s</strong></div></div></div><footer class="cardfooter"><span class="address">PORT ${s.port}</span><div class="actions">${operator() && ['stopped','sleeping','error','crashed'].includes(s.status) && s.launch ? button('Start','server-start',s.id,'small','play') : ''}${operator() && ['running','starting'].includes(s.status) ? button('Stop','server-stop',s.id,'small','stop')+button('Restart','server-restart',s.id,'small','refresh') : ''}</div></footer></article>`;
}
function renderDashboard(d,h) {
 return stats(d)+(d.host.note?`<div class="notice">${esc(d.host.note)}</div>`:'')+`<div class="section-head"><h2>Your servers <span>${d.servers.length} active</span></h2>${globalAdmin()?button('Create server','new-server','','primary','plus'):''}</div>${d.servers.length?`<div class="servergrid">${d.servers.map(serverCard).join('')}</div>`:'<div class="empty"><h3>No servers yet</h3><p>Create a server to start your first world.</p></div>'}`;
}
function renderAnalytics(data) {
 const hours=v=>Number(v).toFixed(1)+' h';
 return heading('Historical analytics','Daily totals across your active, assigned servers.')+`<div class="tabs range-tabs">${[[7,'Week'],[30,'Month'],[90,'90 days'],[365,'Year']].map(([d,label])=>`<button class="tab ${data.days===d?'active':''}" data-action="analytics-range" data-id="${d}">${label}</button>`).join('')}</div><div class="charts"><section class="panel"><h2>Combined player time</h2><p>${hours(data.totals.player_hours)} in this period</p>${usageChart(data.series,['player_hours'],['Player-hours'],hours)}</section><section class="panel"><h2>Network bandwidth used</h2><p>↓ ${bytes(data.totals.rx_bytes)} received · ↑ ${bytes(data.totals.tx_bytes)} sent</p>${usageChart(data.series,['rx_bytes','tx_bytes'],['Received','Sent'],bytes)}</section></div><section class="panel"><h2>By server</h2><div class="tablewrap"><table><thead><tr><th>Server</th><th>Player-hours</th><th>Received</th><th>Sent</th></tr></thead><tbody>${data.servers.map(r=>`<tr><td>${button(r.name,'open-server',r.id,'small')}</td><td>${hours(r.player_hours)}</td><td>${bytes(r.rx_bytes)}</td><td>${bytes(r.tx_bytes)}</td></tr>`).join('')}</tbody></table></div></section><p class="smalltext">Player time is estimated from sampled online counts: two players online for an hour count as two player-hours. Network totals measure actual bytes through MMSM’s player proxy. Daily buckets use UTC. Missing player samples and manager downtime are not credited. These aggregates collect from version 0.4 onward and are retained for 366 days; no older activity is invented.${data.first_sample?' First available sample: '+esc(date(data.first_sample))+'.':''}</p>`;
}
function usageChart(rows,keys,labels,formatter){
 if(!rows.some(r=>keys.some(k=>r[k]>0)))return '<div class="chartempty">No usage recorded for this period yet.</div>';
 const max=Math.max(1,...rows.flatMap(r=>keys.map(k=>r[k]||0)))*1.1,w=590,h=140,left=65;
 const points=keys.map((key,j)=>`<polyline class="chartline ${j?'secondary':''}" points="${rows.map((r,i)=>`${left+i*(w-left)/(rows.length-1)},${h-r[key]/max*(h-10)}`).join(' ')}"/>`).join('');
 const day=ts=>new Date(ts*1000).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
 return `<svg class="chart usage-chart" role="img" aria-label="${esc(labels.join(' and '))} daily history" viewBox="0 0 610 175">${[0,.5,1].map(v=>`<line class="chartgrid" x1="${left}" y1="${h-v*(h-10)}" x2="${w}" y2="${h-v*(h-10)}"/><text x="0" y="${h-v*(h-10)+4}">${esc(formatter(max*v))}</text>`).join('')}${points}<text x="65" y="168">${esc(day(rows[0].ts))}</text><text x="530" y="168">${esc(day(rows[rows.length-1].ts))}</text></svg><div class="legend">${labels.map((l,i)=>`<span><i class="${i?'secondary':''}"></i>${esc(l)}</span>`).join('')}</div>`;
}
function statusDetail(s){return s.detail||({starting:'Starting Java and loading the world…',running:'Online — ready for players',stopping:'Stopping — saving the world. Please wait…',sleeping:'Asleep — a Minecraft ping will wake this server',crashed:'Crashed — inspect or copy the error logs',stopped:s.manual_stop?'Stopped manually — automatic wake is paused':'Stopped',installing:'Installing files…',updating:'Updating runtime…',backing_up:'Saving a backup…',killing:'Terminating the Java process…',waking:'Wake requested — starting server…'}[s.status]||s.status);}
function serverHeader(s) {
 const live=['running','starting','stopping'].includes(s.status);
 return `<div id="server-heading"><div class="server-back">${button("Back to servers","back","","small","back")}</div><div class="pagehead compact-head"><div><h1 class="server-title">${serverImage(s)}${statusDot(s)}${esc(s.name)}</h1><p>${esc(s.loader)} ${esc(s.loader_version)} · Minecraft ${esc(s.minecraft)} · Public port ${s.port}</p></div><div class="actions">${operator()&&s.launch&&['stopped','sleeping','error','crashed'].includes(s.status)?button('Start server','server-start',s.id,'primary','play'):''}${operator()&&['running','starting'].includes(s.status)?button('Stop server','server-stop',s.id,'','stop')+button('Restart','server-restart',s.id,'','refresh'):''}${operator()&&live?button('Kill process','server-kill',s.id,'','close'):''}</div></div><div class="detailmeta"><span class="status ${esc(s.status)}" role="status" title="${esc(statusDetail(s))}">${statusDot(s)}${esc(s.status)}</span>${!["stopped","running","sleeping"].includes(s.status)?`<span class="subtle">${esc(statusDetail(s))}</span>`:""}${s.status==="crashed"&&operator()?button("Copy error logs","copy-error",s.id,"small"):""}<span class="subtle">${s.sleep?(s.manual_stop?'Sleep paused by Stop':'Sleep enabled'):'Sleep disabled'} · ${formatGB(s.memory_mb/1024)} GB allocated${s.launch?' · Java '+s.launch.java_major:''}</span></div>${s.error?`<div class="errorbox">${esc(s.error)}</div>`:''}</div><div class="tabs server-tabs">${[['overview','Overview'],...(operator()?[['console','Console'],['files','Files'],['properties','Properties']]:[]),['players','Players'],...(admin()?[['mods','Mods & Plugins'],['backups','Backups & scheduling'],['config','Settings']]:[])].map(([v,l])=>`<button class="tab ${tab===v?'active':''}" data-tab="${v}">${l}</button>`).join('')}</div>`;
}
async function serverBody(s) {
 if(tab==='players')return playersPanel(await api('/servers/'+sid+'/players'));
 if(tab==='backups'){backupData=await api('/servers/'+sid+'/backups');return backupsPanel(s,backupData);}
 if (tab==='overview') {
  const h=await api('/servers/'+sid+'/history?hours=24'), m=s.metrics||{};
  return `<div class="stats">${stat('Players',String(m.players??'—'),'Status query, not TCP connections','users')}${stat('CPU',pct(m.cpu),'Share of total host CPU','cpu')}${stat('Memory',ram(m.ram),formatGB(s.memory_mb/1024)+' GB JVM maximum','memory')}${stat('Network',bytes((m.rx_rate||0)+(m.tx_rate||0))+'<small>/s</small>','Player traffic through MMSM','network')}</div>${playersPanel(await api('/servers/'+sid+'/players'),true)}${historyPanels(h)}<div class="charts"><section class="panel"><h2>Player history</h2>${chart(h,['players'],['Players'],v=>String(Math.round(v)))}</section><section class="panel"><h2>Network history</h2>${chart(h,['rx_rate','tx_rate'],['Inbound','Outbound'],v=>bytes(v)+'/s')}</section></div>${s.modpack?`<div class="notice">Modpack: ${esc(s.modpack.name)}${s.modpack.untracked_files.length ? ' · '+s.modpack.untracked_files.length+' jars could not be matched to Modrinth for update tracking.' : ''}</div>`:''}`;
 }
 if(tab==='console') {const logs=await api('/servers/'+sid+'/logs');return `<div class="console-toolbar actions"><button class="button small" data-action="console-scroll" aria-pressed="${consoleAutoScroll}">Auto-scroll: ${consoleAutoScroll?'on':'off'}</button>${button('Copy error logs','copy-error',sid,'small')}</div><pre class="console" id="console">${esc(logs.lines.join('\n')||'Console output will appear when the server starts.')}</pre><form class="rowform" data-form="command"><input name="command" aria-label="Server command" placeholder="Enter a Minecraft server command, e.g. list" required maxlength="4096"><button class="button primary" type="submit">Send command</button></form><p class="smalltext">Commands run in the Minecraft console. Use Stop server for graceful shutdown.</p>`;}
 if(tab==='files') return filesBody(await api('/servers/'+sid+'/files?path='+encodeURIComponent(filePath)));
 if(tab==='properties') {
  const props=await api('/servers/'+sid+'/properties');
  return `<div class="notice">Stop the server before saving properties. Public port ${s.port} forwards to a private backend; network binding, status queries and RCON are managed by MMSM.</div><label for="properties-search">Filter properties</label><input id="properties-search" type="search" placeholder="Find a setting…"><form data-form="properties" class="panel"><div class="formgrid">${Object.entries(props.values).map(([k,v])=>field(k,k,v,'text',props.managed.includes(k)?'Managed by MMSM':'',props.managed.includes(k)||!admin()?'disabled':'')).join('')}</div>${admin()?'<div class="formactions"><button class="button primary">Save properties</button></div>':''}</form>`;
 }
 if(tab==='mods') return modsBody(s);
 if(tab==='config') return `<div class="split"><form class="panel" data-form="server-config"><div class="panelhead"><h2>Server settings</h2></div><div class="server-icon-editor">${serverImage(s)}${button('Upload server icon','image-upload','server','small','upload')}<p class="smalltext">Stop the server first. Cropped to a 64 × 64 PNG; takes effect on its next start.</p></div>${field('Server name','name',s.name,'text','', 'required maxlength="64"')}${memoryField('memory_gb',s.memory_mb)}<label class="check"><input name="autostart" type="checkbox" ${s.autostart?'checked':''}> AutoStart with MMSM</label><p class="smalltext">Starts this server when MMSM launches. Configure your operating system to launch MMSM at boot if needed.</p><label class="check"><input name="sleep" type="checkbox" ${s.sleep?'checked':''}> Sleep when idle and wake on a Minecraft ping</label>${field('Idle time before sleep (minutes)','idle_minutes',s.idle_minutes,'number','A failed player query never counts as an empty server.','min="1" max="1440" required')}<div class="sleep-test"><button type="button" id="sleep-now" class="button" data-action="server-sleep" data-id="${s.id}" ${!s.sleep||!s.launch||['installing','updating','stopping','killing'].includes(s.status)?'disabled':''}>${icon('moon')} Sleep now</button><span class="subtle">Enable and save sleep first. This saves the world and skips the idle timer.</span></div><p>Stop keeps the server offline and disables automatic wake until Start or Sleep now. While asleep, the first ping starts Minecraft and shows a starting message. Players reconnect once the server is ready. Server-list refreshes can also wake it.</p><div class="formactions"><button class="button primary">Save settings</button></div></form><div><section class="panel"><h2>Update server runtime</h2><p>Choose an available Minecraft and loader version. MMSM preserves worlds and settings and keeps a full backup before replacing the runtime.</p><p>Check mod compatibility before changing Minecraft versions. World downgrades are not supported.</p>${button('Choose version','update-runtime',sid,'','refresh')}${s.last_backup?`<p class="smalltext">Last backup: ${esc(s.last_backup)}</p>`:''}</section><section class="panel"><h2>Archive server</h2><p>Archived servers are completely dormant. They have no listener, background updates, or contribution to analytics. Your files remain available after unarchiving.</p><div class="actions">${button('Move to archive','server-archive',sid,'','archive')}${button('Delete server','server-delete',sid,'danger','trash')}</div></section></div></div>`;
 return '';
}
function projectImage(url,name) {
 let safe='';
 try {const parsed=new URL(url);if(parsed.protocol==='https:'&&parsed.hostname==='cdn.modrinth.com'&&!parsed.username&&!parsed.password&&(!parsed.port||parsed.port==='443'))safe=parsed.href;}catch{}
 return `<span class="project-icon">${safe?`<img src="${esc(safe)}" alt="${esc(name)} icon" loading="lazy" referrerpolicy="no-referrer">`:icon('cube')}</span>`;
}
async function hydrateInstalledIcons(server,epoch) {
 if(!server.mods.some(m=>!('icon_url' in m)))return;
 try {
  const result=await api('/servers/'+server.id+'/mods-icons','POST',{});
  if(epoch===routeEpoch&&sid===server.id&&tab==='mods'&&$('#installed-mods')) {
   // Only merge metadata: a simultaneous mod update must retain its new version.
   const icons=new Map(result.mods.map(m=>[m.project_id,m]));
   currentServer.mods=currentServer.mods.map(m=>icons.has(m.project_id)?{...m,icon_url:icons.get(m.project_id).icon_url,name:icons.get(m.project_id).name}:m);
   $('#installed-mods').innerHTML=installedMods(currentServer);
  }
 }catch(e){console.debug('Project images:',e.message);}
}
const modrinthLink=id=>`<a class="button small" href="https://modrinth.com/project/${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">View on Modrinth</a>`;
function installedMods(s) {
 const local=m=>m.source==='local';
 return `<div class="panelhead"><h2>Installed projects <span class="muted">(${s.mods.length})</span></h2><div class="actions">${button('Upload JAR','mod-upload','','small primary','upload')}${button('Check updates','check-updates',s.id,'small','refresh')}</div></div><input id="mod-upload-input" type="file" accept=".jar" multiple hidden><div id="upload-progress" role="status"></div>${s.mods.length?`<div class="installed-grid">${s.mods.map(m=>{
 const parents=s.mods.filter(p=>(p.requires_project_ids||[]).includes(m.project_id));
 const required=(m.requires_project_ids||[]).map(id=>s.mods.find(p=>p.project_id===id)?.name||id);
 return `<article class="installed-mod">${projectImage(m.icon_url,m.name)}<div class="installed-info"><h3>${esc(m.name)}</h3><span class="source-label ${local(m)?'third-party':'modrinth'}">${local(m)?'Third-party':'Modrinth'}</span><span class="subtle"> ${esc(m.version)}</span>${parents.length?`<p class="dependency-note">Required by: ${parents.map(p=>esc(p.name)+(p.enabled?'':' (disabled)')).join(', ')}</p>`:''}${required.length?`<p class="dependency-note">Requires: ${required.map(esc).join(', ')}</p>`:''}${local(m)?'<p class="dependency-note">Local JAR · no Modrinth sync or automatic dependency detection</p>':!('requires_project_ids' in m)?'<p class="dependency-note">Check updates to load dependency information.</p>':''}${m.update&&!local(m)?`<p class="update-badge">${icon('download')} Update: ${esc(m.update.name)} · Minecraft ${esc(s.minecraft)}</p>`:''}</div><div class="actions">${local(m)?'':modrinthLink(m.project_id)+button('Change version','installed-versions',m.project_id,'small versions-button')}<label class="mod-switch"><input type="checkbox" role="switch" data-mod-toggle="${esc(m.project_id)}" aria-label="Enable ${esc(m.name)}" ${m.enabled?'checked':''}><span class="switch-track" aria-hidden="true"></span><span>${m.enabled?'Enabled':'Disabled'}</span></label>${m.update&&!local(m)?button('Update','install-version',m.update.id,'small primary'):''}</div></article>`;}).join('')}</div>`:'<p>No projects installed yet. Upload a JAR or search Modrinth.</p>'}<p class="smalltext">Modrinth updates are checked for Minecraft ${esc(s.minecraft)} and ${esc(s.loader)}. Last checked: ${esc(date(s.last_update_check))}. Third-party JARs are managed locally only.</p><p class="smalltext">Stop the server before uploading or switching mods. Disabling a required dependency can prevent startup. Local JAR compatibility is your responsibility; uploads do not run the JAR.</p>`;
}
function modsBody(s) {
 if(s.loader==='vanilla')return '<div class="notice">Vanilla does not support mods or plugins. Create a Fabric, NeoForge, or Forge server for mods, or a Paper server for plugins.</div>';
 const tabs=`<div class="tabs"><button class="tab ${modView==='installed'?'active':''}" data-action="mod-view" data-id="installed">Installed</button><button class="tab ${modView==='discover'?'active':''}" data-action="mod-view" data-id="discover">Search Modrinth</button></div>`;
 if(modView==='installed')return tabs+`<div class="panel" id="installed-mods">${installedMods(s)}</div>`;
 const state=modSearch?.sid===s.id?modSearch:{query:'',type:s.loader==='paper'?'plugin':'mod'};
 return tabs+`<section class="panel"><div class="panelhead"><h2>Discover on Modrinth</h2><span class="tag">${esc(s.loader)} · ${esc(s.minecraft)}</span></div><form class="mod-search" data-form="search-mods"><label class="sr-only" for="mod-query">Search Modrinth</label><input id="mod-query" name="query" value="${esc(state.query)}" placeholder="Search for a specific mod, plugin or modpack…"><button class="button small primary mod-search-button">Search</button><select name="type" aria-label="Project type">${[['mod','Mods'],['plugin','Plugins'],['modpack','Modpacks']].map(([v,l])=>`<option value="${v}" ${state.type===v?'selected':''}>${l}</option>`).join('')}</select><select name="index" aria-label="Sort results">${[['downloads','Most downloaded'],['relevance','Relevance'],['follows','Most followed'],['newest','Newest'],['updated','Recently updated']].map(([v,l])=>`<option value="${v}" ${(state.index||'downloads')===v?'selected':''}>${l}</option>`).join('')}</select></form><p class="smalltext">Install picks the newest compatible version. Use Versions to choose another release. Versions are filtered for this server. Bukkit-family plugins require Paper; they cannot install on Fabric, Forge or NeoForge. Modpacks need a fresh server with the pack’s exact loader version.</p><div id="search-results" aria-live="polite"></div></section>`;
}
function filesBody(data) {
 const parent=filePath.split('/').slice(0,-1).join('/');
 const currentDirectory=!!data.entries;
 return `<div class="panel"><div class="panelhead">${filePath?button('Back','file-open',parent,'small','back'):''}<h2>Server files <span class="subtle">/ ${esc(filePath)}</span></h2><div class="actions">${admin()&&currentDirectory?button('Upload files','file-upload','','primary','upload'):''}</div></div>${admin()&&currentDirectory?'<input id="file-upload-input" type="file" multiple hidden><div id="upload-progress" aria-live="polite"></div><p class="smalltext">Uploads go into this folder (up to 512 MB per file). Stop the server first. Existing filenames are not overwritten.</p>':''}${data.entries?`<div class="tablewrap"><table><thead><tr><th>Name</th><th>Type</th><th>Size</th>${admin()?'<th>Actions</th>':''}</tr></thead><tbody>${data.entries.map(e=>{const path=[filePath,e.name].filter(Boolean).join('/');return `<tr><td><button class="filelink" data-action="file-open" data-path="${esc(path)}" ${e.symlink?'disabled':''}>${icon(e.directory?'folder':'file')}${esc(e.name)}</button></td><td>${e.symlink?'Symlink (blocked)':e.directory?'Folder':'File'}</td><td>${e.directory?'—':bytes(e.size)}</td>${admin()?`<td>${!e.symlink?button('Delete',e.directory?'folder-delete':'file-delete',path,'small danger','trash'):''}</td>`:''}</tr>`;}).join('')}</tbody></table></div>${!data.entries.length?'<p>This folder is empty.</p>':''}`:`<form data-form="edit-file"><textarea class="editor" name="content" aria-label="File content" spellcheck="false" ${!admin()?'readonly':''}>${esc(data.content)}</textarea>${admin()?`<div class="formactions">${button('Delete file','file-delete',filePath,'danger','trash')}<button class="button primary">Save text file</button></div>`:''}<p class="smalltext">Stop the server before editing. Managed launch files and server.properties cannot be changed here.</p></form>`}</div>`;
}


function archivePage(rows) {return heading('A place for past adventures.','Archived servers stay dormant until you bring them back.','','Archive')+`<div class="panel tablewrap"><table><thead><tr><th>Server</th><th>Runtime</th><th>Port</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.loader)} · ${esc(s.minecraft)}</td><td>${s.port}</td><td>${button('Unarchive','server-unarchive',s.id,'small','refresh')}${button('Delete','server-delete',s.id,'small danger','trash')}</td></tr>`).join('')}</tbody></table>${rows.length?'':'<div class="empty">'+icon('archive')+'<h3>No archived servers</h3><p>Archive a stopped server from its settings to keep it out of your active workspace.</p></div>'}</div>`;}
function settingsPage(s) {return heading('Make MMSM your own.','Global preferences and defaults for new servers.','','Settings')+`<form data-form="settings"><div class="split"><section class="panel"><div class="panelhead"><h2>Manager</h2></div>${field('WebGUI port','web_port',s.web_port,'number','Currently listening on '+s.running_web_port+'. Restart MMSM to apply a port change.','min="1024" max="65535" required')}${selectField('Listen on','bind_host',[['0.0.0.0','All network interfaces — LAN / internet'],['127.0.0.1','Localhost only']],s.bind_host||'0.0.0.0')}${field('Public URL (optional for direct IP)','public_origin',s.public_origin||'','url','For HTTPS proxy access, set the exact browser URL, e.g. https://mmsm.example.com. Save and restart MMSM. Leave blank for direct IP access.')}${field('Upstream contact','upstream_contact',s.upstream_contact,'text','Your contact URL or email. Required by the Paper download API.','maxlength="200"')}${field('Detailed sample retention (days)','retention_days',s.retention_days,'number','Daily player-time and traffic aggregates are kept for 366 days.','min="1" max="365" required')}${field('Release and mod check interval (hours)','update_interval_hours',s.update_interval_hours,'number','','min="1" max="168" required')}</section><section class="panel"><div class="panelhead"><h2>New server defaults</h2></div>${selectField('Loader','default_loader',['fabric','neoforge','forge','paper','vanilla'],s.default_loader)}${memoryField('default_memory_gb',s.default_memory_mb)}${field('Idle time before sleep (minutes)','idle_minutes',s.idle_minutes,'number','','min="1" max="1440" required')}<label class="check"><input name="default_sleep" type="checkbox" ${s.default_sleep?'checked':''}> Enable sleep for new servers</label><label class="check"><input name="auto_eula" type="checkbox" ${s.auto_eula?'checked':''}> Automatically accept the Minecraft EULA for new servers</label><p>Enable this only after reviewing and agreeing to the <a href="https://www.minecraft.net/eula" target="_blank" rel="noopener">Minecraft EULA</a>. Defaults apply to new servers.</p></section></div><section class="panel"><h2>Appearance</h2>${button('Upload launcher image','image-upload','logo','','upload')}<div class="formgrid">${selectField('Theme','theme',[['forest','Forest'],['midnight','Midnight blue'],['amethyst','Amethyst'],['ember','Ember'],['slate','Slate']],s.theme||'forest')}</div></section><section class="panel"><h2>MMSM updates</h2>${field('Release feed URL','update_feed',s.update_feed||'','url','HTTPS URL of your published latest.json. Save before checking.')}<label class="check"><input type="checkbox" name="wrapper_update_checks" ${s.wrapper_update_checks!==false?'checked':''}> Check for MMSM updates every six hours</label><p id="wrapper-update-status">${esc(wrapperUpdateText(s.wrapper_update))}</p><div class="actions">${button('Check for updates','wrapper-check')}<button type="button" id="wrapper-install" class="button primary" data-action="wrapper-install" ${s.wrapper_update?.status==='available'?'':'disabled'}>Update MMSM</button></div><p class="smalltext">Stop Minecraft servers before updating. The manager restarts; accounts, worlds and settings are preserved. Only AutoStart servers launch afterward.</p></section><div class="formactions"><button class="button primary">Save settings</button></div></form>`;}
function accountsPage(rows) {return heading('Your trusted crew.','Only administrators can create and manage accounts.',button('Add account','new-account','','primary','plus'),'Accounts')+`<div class="panel tablewrap"><table><thead><tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>${rows.map(u=>`<tr><td><strong>${esc(u.username)}</strong>${u.id===user.id?' <span class="tag">You</span>':''}</td><td>${esc(u.role)}</td><td>${esc(date(u.created))}</td><td>${u.role!=='owner'&&u.id!==user.id?button('Edit','edit-account',JSON.stringify(u),'small')+' '+button('Delete','delete-account',u.id,'small danger'):''}</td></tr>`).join('')}</tbody></table></div><div class="notice">Owner / admin: full management. Operator: start, stop, console, file viewing and download history. Viewer: dashboard and analytics. Server selections are enforced for dashboards, files, console, downloads, notifications and direct API access. The owner always has access to all servers.</div>`;}
function modal(title,body) { $('#modal').innerHTML=`<div class="modalhead"><h2>${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close')}</button></div>${body}<div id="modalerror"></div>`; if(!$('#modal').open) $('#modal').showModal(); }
async function serverModal(update=false) {
 const s = update ? currentServer : (settings || await api('/settings'));
 modal(update?'Update server runtime':'Create a new server',`<form data-form="${update?'update-runtime':'create-server'}">${update?'':field('Server name','name','','text','', 'required maxlength="64"')}${selectField('Loader','loader',['fabric','neoforge','forge','paper','vanilla'],update?s.loader:s.default_loader,update?'disabled':'')}<label class="check"><input type="checkbox" name="experimental" id="experimental"> Show experimental versions (snapshots, pre-releases and beta loaders)</label><div class="formgrid">${selectField('Minecraft version','minecraft',[['','Loading versions…']],'')}${selectField('Loader version / build','loader_version',[['','Select Minecraft first']],'')}</div>${update?'<div class="notice">A full runtime backup will be created. Check that your mods and world support the target version before applying.</div>':`<div class="formgrid spacer">${field('Public Minecraft port','port',25565,'number','','min="1024" max="65535" required')}${memoryField('memory_gb',s.default_memory_mb)}</div><label class="check"><input name="sleep" type="checkbox" ${s.default_sleep?'checked':''}> Enable wake-on-ping and idle sleep</label><p class="smalltext">${s.auto_eula?'Global EULA auto-accept is enabled.':'Enable EULA auto-accept in wrapper Settings before creating a server.'}</p>`}<div class="formactions"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button primary" id="create-submit" disabled>${update?'Back up & update':'Create server'}</button></div></form>`);
 await loadCatalog(update?s.loader:s.default_loader,update?s.minecraft:null,update?s.loader_version:null);
}
let catalogSeq=0;
async function loadCatalog(loader, preferred=null, preferredLoader=null, buildsOnly=false) {
 const loaderField=$('#f-loader_version');if(loaderField){const group=loaderField.closest?.('.field');if(group)group.hidden=loader==='vanilla';}
 const experimental=$('#experimental')?.checked?'&experimental=true':'';
 const seq=++catalogSeq; const submit=$('#create-submit'); if(submit)submit.disabled=true;
 $('#modalerror').textContent='';
 try {
  let mc=preferred;
  if(!buildsOnly){
   const catalog=await api('/catalog?loader='+encodeURIComponent(loader)+experimental); if(seq!==catalogSeq||!$('#modal').open)return;
   mc=catalog.minecraft.includes(preferred)?preferred:catalog.minecraft[0];
   $('#f-minecraft').innerHTML=catalog.minecraft.map(v=>`<option ${v===mc?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  if(!mc)throw new Error('No Minecraft versions are available for this loader.');
  const catalog=await api('/catalog?loader='+encodeURIComponent(loader)+'&minecraft='+encodeURIComponent(mc)+experimental); if(seq!==catalogSeq||!$('#modal').open)return;
  $('#f-loader_version').innerHTML=catalog.versions.map(v=>`<option value="${esc(v)}" ${v===preferredLoader?'selected':''}>${esc(v)}${catalog.channels?.[v]?' · '+esc(catalog.channels[v]):''}</option>`).join('');
  if(submit)submit.disabled=!catalog.versions.length;
 }catch(e){if(seq===catalogSeq&&$('#modal').open)$('#modalerror').innerHTML=`<div class="errorbox">${esc(e.message)}</div>${button('Retry catalog','retry-catalog','','small','refresh')}`;}
}
async function searchMods(form, page=0) {
 if(!currentServer||route!=='server'||tab!=='mods')return;
 const data=form?new FormData(form):null;
 const query=data?String(data.get('query')||''):(modSearch?.query||'');
 const type=data?String(data.get('type')):(modSearch?.type||(currentServer.loader==='paper'?'plugin':'mod'));
 const index=data?String(data.get('index')||'downloads'):(modSearch?.index||'downloads');
 const requestedSid=sid, sequence=++modSequence, epoch=routeEpoch;
 modSearch={sid:requestedSid,query,type,index,page,total:0,hits:[],loaded:false,sequence};
 $('#search-results').innerHTML='<p>Searching Modrinth…</p>';
 try {
  const result=await api('/modrinth/search?server_id='+requestedSid+'&q='+encodeURIComponent(query)+'&type='+encodeURIComponent(type)+'&offset='+(page*12)+'&limit=12&index='+encodeURIComponent(index));
  if(epoch!==routeEpoch||sequence!==modSequence||sid!==requestedSid)return;
  modSearch={...modSearch,hits:result.hits,total:result.total_hits??result.hits.length,loaded:true};
  renderModResults();
  await hydrateModCards(sequence);
 }catch(e){if(epoch===routeEpoch&&sequence===modSequence&&$('#search-results'))$('#search-results').innerHTML=`<div class="errorbox">${esc(e.message)}</div>${button('Retry search','mod-retry')}`;}
}
function renderModResults() {
 if(!$('#search-results')||!modSearch?.loaded)return;
 const state=modSearch,pages=Math.max(1,Math.ceil(state.total/12));
 $('#search-results').innerHTML=`<div class="search-summary"><span class="subtle">${state.total.toLocaleString()} results · Page ${state.page+1} of ${pages}</span><div class="pagination"><button class="button small" data-action="mod-page" data-id="${state.page-1}" ${state.page===0?'disabled':''}>Previous</button><button class="button small" data-action="mod-page" data-id="${state.page+1}" ${state.page+1>=pages?'disabled':''}>Next</button></div></div><div class="searchresults">${state.hits.map(r=>`<article class="result" data-project="${esc(r.project_id)}"><div class="result-heading">${projectImage(r.icon_url,r.title)}<div><h3>${esc(r.title)}</h3><span class="subtle">by ${esc(r.author)}</span></div></div><p>${esc(r.description)}</p><span class="subtle">${Number(r.downloads).toLocaleString()} downloads</span><div class="project-install" data-install="${esc(r.project_id)}">${modVersionControl(r)}</div></article>`).join('')}</div>${state.hits.length?'':'<p>No compatible projects found. Try another search.</p>'}<div class="pagination pagination-bottom"><button class="button small" data-action="mod-page" data-id="${state.page-1}" ${state.page===0?'disabled':''}>Previous</button><span class="subtle">${state.page+1} / ${pages}</span><button class="button small" data-action="mod-page" data-id="${state.page+1}" ${state.page+1>=pages?'disabled':''}>Next</button></div>`;
}
function modVersionControl(project) {
 const versions=project.compatibleVersions;
 const latest=versions?.find(v=>v.id===project.latestId);
 const installed=!!latest&&(currentServer.mods.some(m=>m.project_id===latest.project_id&&m.version_id===latest.id)||currentServer.modpack?.version_id===latest.id);
 return `<div class="mod-install-actions"><button class="button small primary" data-action="mod-card-install" data-id="${esc(project.project_id)}" ${project.installing||installed||versions?.length===0?'disabled':''}>${project.installing?'Installing…':installed?'Installed':'Install'}</button>${button('Versions','mod-versions',project.project_id,'small versions-button')}${modrinthLink(project.project_id)}</div><span class="subtle mod-version-note">${project.versionError?esc(project.versionError):latest?esc(latest.version_number)+' · '+esc(latest.version_type):versions?.length===0?'No compatible server versions':'Install newest compatible version'}</span>`;
}
async function loadProjectVersions(project,state=modSearch){
 const response=await api('/modrinth/compatible?server_id='+state.sid+'&project='+encodeURIComponent(project.project_id)+'&type='+state.type);
 if(!response||!Array.isArray(response.versions)||response.versions.some(v=>!v.id||!v.version_number))throw new Error('Modrinth returned incomplete version details. Try Versions again.');
 project.compatibleVersions=response.versions;project.latestId=response.latest_id;project.versionError=null;
 return response.versions;
}
async function hydrateModCards(sequence) {
 const epoch=routeEpoch,state=modSearch;
 if(!state||state.sequence!==sequence)return;
 // Search's `versions` is a list of Minecraft versions, not downloadable releases.
 const queue=state.hits.filter(p=>!p.compatibleVersions);
 async function worker(){while(queue.length){
  const project=queue.shift();
  try{await loadProjectVersions(project,state);}catch(e){project.versionError=e.message;}
  if(epoch!==routeEpoch||modSearch!==state)return;
  const el=document.querySelector(`[data-install="${CSS.escape(project.project_id)}"]`);if(el)el.innerHTML=modVersionControl(project);
 }}
 await Promise.all(Array.from({length:Math.min(3,queue.length)},worker));
}
async function projectVersionsModal(project,state=modSearch){
 const server=currentServer;
 modal('Compatible versions — '+project.title,'<p id="versions-loading">Loading versions…</p>');
 try{
  const versions=await loadProjectVersions(project,state);
  if(!$('#modal').open||!$('#versions-loading'))return;
  modal('Compatible versions — '+project.title,`<p>${esc(server.loader)} · Minecraft ${esc(server.minecraft)}. Newest first.</p><div class="version-list">${versions.map(v=>{
   const installed=server.mods.some(m=>m.version_id===v.id)||server.modpack?.version_id===v.id;
   return `<article class="version-row"><div><strong>${esc(v.version_number)}</strong><p>${esc(v.name)} · ${esc(v.version_type)}<br>${esc(date(v.published))}</p></div><button class="button small ${installed?'':'primary'}" data-action="mod-version-install" data-id="${esc(JSON.stringify({project_id:project.project_id,version_id:v.id,type:state.type,server_id:state.sid}))}" ${installed?'disabled':''}>${installed?'Installed':'Install'}</button></article>`;
  }).join('')||'<p>No compatible server versions found.</p>'}</div>`);
 }catch(e){if($('#modal').open&&$('#versions-loading'))modal('Compatible versions — '+project.title,`<div class="errorbox">${esc(e.message)}</div>${button('Retry',project.installedSource?'installed-versions':'mod-versions',project.project_id)}`);}
}
async function installProject(projectId,type,versionId=null,serverId=sid){
 const result=await api('/servers/'+serverId+'/project-install','POST',{project_id:projectId,type,...(versionId?{version_id:versionId}:{})});
 $('#modal').close();beginInstall(serverId);toast('Installing '+result.version+'. Progress is in Downloads.');
}

async function accountModal(u=null) {const servers=[...await api('/servers'),...await api('/servers?archive=true')];modal(u?'Edit account':'Add an account',`<form data-form="account"><input name="id" type="hidden" value="${esc(u?.id||'')}">${u?`<p>Editing ${esc(u.username)}</p>`:field('Username','username','','text','','required minlength="3" maxlength="32"')}${field(u?'New password (optional)':'Password','password','','password','At least 12 characters.',u?'minlength="12"':'required minlength="12"')}${selectField('Role','role',['viewer','operator','admin'],u?.role||'viewer')}<h3>Server access</h3><label class="check"><input type="checkbox" name="all_servers" ${!u||u.server_ids==null?'checked':''}> All servers, including future servers</label><p class="smalltext">Uncheck a server to restrict this account. Restricted admins cannot manage global settings or accounts.</p>${servers.map(s=>`<label class="check"><input type="checkbox" name="server_access" value="${esc(s.id)}" ${!u||u.server_ids==null||u.server_ids.includes(s.id)?'checked':''}>${esc(s.name)}${s.archived?' (archived)':''}</label>`).join('')}<div class="formactions"><button class="button primary">Save account</button></div></form>`);}

function serversPage(servers) {
 return heading('Your servers','All non-archived servers in one place.',globalAdmin()?button('Create server','new-server','','primary','plus'):'','Servers')+`<div class="panel tablewrap"><table><thead><tr><th>Server</th><th>Status</th><th>Loader / Minecraft</th><th>Memory limit</th><th>Port</th><th>Actions</th></tr></thead><tbody>${servers.map(s=>`<tr><td><button class="filelink" data-action="open-server" data-id="${s.id}">${serverImage(s)}${statusDot(s)}<strong>${esc(s.name)}</strong></button></td><td><span class="status ${esc(s.status)}">${esc(s.status)}</span></td><td>${esc(s.loader)} · ${esc(s.minecraft)}</td><td>${formatGB(s.memory_mb/1024)} GB</td><td>${s.port}</td><td><div class="actions">${operator()&&s.launch&&['stopped','sleeping','error','crashed'].includes(s.status)?button('Start','server-start',s.id,'small','play'):''}${operator()&&['running','starting'].includes(s.status)?button('Stop','server-stop',s.id,'small','stop')+button('Restart','server-restart',s.id,'small','refresh'):''}${button('Manage','open-server',s.id,'small','arrow')}</div></td></tr>`).join('')}</tbody></table>${servers.length?'':'<p>No active servers yet. Create a server or restore one from Archive.</p>'}</div>`;
}
function accountSettingsModal() {
 closePopover();
 modal('Account settings',`<div class="account-summary"><span class="avatar">${avatar()}</span><div><h3>${esc(user.username)}</h3><span class="tag">${esc(user.role)}</span></div>${button('Sign out','logout','','','logout')}</div><div class="divider"></div><h3>Profile picture</h3>${button('Upload picture','image-upload','avatar','','upload')}<form data-form="profile">${field('Minecraft username','minecraft_name',user.username,'text','Pull the face and hat layer from this Minecraft skin.','required pattern="[A-Za-z0-9_]{1,16}"')}<button class="button">Use Minecraft face</button></form><div class="divider"></div><h3>Password</h3><form data-form="password">${field('Current password','current','','password','','required')}${field('New password','password','','password','At least 12 characters. Saving signs out your existing sessions.','required minlength="12"')}<div class="formactions"><button class="button primary">Save password</button></div></form>`);
}
function confirmation(title,message,label,action,id,extra='') {
 modal(title,`<p>${esc(message)}</p>${extra}<div class="formactions">${button('Cancel','close-modal')}${button(label,action,id,'danger')}</div>`);
}
function closePopover(suppress=true) {
 if(suppress&&popoverKind==='downloads')downloadsSuppressed=true;
 clearTimeout(downloadCloseTimer);downloadCloseTimer=null;
 popoverKind=null;popoverAutomatic=false;
 const el=$('#activity-popover');if(el)el.hidden=true;
 document.querySelectorAll('.activity-trigger').forEach(el=>el.setAttribute('aria-expanded','false'));
}
function openPopover(kind,automatic=false) {
 clearTimeout(downloadCloseTimer);downloadCloseTimer=null;
 if(!automatic&&popoverKind===kind){closePopover();return;}
 popoverKind=kind;popoverAutomatic=automatic;
 renderPopover();
}
function renderPopover() {
 const el=$('#activity-popover');if(!el||!popoverKind)return;
 const top=el.scrollTop;
 el.hidden=false;
 el.setAttribute('aria-label',popoverKind==='downloads'?'Downloads':'Notifications');
 document.querySelectorAll('.activity-trigger').forEach(el=>el.setAttribute('aria-expanded',String(el.dataset.action===popoverKind+'-popup')));
 if(popoverKind==='downloads') {
  const visible=popupDownloads(downloadRows);
  el.innerHTML=`<div class="popover-head"><h2>Downloads</h2>${button('Close','close-popup','','small','close')}</div>${pendingInstallServers.size&&!downloadRows.some(d=>['queued','downloading'].includes(d.status))?'<p class="preparing">Preparing or installing server files…</p>':''}<div class="activity-items">${visible.length?visible.map(d=>`<article class="activity-item"><div class="activity-item-main"><strong>${esc(d.name)}</strong><div class="activity-meta"><span class="status ${d.status==='failed'?'error':''}">${esc(d.status)}</span><span>${bytes(d.bytes)}${d.total?' / '+bytes(d.total):''}</span></div>${d.error?`<p class="orange">${esc(d.error)}</p>`:''}${d.status==='downloading'&&d.total?`<svg class="download-progress" viewBox="0 0 100 5" preserveAspectRatio="none"><rect class="track" width="100" height="5"/><rect width="${Math.min(100,d.bytes/d.total*100)}" height="5"/></svg>`:''}<small>${esc(date(d.created))}</small></div>${!['queued','downloading'].includes(d.status)?`<button class="icon-button" data-action="download-dismiss" data-id="${esc(d.id)}" aria-label="Dismiss ${esc(d.name)}">${icon('close')}</button>`:''}</article>`).join(''):'<p class="popup-empty">No downloads in your history.</p>'}</div><div class="popover-footer">${button('Dismiss completed history','downloads-clear','','small')}${button('View all history','download-history','','small')}<span class="subtle">Three recent transfers · older records in history.</span></div>`;
 }else{
  el.innerHTML=`<div class="popover-head"><h2>Notifications</h2>${button('Close','close-popup','','small','close')}</div><div class="activity-items">${notificationRows.length?notificationRows.map(n=>`<article class="notify ${n.seen?'read':''}"><span class="dot"></span><div><p>${esc(n.message)}</p><small>${esc(date(n.created))}</small>${notificationActions(n)}</div></article>`).join(''):'<p class="popup-empty">You’re all caught up.</p>'}</div>${operator()?`<div class="popover-footer">${button('Mark all read','notifications-read','','small','check')}</div>`:''}`;
 }
 el.scrollTop=top;
}
function updateActivityBadges() {
 if($('#unread'))$('#unread').textContent=notificationRows.filter(n=>!n.seen&&!n.resolved).length||'';
 if($('#download-count'))$('#download-count').textContent=downloadRows.filter(d=>['queued','downloading'].includes(d.status)).length||'';
}
function reconcileDownloads(rows) {
 const newRows=seenDownloadIds===null?rows.filter(d=>['queued','downloading'].includes(d.status)):rows.filter(d=>!seenDownloadIds.has(d.id));
 if(seenDownloadIds===null)seenDownloadIds=new Set();
 rows.forEach(d=>seenDownloadIds.add(d.id));
 if(seenDownloadIds.size>12000)seenDownloadIds=new Set(rows.map(d=>d.id));
 downloadRows=rows;
 const active=rows.some(d=>['queued','downloading'].includes(d.status))||pendingInstallServers.size>0;
 if(newRows.length&&!downloadsSuppressed&&!popoverKind&&!$('#modal').open)openPopover('downloads',true);
 if(popoverKind==='downloads')renderPopover();
 if(active){clearTimeout(downloadCloseTimer);downloadCloseTimer=null;}
 else {
  downloadsSuppressed=false;
  if(popoverKind==='downloads'&&popoverAutomatic&&!downloadCloseTimer)downloadCloseTimer=setTimeout(()=>{
   downloadCloseTimer=null;
   if(popoverKind==='downloads'&&popoverAutomatic&&!pendingInstallServers.size&&!downloadRows.some(d=>['queued','downloading'].includes(d.status)))closePopover(false);
  },1600);
 }
 updateActivityBadges();
}
async function activityPoll() {
 if(!user||activityPolling)return;
 activityPolling=true;
 try {
  const accountId=user.id;
  const requests=[api('/notifications'),operator()?api('/downloads'):Promise.resolve([]),pendingInstallServers.size?api('/servers'):Promise.resolve(null)];
  const [notes,downloads,servers]=await Promise.all(requests);
  if(!user||user.id!==accountId)return;
  notificationRows=notes;
  if(servers)for(const id of pendingInstallServers){const s=servers.find(s=>s.id===id);if(!s||!['installing','updating'].includes(s.status))pendingInstallServers.delete(id);}
  reconcileDownloads(downloads);
  if(popoverKind==='notifications')renderPopover();
  updateActivityBadges();
 }catch(e){console.debug('Activity refresh:',e.message);}finally{activityPolling=false;}
}
function beginInstall(serverId) {
 pendingInstallServers.add(serverId);
 downloadsSuppressed=false;
 openPopover('downloads',true);
 void activityPoll();
}
async function queueModInstall(versionId, type='mod') {
 const serverId=sid;
 await api('/servers/'+serverId+(type==='modpack'?'/pack-install':'/mods-install'),'POST',{version_id:versionId});
 beginInstall(serverId);
 toast('Installation started. Progress is in Downloads.');
}
async function uploadFiles(files,mods=false) {
 if(!files.length)return;
 const requestedSid=sid, directory=filePath, epoch=routeEpoch;
 const progress=$('#upload-progress'),buttonEl=document.querySelector(mods?'[data-action="mod-upload"]':'[data-action="file-upload"]');
 if(buttonEl)buttonEl.disabled=true;
 try {
  for(let i=0;i<files.length;i++) {
   const file=files[i];if(file.size>512*1024**2)throw new Error(file.name+' exceeds the 512 MB upload limit.');
   const path=[directory,file.name].filter(Boolean).join('/');
   await new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open('POST','/api/servers/'+requestedSid+(mods?'/mods-upload?name='+encodeURIComponent(file.name):'/upload?path='+encodeURIComponent(path)));
    xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-CSRF-Token',csrf);
    xhr.upload.onprogress=e=>{if(progress&&epoch===routeEpoch)progress.textContent=`Uploading ${file.name} (${i+1}/${files.length}) — ${e.lengthComputable?Math.round(e.loaded/e.total*100)+'%':bytes(e.loaded)}`;};
    xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{result={error:'Upload failed'};}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(new Error(result.error));};
    xhr.onerror=()=>reject(new Error('Upload connection failed'));xhr.onabort=()=>reject(new Error('Upload cancelled'));
    xhr.send(file);
   });
  }
  toast(files.length+' file'+(files.length===1?'':'s')+' uploaded');
  if(epoch===routeEpoch)await render();
 }catch(e){toast(e.message,true);if(progress)progress.textContent=e.message;}
 finally{if(buttonEl)buttonEl.disabled=false;}
}

async function perform(action,id,el) {
 if(await featureAction(action,id,el))return;
 if(action==='go-settings'){closePopover();await navigate('settings');return;}
 if(action==='wrapper-check'){const state=await api('/wrapper-update/check','POST',{});$('#wrapper-update-status').textContent=wrapperUpdateText(state);if($('#wrapper-install'))$('#wrapper-install').disabled=state.status!=='available';return;}
 if(action==='wrapper-install'){await api('/wrapper-update/install','POST',{});toast('Update verified. MMSM is restarting…');waitForManager();return;}
 if(action==='console-scroll'){consoleAutoScroll=!consoleAutoScroll;el.textContent='Auto-scroll: '+(consoleAutoScroll?'on':'off');el.setAttribute('aria-pressed',String(consoleAutoScroll));if(consoleAutoScroll&&$('#console'))$('#console').scrollTop=$('#console').scrollHeight;return;}
 if(action==='copy-error'){await copyErrorLogs(id);return;}
 if(action==='folder-delete'){confirmation('Delete this folder?',id+' and all its contents will be removed. A recovery copy is kept in backups.','Delete folder','confirm-folder-delete',id);return;}
 if(action==='confirm-folder-delete'){const result=await api('/servers/'+sid+'/files','DELETE',{path:id,directory:true});$('#modal').close();toast('Folder deleted. Recovery copy: '+result.backup);await render();return;}
 if(action==='installed-versions'){const m=currentServer.mods.find(m=>m.project_id===id);await projectVersionsModal({project_id:id,title:m.name,installedSource:true},{sid,type:currentServer.loader==='paper'?'plugin':'mod'});return;}
 if(action==='close-modal'){$('#modal').close();return;}
 if(action==='close-popup'){closePopover();return;}
 if(action==='downloads-popup'||action==='notifications-popup'){openPopover(action.split('-')[0]);await activityPoll();return;}
 if(action==='download-dismiss'||action==='downloads-clear'){await api('/downloads/dismiss','POST',action==='download-dismiss'?{id}:{});await activityPoll();return;}
 if(action==='logout'){try{await api('/logout','POST',{});}catch(e){if(e.status!==401)throw e;}csrf=null;user=null;resetActivity();showAuth(false);return;}
 if(action==='account-settings'){accountSettingsModal();return;}
 if(action==='retry'){await navigate(route,sid,tab);return;}
 if(action==='back'){await navigate('servers');return;}
 if(action==='go-archive'){await navigate('archive');return;}
 if(action==='open-server'){await navigate('server',id);return;}
 if(action==='new-server'){await serverModal();return;}
 if(action==='update-runtime'){await serverModal(true);return;}
 if(action==='retry-catalog'){await loadCatalog($('#f-loader').value);return;}
 if(action==='new-account'){await accountModal();return;}
 if(action==='edit-account'){await accountModal(JSON.parse(id));return;}
 if(action==='delete-account'){confirmation('Delete account?','This revokes the account’s sessions and removes access.','Delete account','confirm-delete-account',id);return;}
 if(action==='confirm-delete-account'){await api('/users/'+id,'DELETE',{});$('#modal').close();toast('Account deleted');await render();return;}
 if(action==='notifications-read'){await api('/notifications/read','POST',{});await activityPoll();return;}
 if(action==='file-open'){const previous=filePath;filePath=el.dataset.path??id??'';try{await render();}catch(e){filePath=previous;throw e;}return;}
 if(action==='mod-upload'){$('#mod-upload-input').click();return;}
 if(action==='file-upload'){$('#file-upload-input').click();return;}
 if(action==='file-delete'){confirmation('Delete this file?',id+' will be removed from the server. A recovery copy is kept in backups.','Delete file','confirm-file-delete',id);return;}
 if(action==='confirm-file-delete'){
  const result=await api('/servers/'+sid+'/files','DELETE',{path:id});$('#modal').close();
  if(filePath===id)filePath=id.split('/').slice(0,-1).join('/');
  toast('File deleted. Recovery copy: '+result.backup);await render();return;
 }
 if(action==='mod-page'){await searchMods(null,Math.max(0,Number(id)));return;}
 if(action==='mod-retry'){await searchMods(null,modSearch?.page||0);return;}
 if(action==='mod-versions'){const project=modSearch.hits.find(p=>p.project_id===id);await projectVersionsModal(project);return;}
 if(action==='mod-version-install'){const data=JSON.parse(id);await installProject(data.project_id,data.type,data.version_id,data.server_id);return;}
 if(action==='mod-card-install'){
  const project=modSearch.hits.find(p=>p.project_id===id);
  await installProject(project.project_id,modSearch.type);project.installing=true;
  const el=document.querySelector(`[data-install="${CSS.escape(id)}"]`);if(el)el.innerHTML=modVersionControl(project);return;
 }
 if(action==='install-version'){await queueModInstall(id);return;}
 if(action==='toggle-mod'){const m=currentServer.mods.find(m=>m.project_id===id);await api('/servers/'+sid+'/mods-toggle','POST',{project_id:id,enabled:!m.enabled});toast('Project '+(m.enabled?'disabled':'enabled'));await refreshServerPanels();return;}
 if(action==='check-updates'){const result=await api('/servers/'+id+'/check-updates','POST',{});toast(result.updates.length+' compatible updates found');await refreshServerPanels();return;}
 if(action==='server-kill'){confirmation('Kill the server process?','This immediately terminates Java without saving the world. Unsaved changes may be lost. Use this if normal Stop is stuck.','Kill process','confirm-server-kill',id);return;}
 if(action==='confirm-server-kill'){await api('/servers/'+id+'/kill','POST',{});$('#modal').close();toast('Server process killed');await refreshServerPanels();return;}
 if(action==='server-archive'){confirmation('Archive this server?','The server will stay dormant until you unarchive it.','Archive','confirm-server-archive',id);return;}
 if(action==='confirm-server-archive'){await api('/servers/'+id+'/archive','POST',{});$('#modal').close();toast('Server archived');await navigate('archive');return;}
 if(action.startsWith('server-')){
  const cmd=action.slice(7);
  const statusBar=$('.detailmeta [role="status"]');if(statusBar)statusBar.innerHTML=statusDot({status:{stop:'stopping',start:'starting',restart:'stopping',sleep:'stopping'}[cmd]||currentServer?.status||'stopped'})+({stop:'Stopping — saving the world…',start:'Starting server…',restart:'Restart requested…',sleep:'Putting server to sleep…'}[cmd]||'Working…');
  const result=await api('/servers/'+id+'/'+cmd,'POST',{});
  if(result.stop_requested){toast('Stop requested; current operation will finish without restarting.');await refreshServerPanels();return;}
  toast({start:'Server starting',stop:'Server stopped',sleep:'Server is sleeping. Ping it from Minecraft to test wake-up.',unarchive:'Server restored'}[cmd]||'Done');
  if(route==='server')await refreshServerPanels();else await render();
 }
}
function resetActivity() {
 closePopover(false);downloadRows=[];notificationRows=[];seenDownloadIds=null;pendingInstallServers.clear();downloadsSuppressed=false;
}
document.addEventListener('click',async e=>{
 const el=e.target.closest('button');
 const card=e.target.closest('[data-server-card]');
 if(!el&&card&&!e.target.closest('a,input,select,textarea')){await navigate('server',card.dataset.serverCard);return;}
 if(popoverKind&&!e.target.closest('#activity-popover')&&!el?.classList.contains('activity-trigger'))closePopover();
 if(!el||el.disabled)return;
 if(el.dataset.route){await navigate(el.dataset.route);return;}
 if(el.dataset.tab){tab=el.dataset.tab;routeEpoch++;try{await render();}catch(err){toast(err.message,true);}return;}
 if(!el.dataset.action)return;
 el.disabled=true;
 try{await perform(el.dataset.action,el.dataset.id,el);}catch(err){if($('#modal').open&&$('#modalerror'))$('#modalerror').innerHTML=`<div class="errorbox">${esc(err.message)}</div>`;else toast(err.message,true);}finally{el.disabled=false;}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&popoverKind)closePopover();if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-server-card]')){e.preventDefault();void navigate('server',e.target.dataset.serverCard);}});
document.addEventListener('error',e=>{
 if(e.target.tagName==='IMG'&&e.target.closest('.player-head')){e.target.parentElement.textContent='?';return;}
 if(e.target.tagName==='IMG'&&e.target.closest('.project-icon'))e.target.parentElement.innerHTML=icon('cube');
},true);
document.addEventListener('change',async e=>{
 if(e.target.id==='mod-upload-input'){await uploadFiles(Array.from(e.target.files),true);return;}
 if(e.target.dataset?.modToggle){
  const input=e.target,enabled=input.checked,serverId=sid;input.disabled=true;
  try{await api('/servers/'+serverId+'/mods-toggle','POST',{project_id:input.dataset.modToggle,enabled});if(sid===serverId)await refreshServerPanels();}
  catch(error){input.checked=!enabled;toast(error.message,true);}finally{input.disabled=false;}
  return;
 }

 if(e.target.name==='server_access'&&!e.target.checked)e.target.closest('form').querySelector('[name=all_servers]').checked=false;
 if(e.target.name==='all_servers'&&e.target.checked)e.target.closest('form').querySelectorAll('[name=server_access]').forEach(el=>el.checked=true);
 if(e.target.id==='file-upload-input'){await uploadFiles(Array.from(e.target.files));return;}
 if(!$('#modal').open)return;
 if(e.target.name==='experimental')await loadCatalog($('#f-loader').value,$('#f-minecraft').value);
 if(e.target.name==='loader')await loadCatalog(e.target.value);
 if(e.target.name==='minecraft')await loadCatalog($('#f-loader').value,e.target.value,null,true);
});
document.addEventListener('submit',async e=>{
 const form=e.target; if(!form.dataset.form)return; e.preventDefault();
 const btn=form.querySelector('button[type="submit"],button:not([type])'),data=Object.fromEntries(new FormData(form));if(btn)btn.disabled=true;
 try{
  const kind=form.dataset.form;
  if(await featureSubmit(kind,data,form))return;
  if(kind==='login'||kind==='setup'){
   if(kind==='setup')await api('/setup','POST',data);
   const result=await api('/login','POST',{username:data.username,password:data.password});user=(await api('/me')).user;csrf=result.csrf;appearance=await api('/appearance');resetActivity();await navigate('dashboard');void activityPoll();return;
  }
  if(kind==='create-server'){
   const body={...data,port:Number(data.port),memory_mb:memoryToMB(data.memory_gb),sleep:data.sleep==='on'};delete body.memory_gb;
   const result=await api('/servers','POST',body);$('#modal').close();toast('Server created. Runtime installation is in progress.');await navigate('server',result.id);beginInstall(result.id);return;
  }
  if(kind==='update-runtime'){await api('/servers/'+sid+'/update','POST',{minecraft:data.minecraft,loader_version:data.loader_version});$('#modal').close();beginInstall(sid);toast('Backup and update queued');await render();return;}
  if(kind==='command'){await api('/servers/'+sid+'/command','POST',data);form.reset();toast('Command sent');return;}
  if(kind==='server-config'){const body={...data,memory_mb:memoryToMB(data.memory_gb),idle_minutes:Number(data.idle_minutes),sleep:data.sleep==='on',autostart:data.autostart==='on'};delete body.memory_gb;await api('/servers/'+sid+'/configure','PUT',body);toast('Server settings saved');await render();return;}
  if(kind==='properties'){await api('/servers/'+sid+'/properties','PUT',{values:data});toast('Server properties saved');return;}
  if(kind==='edit-file'){await api('/servers/'+sid+'/files','PUT',{path:filePath,content:data.content});toast('File saved');return;}
  if(kind==='search-mods'){await searchMods(form,0);return;}
  if(kind==='settings'){
   data.default_memory_mb=memoryToMB(data.default_memory_gb);delete data.default_memory_gb;
   for(const k of ['web_port','idle_minutes','retention_days','update_interval_hours'])data[k]=Number(data[k]);data.default_sleep=data.default_sleep==='on';data.auto_eula=data.auto_eula==='on';data.wrapper_update_checks=data.wrapper_update_checks==='on';
   const result=await api('/settings','PUT',data);settings={...settings,...data};refreshTheme();toast(result.restart_required?'Settings saved. Restart MMSM to apply the network settings.':'Settings saved');return;
  }
  if(kind==='account'){data.server_ids=data.all_servers==='on'?null:Array.from(form.querySelectorAll('[name=server_access]:checked')).map(el=>el.value);delete data.all_servers;delete data.server_access;const id=data.id;delete data.id;await api(id?'/users/'+id:'/users',id?'PUT':'POST',data);$('#modal').close();toast('Account saved');await render();return;}
  if(kind==='password'){await api('/password','POST',data);user=null;csrf=null;resetActivity();showAuth(false);toast('Password changed. Please sign in again.');return;}
 }catch(err){if(form.closest('dialog')&&$('#modalerror'))$('#modalerror').innerHTML=`<div class="errorbox">${esc(err.message)}</div>`;else if($('#autherror'))$('#autherror').innerHTML=`<div class="errorbox">${esc(err.message)}</div>`;else toast(err.message,true);}finally{if(btn)btn.disabled=false;}
});
async function refreshServerPanels() {
 if(route!=='server')return;
 const epoch=routeEpoch,requestedSid=sid;
 const s=await api('/servers/'+requestedSid);if(epoch!==routeEpoch)return;
 currentServer=s;
 const header=$('#server-heading');if(header)header.outerHTML=serverHeader(s).split('<div class="tabs server-tabs">')[0];
 if($('#sleep-now'))$('#sleep-now').disabled=!s.sleep||!s.launch||['installing','updating','stopping','killing'].includes(s.status);
 if(tab==='mods'){
  if($('#installed-mods'))
  $('#installed-mods').innerHTML=installedMods(s);
  if(modSearch?.sid===sid)for(const project of modSearch.hits){
   if(!['installing','updating'].includes(s.status))project.installing=false;
   const container=document.querySelector(`[data-install="${CSS.escape(project.project_id)}"]`);
   if(container&&document.activeElement?.closest('[data-install]')!==container)container.innerHTML=modVersionControl(project);
  }
 }
 if(tab==='console'){
  const logs=await api('/servers/'+requestedSid+'/logs');const el=$('#console');
  if(el&&epoch===routeEpoch){const previousTop=el.scrollTop;el.textContent=logs.lines.join('\n')||'Console output will appear when the server starts.';el.scrollTop=consoleAutoScroll?el.scrollHeight:previousTop;}
 }
}
async function refresh() {
 if(!user||polling||$('#modal').open||document.hidden)return;
 polling=true;
 try{
  const epoch=routeEpoch;
  if(['dashboard','analytics','servers'].includes(route) || (route==='server' && ['overview','players'].includes(tab)))await render(epoch);
  else if(route==='server')await refreshServerPanels();
 }catch(e){console.debug('Refresh:',e.message);}finally{polling=false;}
}
async function init(){
 try{const setup=await api('/setup');if(setup.required){showAuth(true);return;}const me=await api('/me');user=me.user;csrf=me.csrf;appearance=await api('/appearance');await navigate('dashboard');void activityPoll();}catch(e){showAuth(false);}
}
setInterval(refresh,5000);
setInterval(activityPoll,2000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

function notificationActions(n){
 if(n.kind==='wrapper')return button('Open Settings','go-settings','','small');
 if(n.resolved)return '<p class="subtle">Resolved</p>';
 if(n.kind==='whitelist'&&admin())return `<div class="actions">${button('Whitelist','request-approve',n.id,'small primary')}${button('Ignore','request-ignore',n.id,'small')}</div>`;
 return n.server_id?`<div class="actions">${button(n.kind==='runtime'?'Review server update':n.kind==='mod'?'Review mod updates':'Open server','notification-open',JSON.stringify({sid:n.server_id,tab:n.payload?.tab||'overview'}),'small')}</div>`:'';
}
function playersPanel(data,compact=false){
 const rows=data.players;
 const card=p=>`<article class="player-row"><span class="player-head"><img src="/api/servers/${sid}/head?name=${encodeURIComponent(p.name)}" alt="${esc(p.name)} head" loading="lazy"></span><div class="player-info"><strong>${esc(p.name)}</strong><small>${p.online?'Online · ':''}${p.op?'Operator (level '+(p.level||4)+')':'Standard player'}${p.whitelisted?' · Whitelisted':''}${p.banned?' · Banned':''}</small><small>${esc(p.uuid||'UUID not cached yet')}</small>${p.reason?`<small>${esc(p.reason)}</small>`:''}</div>${admin()&&!compact?`<div class="actions">${button(p.whitelisted?'Remove whitelist':'Whitelist','player-action',JSON.stringify({name:p.name,action:p.whitelisted?'unwhitelist':'whitelist'}),'small')}${button(p.op?'De-op':'Op','player-confirm',JSON.stringify({name:p.name,action:p.op?'deop':'op'}),'small')}${button(p.banned?'Unban':'Ban','player-confirm',JSON.stringify({name:p.name,action:p.banned?'pardon':'ban'}),'small')}</div>`:''}</article>`;
 if(compact)return `<section class="panel"><div class="panelhead"><h2>Players ${data.online_count==null?'':'· '+data.online_count+' online'}</h2><button class="button small" data-tab="players">Manage players</button></div>${rows.filter(p=>p.online).map(card).join('')||'<p>No online names reported yet.</p>'}<p class="smalltext">Names come from join/leave logs. Player count comes from Minecraft’s status query.</p></section>`;
 return `<section class="panel"><h2>Join requests</h2>${data.requests.map(n=>`<div class="player-row"><strong>${esc(n.payload.name)}</strong>${notificationActions(n)}</div>`).join('')||'<p>No pending whitelist requests.</p>'}</section>${admin()?`<form class="panel" data-form="player"><h2>Manage a player</h2><div class="formgrid">${field('Minecraft username','name','','text','','required pattern="[A-Za-z0-9_]{1,16}"')}${selectField('Action','action',[['whitelist','Whitelist'],['unwhitelist','Remove whitelist'],['ban','Ban'],['pardon','Unban'],['op','Make operator'],['deop','Remove operator']],'whitelist')}</div><button class="button primary">Apply action</button><p class="smalltext">When running, Minecraft processes the command. When stopped, MMSM updates the player lists. Online-mode servers verify new usernames with Mojang.</p></form>`:''}${[['Online',p=>p.online],['Whitelisted',p=>p.whitelisted],['Banned',p=>p.banned],['Known players',()=>true]].map(([label,filter])=>`<section class="panel"><h2>${label}</h2>${rows.filter(filter).map(card).join('')||'<p>No players in this section.</p>'}</section>`).join('')}`;
}
function backupsPanel(s,d){
 return `<div class="notice">Backups gracefully stop a running server, save its files, then start it again. Keep MMSM running for schedules to run. Archived servers are skipped; missed intervals run once on return.</div><section class="panel"><div class="panelhead"><h2>Backup rules</h2>${button('Add rule','backup-rule-new','','primary','plus')}</div>${d.rules.map(r=>`<article class="backup-row"><div><h3>${esc(r.name)}</h3><p>${esc(r.path)}</p><small>Keep ${r.keep} backups</small></div><div class="actions">${button('Run now','backup-run',r.id,'small primary')}${button('Edit','backup-rule-edit',r.id,'small')}${button('Delete rule','backup-rule-delete',r.id,'small danger')}</div></article>`).join('')||'<p>Create a backup rule with a destination and retention count.</p>'}${s.backup_result?`<p class="${s.backup_result.ok?'subtle':'orange'}">Last manual backup: ${esc(s.backup_result.path||s.backup_result.error)}</p>`:''}</section><section class="panel"><div class="panelhead"><h2>Schedules</h2>${button('Add schedule','schedule-new','','primary','plus')}</div>${d.schedules.map(j=>`<article class="backup-row"><div><h3>${esc(j.action)} every ${j.every} ${esc(j.unit)}</h3><p>${j.enabled===false?'Paused':'Next: '+esc(date(j.next_run))}${j.rule_id?' · '+esc(d.rules.find(r=>r.id===j.rule_id)?.name||'Missing rule'):''}</p><small>${esc(j.last_result||'Not run yet')}${j.last_run?' · '+esc(date(j.last_run)):''}</small></div><div class="actions">${button('Edit','schedule-edit',j.id,'small')}${button(j.enabled===false?'Enable':'Pause','schedule-toggle',j.id,'small')}${button('Delete','schedule-delete',j.id,'small danger')}</div></article>`).join('')||'<p>Schedule backups, starts, stops, restarts or sleep.</p>'}</section><section class="panel"><div class="panelhead"><h2>Backup history</h2>${button('Refresh','backup-refresh','','small','refresh')}</div>${d.history.map(r=>`<p><strong>${esc(date(r.created))}</strong><br><span class="subtle">${esc(r.path)}</span></p>`).join('')||'<p>No saved backups yet.</p>'}<p class="smalltext">To restore: stop the server, preserve the current folder, then extract a backup into its Servers folder.</p></section>`;
}
function ruleModal(id){
 const r=backupData.rules.find(r=>r.id===id);
 modal(r?'Edit backup rule':'New backup rule',`<form data-form="backup-rule"><input name="id" type="hidden" value="${esc(r?.id||'')}">${field('Rule name','name',r?.name||'World backup','text','','required maxlength="64"')}${field('Destination path','path',r?.path||'','text','Blank uses Backups/<server name> inside MMSM. Relative paths are relative to the project.')}${field('Backups to keep','keep',r?.keep||7,'number','Only backups created by this rule are removed.','required min="1" max="1000"')}<button class="button primary">Save rule</button></form>`);
}
function scheduleModal(id){
 const j=backupData.schedules.find(j=>j.id===id);
 modal(j?'Edit schedule':'New schedule',`<form data-form="schedule"><input name="id" type="hidden" value="${esc(j?.id||'')}">${selectField('Action','action',['backup','start','stop','restart','sleep'],j?.action||'backup')}${selectField('Backup rule (for backups)','rule_id',[['','Choose a backup rule'],...backupData.rules.map(r=>[r.id,r.name])],j?.rule_id||'')}<div class="formgrid">${field('Every','every',j?.every||1,'number','','required min="1" max="100000"')}${selectField('Interval unit','unit',['seconds','minutes','hours','days','weeks'],j?.unit||'days')}</div><label class="check"><input type="checkbox" name="enabled" ${j?.enabled===false?'':'checked'}> Schedule enabled</label><button class="button primary">Save schedule</button></form>`);
}
async function saveBackupData(rules,schedules){
 await api('/servers/'+sid+'/backups','PUT',{backup_rules:rules,schedules});await render();
}
function refreshTheme(){const el=$('#theme');if(el)el.href='/theme.css?v='+Date.now();}
async function uploadImage(kind){
 const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
 input.addEventListener('change',async()=>{
  const file=input.files[0];if(!file)return;
  try{
   if(file.size>2*1024**2)throw new Error('Choose an image smaller than 2 MB.');
   const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Cannot read image'));reader.readAsDataURL(file);});
   await api(kind==='server'?'/servers/'+sid+'/icon':kind==='logo'?'/assets/logo':'/profile','POST',{image:encoded});
   if(kind==='avatar')user=(await api('/me')).user;
   if(kind==='logo'){appearance=await api('/appearance');}
   if(kind==='avatar'){$('#modal').close();await navigate(route,sid,tab);accountSettingsModal();}
   else await navigate(route,sid,tab);
   toast('Image saved');
  }catch(e){toast(e.message,true);}
 });input.click();
}
async function featureAction(action,id,el){
 if(action==='analytics-range'){analyticsDays=Number(id);await render();return true;}
 if(action==='download-history'){downloadHistoryPage=0;await navigate('downloads');return true;}
 if(action==='history-page'){downloadHistoryPage=Math.max(0,Number(id));await render();return true;}
 if(action==='server-delete'){
  const server=currentServer?.id===id?currentServer:(await api('/servers?archive=true')).find(s=>s.id===id);
  if(!server)throw new Error('Server not found');
  modal('Permanently delete '+server.name+'?',`<p>This deletes the server folder, including its worlds, mods, properties and schedules. Stop the server first. Existing backup files and download history are retained.</p><form data-form="delete-server"><input name="id" type="hidden" value="${esc(id)}">${field('Type the exact server name','confirm_name','','text',server.name,'required autocomplete="off"')}<div class="formactions">${button('Cancel','close-modal')}<button class="button danger">Delete permanently</button></div></form>`);return true;
 }
 if(action==='image-upload'){await uploadImage(id);return true;}
 if(action==='mod-view'){modView=id;await render();return true;}
 if(action==='notification-open'){const target=JSON.parse(id);await navigate('server',target.sid,target.tab);return true;}
 if(action==='request-approve'||action==='request-ignore'){
  const result=await api('/notifications/action','POST',{id,action:action==='request-approve'?'whitelist':'ignore'});toast(result.message||'Request resolved');await activityPoll();if(route==='server'&&tab==='players')await render();return true;
 }
 if(action==='player-confirm'){const d=JSON.parse(id);confirmation('Change player permissions?',d.action+' '+d.name+'?','Apply','player-action',id);return true;}
 if(action==='player-action'){const result=await api('/servers/'+sid+'/players','POST',JSON.parse(id));$('#modal').close();toast(result.message||'Player list saved');await render();return true;}
 if(action==='backup-rule-new'||action==='backup-rule-edit'){ruleModal(id);return true;}
 if(action==='schedule-new'||action==='schedule-edit'){scheduleModal(id);return true;}
 if(action==='backup-run'){await api('/servers/'+sid+'/backups','POST',{rule_id:id});toast('Backup queued. Refresh history to see the result.');return true;}
 if(action==='backup-refresh'){await render();return true;}
 if(action==='backup-rule-delete'){if(backupData.schedules.some(j=>j.rule_id===id))throw new Error('Remove schedules using this rule first.');await saveBackupData(backupData.rules.filter(r=>r.id!==id),backupData.schedules);return true;}
 if(action==='schedule-delete'||action==='schedule-toggle'){const jobs=action==='schedule-delete'?backupData.schedules.filter(j=>j.id!==id):backupData.schedules.map(j=>j.id===id?{...j,enabled:j.enabled===false}:j);await saveBackupData(backupData.rules,jobs);return true;}
 return false;
}
async function featureSubmit(kind,data,form){
 if(kind==='delete-server'){const result=await api('/servers/'+data.id,'DELETE',{confirm_name:data.confirm_name});$('#modal').close();await navigate('servers');toast(result.warning||'Server deleted',!!result.warning);return true;}
 if(kind==='profile'){await api('/profile','POST',data);user=(await api('/me')).user;$('#modal').close();await navigate(route,sid,tab);accountSettingsModal();toast('Minecraft profile picture saved');return true;}
 if(kind==='player'){const result=await api('/servers/'+sid+'/players','POST',data);toast(result.message||'Player list saved');await render();return true;}
 if(kind==='backup-rule'){
  data.keep=Number(data.keep);const rules=backupData.rules.filter(r=>r.id!==data.id);if(!data.id)delete data.id;rules.push(data);
  await saveBackupData(rules,backupData.schedules);$('#modal').close();return true;
 }
 if(kind==='schedule'){
  data.every=Number(data.every);data.enabled=data.enabled==='on';const jobs=backupData.schedules.filter(j=>j.id!==data.id);if(!data.id)delete data.id;jobs.push(data);
  await saveBackupData(backupData.rules,jobs);$('#modal').close();return true;
 }
 return false;
}

function popupDownloads(rows){
 return [...rows.filter(d=>['queued','downloading'].includes(d.status)),...rows.filter(d=>!['queued','downloading'].includes(d.status)).slice(0,3)];
}
function downloadsHistoryPage(data){
 const pages=Math.max(1,Math.ceil(data.total/data.page_size));
 return heading('Download history','What was downloaded, when, and where it was saved.')+`<div class="notice">History keeps up to 10,000 completed records, 16 MB of metadata or 90 days, whichever limit is reached first. Active downloads are kept. Cleanup removes history only, never downloaded files. Dismissing a popup entry does not remove it here.</div><section class="panel"><div class="panelhead"><h2>${data.total.toLocaleString()} retained downloads</h2><div class="pagination"><button class="button small" data-action="history-page" data-id="${data.page-1}" ${data.page===0?'disabled':''}>Previous</button><span>${data.page+1} / ${pages}</span><button class="button small" data-action="history-page" data-id="${data.page+1}" ${data.page+1>=pages?'disabled':''}>Next</button></div></div><div class="tablewrap"><table><thead><tr><th>Download</th><th>When</th><th>Server / destination</th><th>Status / size</th></tr></thead><tbody>${data.items.map(d=>`<tr><td><strong>${esc(d.name)}</strong>${d.source?`<small class="download-path">${esc(d.source)}</small>`:''}</td><td>${esc(date(d.finished||d.created))}</td><td>${esc(d.server_name||d.server_id||'Shared runtime')}<small class="download-path">${esc(d.installed_to||d.destination||'Destination not recorded by this older MMSM version')}</small></td><td>${esc(d.status)} · ${bytes(d.bytes)}${d.error?`<p class="orange">${esc(d.error)}</p>`:''}</td></tr>`).join('')}</tbody></table></div>${data.items.length?'':'<p>No retained download history.</p>'}</section>`;
}

async function copyErrorLogs(serverId){
 const report=await api('/servers/'+serverId+'/error-report');
 try {await navigator.clipboard.writeText(report.text);toast('Error logs copied');}
 catch {modal('Copy error logs','<p>Select and copy the text below (Ctrl+C / Cmd+C).</p><textarea id="copy-logs" class="editor" readonly>'+esc(report.text)+'</textarea>');const el=$('#copy-logs');el.focus();el.select();}
}
document.addEventListener('input',event=>{
 if(event.target.id==='properties-search'){
  const query=event.target.value.trim().toLowerCase();
  document.querySelectorAll('[data-form="properties"] .field').forEach(el=>{el.hidden=!el.textContent.toLowerCase().includes(query);});
 }
});

function wrapperUpdateText(s){if(!s||s.status==='unconfigured')return 'No release feed configured.';return s.error||({available:'MMSM '+s.latest+' is available.',current:'MMSM is up to date.',checking:'Checking…',installing:'Installing update…',failed:'Update failed.'}[s.status]||s.status)+(s.checked?' Last checked: '+date(s.checked):'');}

function waitForManager(attempt=0){setTimeout(async()=>{try{const state=await api('/wrapper-update/status');if(state.status!=='installing'){location.reload();return;}}catch{}if(attempt<60)waitForManager(attempt+1);else toast('Restart is taking longer than expected. Check the MMSM terminal, then reload.',true);},2000);}
