"""Re-segment the supplied, already packed backpack without changing UVs.

The front pockets remain sewn to the body. Only the small zippered top cap
opens. Safe to rerun after prepare_equipment.py; no original upload is changed.
"""
import base64, json, struct
from pathlib import Path

path=Path(__file__).resolve().parents[1]/'client/backpack-assets.js'
asset=json.loads(path.read_text().removeprefix('const BACKPACK_ASSET=').strip().removesuffix(';'))
parts={'body':[], 'top':[]}
for mesh in asset['meshes']:
    raw=base64.b64decode(mesh['vertices'])
    indices=struct.unpack('<'+'I'*(len(base64.b64decode(mesh['indices']))//4),base64.b64decode(mesh['indices']))
    for offset in range(0,len(indices),3):
        vertices=[raw[i*32:i*32+32] for i in indices[offset:offset+3]]
        points=[struct.unpack_from('<3f',v) for v in vertices]
        cx=sum(p[0] for p in points)/3;cy=sum(p[1] for p in points)/3;cz=sum(p[2] for p in points)/3
        handle=cy>.462 and abs(cx)<.085 and cz<.025
        parts['top' if .398<cy<.49 and cz>-.065 and not handle else 'body'].extend(vertices)
meshes=[]
for name,rows in parts.items():
    unique={};vertices=[];indices=[]
    for row in rows:
        if row not in unique:unique[row]=len(vertices);vertices.append(row)
        indices.append(unique[row])
    meshes.append({'name':name,'vertexCount':len(vertices),'vertices':base64.b64encode(b''.join(vertices)).decode(),'indices':base64.b64encode(struct.pack('<'+'I'*len(indices),*indices)).decode()})
asset.update(meshes=meshes,hinge=[0,.398,-.065],openingAngle=-.42,handle=[-.035,.482,-.003],screen=[-.142,-.09,.142,.20,.434])
path.write_text('const BACKPACK_ASSET='+json.dumps(asset,separators=(',',':'))+';\n')
print('Top-opening backpack:',[(m['name'],m['vertexCount']) for m in meshes])
