// Versioned, deterministic world generation. The server owns the seed; every
// client builds the same roads, utility corridor and forest from these rules.
export const LAYOUT_VERSION=2;
export function layoutRandom(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function seedFromText(value){
  const text=String(value??'').trim().slice(0,40);if(!text)return null;
  if(/^\d{1,10}$/.test(text)&&Number(text)<=0xffffffff)return Number(text)>>>0;
  let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return hash>>>0;
}
export function segmentDistanceSquared(x,z,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return(x-a.x-dx*t)**2+(z-a.z-dz*t)**2;
}
export function nearestRoad(x,z,layout){
  let best={distance:1e6,side:1e6,along:0,index:-1};
  for(let i=0;i<(layout?.roads.length||0);i++){
    const s=layout.roads[i],dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,length=Math.hypot(dx,dz),along=((x-s.a.x)*dx+(z-s.a.z)*dz)/length,t=Math.max(0,Math.min(length,along)),distance=Math.hypot(x-s.a.x-dx*t/length,z-s.a.z-dz*t/length);
    if(distance<best.distance)best={distance,side:((x-s.a.x)*dz-(z-s.a.z)*dx)/length,along,index:i};
  }
  return best;
}
export function fieldRoadOffset(x,z,original,layout){return layout?.roads?nearestRoad(x,z,layout).distance:original;}
export function siteClearing(x,z,layout){return(layout?.sites||[]).some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+1.5);}
export function makeLayout(seed=0){
  seed=Number.isSafeInteger(seed)?seed>>>0:seedFromText(seed)??0;
  const r=layoutRandom(seed^0x125f71),nodes=[],edges=[],roads=[],turbines=[],pylons=[],powerLinks=[];
  const add=(x,z,kind='junction')=>{const n={id:nodes.length,x:Math.round(x*100)/100,z:Math.round(z*100)/100,kind};nodes.push(n);return n;};
  const link=(a,b,kind='road')=>{if(a.id===b.id||edges.some(e=>(e.a===a.id&&e.b===b.id)||(e.a===b.id&&e.b===a.id)))return;edges.push({a:a.id,b:b.id,kind});roads.push({a:{x:a.x,z:a.z},b:{x:b.x,z:b.z},kind});};
  const range=(a,b)=>a+(b-a)*r(),pick=a=>a[Math.floor(r()*a.length)];
  // A short safe approach preserves the shed and all starter-item placement.
  // Beyond it, junction locations, turns, branches, loops and dead ends vary.
  const root=add(119,-42,'spawn'),south=add(119,range(90,170),'end');link(root,south);
  const trunk=[root,add(119,range(-135,-108))];link(root,trunk[1]);
  const length=5+Math.floor(r()*4);
  for(let i=2;i<length;i++){const last=trunk.at(-1),n=add(last.x+range(-110,110),last.z-range(125,210));link(last,n);trunk.push(n);}
  const branches=[];
  for(let i=1;i<trunk.length-1;i++){
    const a=trunk[i],before=trunk[i-1],after=trunk[i+1],dx=after.x-before.x,dz=after.z-before.z,l=Math.hypot(dx,dz);
    for(const side of [-1,1])if(i===1||r()<.70){
      const distance=range(130,245),b=add(a.x+side*(-dz/l)*distance+range(-40,40),a.z+side*(dx/l)*distance+range(-35,35));link(a,b);branches.push({node:b,side,row:i});
      if(r()<.55){const end=add(b.x+side*range(90,190),b.z+range(-95,95),'end');link(b,end);branches.push({node:end,side,row:i});}
    }
  }
  // Optional cross-links produce traversable loops rather than a fixed grid.
  for(const side of [-1,1]){
    const row=branches.filter(b=>b.side===side);for(let i=1;i<row.length;i++)if(row[i].row!==row[i-1].row&&r()<.72)link(row[i-1].node,row[i].node);
  }
  const candidates=[...branches.map(b=>b.node),...trunk.slice(2)];
  const turbineCount=1+Math.floor(r()*4);
  for(let i=0;i<turbineCount;i++){
    let site,parent;
    for(let attempt=0;attempt<100;attempt++){
      parent=pick(candidates);const a=range(0,Math.PI*2),d=range(55,120),x=parent.x+Math.cos(a)*d,z=parent.z+Math.sin(a)*d;
      if(Math.hypot(x-128,z+34)<225||turbines.some(t=>Math.hypot(x-t.x,z-t.z)<150)||nearestRoad(x,z,{roads}).distance<28)continue;
      site={id:'turbine-'+i,x,z,style:Math.floor(r()*3)};break;
    }
    if(!site){parent=trunk.at(-1);site={id:'turbine-'+i,x:parent.x+160+i*175,z:parent.z-110,style:i%3};}
    const center=add(site.x,site.z,'turbine');Object.assign(site,{x:center.x,z:center.z,nodeId:center.id});
    link(parent,center,'access');turbines.push(site);
  }
  // Utility towers form one connected line with a possible fork. Their sockets
  // and access roads both derive from these exact same anchors.
  const utilitySide=r()<.5?-1:1,utilityParent=trunk[1+Math.floor(r()*Math.min(3,trunk.length-2))];
  let lineAngle=range(-.32,.32),x=utilityParent.x+utilitySide*range(380,500),z=utilityParent.z-range(75,155);
  const count=6+Math.floor(r()*4);
  for(let i=0;i<count;i++){
    if(i){lineAngle+=range(-.14,.14);const d=range(165,220);x+=Math.sin(lineAngle)*d;z-=Math.cos(lineAngle)*d;}
    // Keep the enormous legs clear of turbine bases and each other.
    for(const t of turbines)if(Math.hypot(x-t.x,z-t.z)<145)x=t.x+utilitySide*165;
    pylons.push({id:'pylon-'+i,x:Math.round(x*100)/100,z:Math.round(z*100)/100,scale:1,style:Math.floor(r()*3),heading:0});
    if(i)powerLinks.push({a:i-1,b:i});
  }
  if(r()<.65){
    const parent=2+Math.floor(r()*(count-4)),start=pylons[parent];
    for(let attempt=0;attempt<12;attempt++){
      const angle=utilitySide*range(.8,1.35),distance=range(175,200),fork=[];
      for(let i=1;i<=2;i++)fork.push({id:'pylon-'+(pylons.length+i-1),x:Math.round((start.x+Math.sin(angle)*distance*i)*100)/100,z:Math.round((start.z-Math.cos(angle)*distance*i)*100)/100,scale:1,style:Math.floor(r()*3),heading:0});
      if(fork.some(p=>[...pylons,...turbines].some(t=>Math.hypot(p.x-t.x,p.z-t.z)<145)))continue;
      powerLinks.push({a:parent,b:pylons.length},{a:pylons.length,b:pylons.length+1});pylons.push(...fork);break;
    }
  }
  for(let i=0;i<pylons.length;i++){
    const previous=powerLinks.find(e=>e.b===i),next=powerLinks.find(e=>e.a===i),a=previous?pylons[previous.a]:pylons[i],b=next?pylons[next.b]:pylons[i];
    pylons[i].heading=Math.atan2(-(b.z-a.z),b.x-a.x);
  }
  const utilityRoads=pylons.map((p,i)=>{
    const nx=Math.sin(p.heading),nz=Math.cos(p.heading),a=add(p.x+nx*47*utilitySide,p.z+nz*47*utilitySide),b=add(p.x,p.z,'pylon');
    link(a,b,'access');p.nodeId=b.id;p.accessNode=a.id;return a;
  });
  link(utilityParent,utilityRoads[0],'access');for(const e of powerLinks)link(utilityRoads[e.a],utilityRoads[e.b],'service');
  // Forest location and size vary too. Its edge always starts beyond the spawn
  // draw range and away from tower bases; the road continues to its entrance.
  const forestSide=-utilitySide;let forest;
  for(let attempt=0;attempt<30;attempt++){
    const radius=range(185,250),f={x:128+forestSide*range(650,1050),z:range(-1050,-550),radius};
    if([...turbines,...pylons].every(p=>Math.hypot(p.x-f.x,p.z-f.z)>radius+100)){forest=f;break;}
  }
  forest??={x:128+forestSide*1250,z:-850,radius:205};
  forest.x=Math.round(forest.x);forest.z=Math.round(forest.z);forest.radius=Math.round(forest.radius);
  const nearest=nodes.reduce((a,b)=>Math.hypot(a.x-forest.x,a.z-forest.z)<Math.hypot(b.x-forest.x,b.z-forest.z)?a:b);
  const dx=nearest.x-forest.x,dz=nearest.z-forest.z,d=Math.hypot(dx,dz),entry=add(forest.x+dx/d*(forest.radius-30),forest.z+dz/d*(forest.radius-30),'forest');
  link(nearest,entry,'forest');forest.entrance={x:entry.x,z:entry.z};forest.nodeId=entry.id;
  const sites=[...turbines.map(t=>({...t,radius:11.4,kind:0})),...pylons.map((p,i)=>({...p,radius:i===0?46.5:29,kind:1}))];
  const bounds=[Math.min(...nodes.map(n=>n.x),forest.x-forest.radius)-250,Math.min(...nodes.map(n=>n.z),forest.z-forest.radius)-250,Math.max(...nodes.map(n=>n.x),forest.x+forest.radius)+250,Math.max(...nodes.map(n=>n.z),forest.z+forest.radius)+250];
  return{version:LAYOUT_VERSION,bounds,seed,name:'FIELD '+seed,nodes,edges,roads,turbines,pylons,powerLinks,power:{...pylons[0],name:'POWER CORRIDOR'},pylonStyle:pylons[0].style,forest,sites};
}
// Compact spatial lookup for GPU road/clearing queries. Eight candidates per
// cell keep pixel/grass cost independent of the total road count. Exact segment
// distance is still evaluated in the shader: this is not a blurry road bitmap.
export function makeLayoutLookup(layout,size=192){
  const points=layout.nodes,minX=Math.min(...points.map(p=>p.x))-80,minZ=Math.min(...points.map(p=>p.z))-80,maxX=Math.max(...points.map(p=>p.x))+80,maxZ=Math.max(...points.map(p=>p.z))+80;
  const bounds=[minX,minZ,maxX-minX,maxZ-minZ],pixels=new Uint8Array(size*size*12),data=new Float32Array(256*2*4);
  layout.roads.forEach((s,i)=>data.set([s.a.x,s.a.z,s.b.x,s.b.z],i*4));
  layout.sites.forEach((s,i)=>data.set([s.x,s.z,s.radius,s.kind],(256+i)*4));
  const ids=new Int32Array(8),distances=new Float64Array(8);
  const closest=(x,z,items,n,metric)=>{ids.fill(-1);distances.fill(Infinity);for(let i=0;i<items.length;i++){const d=metric(items[i],x,z);if(d>=distances[n-1])continue;let at=n-1;while(at>0&&d<distances[at-1]){ids[at]=ids[at-1];distances[at]=distances[at-1];at--;}ids[at]=i;distances[at]=d;}};
  for(let iz=0;iz<size;iz++)for(let ix=0;ix<size;ix++){
    const x=minX+(ix+.5)/size*bounds[2],z=minZ+(iz+.5)/size*bounds[3],offset=(iz*size+ix)*4;
    closest(x,z,layout.roads,8,(s,x,z)=>segmentDistanceSquared(x,z,s.a,s.b));
    for(let j=0;j<8;j++)pixels[offset+(j%4)+(j>=4?size*size*4:0)]=ids[j]+1;
    closest(x,z,layout.sites,4,(s,x,z)=>(x-s.x)**2+(z-s.z)**2);
    for(let j=0;j<4;j++)pixels[offset+size*size*8+j]=ids[j]+1;
  }
  return{size,bounds,pixels,data};
}
const forestCache=new Map();
export function forestForLayout(layout){
  const l=layout||makeLayout(0),key=l.seed;if(forestCache.has(key))return forestCache.get(key);
  const r=layoutRandom(key^0x72f415),trees=[],cells=new Map(),f=l.forest,extent=Math.ceil(f.radius/12);
  for(let gz=-extent;gz<=extent;gz++)for(let gx=-extent;gx<=extent;gx++){
    const dx=gx*12+(r()-.5)*8,dz=gz*12+(r()-.5)*8,x=f.x+dx,z=f.z+dz;
    if(Math.hypot(dx,dz)>f.radius-8||Math.abs(dx+Math.sin(dz*.018)*18)<5||nearestRoad(x,z,l).distance<7)continue;
    const tree={x,z,height:12+r()*11,yaw:r()*Math.PI*2,kind:Math.floor(r()*3),shade:.8+r()*.3};tree.radius=.25+tree.height*.019;trees.push(tree);
    const cell=Math.floor(x/16)+','+Math.floor(z/16);if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(tree);
  }
  const result={trees,cells};if(forestCache.size>=64)forestCache.delete(forestCache.keys().next().value);forestCache.set(key,result);return result;
}
export function collideForest(p,layout){
  const f=layout?.forest;if(!f||Math.hypot(p.x-f.x,p.z-f.z)>f.radius+3)return;
  const cells=forestForLayout(layout).cells,gx=Math.floor(p.x/16),gz=Math.floor(p.z/16);
  for(let iz=-1;iz<=1;iz++)for(let ix=-1;ix<=1;ix++)for(const t of cells.get((gx+ix)+','+(gz+iz))||[]){
    const dx=p.x-t.x,dz=p.z-t.z,d=Math.hypot(dx,dz),radius=t.radius+.29;
    if(d<radius){p.x=t.x+(d>.001?dx/d:1)*radius;p.z=t.z+(d>.001?dz/d:0)*radius;}
  }
}
