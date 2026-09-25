import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const transport = readFileSync(new URL('../client/networking.js', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../client/multiplayer.js', import.meta.url), 'utf8').split('function networkInput()')[0];
const markup = readFileSync(new URL('../client/multiplayer.html', import.meta.url), 'utf8');
const live = 'https://tower-of-power-server-live-production.up.railway.app';
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k)};
}
function environment(origin='https://appassets.androidplatform.net', stored='', fetcher=async()=>({ok:true,json:async()=>({protocol:1})})) {
  const localStorage=storage({'top-server':stored}), sessionStorage=storage();
  const context=vm.createContext({URL, AbortController, setTimeout, clearTimeout, performance,
    TypeError, SyntaxError, fetch:fetcher, location:new URL(origin), localStorage, sessionStorage});
  vm.runInContext(transport+'\nthis.Network=TowerNetwork;',context);
  return {context, localStorage, sessionStorage, Network:context.Network};
}
function uiEnvironment(fetcher) {
  const e=environment(undefined,undefined,fetcher), elements=new Map();
  function element(id) {
    const x={id,value:'',textContent:'',hidden:false,disabled:false,dataset:{},events:{},
      addEventListener(type,fn){(this.events[type]??=[]).push(fn)},
      setAttribute(k,v){this[k]=v},appendChild(){},
      querySelectorAll(){return [...markup.matchAll(/id="([^"]+)"[^>]*data-net-action/g)].map(m=>elements.get(m[1]))},
      async trigger(type){for(const f of this.events[type]??[])await f({preventDefault(){}})},
      click(){if(!this.disabled)return this.trigger('click')}};
    elements.set(id,x); return x;
  }
  for(const m of markup.matchAll(/id="([^"]+)"/g))element(m[1]);
  element('multiplayerOpen');
  Object.assign(e.context, {document:{getElementById:id=>elements.get(id),createElement:()=>element('new'),activeElement:null},
    ui:{pausePanel:element('pausePanel'),menu:element('menu')},game:{mode:'menu'},sound:{start(){}},canvas:{},
    syncUI(){},mainMenu(){},setMode(){}});
  vm.runInContext(adapter+'\nthis.client=net;this.refresh=refreshNetworkUI;this.closePanel=closeMultiplayer;',e.context);
  return {...e,elements,client:e.context.client};
}
test('APK and standalone HTML start with the live server; hosted builds use their own origin',()=>{
  for(const origin of ['https://appassets.androidplatform.net','file:///game.html'])
    assert.equal(new (environment(origin).Network)().url,live);
  assert.equal(new (environment('https://my-game.test').Network)().url,'https://my-game.test');
  assert.equal(new (environment('http://localhost:8080').Network)().url,'http://localhost:8080');
});
test('valid custom servers persist; stale placeholders and malformed saved addresses recover',()=>{
  assert.equal(new (environment(undefined,'https://custom.test/').Network)().url,'https://custom.test');
  for(const saved of ['https://your-server.example','https://appassets.androidplatform.net','not a url'])
    assert.equal(new (environment(undefined,saved).Network)().url,live);
});
test('same server does not log out or disconnect an existing room',()=>{
  const {Network}=environment(),n=new Network();
  n.token='test-token';n.player={id:'test'};n.code='K7P4Q';
  n.setServer(live+'/');
  assert.equal(n.token,'test-token');assert.equal(n.code,'K7P4Q');
  assert.throws(()=>n.setServer('https://another.test'),/Leave the world/);
});
test('address normalization preserves HTTPS and rejects embedded credentials',()=>{
  const {Network}=environment();
  assert.equal(Network.normalizeServer('  example.test/  '),'https://example.test');
  for(const address of ['http://example.test','https://name:password@example.test','https://example.test?token=x','javascript:alert(1)'])
    assert.throws(()=>Network.normalizeServer(address));
});
test('guest works without entering an address or pressing a connect button',async()=>{
  let called;
  const e=uiEnvironment(async(url)=>{called=url;return {ok:true,json:async()=>({token:'test-token',expires:Date.now()+60000,player:{id:'guest-id',username:'Guest',guest:true}})}});
  await e.elements.get('accountGuest').click();
  assert.equal(called,live+'/api/guest');assert.equal(e.client.player.id,'guest-id');
  assert.equal(e.elements.get('accountForm').hidden,true);
  assert.equal(e.elements.get('worldMenu').hidden,false);
});
test('typed address is retained after refresh and applied by guest without a separate save',async()=>{
  let called;
  const e=uiEnvironment(async(url)=>{called=url;return {ok:true,json:async()=>({token:'t',player:{id:'p',username:'Guest'}})}});
  e.elements.get('serverAddress').value=' custom.test/ ';
  e.context.refresh();
  assert.equal(e.elements.get('serverAddress').value,' custom.test/ ');
  await e.elements.get('accountGuest').click();
  assert.equal(called,'https://custom.test/api/guest');
  assert.equal(e.elements.get('serverAddress').value,'https://custom.test');
});
test('offline server recovers buttons and allows returning to singleplayer',async()=>{
  const e=uiEnvironment(async()=>{throw new TypeError('Network unavailable')});
  await e.elements.get('accountGuest').click();
  assert.match(e.elements.get('netMessage').textContent,/Singleplayer is still available/);
  assert.equal(e.elements.get('accountGuest').disabled,false);
  await e.elements.get('multiplayerBack').click();
  assert.equal(e.elements.get('multiplayerPanel').hidden,true);
  assert.equal(e.client.active,false);
});
test('duplicate guest clicks make only one request while pending',async()=>{
  let release,calls=0;
  const e=uiEnvironment(async()=>{calls++;await new Promise(r=>release=r);return {ok:true,json:async()=>({token:'t',player:{id:'p'}})}});
  const first=e.elements.get('accountGuest').click();
  await e.elements.get('accountGuest').click();
  release();await first;
  assert.equal(calls,1);
});
test('server check rejects a non-game endpoint and accepts protocol 1',async()=>{
  const good=environment(),bad=environment(undefined,undefined,async()=>({ok:true,json:async()=>({})}));
  const a=new good.Network(),b=new bad.Network();await a.checkServer();
  assert.equal(a.status,'SERVER READY');
  await assert.rejects(b.checkServer(),/not a compatible/);
  assert.equal(b.status,'SERVER OFFLINE');
});
