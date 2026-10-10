let roadsideChunks=[],trafficLights=[],trafficMeshes=[],trafficTextures={},trafficPoleMesh=null,trafficCableMesh=null,trafficWrapMesh=null;
function roadBeamMatrix(a,b,width,depth=width){
  const delta=b.map((v,k)=>v-a[k]),length=Math.hypot(...delta),axis=norm(delta),right=norm(cross(axis,Math.abs(axis[1])>.95?[0,0,1]:[0,1,0])),front=cross(right,axis);
  return new Float32Array([...right.map(v=>v*width),0,...delta,0,...front.map(v=>v*depth),0,...a,1]);
}
function addRoadBeam(g,a,b,width,depth,color){
  const unit=infraBox(0,.5,0,1,1,1,color),m=roadBeamMatrix(a,b,width,depth),base=g.positions.length/3;
  for(let i=0;i<unit.positions.length;i+=3){const p=unit.positions.slice(i,i+3);for(let k=0;k<3;k++)g.positions.push(m[12+k]+m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]);}
  g.colors.push(...unit.colors);g.indices.push(...unit.indices.map(i=>i+base));
  for(let i=0;i<unit.positions.length;i+=3)g.uvs.push(unit.positions[i]*.5,unit.positions[i+1]*Math.hypot(...b.map((v,k)=>v-a[k]))*.5);
}
function buildTrafficModels(){
  trafficMeshes=TRAFFIC_LIGHT_ASSET.meshes.map(p=>({...p,mesh:unpackModel(p)}));
  for(const [key,source] of Object.entries(TRAFFIC_LIGHT_ASSET.textures))trafficTextures[key]=importedTexture(source,5);
  const pole=infraGeometry();
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,b=(i+1)*Math.PI/5,color=[.32+i%3*.018,.265+i%2*.018,.185];
    infraFace(pole,[[Math.cos(a)*.5,0,Math.sin(a)*.5],[Math.cos(b)*.5,0,Math.sin(b)*.5],[Math.cos(b)*.39,1,Math.sin(b)*.39],[Math.cos(a)*.39,1,Math.sin(a)*.39]],color,[[i/10,0],[(i+1)/10,0],[(i+1)/10,3],[i/10,3]]);
  }
  infraFace(pole,Array.from({length:10},(_,i)=>[Math.cos(-i*Math.PI/5)*.39,1,Math.sin(-i*Math.PI/5)*.39]),[.41,.33,.20]);
  trafficPoleMesh=mesh3D(pole);trafficCableMesh=mesh3D(infraBox(0,.5,0,1,1,1,[.028,.030,.024]));
  // A continuous, visibly thick cable coils around each wooden pole beneath its tip.
  // Bake the loops into one mesh per pole rather than drawing every loop segment.
  const wraps=infraGeometry();let previous=null;
  for(let i=0;i<=64;i++){
    const t=i/64,a=t*Math.PI*6,p=[Math.cos(a)*.155,SIGNAL_ATTACH_HEIGHT-.14+t*.28,Math.sin(a)*.155];
    if(previous)addRoadBeam(wraps,previous,p,.045,.045,[.09,.08,.057]);previous=p;
  }
  addRoadBeam(wraps,previous,[previous[0],previous[1]-.53,previous[2]],.045,.045,[.09,.08,.057]);
  for(let i=1;i<wraps.positions.length;i+=3)wraps.positions[i]/=SIGNAL_HEIGHT;
  trafficWrapMesh=mesh3D(wraps);
}
function resetRoadside(){
  for(const c of roadsideChunks){gl.deleteVertexArray(c.mesh.vao);gl.deleteBuffer(c.mesh.buffer);gl.deleteBuffer(c.mesh.indexBuffer);}
  roadsideChunks=[];trafficLights=createTrafficLights(activeLayout,terrainHeight);
  // One draw per short fence run; no per-post draw calls.
  for(const fence of activeLayout.roadside?.fences||[]){
    const g=infraGeometry(),dx=fence.b.x-fence.a.x,dz=fence.b.z-fence.a.z,length=Math.hypot(dx,dz),count=Math.ceil(length/3.2),posts=[];
    for(let i=0;i<=count;i++){
      const x=fence.a.x+dx*i/count,z=fence.a.z+dz*i/count,y=terrainHeight(x,z),p=[x,y,z];posts.push(p);
      addRoadBeam(g,p,[x,y+fence.height,z],.15,.15,[.30,.265,.20]);
    }
    for(let i=1;i<posts.length;i++)for(const h of [.55,1.05])addRoadBeam(g,posts[i-1].map((v,k)=>v+(k===1?h:0)),posts[i].map((v,k)=>v+(k===1?h:0)),.09,.13,[.34,.30,.225]);
    roadsideChunks.push({x:(fence.a.x+fence.b.x)/2,z:(fence.a.z+fence.b.z)/2,mesh:mesh3D(g)});
  }
}
function trafficObstacles(){return[{x:shed.x,z:shed.z,r:5.4,shelter:true},...activeLayout.turbines.map(t=>({x:t.x,z:t.z,r:9}))];}
function updateTrafficLights(dt){
  if(net.active||inForest()||game.mode!=='playing')return;
  const solo={...player,id:'solo',alive:true,godMode:game.godMode};
  stepTrafficLights(trafficLights,dt,[solo],terrainHeight,trafficObstacles(),()=>{sound.caught();setMode('lost');if(document.pointerLockElement===canvas)document.exitPointerLock();});
}
function visibleTrafficLights(){
  if(!net.active)return trafficLights.map(s=>s.paused?{...s,phase:'red'}:s);
  const q=snapshotPair();if(!q)return[];
  return(q.b.world.trafficLights||[]).map(cur=>{
    const prev=(q.a.world.trafficLights||[]).find(s=>s.id===cur.id)||cur,s=poseBetween(prev,cur,q.t);
    if(q.t<1&&!s.paused)s.phase=prev.phase;
    for(const k of ['swingX','swingZ','headRoll','leanX','leanZ'])s[k]=lerp(prev[k]||0,cur[k]||0,q.t);
    return s;
  });
}
function drawSignalCable(a,b,width=.045){if(Math.hypot(...a.map((v,k)=>v-b[k]))<.001)return;objectDraws.push({mesh:trafficCableMesh,model:roadBeamMatrix(a,b,width),material:5,assetKind:13,castShadow:false,trafficCable:true});}
function appendRoadside(){
  if(isMenuScene()||inForest())return;
  for(const c of roadsideChunks)if(Math.hypot(c.x-player.x,c.z-player.z)<220)objectDraws.push({mesh:c.mesh,model:identity(),material:1,castShadow:Math.hypot(c.x-player.x,c.z-player.z)<90,roadsideFence:true});
  for(const s of visibleTrafficLights()){
    if(Math.hypot(s.x-player.x,s.z-player.z)>240)continue;
    const geo=trafficLightGeometry(s),shadow=Math.hypot(s.x-player.x,s.z-player.z)<75;
    for(let i=0;i<2;i++){
      objectDraws.push({mesh:trafficPoleMesh,model:roadBeamMatrix(s.feet[i].position,geo.tops[i],.30),material:1,castShadow:shadow,trafficPole:true});
      objectDraws.push({mesh:trafficWrapMesh,model:roadBeamMatrix(s.feet[i].position,geo.tops[i],1),material:5,assetKind:13,castShadow:false,trafficWrap:true});
    }
    let previous=geo.attachments[0];
    for(let i=0;i<=16;i++){
      const t=i/16,p=geo.attachments[0].map((v,k)=>lerp(v,geo.attachments[1][k],t)-(k===1?Math.sin(t*Math.PI)*geo.sag:0));
      if(i)drawSignalCable(previous,p);previous=p;
    }
    const head=multiply(multiply(transform(...geo.head),multiply(rotateY(s.heading),multiply(rotateZ(s.headRoll),rotateX(s.swingZ*.4)))),transform(0,0,0,SIGNAL_HEAD_SCALE,SIGNAL_HEAD_SCALE,SIGNAL_HEAD_SCALE));
    // Two short hangers physically join the top span to the one horizontal head.
    for(const sign of [-1,1]){
      const x=sign*.285,attach=[0,1,2].map(k=>head[12+k]+head[k]*x+head[4+k]*.158);
      const span=Math.hypot(...geo.attachments[1].map((v,k)=>v-geo.attachments[0][k])),t=.5+x*SIGNAL_HEAD_SCALE/Math.max(1,span),top=geo.attachments[0].map((v,k)=>lerp(v,geo.attachments[1][k],t)-(k===1?Math.sin(t*Math.PI)*geo.sag:0));drawSignalCable(top,attach,.045);
    }
    for(const p of trafficMeshes){const lens=p.kind!=='housing',on=p.kind===s.phase;objectDraws.push({mesh:p.mesh,model:head,texture:lens?trafficTextures[p.kind+(on?'':'Off')]:null,material:5,assetKind:lens?15:13,variant:lens&&on?{red:1,yellow:2,green:3}[p.kind]:0,castShadow:shadow,signalHead:s.id,signalLens:lens?p.kind:null});}
  }
}
