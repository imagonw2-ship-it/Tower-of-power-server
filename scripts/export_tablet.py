import struct,re,json
from pathlib import Path
import sys,base64,numpy as np
p=Path(sys.argv[1])
data=p.read_bytes();blocks=[];pos=12
while pos+24<=len(data):
 code,size,addr,sdna,count=struct.unpack_from('<4sIQII',data,pos);pos+=24
 blocks.append(dict(code=code.decode(errors='replace'),size=size,addr=addr,sdna=sdna,count=count,data=data[pos:pos+size]));pos+=size
 if code==b'ENDB':break
D=next(b['data'] for b in blocks if b['code']=='DNA1');o=8
n=struct.unpack_from('<I',D,o)[0];o+=4;names=[]
for i in range(n):
 end=D.index(b'\0',o);names.append(D[o:end].decode());o=end+1
o=(o+3)&~3;assert D[o:o+4]==b'TYPE';o+=4;n=struct.unpack_from('<I',D,o)[0];o+=4;types=[]
for i in range(n):
 end=D.index(b'\0',o);types.append(D[o:end].decode());o=end+1
o=(o+3)&~3;assert D[o:o+4]==b'TLEN';o+=4;lens=struct.unpack_from('<'+'H'*n,D,o);o+=n*2;o=(o+3)&~3;assert D[o:o+4]==b'STRC';o+=4;n=struct.unpack_from('<I',D,o)[0];o+=4;structs=[]
for i in range(n):
 ti,nf=struct.unpack_from('<HH',D,o);o+=4;fields={};off=0
 for j in range(nf):
  ft,fn=struct.unpack_from('<HH',D,o);o+=4;name=names[fn];num=1
  for v in re.findall(r'\[(\d+)\]',name):num*=int(v)
  pointer='*' in name;size=(8 if pointer else lens[ft])*num
  key=re.sub(r'[\*\(\)]','',name).split('[')[0];fields[key]=(off,types[ft],num,pointer);off+=size
 structs.append((types[ti],fields,lens[ti]))
bytype={s[0]:s for s in structs};addresses={b['addr']:b for b in blocks}
def read(ty,raw,key):
 off,ft,num,ptr=bytype[ty][1][key]
 if ptr:return struct.unpack_from('<Q',raw,off)[0]
 codes={'float':'f','double':'d','int':'i','short':'h','char':'b','uchar':'B','ushort':'H','uint':'I','int64_t':'q','uint64_t':'Q'}
 if ft in codes:
  if ft=='char' and num>1:return raw[off:off+num].split(b'\0')[0].decode(errors='replace')
  vals=struct.unpack_from('<'+codes[ft]*num,raw,off);return vals[0] if num==1 else vals
 return raw[off:off+bytype[ft][2]*num]
def objects(ty):
 for b in blocks:
  if structs[b['sdna']][0]==ty:
   size=bytype[ty][2]
   for i in range(b['count']):yield b['data'][i*size:(i+1)*size]
def deref(addr,ty=None):
 b=addresses.get(addr)
 if not b:return []
 ty=ty or structs[b['sdna']][0];size=bytype[ty][2]
 return [b['data'][i:i+size] for i in range(0,len(b['data']),size)]

# The supplied Blender 2.93 model uses Z up and -Y for its display face.
# Read the SDNA mesh records directly; no external textures were included.
models=[];scale=.64/3.5163169
palette={'ekran':(.018,.028,.025),'korpus':(.11,.135,.125),'korpus2':(.032,.046,.04),'Text':(.25,.28,.24),'zadsten':(.065,.08,.073)}
for ob in objects('Object'):
 if read('Object',ob,'type')!=1:continue
 name=read('ID',read('Object',ob,'id'),'name')[2:]
 me=deref(read('Object',ob,'data'),'Mesh')[0]
 matrix=np.array(read('Object',ob,'obmat')).reshape(4,4).T
 verts=np.array([read('MVert',v,'co') for v in deref(read('Mesh',me,'mvert'),'MVert')])
 verts=np.column_stack([verts,np.ones(len(verts))])@matrix.T
 verts=np.column_stack([verts[:,0],verts[:,2]+.03447,-verts[:,1]])*scale
 loops=[read('MLoop',v,'v') for v in deref(read('Mesh',me,'mloop'),'MLoop')]
 raw=bytearray();indices=[];count=0
 for poly in deref(read('Mesh',me,'mpoly'),'MPoly'):
  first=read('MPoly',poly,'loopstart');n=read('MPoly',poly,'totloop');vs=verts[[loops[first+i] for i in range(n)]]
  normal=np.cross(vs[1]-vs[0],vs[2]-vs[0]);normal/=max(np.linalg.norm(normal),1e-9)
  for v in vs:raw+=struct.pack('<3f3h3B3B2f',*v,*[int(x*32767) for x in normal],*[round(x*127) for x in palette[name]],0,0,255,0.,0.)
  for i in range(1,n-1):indices.extend([count,count+i,count+i+1])
  count+=n
 models.append({'name':name,'vertexCount':count,'vertices':base64.b64encode(raw).decode(),'indices':base64.b64encode(struct.pack('<'+'I'*len(indices),*indices)).decode()})
Path(sys.argv[2]).write_text('const TABLET_ASSET='+json.dumps({'meshes':models,'screen':[-1.58*scale,(-1.16+.03447)*scale,1.58*scale,(1.09+.03447)*scale,.0124]},separators=(',',':'))+';\n')
print('Exported supplied tablet:',sum(m['vertexCount'] for m in models),'vertices')
