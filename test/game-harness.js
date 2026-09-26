// Executes the full shipped script with a DOM and a recording GL adapter.
// This catches integration/geometry faults; it is not a GPU rendering test.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
export function launch(touch=true, graphics={}){
  const {document,window:domWindow}=parseHTML(html),errors=[],uploads=[],shaders=[];
  const constants=new Map();let value=1;
  const handlers={
    getShaderParameter:()=>true,getProgramParameter:(_,p)=>p===gl.ACTIVE_UNIFORMS?0:true,
    getExtension:()=>null,checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,
    getParameter:()=>4096,shaderSource:(_,s)=>shaders.push(s),
    bufferData:(_,data)=>{if(ArrayBuffer.isView(data)){assert.ok(data.every(Number.isFinite));uploads.push(data.length);}},
    bufferSubData:(_,__,data)=>assert.ok(data.every(Number.isFinite)),
  };
  Object.assign(handlers,graphics);
  const gl=new Proxy(handlers,{get(o,k){if(k in o)return o[k];if(/^[A-Z_0-9]+$/.test(k)){if(!constants.has(k))constants.set(k,value++);return constants.get(k);}if(k.startsWith('create'))return()=>({});return()=>{};}});
  const canvas=document.getElementById('field');canvas.getContext=()=>gl;
  canvas.requestPointerLock=async()=>{document.pointerLockElement=canvas;document.dispatchEvent(new domWindow.Event('pointerlockchange'));};
  document.exitPointerLock=()=>{document.pointerLockElement=null;document.dispatchEvent(new domWindow.Event('pointerlockchange'));};
  document.getElementById('photo').getContext=()=>null;
  for(const e of document.querySelectorAll('select'))Object.defineProperty(e,'value',{writable:true,value:e.querySelector('option')?.getAttribute('value')||''});
  for(const e of document.querySelectorAll('div,button,canvas'))e.setPointerCapture=()=>{};
  const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
  const context=vm.createContext({document,navigator:{maxTouchPoints:touch?2:0,hardwareConcurrency:4},
    innerWidth:844,innerHeight:390,devicePixelRatio:1,performance,URL,AbortController,Event:domWindow.Event,
    location:new URL('https://appassets.androidplatform.net'),localStorage:storage(),sessionStorage:storage(),
    console:{log(){},warn(){},error:e=>errors.push(e)},setInterval(){},setTimeout(){},clearTimeout(){},
    requestAnimationFrame(){},addEventListener:(...a)=>domWindow.addEventListener(...a),
    dispatchEvent:(...a)=>domWindow.dispatchEvent(...a),matchMedia:q=>({matches:touch&&q.includes('pointer:coarse')}),
    Image:class{},atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')});
  context.window=context;
  const run=s=>vm.runInContext(s,context);
  run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(errors,[]);assert.equal(run('running'),true);assert.ok(uploads.length>20);assert.equal(shaders.length,12);
  return{document,context,run,errors,shaders};
}