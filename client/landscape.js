let activeLayout=makeLayout(0),forestChunks=[],forestBuiltSeed=null,layoutLookup=null,layoutLookupTexture=null,layoutDataTexture=null;
function selectLayout(seed){
  const changed=!layoutLookup||activeLayout.seed!==(seed>>>0);
  activeLayout=makeLayout(seed);world.seed=activeLayout.seed;Object.assign(POWER_ZONE,activeLayout.power);
  if(changed){
    layoutLookup=makeLayoutLookup(activeLayout);
    layoutLookupTexture=layoutLookupTexture||gl.createTexture();layoutDataTexture=layoutDataTexture||gl.createTexture();
    for(const [texture,unit,format,width,height,type,data] of [
      [layoutLookupTexture,9,gl.RGBA8,layoutLookup.size,layoutLookup.size*3,gl.UNSIGNED_BYTE,layoutLookup.pixels],
      [layoutDataTexture,10,gl.RGBA32F,256,2,gl.FLOAT,layoutLookup.data]]){
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,format,width,height,0,gl.RGBA,type,data);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
  }
  document.getElementById('currentWorldSeed').textContent='WORLD SEED · '+activeLayout.seed;
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
