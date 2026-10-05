let activeLayout=makeLayout(0),forestChunks=[],forestBuiltSeed=null,layoutLookup=null,layoutLookupTexture=null,layoutDataTexture=null;
const forestBatches=[];let forestTexture=null,forestRefreshX=Infinity,forestRefreshZ=Infinity,forestRefreshQuality='';
const treeInstanceGLSL=`
  layout(location=5) in vec4 a_treePosition;
  layout(location=6) in vec4 a_treeStyle;
  uniform float u_treeInstanced,u_time;
  vec3 treeRotate(vec3 p){return vec3(p.x*a_treeStyle.y+p.z*a_treeStyle.x,p.y,-p.x*a_treeStyle.x+p.z*a_treeStyle.y);}
  vec3 treePoint(vec3 p){vec3 w=treeRotate(p*a_treePosition.w)+a_treePosition.xyz;w.x+=sin(u_time*.65+w.z*.04)*.12*smoothstep(2.,14.,p.y*a_treePosition.w);return w;}
`;
function selectLayout(seed){
  const changed=!layoutLookup||activeLayout.seed!==(seed>>>0);
  activeLayout=makeLayout(seed);world.seed=activeLayout.seed;Object.assign(POWER_ZONE,activeLayout.power);
  if(changed){
    layoutLookup=makeLayoutLookup(activeLayout);uploadWoodland();
    layoutLookupTexture=layoutLookupTexture||gl.createTexture();layoutDataTexture=layoutDataTexture||gl.createTexture();
    for(const [texture,unit,format,width,height,type,data] of [
      [layoutLookupTexture,9,gl.RGBA8,layoutLookup.size,layoutLookup.size*5,gl.UNSIGNED_BYTE,layoutLookup.pixels],
      [layoutDataTexture,10,gl.RGBA32F,256,3,gl.FLOAT,layoutLookup.data]]){
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,format,width,height,0,gl.RGBA,type,data);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
  }
  document.getElementById('currentWorldSeed').textContent='WORLD SEED · '+activeLayout.seed;
  if(forestBuiltSeed!==activeLayout.seed){
    forestChunks=[];forestBuiltSeed=null;
  }
}
function disposeFieldMesh(mesh){if(!mesh)return;gl.deleteVertexArray(mesh.vao);if(mesh.buffer)gl.deleteBuffer(mesh.buffer);if(mesh.indexBuffer)gl.deleteBuffer(mesh.indexBuffer);}
function buildForest(){
  if(forestBuiltSeed===activeLayout.seed)return;
  const forest=forestForLayout(activeLayout);forestChunks=forest.chunks;
  if(!forestBatches.length){
    forestTexture=importedTexture(TREE_TEXTURE,5);
    for(let kind=0;kind<TREE_ASSETS.length;kind++)for(let lod=0;lod<2;lod++){
      const mesh=unpackModel(TREE_ASSETS[kind].lods[lod]),buffer=gl.createBuffer();
      gl.bindVertexArray(mesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(let i=0;i<2;i++){gl.enableVertexAttribArray(5+i);gl.vertexAttribPointer(5+i,4,gl.FLOAT,false,32,i*16);gl.vertexAttribDivisor(5+i,1);}
      gl.bindVertexArray(null);forestBatches.push({kind,lod,mesh,buffer,count:0,values:null});
    }
  }
  for(const b of forestBatches){b.values=new Float32Array(forest.trees.length*8);gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.bufferData(gl.ARRAY_BUFFER,b.values.byteLength,gl.DYNAMIC_DRAW);}
  forestBuiltSeed=activeLayout.seed;forestRefreshX=Infinity;
}
function appendForest(){
  if(isMenuScene())return;
  const f=activeLayout.forest,range=settings.quality==='low'?140:210;
  if(Math.hypot(player.x-f.x,player.z-f.z)>f.radius+range)return;
  buildForest();appendFallenLogs();
  if((player.x-forestRefreshX)**2+(player.z-forestRefreshZ)**2>16||forestRefreshQuality!==settings.quality){
    for(const b of forestBatches)b.count=0;
    const near=settings.quality==='low'?20:38;
    for(const c of forestChunks){
      if((player.x-c.x)**2+(player.z-c.z)**2>(range+38)**2)continue;
      for(const t of c.trees){
        const d=(player.x-t.x)**2+(player.z-t.z)**2;if(d>(range+14)**2)continue;
        const b=forestBatches[t.kind*2+(d<near*near?0:1)];
        b.values.set([t.x,terrainHeight(t.x,t.z)-.045,t.z,t.height,Math.sin(t.yaw),Math.cos(t.yaw),t.shade,0],b.count++*8);
      }
    }
    for(const b of forestBatches)if(b.count){gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,b.values.subarray(0,b.count*8));}
    forestRefreshX=player.x;forestRefreshZ=player.z;forestRefreshQuality=settings.quality;
  }
  for(const b of forestBatches)if(b.count)objectDraws.push({mesh:b.mesh,model:identity(),material:5,assetKind:8,texture:forestTexture,treeInstances:b.count,castShadow:b.lod===0,forest:true});
}
