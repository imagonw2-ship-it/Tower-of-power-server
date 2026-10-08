const forestDetailMeshes=new Map();
function clearForestDetails(){for(const b of forestDetailMeshes.values())for(const mesh of Object.values(b))disposeFieldMesh(mesh);forestDetailMeshes.clear();}
function forestRockGeometry(rock,g){
  const rings=[],sides=9;
  for(let j=0;j<3;j++){
    const ring=[];
    for(let i=0;i<sides;i++){
      const angle=rock.yaw+i*Math.PI*2/sides,rough=.90+.12*Math.sin(i*4.7+rock.shape*29+j*.7),r=rock.radius*[1,.90,.46][j]*rough;
      const x=rock.x+Math.cos(angle)*r,z=rock.z+Math.sin(angle)*r*.82;
      ring.push([x,j?rock.y+[0,.48,.92][j]*rock.height+Math.sin(i*8.1+rock.shape)*.10:Math.min(rock.y-.28*rock.height,forestTerrainHeight(x,z)-.12),z]);
    }rings.push(ring);
  }
  const color=[.33,.35,.32];
  for(let j=0;j<2;j++)for(let i=0;i<sides;i++){const n=(i+1)%sides;infraFace(g,[rings[j][i],rings[j][n],rings[j+1][n],rings[j+1][i]],color);}
  for(let i=0;i<sides;i++)infraFace(g,[rings[2][i],rings[2][(i+1)%sides],[rock.x,rock.y+rock.height,rock.z]],color);
}
function forestFernGeometry(d,g){
  for(let f=0;f<7;f++){
    const angle=d.yaw+f*2.399,L=d.size*(.70+.20*Math.sin(f*3.1)),along=[Math.cos(angle),Math.sin(angle)],side=[-along[1],along[0]];
    const point=t=>[d.x+along[0]*t*L,d.y+.035+Math.sin(t*2.2)*L*.58,d.z+along[1]*t*L];
    for(let j=1;j<=6;j++){
      const t=j/7,p=point(t),next=point(t+.10),width=L*.21*Math.sin(t*Math.PI);
      for(const sign of [-1,1]){
        const tip=[p[0]+side[0]*width*sign+along[0]*L*.09,p[1]-.018,p[2]+side[1]*width*sign+along[1]*L*.09];
        infraFace(g,[p,tip,next],[.12*d.shade,.235*d.shade,.075*d.shade]);
      }
    }
  }
}
function forestDetailGeometry(d,g,wood){
  if(d.kind==='fern'){forestFernGeometry(d,g);return;}
  if(d.kind==='branch'){
    const a=[d.x,d.y+.07,d.z],b=[d.x+Math.cos(d.yaw)*d.size*2,0,d.z+Math.sin(d.yaw)*d.size*2];b[1]=forestTerrainHeight(b[0],b[2])+.07;
    corridorBeam(wood,a,b,.035,[.19,.16,.11],5);const m=a.map((v,k)=>(v+b[k])*.5),tip=[m[0]+Math.cos(d.yaw+.8)*.6,m[1]+.08,m[2]+Math.sin(d.yaw+.8)*.6];corridorBeam(wood,m,tip,.022,[.20,.17,.12],4);return;
  }
  if(d.kind==='stump'){
    const r=.18+d.size*.12,h=.28+d.size*.48;
    corridorBeam(wood,[d.x,d.y-.12,d.z],[d.x+.06,d.y+h,d.z],r,[.23,.19,.13],8);
    for(let i=0;i<5;i++){const a=i*1.256+d.yaw;corridorBeam(wood,[d.x,d.y+.05,d.z],[d.x+Math.cos(a)*r*2.7,forestTerrainHeight(d.x+Math.cos(a)*r*2.7,d.z+Math.sin(a)*r*2.7)+.015,d.z+Math.sin(a)*r*2.7],.045,[.19,.16,.12],4);}return;
  }
  for(let j=0;j<3;j++){
    const x=d.x+Math.sin(j*3+d.yaw)*.24,z=d.z+Math.cos(j*3+d.yaw)*.24,y=forestTerrainHeight(x,z),h=.09+d.size*.12+j*.013,r=.07+d.size*.055;
    corridorBeam(g,[x,y,z],[x,y+h,z],.018,[.55,.48,.33],5);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;infraFace(g,[[x,y+h+.04,z],[x+Math.cos(a)*r,y+h,z+Math.sin(a)*r],[x+Math.cos(b)*r,y+h,z+Math.sin(b)*r]],[.38,.24,.10]);}
  }
}
function refreshForestDetails(chunks){
  const keys=new Set(chunks.map(c=>c.key));
  for(const [key,b] of forestDetailMeshes)if(!keys.has(key)){for(const mesh of Object.values(b))disposeFieldMesh(mesh);forestDetailMeshes.delete(key);}
  for(const c of chunks)if(!forestDetailMeshes.has(c.key)){
    const stone=infraGeometry(),foliage=infraGeometry(),wood=infraGeometry();
    for(const r of c.rocks)forestRockGeometry(r,stone);
    for(const d of c.details)forestDetailGeometry(d,foliage,wood);
    const b={};for(const [name,g] of Object.entries({stone,foliage,wood}))if(g.indices.length)b[name]=mesh3D(g);forestDetailMeshes.set(c.key,b);
  }
}
function appendForestUnderstory(){
  const near=settings.quality==='low'?58:82;
  for(const c of streamForest.chunks){
    const b=forestDetailMeshes.get(c.key),d=Math.hypot(player.x-c.x,player.z-c.z);if(!b)continue;
    if(b.stone&&d<forestDrawRange()+32)objectDraws.push({mesh:b.stone,model:identity(),material:5,assetKind:14,castShadow:d<72});
    if(d>near+24)continue;
    if(b.foliage)objectDraws.push({mesh:b.foliage,model:identity(),material:5,assetKind:13,castShadow:false});
    if(b.wood)objectDraws.push({mesh:b.wood,model:identity(),material:5,assetKind:13,castShadow:d<42});
  }
}
