// An occasional coarse search hint. This never gives an attack target or velocity.
export function noteAudibleContact(state){state.silence=0;state.searchOnly=false;state.searchHint=null;}
export function silentSearch(state,body,players,dt){
  state.silence=(state.silence||0)+dt;
  if(state.lureId||state.silence<60)return false;
  const candidates=players.filter(p=>p.alive&&p.connected!==false);
  if(!candidates.length)return false;
  const p=candidates.reduce((a,b)=>Math.hypot(a.x-body.x,a.z-body.z)<=Math.hypot(b.x-body.x,b.z-body.z)?a:b);
  state.silence=0;state.hintSerial=(state.hintSerial||0)+1;
  const a=state.hintSerial*2.399+(body.x*.031+body.z*.013),r=28;
  const hint=[Math.round(p.x/64)*64+Math.sin(a)*r,Math.round(p.z/64)*64+Math.cos(a)*r];
  state.searchHint=hint;state.searchOnly=true;state.targetId=null;state.heardVelocity=[0,0];state.attack=null;state.navAge=0;
  state.lastKnown=hint.slice();state.memoryAge=99;
  return true;
}
export function pylonCountForPlayers(count,rules={}){
  return Math.max(1,Math.min(rules.maximum||4,Math.ceil(Math.max(1,count)/(rules.playersPerPylon||2))));
}
export const EXTRA_PYLON_SPAWNS=[{x:-68,z:-402},{x:-302,z:-409},{x:-77,z:-568}];
