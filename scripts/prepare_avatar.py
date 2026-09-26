"""Retarget mobile avatar assets. Requires numpy, scipy and Pillow.
Usage: python scripts/prepare_avatar.py hazmat-raw.json Xbot.glb class-a-nbc-hazmat.zip
Extract hazmat-raw.json with export_hazmat.c linked against the official ufbx source.
"""
from pathlib import Path
import json,struct,base64,math,io,zipfile,sys
import numpy as np
from scipy.spatial.transform import Rotation as R
from PIL import Image
root=Path(__file__).resolve().parents[1];raw=json.loads(Path(sys.argv[1]).read_text())
b=Path(sys.argv[2]).read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);blob=b[28+n:]
def access(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];k={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];return np.frombuffer(blob,dtype='<f4',count=a['count']*k,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,k).copy()
src=g['nodes'];sn={x.get('name',''):i for i,x in enumerate(src)};sp={c:i for i,x in enumerate(src) for c in x.get('children',[])}
def globals_at(anim=None,t=0):
 trs=[(np.array(x.get('translation',[0,0,0]),float),np.array(x.get('rotation',[0,0,0,1]),float),np.array(x.get('scale',[1,1,1]),float)) for x in src]
 if anim:
  for ch in anim['channels']:
   sam=anim['samplers'][ch['sampler']];times=access(sam['input']).ravel();vals=access(sam['output']);idx=min(len(times)-2,max(0,np.searchsorted(times,t)-1));f=np.clip((t-times[idx])/max(.000001,times[idx+1]-times[idx]),0,1);a=vals[idx];bb=vals[idx+1].copy();path=ch['target']['path'];j=ch['target']['node']
   if path=='rotation' and np.dot(a,bb)<0:bb=-bb
   val=a*(1-f)+bb*f
   if path=='rotation':val/=np.linalg.norm(val)
   slot={'translation':0,'rotation':1,'scale':2}[path];trs[j][slot][:]=val
 out={}
 def glob(i):
  if i in out:return out[i]
  p,q,s=trs[i];m=np.eye(4);m[:3,:3]=R.from_quat(q).as_matrix()*s;m[:3,3]=p;out[i]=(glob(sp[i])@m) if i in sp else m;return out[i]
 for i in range(len(src)):glob(i)
 return out
sr=globals_at();tn={v['name']:v for v in raw['nodes']};byid={v['id']:v for v in raw['nodes']}
pairs=[('pelvis','Hips'),('spine_01','Spine'),('spine_03','Spine1'),('spine_05','Spine2'),('neck_01','Neck'),('head','Head')]
for side,ss in [('l','Left'),('r','Right')]:
 pairs += [(f'clavicle_{side}',ss+'Shoulder'),(f'upperarm_{side}',ss+'Arm'),(f'lowerarm_{side}',ss+'ForeArm'),(f'hand_{side}',ss+'Hand'),(f'thigh_{side}',ss+'UpLeg'),(f'calf_{side}',ss+'Leg'),(f'foot_{side}',ss+'Foot'),(f'ball_{side}',ss+'ToeBase')]
ids={tn[name]['id']:i for i,(name,_) in enumerate(pairs)}
def parent_index(node):
 p=node['parent']
 while p not in ids and p>=0:p=byid[p]['parent']
 return ids.get(p,-1)
bind=[];parents=[]
for name,_ in pairs:
 node=tn[name];m=np.eye(4);m[:3,:]=np.array(node['world']).reshape(4,3).T;m[:3,:3]/=np.linalg.norm(m[:3,:3],axis=0);bind.append(m);parents.append(parent_index(node))
bind=np.array(bind)
def rotation(m):return R.from_matrix(m[:3,:3]/np.linalg.norm(m[:3,:3],axis=0)).as_matrix()
def align(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=np.dot(a,b)
 if c>.99999:return np.eye(3)
 if c<-.99999:return R.from_rotvec(np.array([0,1,0])*np.pi).as_matrix()
 k=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]);return np.eye(3)+k+k@k/(1+c)
source_ids=[sn['mixamorig:'+s] for _,s in pairs];alignment=[np.eye(3) for _ in pairs]
for i,(name,sname) in enumerate(pairs):
 if name.startswith(('upperarm','lowerarm','thigh','calf','foot')):
  child=next((j for j,p in enumerate(parents) if p==i),None)
  if child is not None:alignment[i]=align(bind[child,:3,3]-bind[i,:3,3],sr[source_ids[child]][:3,3]-sr[source_ids[i]][:3,3])
 if name.startswith('hand'):alignment[i]=alignment[i-1]
 if name.startswith('ball'):alignment[i]=alignment[i-1]
anims={x['name']:x for x in g['animations']}
def retarget(source):
 out=[]
 for i,(name,_) in enumerate(pairs):
  sid=source_ids[i];m=np.eye(4);m[:3,:3]=rotation(source[sid])@rotation(sr[sid]).T@alignment[i]@bind[i,:3,:3];p=parents[i]
  if p<0:
   m[:3,3]=bind[i,:3,3];m[1,3]+=(source[sid][1,3]-sr[sid][1,3])*.923
  else:m[:3,3]=out[p][:3,3]+out[p][:3,:3]@bind[p,:3,:3].T@(bind[i,:3,3]-bind[p,:3,3])
  out.append(m)
 return np.array(out)
