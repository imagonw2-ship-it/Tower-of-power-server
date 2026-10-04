let activeLayout=makeLayout(0),forestChunks=[],forestBuiltSeed=null;
function selectLayout(seed){
  activeLayout=makeLayout(seed);world.seed=activeLayout.seed;
  if(forestBuiltSeed!==activeLayout.seed){
    for(const c of forestChunks)disposeFieldMesh(c.mesh);
    forestChunks=[];forestBuiltSeed=null;
  }
}
function disposeFieldMesh(mesh){if(!mesh)return;gl.deleteVertexArray(mesh.vao);if(mesh.buffer)gl.deleteBuffer(mesh.buffer);if(mesh.indexBuffer)gl.deleteBuffer(mesh.indexBuffer);}
function buildForest(){
  if(forestBuiltSeed===activeLayout.seed)return;
  const chunks=new Map();
  for(const t of forestForLayout(activeLayout).trees){
    const cell=Math.floor(t.x/48)+','+Math.floor(t.z/48);
    if(!chunks.has(cell))chunks.set(cell,{x:(Math.floor(t.x/48)+.5)*48,z:(Math.floor(t.z/48)+.5)*48,g:infraGeometry()});
    const g=chunks.get(cell).g,asset=TREE_ASSETS[t.kind],base=g.positions.length/3,c=Math.cos(t.yaw),s=Math.sin(t.yaw),y=terrainHeight(t.x,t.z)-.18;
    for(let i=0;i<asset.positions.length;i+=3){
      const [x,h,z]=asset.positions.slice(i,i+3);
      g.positions.push(t.x+(x*c+z*s)*t.height,y+h*t.height,t.z+(-x*s+z*c)*t.height);
      g.colors.push(...asset.colors.slice(i,i+3).map(v=>v*t.shade));
    }
    g.indices.push(...asset.indices.map(i=>i+base));
  }
  forestChunks=[...chunks.values()].map(c=>({x:c.x,z:c.z,mesh:mesh3D(c.g)}));forestBuiltSeed=activeLayout.seed;
}
function appendForest(){
  if(isMenuScene())return;
  const f=activeLayout.forest,range=settings.quality==='low'?195:285;
  if(Math.hypot(player.x-f.x,player.z-f.z)>f.radius+range)return;
  buildForest();
  for(const c of forestChunks){
    const d=Math.hypot(player.x-c.x,player.z-c.z);if(d>range+38)continue;
    objectDraws.push({mesh:c.mesh,model:identity(),material:5,assetKind:8,castShadow:d<80,forest:true});
  }
}
