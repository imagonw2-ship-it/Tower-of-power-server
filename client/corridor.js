let corridorColliders=[], corridorTowers=[], corridorSpans=[], socketMesh;
function corridorBeam(g,a,b,r,color,sides=5){
  const d=norm(b.map((v,i)=>v-a[i])),x=norm(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),y=cross(d,x),points=[];
  for(const p of [a,b])for(let i=0;i<sides;i++){const angle=i*Math.PI*2/sides;points.push(p.map((v,k)=>v+r*(Math.cos(angle)*x[k]+Math.sin(angle)*y[k])));}
  for(let i=0;i<sides;i++)infraFace(g,[points[i],points[(i+1)%sides],points[(i+1)%sides+sides],points[i+sides]],color);
}
function conductorSocket(tower,index){const p=pylonPoint(tower,PYLON_SOCKETS[index]);p[1]-=1.6*(tower.scale||1);return p;}
function spanGeometry(start,end,released=0,endReleased=0){
  const g=infraGeometry();
  for(let wire=0;wire<6;wire++){
    const a=conductorSocket(start,wire),b=conductorSocket(end,wire);
    // The moving tower tears free; its six loose ends fall onto the yard.
    // The far ends remain secured to the next tower's insulators.
    a[1]=lerp(a[1],terrainHeight(a[0],a[2])+.12,ease(released));
    b[1]=lerp(b[1],terrainHeight(b[0],b[2])+.12,ease(endReleased));
    let previous=a;
    for(let i=1;i<=24;i++){const next=cablePoint(a,b,i/24,terrainHeight);corridorBeam(g,previous,next,.10,[.115,.13,.135],4);previous=next;}
  }
  return g;
}
function buildPowerCorridor(){
  for(const span of corridorSpans)disposeFieldMesh(span.mesh);
  for(const tower of corridorTowers)disposeFieldMesh(tower.shoes);
  disposeFieldMesh(corridorMesh);
  corridorTowers=activeLayout.pylons.map((t,index)=>({...groundedPylon(t,POWER_RIG,terrainHeight),index}));
  corridorColliders=corridorTowers.map(t=>[0,1,2,3].map(i=>{
    const p=pylonLegPoints(t,POWER_RIG,i);return{a:p[1],b:p[2],r0:.7,r1:.45};
  }));
  corridorSpans=activeLayout.powerLinks.map(e=>{
    const a=corridorTowers[e.a],b=corridorTowers[e.b];
    return{a,b,mesh:mesh3D(spanGeometry(a,b)),released:0,endReleased:0,lastUpdate:-1};
  });
  if(!socketMesh){
    const sockets=infraGeometry();
    for(const p of PYLON_SOCKETS){
      corridorBeam(sockets,p,[p[0],p[1]-1.6,p[2]],.14,[.21,.22,.20]);
      for(let i=0;i<6;i++)infraBox(p[0],p[1]-.24-i*.21,p[2],.55,.09,.55,[.32,.29,.23],sockets);
    }
    socketMesh=mesh3D(sockets);
  }
  const g=infraGeometry();
  for(const tower of corridorTowers){const shoes=infraGeometry();for(const local of POWER_RIG.feet){
    const at=pylonPoint(tower,local),floor=terrainHeight(at[0],at[2]);
    corridorBeam(shoes,[at[0],floor-.12,at[2]],[at[0],Math.max(floor+.35,at[1]+1.5*tower.scale),at[2]],.19*tower.scale,[.28,.31,.29],6);
  }tower.shoes=mesh3D(shoes);}
  // A narrow drainage channel, maintenance cabinets, and low edge kerbs.
  for(const side of [-1,1]){
    const x=POWER_ZONE.x+side*31.5;
    for(let z=-28;z<=28;z+=2){const y=terrainHeight(x,POWER_ZONE.z+z);infraBox(x,y+.07,POWER_ZONE.z+z,.28,.08,2.02,[.22,.245,.24],g);}
    for(let z=-28;z<=28;z+=.7)infraBox(x,terrainHeight(x,POWER_ZONE.z+z)+.117,POWER_ZONE.z+z,.24,.018,.052,[.085,.10,.10],g);
    for(let z=-30;z<=30;z+=2){const xx=POWER_ZONE.x+side*33,zz=POWER_ZONE.z+z;infraBox(xx,terrainHeight(xx,zz)+.05,zz,.55,.16,2.02,[.42,.43,.40],g);}
  }
  for(const x of [-29,29])for(const z of [-28,28]){
    const xx=POWER_ZONE.x+x,zz=POWER_ZONE.z+z,base=terrainHeight(xx,zz);
    infraBox(xx,base+.48,zz,.15,.96,.15,[.54,.57,.54],g);
    infraBox(xx,base+.80,zz,.16,.13,.16,[.80,.61,.28],g);
  }
  for(let i=0;i<3;i++){
    const x=POWER_ZONE.x+27,z=POWER_ZONE.z-10+i*2.8,base=terrainHeight(x,z);
    infraBox(x,base+.26,z,2,.16,1.8,[.38,.40,.38],g);
    infraBox(x,base+1.13,z,1.6,1.58,1.3,[.27,.32,.30],g);
    infraBox(x,base+1.96,z,1.72,.08,1.42,[.38,.41,.39],g);
    for(let n=0;n<7;n++)infraBox(x,base+1.05+n*.075,z+.656,1.08,.028,.02,[.10,.13,.12],g);
    infraBox(x+.62,base+1.46,z+.67,.04,.15,.025,[.6,.62,.56],g);
  }
  corridorMesh=mesh3D(g);
}
function activePylon(index){return index===0?powerCreature:(net.active?networkPylons[index-1]:null);}
function staticPylonColliders(){return corridorColliders.slice(1+(net.active?networkPylons.length:0)).flat();}
const networkPylonPalettes=[];
function appendPowerObjects(){
  if(isMenuScene())return;
  appendInfrastructure();
  const p=powerCreature,distance=Math.hypot(player.x-p.x,player.z-p.z);
  if(distance<650){
    const model=multiply(transform(p.x,p.y,p.z),rotateY(p.heading));
    objectDraws.push({mesh:distance>200?pylonLODMesh:pylonMesh,model,material:5,assetKind:3,variant:activeLayout.pylonStyle,rig:true},{mesh:socketMesh,model,material:2});
  }
  if(net.active)for(const [slot,pylon] of networkPylons.entries()){
    const d=Math.hypot(player.x-pylon.x,player.z-pylon.z);if(d>650)continue;
    const bones=networkPylonPalettes[slot]||(networkPylonPalettes[slot]=new Float32Array(9*16));updatePylonRig(pylon,bones);
    const model=multiply(transform(pylon.x,pylon.y,pylon.z),rotateY(pylon.heading));
    objectDraws.push({mesh:d>200?pylonLODMesh:pylonMesh,model,material:5,assetKind:3,variant:activeLayout.pylons[slot+1]?.style||0,bones,rigBlend:pylon.rigBlend,castShadow:d<220},{mesh:socketMesh,model,material:2,castShadow:false});
    for(const f of pylon.feet)objectDraws.push({mesh:ankleSteel,model:transform(f.position[0],f.position[1]-.12,f.position[2]),material:2,castShadow:d<80});
  }
  for(const tower of corridorTowers)if(!activePylon(tower.index)&&Math.hypot(player.x-tower.x,player.z-tower.z)<650){
    const model=multiply(transform(tower.x,tower.y,tower.z,tower.scale,tower.scale,tower.scale),rotateY(tower.heading));
    objectDraws.push({mesh:tower.shoes,model:identity(),material:2},{mesh:pylonLODMesh,model,material:5,assetKind:3,variant:tower.style},{mesh:socketMesh,model,material:2});
  }
  for(let i=0;i<corridorSpans.length;i++){
    const span=corridorSpans[i],midX=(span.a.x+span.b.x)/2,midZ=(span.a.z+span.b.z)/2;
    if(Math.hypot(player.x-midX,player.z-midZ)>690)continue;
    const released=clamp(((activePylon(span.a.index)?.wake||0)-.25)/2.6,0,1),endReleased=clamp(((activePylon(span.b.index)?.wake||0)-.25)/2.6,0,1);
    if((released!==span.released||endReleased!==span.endReleased)&&(time-span.lastUpdate>.08||released===0||released===1||endReleased===1)){
      mesh3D(spanGeometry(span.a,span.b,released,endReleased),span.mesh);span.released=released;span.endReleased=endReleased;span.lastUpdate=time;
    }
    objectDraws.push({mesh:span.mesh,model:identity(),material:2,castShadow:false});
  }
  if(Math.hypot(player.x-POWER_ZONE.x,player.z-POWER_ZONE.z)<450)objectDraws.push({mesh:corridorMesh,model:identity()});
}