# Keep the fingers' weighted vertices with the hand; simplify negligible twist/end bones.
meshes=[]
for mesh in raw['meshes']:
 if mesh['name']=='ClassASuit_Visor':continue # The face receives a depth-aware 2D censor in the post pass.
 verts=mesh['vertices'];packed=[];indices=[];seen={}
 for corner in mesh['corners']:
  key=tuple(corner)
  if key not in seen:
   vi,*attrs=corner;v=verts[vi];weights={}
   for node,w in v[3]:
    while node not in ids and node>=0:node=byid[node]['parent']
    bone=ids.get(node,0);weights[bone]=weights.get(bone,0)+w
   ww=sorted(weights.items(),key=lambda x:-x[1])[:2] or [(0,1)]
   if len(ww)==1:ww.append((ww[0][0],0))
   w=round(255*ww[0][1]/max(.0001,sum(x[1] for x in ww)))
   values=struct.pack('<3f3h6B2f',*v[:3],*[int(np.clip(x,-1,1)*32767) for x in attrs[:3]],127,127,127,ww[0][0],ww[1][0],w,*attrs[3:])
   seen[key]=len(packed);packed.append(values)
  indices.append(seen[key])
 meshes.append({'name':mesh['name'],'texture':'mask' if mesh['name']=='GasMask' else 'suit','vertices':base64.b64encode(b''.join(packed)).decode(),'indices':base64.b64encode(np.array(indices,dtype='<u4').tobytes()).decode(),'vertexCount':len(packed),'source':'User Class A NBC hazmat / mobile conversion'})
 print(mesh['name'],len(packed),len(indices)//3)
clips={}
for name,srcname,duration in [('idle','idle',2.5),('walk','walk',.9666666),('run','run',.7),('crouch','walk',1.3),('crouchIdle','idle',2.5)]:
 frames=[];count=max(2,round(duration*24)+1)
 for f in range(count):
  t=f/(count-1)*duration
  source=globals_at(anims[srcname],t/duration*({'walk':.9666666,'run':.7,'idle':2.5}[srcname]));pose=retarget(source)
  if name.startswith('crouch'):
   # Retarget the Mixamo sneak pose, adding the walk/idle joint deltas for locomotion.
   sneaked=retarget(globals_at(anims['sneak_pose'],.0666666));idle=retarget(globals_at(anims['idle'],0));base=pose.copy()
   for i in range(len(pairs)):
    pose[i,:3,:3]=base[i,:3,:3]@idle[i,:3,:3].T@sneaked[i,:3,:3]
    p=parents[i]
    if p<0:pose[i,:3,3]=sneaked[i,:3,3]+(base[i,:3,3]-idle[i,:3,3])*.35
    else:pose[i,:3,3]=pose[p,:3,3]+pose[p,:3,:3]@bind[p,:3,:3].T@(bind[i,:3,3]-bind[p,:3,3])
  if name.startswith('crouch'):
   old=pose.copy();pose[:,1,3]-=.23
   for side in ['l','r']:
    names=[n for n,_ in pairs];hip=names.index('thigh_'+side);knee=names.index('calf_'+side);ankle=names.index('foot_'+side);toe=names.index('ball_'+side)
    hp=pose[hip,:3,3];target=old[ankle,:3,3];d=target-hp;dist=np.linalg.norm(d);axis=d/dist
    l1=np.linalg.norm(bind[knee,:3,3]-bind[hip,:3,3]);l2=np.linalg.norm(bind[ankle,:3,3]-bind[knee,:3,3]);dist=min(dist,(l1+l2)*.999)
    along=(l1*l1-l2*l2+dist*dist)/(2*dist);out=np.sqrt(max(0,l1*l1-along*along));bend=np.array([0.,0.,1.]);bend-=axis*np.dot(bend,axis);bend/=np.linalg.norm(bend)
    kp=hp+axis*along+bend*out
    pose[hip,:3,:3]=align(old[knee,:3,3]-old[hip,:3,3],kp-hp)@pose[hip,:3,:3]
    pose[knee,:3,:3]=align(old[ankle,:3,3]-old[knee,:3,3],target-kp)@pose[knee,:3,:3];pose[knee,:3,3]=kp
    pose[ankle]=old[ankle];pose[toe]=old[toe]
  # Remove residual sliding/lift caused by differently proportioned skeletons.
  floor=min(pose[j][1,3]-bind[j][1,3] for j,(n,_) in enumerate(pairs) if n.startswith(('foot','ball')))
  pose[:,1,3]-=floor
  vals=[]
  for m in pose:vals.extend([*m[:3,3],*R.from_matrix(m[:3,:3]).as_quat()])
  frames.append(vals)
 clips[name]={'duration':duration,'frames':count,'data':base64.b64encode(np.array(frames,dtype='<f4').tobytes()).decode()}
textures={}
with zipfile.ZipFile(Path(sys.argv[3])) as z:
 for label,name in [('suit','T_ClassAHazmat_BaseColor.png'),('mask','T_GasMask01_BaseColor.png')]:
  im=Image.open(io.BytesIO(z.read('textures/'+name))).convert('RGB');im.thumbnail((1024,1024));out=io.BytesIO();im.save(out,'JPEG',quality=85,optimize=True);textures[label]='data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
asset={'bones':[n for n,_ in pairs],'parents':parents,'bind':[m.flatten(order='F').round(7).tolist() for m in bind],'inverseBind':[np.linalg.inv(m).flatten(order='F').round(7).tolist() for m in bind],'clips':clips,'meshes':meshes,'textures':textures}
(root/'client/avatar-assets.js').write_text('const AVATAR_ASSET='+json.dumps(asset,separators=(',',':'))+';\n')
print('Avatar bytes',(root/'client/avatar-assets.js').stat().st_size)
