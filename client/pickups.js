// One contextual prompt is anchored to the item under the player's aim. It uses
// the existing reach/sight rules and sends that item's ID to the authoritative server.
const pickupPrompt=document.getElementById('touchPickup');
let pickupPromptTarget=null;
function pickupCandidates(){
  const items=net.active?net.items.filter(i=>sameBiome(i,player)&&!i.holder&&!i.consumed&&!(i.kind==='camera'&&game.hasCamera!==false)&&!(i.kind==='flashlight'&&game.hasFlashlight)&&!(i.kind==='flare'&&game.hasFlare)&&!(i.kind==='gun'&&game.hasGun)&&!(i.kind==='backpack'&&game.hasBackpack)).map(i=>({...i,p:[i.x,i.y+(i.kind==='soda'?.1:0),i.z]})):[];
  if(!net.active){
    if(!inForest()&&!game.flashlightTaken&&!game.hasFlashlight)items.push({id:'local-flashlight',kind:'flashlight',p:flashlightPosition()});
    if(!inForest()&&!game.flareTaken)items.push({id:'local-flare',kind:'flare',p:flarePosition()});
    for(const i of localDroppedItems)if(sameBiome(i,player)&&!i.holder&&!i.consumed&&!((i.kind==='camera'&&game.hasCamera!==false)||(i.kind==='flashlight'&&game.hasFlashlight)||(i.kind==='flare'&&game.hasFlare)||(i.kind==='gun'&&game.hasGun)||(i.kind==='backpack'&&game.hasBackpack)))items.push({...i,p:[i.x,i.y,i.z]});
    if(!inForest()&&!game.sodaTaken)items.push({id:'local-soda',kind:'soda',p:sodaPosition().map((v,i)=>v+(i===1?.1:0))});
  }
  const eye=[player.x,player.y,player.z];
  return items.filter(item=>{
    const delta=item.p.map((v,i)=>v-eye[i]),d=Math.hypot(...delta),f=dot(norm(delta),Array.from(forward));
    item.score=d*.015+(1-f)*12;
    return d<2.35&&f>.88&&!shedBlocksSight(eye,item.p);
  }).sort((a,b)=>a.score-b.score);
}
function projectPickup(p){
  const m=viewProjection,w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
  if(w<=.02)return null;
  const uv=[(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w*.5+.5,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w*.5+.5];
  // Reverse the lens warp for the HTML overlay; a broad tap area absorbs tape jitter.
  const q=uv.map(v=>v-.5);let x=q[0],y=q[1];
  for(let i=0;i<4;i++){const f=1+(x*x+y*y)*cameraLensStrength();x=q[0]/f;y=q[1]/f;}
  return [(.5+x)*innerWidth,(.5-y)*innerHeight];
}
function updatePickupPrompt(){
  const item=game.mode==='playing'&&locked&&(!net.active||net.connected)?nearestItem():null;
  const screen=item?projectPickup(item.p):null;
  if(!item||!screen||screen[0]<48||screen[0]>innerWidth-48||screen[1]<58||screen[1]>innerHeight-24){pickupPrompt.hidden=true;pickupPromptTarget=null;return;}
  pickupPrompt.hidden=false;pickupPrompt.style.left=screen[0].toFixed(1)+'px';pickupPrompt.style.top=(screen[1]-26).toFixed(1)+'px';
  if(pickupPromptTarget!==item.id){
    pickupPromptTarget=item.id;
    document.getElementById('pickupName').textContent=item.kind==='gun'?'GLOCK 17':item.kind==='backpack'?'BACKPACK · +6 SLOTS':item.kind==='flashlight'?'FLASHLIGHT':item.kind==='flare'?'FLARE GUN':item.kind==='camera'?'CAMERA':'SODA';
    pickupPrompt.setAttribute('aria-label','Pick up '+item.kind);pickupPrompt.dataset.itemId=item.id;
  }
}
pickupPrompt.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(pickupPromptTarget){sound.start();interact(pickupPromptTarget);updatePickupPrompt();}});
