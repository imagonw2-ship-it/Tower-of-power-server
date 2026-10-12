// Exact damped progress: opening, closing and mid-motion reversals share velocity.
export function advancePackMotion(state,key,target,dt){
  const vk=key+'Velocity',w=target?5.8:7,x=(state[key]||0)-target,v=state[vk]||0,c=v+w*x,e=Math.exp(-w*Math.max(0,dt));
  state[key]=target+(x+c*dt)*e;state[vk]=(v-w*c*dt)*e;
  if(Math.abs(state[key]-target)<.0015&&Math.abs(state[vk])<.012){state[key]=target;state[vk]=0;}
  return state[key];
}
export const PACK_TRANSFER_SECONDS=1.45;
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
// traces the zipper, then reaches into a modest top opening for each transfer.
export function packHandPose(action,progress=1,held='none'){
  const rest=[.235,.365,.20],inside=[.025,.345,-.025],above=[.035,.62,-.025];
  const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*packEase(t));
  if(!action){
    const start=[-.14,.475,.035],end=[.14,.475,.035];
    const position=progress<.65?mix(rest,start,(progress-.36)/.29):progress<.9?mix(start,end,(progress-.65)/.25):mix(end,rest,(progress-.9)/.1);
    return{position,kind:progress>.97?held:'none',tilt:0,inside:false};
  }
  const t=Math.min(1,action.time/PACK_TRANSFER_SECONDS);let position,kind='none';
  if(t<.24){position=mix(rest,above,t/.24);kind=action.from;}
  else if(t<.44){position=mix(above,inside,(t-.24)/.20);kind=action.from;}
  else if(t<.56)position=inside;
  else if(t<.79){position=mix(inside,above,(t-.56)/.23);kind=action.to;}
  else{position=mix(above,rest,(t-.79)/.21);kind=action.to;}
  const reach=packEase(t/.3)*(1-packEase((t-.76)/.24));
  return{position,kind,tilt:-reach*1.3,inside:t>.40&&t<.60};
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
