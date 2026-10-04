// A room owns its seed. These small, deterministic rules also run offline.
export function layoutRandom(seed) {
  let a=seed>>>0;
  return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}
export function makeLayout(seed=0) {
  seed=Number.isSafeInteger(seed)?seed>>>0:0;
  const variant=seed%3,random=layoutRandom(seed+901);
  return {version:1,seed,variant,name:['OPEN FIELD','CROSSROADS','TWIN SENTINELS'][variant],
    crossroad:variant===1,
    turbines:[{x:95,z:-250,style:Math.floor(random()*3)},...(variant===2?[{x:325,z:-325,style:2}]:[])],
    pylonStyle:Math.floor(random()*3),forest:{x:770,z:-810,radius:225}};
}
export function crossingOffset(x,z,layout) {
  return layout?.crossroad?((x-108)*.70710678-(z+170)*.70710678):1e6;
}
export function fieldRoadOffset(x,z,original,layout) {
  const other=crossingOffset(x,z,layout);return Math.abs(other)<Math.abs(original)?other:original;
}
const forestCache=new Map();
export function forestForLayout(layout) {
  const key=layout?.seed??0;
  if(forestCache.has(key))return forestCache.get(key);
  const l=layout||makeLayout(0),r=layoutRandom(key^0x72f415),trees=[],cells=new Map(),f=l.forest;
  for(let gz=-18;gz<=18;gz++)for(let gx=-18;gx<=18;gx++){
    const dx=gx*12+(r()-.5)*8,dz=gz*12+(r()-.5)*8;
    if(Math.hypot(dx,dz)>f.radius-8||Math.abs(dx+Math.sin(dz*.018)*18)<5)continue;
    const tree={x:f.x+dx,z:f.z+dz,height:12+r()*11,yaw:r()*Math.PI*2,kind:Math.floor(r()*3),shade:.8+r()*.3};
    tree.radius=.25+tree.height*.019;trees.push(tree);
    const cell=Math.floor(tree.x/16)+','+Math.floor(tree.z/16);
    if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(tree);
  }
  const result={trees,cells};if(forestCache.size>=64)forestCache.delete(forestCache.keys().next().value);forestCache.set(key,result);return result;
}
export function collideForest(p,layout) {
  const f=layout?.forest;if(!f||Math.hypot(p.x-f.x,p.z-f.z)>f.radius+3)return;
  const cells=forestForLayout(layout).cells,gx=Math.floor(p.x/16),gz=Math.floor(p.z/16);
  for(let iz=-1;iz<=1;iz++)for(let ix=-1;ix<=1;ix++)for(const t of cells.get((gx+ix)+','+(gz+iz))||[]){
    const dx=p.x-t.x,dz=p.z-t.z,d=Math.hypot(dx,dz),radius=t.radius+.29;
    if(d<radius){p.x=t.x+(d>.001?dx/d:1)*radius;p.z=t.z+(d>.001?dz/d:0)*radius;}
  }
}
