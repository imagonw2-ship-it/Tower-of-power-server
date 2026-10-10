// Exact damped progress: opening, closing and mid-motion reversals share velocity.
export function advancePackMotion(state,key,target,dt){
  const vk=key+'Velocity',w=target?5.8:7,x=(state[key]||0)-target,v=state[vk]||0,c=v+w*x,e=Math.exp(-w*Math.max(0,dt));
  state[key]=target+(x+c*dt)*e;state[vk]=(v-w*c*dt)*e;
  if(Math.abs(state[key]-target)<.0015&&Math.abs(state[vk])<.012){state[key]=target;state[vk]=0;}
  return state[key];
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
