let corridorColliders=[], corridorTowers=[], corridorSpans=[], socketMesh;
function corridorBeam(g,a,b,r,color,sides=5){
  const d=norm(b.map((v,i)=>v-a[i])),x=norm(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),y=cross(d,x),points=[];
  for(const p of [a,b])for(let i=0;i<sides;i++){const angle=i*Math.PI*2/sides;points.push(p.map((v,k)=>v+r*(Math.cos(angle)*x[k]+Math.sin(angle)*y[k])));}
  for(let i=0;i<sides;i++)infraFace(g,[points[i],points[(i+1)%sides],points[(i+1)%sides+sides],points[i+sides]],color);
}
function conductorSocket(tower,index){const p=pylonPoint(tower,PYLON_SOCKETS[index]);p[1]-=1.6*(tower.scale||1);return p;}
function spanGeometry(start,end,released=0){
  const g=infraGeometry();
  for(let wire=0;wire<6;wire++){
    const a=conductorSocket(start,wire),b=conductorSocket(end,wire);
    // The moving tower tears free; its six loose ends fall onto the yard.
    // The far ends remain secured to the next tower's insulators.
    a[1]=lerp(a[1],terrainHeight(a[0],a[2])+.12,ease(released));
    let previous=a;
    for(let i=1;i<=24;i++){const next=cablePoint(a,b,i/24,terrainHeight);corridorBeam(g,previous,next,.10,[.115,.13,.135],4);previous=next;}
  }
  return g;
}
function buildPowerCorridor(){
  const rest={x:POWER_ZONE.x,z:POWER_ZONE.z,y:terrainHeight(POWER_ZONE.x,POWER_ZONE.z),heading:PYLON_HEADING,scale:1};
  corridorTowers=STATIC_PYLONS.map(t=>groundedPylon(t,POWER_RIG,terrainHeight));
  corridorColliders=corridorTowers.flatMap(t=>{
    const scaled={hips:POWER_RIG.hips.map(p=>p.map(v=>v*t.scale)),knees:POWER_RIG.knees.map(p=>p.map(v=>v*t.scale)),feet:POWER_RIG.feet.map(p=>p.map(v=>v*t.scale))};
    return [0,1,2,3].map(i=>{const p=pylonLegPoints(t,scaled,i);return{a:p[1],b:p[2],r0:.7,r1:.45};});
  });
  corridorSpans=[rest,...corridorTowers].slice(0,-1).map((a,i)=>({a,b:corridorTowers[i],mesh:mesh3D(spanGeometry(a,corridorTowers[i])),released:0,lastUpdate:-1}));
  const sockets=infraGeometry();
  for(const p of PYLON_SOCKETS){
    corridorBeam(sockets,p,[p[0],p[1]-1.6,p[2]],.14,[.21,.22,.20]);
    for(let i=0;i<6;i++)infraBox(p[0],p[1]-.24-i*.21,p[2],.55,.09,.55,[.32,.29,.23],sockets);
  }
  socketMesh=mesh3D(sockets);
  const g=infraGeometry();
  // A narrow drainage channel, maintenance cabinets, and low edge kerbs.
  for(const side of [-1,1]){
    const x=POWER_ZONE.x+side*31.5;
    infraBox(x,.22,POWER_ZONE.z,.28,.08,59,[.22,.245,.24],g);
    for(let z=-28;z<=28;z+=.7)infraBox(x,.267,POWER_ZONE.z+z,.24,.018,.052,[.085,.10,.10],g);
    infraBox(POWER_ZONE.x+side*33,.20,POWER_ZONE.z,.55,.16,62,[.42,.43,.40],g);
  }
  for(const x of [-29,29])for(const z of [-28,28]){
    const xx=POWER_ZONE.x+x,zz=POWER_ZONE.z+z,base=terrainHeight(xx,zz);
    infraBox(xx,base+.48,zz,.15,.96,.15,[.54,.57,.54],g);
    infraBox(xx,base+.80,zz,.16,.13,.16,[.80,.61,.28],g);
  }
  for(let i=0;i<3;i++){
    const x=POWER_ZONE.x+27,z=POWER_ZONE.z-10+i*2.8;
    infraBox(x,.26,z,2,.16,1.8,[.38,.40,.38],g);
    infraBox(x,1.13,z,1.6,1.58,1.3,[.27,.32,.30],g);
    infraBox(x,1.96,z,1.72,.08,1.42,[.38,.41,.39],g);
    for(let n=0;n<7;n++)infraBox(x,1.05+n*.075,z+.656,1.08,.028,.02,[.10,.13,.12],g);
    infraBox(x+.62,1.46,z+.67,.04,.15,.025,[.6,.62,.56],g);
  }
  corridorMesh=mesh3D(g);
}
function appendPowerObjects(){
  if(isMenuScene())return;
  appendInfrastructure();
  const p=powerCreature,distance=Math.hypot(player.x-p.x,player.z-p.z);
  if(distance<650){
    const model=multiply(transform(p.x,p.y,p.z),rotateY(p.heading));
    objectDraws.push({mesh:distance>200?pylonLODMesh:pylonMesh,model,material:5,assetKind:3,rig:true},{mesh:socketMesh,model,material:2});
  }
  for(const tower of corridorTowers)if(Math.hypot(player.x-tower.x,player.z-tower.z)<650){
    const model=multiply(transform(tower.x,tower.y,tower.z,tower.scale,tower.scale,tower.scale),rotateY(tower.heading));
    objectDraws.push({mesh:pylonLODMesh,model,material:5,assetKind:3},{mesh:socketMesh,model,material:2});
  }
  for(let i=0;i<corridorSpans.length;i++){
    const span=corridorSpans[i],midX=(span.a.x+span.b.x)/2,midZ=(span.a.z+span.b.z)/2;
    if(Math.hypot(player.x-midX,player.z-midZ)>690)continue;
    if(i===0){
      const released=clamp((p.wake-.25)/2.6,0,1);
      if(released!==span.released&&(time-span.lastUpdate>.08||released===0||released===1)){
        mesh3D(spanGeometry(span.a,span.b,released),span.mesh);span.released=released;span.lastUpdate=time;
      }
    }
    objectDraws.push({mesh:span.mesh,model:identity(),material:2,castShadow:false});
  }
  if(Math.hypot(player.x-POWER_ZONE.x,player.z-POWER_ZONE.z)<450)objectDraws.push({mesh:corridorMesh,model:identity()});
}
