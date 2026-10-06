// Built once per seed. A small canopy map supplies broad sky occlusion below
// clustered crowns; the existing cutout shadow maps still draw leaf shadows.
let canopyMap=null,canopyTexture=null,fallenLogBatches=[];
function buildCanopyMap(layout,size=192,stream=null,region=null){
  const forest=stream||forestForLayout(layout),f=layout.forest,extent=f.radius+40,bounds=region||[f.x-extent,f.z-extent,extent*2,extent*2];
  const density=new Float32Array(size*size),height=new Float32Array(size*size),pixels=new Uint8Array(size*size*4),spread=[.36,.32,.36,.32,.28,.35,.32];
  for(const t of forest.trees){
    const radius=t.height*spread[t.kind],cx=(t.x-bounds[0])/bounds[2]*size,cz=(t.z-bounds[1])/bounds[3]*size,rr=radius/bounds[2]*size;
    for(let z=Math.max(0,Math.floor(cz-rr));z<=Math.min(size-1,Math.ceil(cz+rr));z++)for(let x=Math.max(0,Math.floor(cx-rr));x<=Math.min(size-1,Math.ceil(cx+rr));x++){
      const d=Math.hypot(x+.5-cx,z+.5-cz)/rr;if(d>=1)continue;
      const w=(1-d*d)*1.35,i=z*size+x;density[i]+=w;height[i]+=w*t.height*.72;
    }
  }
  for(let i=0;i<density.length;i++){pixels[i*4]=Math.round(255*(1-Math.exp(-density[i])));pixels[i*4+1]=Math.round(Math.min(1,height[i]/Math.max(.001,density[i])/32)*255);pixels[i*4+3]=255;}
  return{size,bounds,pixels};
}
function uploadWoodland(stream=null,region=null){
  canopyMap=buildCanopyMap(activeLayout,192,stream,region);canopyTexture??=gl.createTexture();
  gl.activeTexture(gl.TEXTURE0+11);gl.bindTexture(gl.TEXTURE_2D,canopyTexture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,canopyMap.size,canopyMap.size,0,gl.RGBA,gl.UNSIGNED_BYTE,canopyMap.pixels);
  for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);
  for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);
  for(const b of fallenLogBatches)disposeFieldMesh(b.mesh);fallenLogBatches=[];
}
function fallenLogGeometry(log,g=infraGeometry()){
  const ground=(x,z)=>dropSurface(x,z,terrainHeight,inForest()?null:shed,terrainHeight),a=[log.a.x,ground(log.a.x,log.a.z)+log.radius,log.a.z],b=[log.b.x,ground(log.b.x,log.b.z)+log.radius*.82,log.b.z],
    axis=norm(b.map((v,i)=>v-a[i])),side=norm(cross(axis,[0,1,0])),up=cross(side,axis),rings=[],sides=12;
  let lift=0;
  for(let j=0;j<=4;j++){
    const t=j/4,r=log.radius*(1-.18*t),center=a.map((v,k)=>v+(b[k]-v)*t),ring=[];
    for(let i=0;i<sides;i++){const angle=i*Math.PI*2/sides,rough=1+.035*Math.sin(i*5.1+j*.2),p=center.map((v,k)=>v+r*rough*(side[k]*Math.cos(angle)+up[k]*Math.sin(angle)));ring.push(p);lift=Math.max(lift,ground(p[0],p[2])-p[1]-.008);}
    rings.push(ring);
  }
  for(const ring of rings)for(const p of ring)p[1]+=lift;
  for(let j=0;j<4;j++)for(let i=0;i<sides;i++){const n=(i+1)%sides;infraFace(g,[rings[j][i],rings[j+1][i],rings[j+1][n],rings[j][n]],[1,1,1],[[j/4,i/sides],[(j+1)/4,i/sides],[(j+1)/4,(i+1)/sides],[j/4,(i+1)/sides]]);}
  for(const end of [0,4]){
    const center=(end===0?a:b).slice();center[1]+=lift;
    for(let i=0;i<sides;i++){const n=(i+1)%sides,indices=end===0?[n,i]:[i,n];infraFace(g,[center,...indices.map(k=>rings[end][k])],[1,1,1],[[4,0],...indices.map(k=>[4+Math.cos(k*Math.PI*2/sides),Math.sin(k*Math.PI*2/sides)])]);}
  }
  return g;
}
function buildFallenLogs(){
  if(fallenLogBatches.length)return;
  const groups=new Map();
  for(const log of forestForLayout(activeLayout).logs){const x=(log.a.x+log.b.x)/2,z=(log.a.z+log.b.z)/2,key=Math.floor(x/80)+','+Math.floor(z/80);let b=groups.get(key);if(!b){b={x:(Math.floor(x/80)+.5)*80,z:(Math.floor(z/80)+.5)*80,geometry:infraGeometry()};groups.set(key,b);}fallenLogGeometry(log,b.geometry);}
  fallenLogBatches=[...groups.values()].map(b=>({x:b.x,z:b.z,mesh:mesh3D(b.geometry)}));
}
function appendFallenLogs(){
  buildFallenLogs();const range=settings.quality==='low'?125:180;
  for(const b of fallenLogBatches){const d=Math.hypot(player.x-b.x,player.z-b.z);if(d<range+57)objectDraws.push({mesh:b.mesh,model:identity(),material:5,assetKind:10,castShadow:d<100,fallenLog:true});}
}
