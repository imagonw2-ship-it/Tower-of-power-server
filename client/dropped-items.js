let localDroppedItems=[],localDropSerial=0,pendingDrop=null;
function dropEquipment(){
  const kind=equippedTool;
  if(!['playing','inventory'].includes(game.mode)||kind==='none'||!canEquip(kind)||game.drinking>0||pendingDrop)return;
  if(net.active){if(!net.connected)return;pendingDrop={kind,at:performance.now()};net.action('drop',{item:kind});refreshFieldKit();return;}
  const item={id:'drop-'+(++localDropSerial),kind,biome:biomeOf(player),...droppedItemPose(player,kind,time,shedFloor,shedBlocksSight,inForest()?null:shed,terrainHeight)};
  if(kind==='gun'){item.ammo=game.ammo;item.reserve=game.reserve;game.hasGun=false;game.ammo=game.reserve=game.gunReload=0;}else if(kind==='flare'){item.ammo=game.flares;game.flares=0;game.hasFlare=false;}else if(kind==='flashlight'){game.hasFlashlight=false;kitPreviousFlashlight=false;}else if(kind==='camera')game.hasCamera=false;else game.sodas--;
  localDroppedItems.push(item);equippedTool='none';game.torchOn=false;advanceToolMotion(equipmentMotion,'none',0);sound.noise(.08,.06,700);refreshFieldKit();
}
function takeLocalDroppedItem(item){
  if(!canTakeEquipment(localInventory(),item.kind))return;
  const i=localDroppedItems.findIndex(x=>x.id===item.id);if(i<0)return;localDroppedItems.splice(i,1);
  const inv=localInventory();if(!collectEquipment(inv,item))return;assignLocalInventory(inv);
  if(item.kind==='flashlight')game.torchOn=true;
  if(item.kind!=='backpack')equipTool(item.kind);
  game.notice=item.kind==='backpack'?'BACKPACK EQUIPPED · 12 SLOTS':'ITEM COLLECTED';game.noticeTime=2;sound.noise(.08,.12,1400);refreshFieldKit();
}
function appendWorldItem(item,clock){
  if(!sameBiome(item,player))return;
  const kind=item.kind,age=Math.max(0,clock-(item.dropAt||0)),y=item.dropped?Math.max(item.y,(item.dropFromY??item.y)-4.9*age*age):item.y;
  const rotation=kind==='flashlight'||kind==='flare'||kind==='gun'||(kind==='soda'&&item.dropped)?rotateZ(Math.PI/2):kind==='camera'?rotateX(Math.PI/2):identity();
  let model=multiply(multiply(transform(item.x,y,item.z),rotateY(item.yaw||0)),rotation);
  if(item.dropped&&item.normal){
    const axes=[[1,0,0],[0,1,0],[0,0,1]].map(p=>itemRestPoint(p,kind,item.yaw||0,item.normal));
    model=new Float32Array([...axes[0],0,...axes[1],0,...axes[2],0,item.x,y,item.z,1]);
  }
  if(kind==='gun'){appendGun(model,{ammo:item.ammo??17,shadow:true});return;}if(kind==='backpack'){appendBackpackModel(model,0,true);return;}
  objectDraws.push({mesh:kind==='flashlight'?flashlightMesh:kind==='flare'?flareGunMesh:kind==='camera'?cameraItemMesh:sodaMesh,model,material:5,assetKind:kind==='flashlight'?1:kind==='flare'?7:kind==='camera'?6:2,texture:kind==='camera'?cameraItemTexture:kind==='flare'?flareGunTexture:undefined});
}

function summonLocalItem(kind){
  if(!ITEM_KINDS.includes(kind)||localDroppedItems.length>=128)return false;
  localDroppedItems.push({id:'summoned-'+(++localDropSerial),kind,biome:biomeOf(player),...droppedItemPose(player,kind,time,shedFloor,shedBlocksSight,null)});return true;
}
