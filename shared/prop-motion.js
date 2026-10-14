// Exact damped progress: opening, closing and mid-motion reversals share velocity.
export function advancePackMotion(state,key,target,dt){
  const vk=key+'Velocity',w=target?8.5:10,x=(state[key]||0)-target,v=state[vk]||0,c=v+w*x,e=Math.exp(-w*Math.max(0,dt));
  state[key]=target+(x+c*dt)*e;state[vk]=(v-w*c*dt)*e;
  if(Math.abs(state[key]-target)<.0015&&Math.abs(state[vk])<.012){state[key]=target;state[vk]=0;}
  return state[key];
}
export const PACK_TRANSFER_SECONDS=.78;
const packEase=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export function ownsPackTool(p,item){return item==='none'||item==='camera'&&p.inventory.camera!==false||item==='soda'&&p.inventory.sodas>0||['gun','flare','flashlight'].includes(item)&&!!p.inventory[item];}
export function beginPackTransfer(p,item){
  if(!p.alive||!p.inventoryOpen||!p.inventory.backpack||p.packAction||item===p.heldItem||!ownsPackTool(p,item))return false;
  p.packSerial=(p.packSerial||0)+1;p.packAction={serial:p.packSerial,from:p.heldItem,to:item,time:0};p.torch=false;p.gunReload=0;return true;
}
export function tickPackTransfer(p,dt){
  const a=p.packAction;if(!a)return;
  if(!p.alive||p.connected===false||!p.inventory.backpack){p.packAction=null;p.packCloseRequested=false;p.inventoryOpen=false;return;}
  a.time+=Math.max(0,dt);
  if(a.time>=PACK_TRANSFER_SECONDS){p.heldItem=ownsPackTool(p,a.to)?a.to:'none';p.packAction=null;if(p.packCloseRequested)p.inventoryOpen=false;p.packCloseRequested=false;}
}
// Shared local coordinates: the left hand stays on the carry handle. The right
// traces the zipper, then reaches into the open top for each transfer.
export function packHandPose(action,progress=1,held='none'){
  const rest=[.235,.365,.20],inside=[.025,.315,.015],above=[.060,.62,.020];
  const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*packEase(t));
  if(!action){
    const start=[-.14,.475,.035],end=[.14,.475,.035];
    const position=progress<.65?mix(rest,start,(progress-.36)/.29):progress<.9?mix(start,end,(progress-.65)/.25):mix(end,rest,(progress-.9)/.1);
    return{position,kind:progress>.97?held:'none',tilt:0,inside:false};
  }
  const t=Math.max(0,Math.min(1,action.time/PACK_TRANSFER_SECONDS));
  const knots=[0,.26,.47,.57,.79,1],points=[rest,above,inside,inside,above,rest];
  let seg=0;while(seg<knots.length-2&&t>knots[seg+1])seg++;
  const u=packEase((t-knots[seg])/(knots[seg+1]-knots[seg]));
  const position=points[seg].map((v,k)=>v+(points[seg+1][k]-v)*u);
  // A small side arc makes the wrist clear the zipper instead of cutting through it.
  position[0]+=.025*Math.sin(t*Math.PI*2)*Math.sin(t*Math.PI);
  const kind=t<.46?action.from:t>.56?action.to:'none';
  const reach=packEase(t/.30)*(1-packEase((t-.76)/.24));
  return{position,kind,tilt:-reach*.85,inside:t>.43&&t<.60};
}
// Turbines keep their resting heading, then accelerate into a limited yaw turn.
export function turnWakingTurbine(state,body,dt){
  const desired=Math.atan2(state.lastKnown[0]-body.x,state.lastKnown[1]-body.z);
  const delta=Math.atan2(Math.sin(desired-state.heading),Math.cos(desired-state.heading));
  const target=Math.max(-.52,Math.min(.52,delta*1.5)),blend=1-Math.exp(-3*dt);
  state.wakeYawSpeed=(state.wakeYawSpeed||0)+(target-(state.wakeYawSpeed||0))*blend;
  const step=state.wakeYawSpeed*dt;
  state.heading+=Math.abs(step)>Math.abs(delta)?delta:step;
}
