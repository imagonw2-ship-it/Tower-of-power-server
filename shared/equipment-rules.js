// One authority for local play, multiplayer and the inventory display.
export const ITEM_KINDS=['camera','flashlight','soda','flare','gun','backpack'];
export const GUN_MAGAZINE=17,GUN_RESERVE=34,GUN_RELOAD_SECONDS=1.75,GUN_SHOT_SECONDS=.19,GUN_RANGE=65;
export function inventoryCapacity(i){return i.backpack?12:6;}
export function inventoryUsed(i){return Number(i.camera!==false)+Number(!!i.flashlight)+Number(!!i.flare)+Number(!!i.gun)+Math.max(0,i.sodas||0);}
export function canTakeEquipment(i,kind){
  if(!ITEM_KINDS.includes(kind))return false;
  if(kind==='backpack')return !i.backpack;
  if(kind==='camera'?i.camera!==false:kind!=='soda'&&i[kind])return false;
  return inventoryUsed(i)<inventoryCapacity(i);
}
export function collectEquipment(i,item){
  if(!canTakeEquipment(i,item.kind))return false;
  if(item.kind==='soda')i.sodas=(i.sodas||0)+1;
  else i[item.kind]=true;
  if(item.kind==='flare')i.flares=item.ammo??3;
  if(item.kind==='gun'){i.ammo=Math.max(0,Math.min(GUN_MAGAZINE,item.ammo??GUN_MAGAZINE));i.reserve=Math.max(0,Math.min(99,item.reserve??GUN_RESERVE));}
  return true;
}
export function beginGunReload(p){
  if(!p.alive||p.heldItem!=='gun'||!p.inventory.gun||p.inventory.ammo>=GUN_MAGAZINE||p.inventory.reserve<=0||p.gunReload>0||p.tabletOpen||p.inventoryOpen||p.frozen>0)return false;
  p.gunReload=GUN_RELOAD_SECONDS;return true;
}
export function tickGun(p,dt){
  p.gunCooldown=Math.max(0,(p.gunCooldown||0)-dt);p.gunFlash=Math.max(0,(p.gunFlash||0)-dt);
  if(p.gunReload>0){
    if(!p.alive||p.heldItem!=='gun'||p.tabletOpen||p.inventoryOpen||!p.inventory.gun){p.gunReload=0;return;}
    p.gunReload=Math.max(0,p.gunReload-dt);
    if(p.gunReload===0){const count=Math.min(GUN_MAGAZINE-p.inventory.ammo,p.inventory.reserve);p.inventory.ammo+=count;p.inventory.reserve-=count;}
  }
}
