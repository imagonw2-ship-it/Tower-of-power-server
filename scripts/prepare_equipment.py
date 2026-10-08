"""Pack the supplied Glock GLB and military backpack FBX export for offline WebGL.

Usage: python prepare_equipment.py glock.glb backpack-mobile.json backpack/textures
Dependencies: numpy, scipy, Pillow. FBX export: export_prop.c.
First run simplify_prop.mjs to preserve UV seams during mobile optimization.
The original uploads stay untouched. UVs and original base colors are preserved.
"""
from pathlib import Path
import base64, io, json, struct, sys
import numpy as np
from scipy.spatial import ConvexHull
from PIL import Image

root=Path(__file__).resolve().parents[1]
def texture(image, size=1024):
    image=image.convert('RGB');image.thumbnail((size,size),Image.Resampling.LANCZOS)
    out=io.BytesIO();image.save(out,'JPEG',quality=87,optimize=True)
    return 'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
def pack(rows, indices=None):
    if indices is None:rows,indices=np.unique(np.round(rows,7),axis=0,return_inverse=True)
    raw=b''.join(struct.pack('<3f3h6B2f',*v[:3],*np.clip(v[3:6]*32767,-32767,32767).astype(int),127,127,127,0,0,255,*v[6:8]) for v in rows)
    return {'vertexCount':len(rows),'vertices':base64.b64encode(raw).decode(),'indices':base64.b64encode(np.asarray(indices,dtype='<u4').tobytes()).decode()}
def save(name,asset):
    path=root/'client'/f'{name}-assets.js';path.write_text('const '+name.upper()+'_ASSET='+json.dumps(asset,separators=(',',':'))+';\n')
    print(name,path.stat().st_size,'bytes',sum(m['vertexCount'] for m in asset['meshes']),'vertices')

b=Path(sys.argv[1]).read_bytes();length=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+length]);blob=b[28+length:]
def access(i):
    a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];components={'VEC3':3,'VEC2':2}.get(a['type'],1)
    return np.frombuffer(blob,{5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']],count=a['count']*components,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,components).copy()
p=access(1);n=access(0);uv=access(2);tri=access(3).reshape(-1,3)
# Find physically disconnected pieces, including the existing slide and magazine.
unique,inv=np.unique(np.round(p,5),axis=0,return_inverse=True);parents=list(range(len(unique)))
def find(i):
    while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
    return i
for t in inv[tri]:
    for v in t[1:]:parents[find(v)]=find(t[0])
ids=np.array([find(i) for i in inv]);groups={}
for i in np.unique(ids):
    vs=p[ids==i];lo,hi=vs.min(axis=0),vs.max(axis=0)
    kind='magazine' if lo[1]<-.32 and hi[0]-lo[0]<.5 else 'slide' if lo[1]>.15 and hi[0]-lo[0]>.025 and not (lo[0]<-.49 and hi[1]<.31) else 'frame'
    groups.setdefault(kind,[]).extend(tri[ids[tri[:,0]]==i].ravel())
# Model's barrel is -X. Local game props use -Z and a palm-centred origin.
pos=np.column_stack([-p[:,2],p[:,1]-.10,p[:,0]-.30])*.22
normal=np.column_stack([-n[:,2],n[:,1],n[:,0]])
uv[:,1]=1-uv[:,1];rows=np.column_stack([pos,normal,uv])
view=g['bufferViews'][g['images'][1]['bufferView']];image=Image.open(io.BytesIO(blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]))
gun={'source':'User supplied Glock 17 GLB','texture':texture(image),'meshes':[dict(name=k,**pack(rows[np.array(v)])) for k,v in groups.items()]}
save('gun',gun)

raw=json.loads(Path(sys.argv[2]).read_text());textures=Path(sys.argv[3]);atlas=Image.new('RGB',(1536,1024))
parts={'body':[],'flap':[]};allpos=[]
budgets=[3500,4200,2200,6500,1400,1600]
for mi,m in enumerate(raw):
    rows=np.array(m['corners'],float)
    rows[:,3:6]/=np.maximum(1e-8,np.linalg.norm(rows[:,3:6],axis=1))[:,None]
    im=Image.open(next(textures.glob('bag4_'+m['material']+'_BaseColor.png'))).convert('RGB').resize((508,508),Image.Resampling.LANCZOS)
    ax=(mi%3)*512;ay=(mi//3)*512;atlas.paste(im,(ax+2,ay+2))
    rows[:,6]=(ax+2+np.clip(rows[:,6],0,1)*508)/1536
    rows[:,7]=1-(ay+2+(1-np.clip(rows[:,7],0,1))*508)/1024
    rows[:,0]-=.012;rows[:,2]-=.15
    tris=rows.reshape(-1,3,8);center=tris[:,:,:3].mean(axis=1)
    # The front shell opens as a clamshell, carrying its original pockets/zippers.
    flap=(center[:,2]>.052)&(center[:,1]>.063)&(center[:,1]<.405)
    for key,mask in [('body',~flap),('flap',flap)]:parts[key].append(tris[mask].reshape(-1,8))
    allpos.append(rows[:,:3]);print(m['name'],len(rows)//3,'triangles')
meshes=[dict(name=k,**pack(np.concatenate(v))) for k,v in parts.items()]
bagrows=np.concatenate([np.concatenate(v) for v in parts.values()])
bag={'source':'User supplied military-backpack-02 FBX','texture':texture(atlas,1536),'meshes':meshes,'hinge':[0,.066,.054],'screen':[-.133,.093,.139,.369,.059]}
save('backpack',bag)
# Convex support points let dropped models rest on slopes without sinking.
supports={}
for kind,points in [('gun',pos),('backpack',np.concatenate(allpos))]:
    hull=ConvexHull(points);supports[kind]=points[hull.vertices].round(6).tolist()
(root/'shared/equipment-shapes.js').write_text('export const equipmentSupportPoints='+json.dumps(supports,separators=(',',':'))+';\n')
