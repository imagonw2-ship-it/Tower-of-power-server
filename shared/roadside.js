// Kept separate from the main layout RNG so adding roadside props cannot move roads.
import {layoutRandom,nearestRoad,segmentDistanceSquared} from './world-layout.js';
export function makeRoadside(layout){
  const random=layoutRandom(layout.seed^0x717aff17),fences=[],signals=[];
  const clear=(p,r=10)=>Math.hypot(p.x-134,p.z+43)>32&&Math.hypot(p.x-layout.forest.x,p.z-layout.forest.z)>layout.forest.radius+15&&layout.sites.every(s=>Math.hypot(p.x-s.x,p.z-s.z)>s.radius+r);
  for(let ri=0;ri<layout.roads.length;ri++){
    const road=layout.roads[ri];if(road.kind!=='road')continue;
    const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    const point=(along,side=0)=>({x:road.a.x+ux*along+uz*side,z:road.a.z+uz*along-ux*side});
    let signalAlong=-100;
    if(length>100&&random()<.22&&signals.length<3){
      const along=length*(.35+random()*.3),p=point(along);
      if(clear(p,30)&&Math.hypot(p.x-128,p.z+34)>95&&signals.every(s=>Math.hypot(s.x-p.x,s.z-p.z)>180)&&layout.roads.every((r,i)=>i===ri||segmentDistanceSquared(p.x,p.z,r.a,r.b)>22*22)){
        signalAlong=along;signals.push({...p,id:'signal-'+signals.length,heading:Math.atan2(ux,uz),road:ri});
      }
    }
    for(const side of [-1,1])for(let start=20+random()*12;start<length-24;start+=32+random()*18){
      const end=Math.min(length-17,start+14+random()*20);
      if(random()>.64||start<signalAlong+17&&end>signalAlong-17)continue;
      const a=point(start,side*6.2),b=point(end,side*6.2);
      if(![a,b,point((start+end)/2,side*6.2)].every(p=>clear(p)&&nearestRoad(p.x,p.z,layout).distance>5.4))continue;
      fences.push({a,b,road:ri,height:1.35+random()*.15});
    }
  }
  return{fences,signals};
}
export function collideRoadside(p,layout,radius=.40){
  if(p.biome==='forest')return;
  for(const f of layout?.roadside?.fences||[]){
    const dx=f.b.x-f.a.x,dz=f.b.z-f.a.z,l=dx*dx+dz*dz;
    const t=Math.max(0,Math.min(1,((p.x-f.a.x)*dx+(p.z-f.a.z)*dz)/(l||1))),x=f.a.x+t*dx,z=f.a.z+t*dz;
    const px=p.x-x,pz=p.z-z,d=Math.hypot(px,pz);
    if(d<radius){const n=d>.0001?d:Math.sqrt(l);p.x=x+(d>.0001?px:dz)/n*radius;p.z=z+(d>.0001?pz:-dx)/n*radius;}
  }
}
