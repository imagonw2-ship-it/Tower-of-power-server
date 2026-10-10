"""Pack ONE head from the supplied 8-inch GE DR6 FBX (export_prop.c JSON).
Usage: python prepare_traffic_light.py signal.json textures/
No duplicated red/amber/green display heads: lenses are switched on one mesh.
"""
from pathlib import Path
import base64, io, json, struct, sys
from PIL import Image

source=json.loads(Path(sys.argv[1]).read_text());textures=Path(sys.argv[2])
selected=[m for m in source if m['name']=='Cylinder.299']
assert len(selected)==7, 'Expected the first complete GE DR6 signal only'
scale=.2032/.19387 # Supplied nominal eight-inch lens diameter, in metres.
center=[56.599, .963, -67.477]
parts=[]
for m in selected:
    name=m['material'];kind='red' if 'red' in name else 'yellow' if 'amber' in name else 'green' if 'lens' in name else 'housing'
    color=[.39,.29,.105] if 'Aluminum' in name else [.18,.19,.17] if 'wingnuts' in name else [.035,.038,.026]
    rows=[];indices=[];unique={}
    for v in m['corners']:
        # Rotate 90 degrees around Z: red LEFT, green RIGHT, front remains +Z.
        p=[-(v[1]-center[1])*scale,(v[0]-center[0])*scale,(v[2]-center[2])*scale]
        n=[-v[4],v[3],v[5]];c=[127]*3 if kind!='housing' else [round(x*127) for x in color]
        row=struct.pack('<3f3h6B2f',*p,*[max(-32767,min(32767,round(x*32767))) for x in n],*c,0,0,255,v[6],v[7])
        if row not in unique:unique[row]=len(rows);rows.append(row)
        indices.append(unique[row])
    parts.append({'name':name,'kind':kind,'vertexCount':len(rows),'vertices':base64.b64encode(b''.join(rows)).decode(),'indices':base64.b64encode(struct.pack('<'+'I'*len(indices),*indices)).decode()})
images={}
for key,file in {'red':'8_inch_GE_red.jpg','redOff':'8_inch_GE_red_off.jpg','yellow':'8_inch_GE_amber_on.jpg','yellowOff':'8_inch_GE_amber.jpg','green':'8_inch_GE_green.jpg','greenOff':'8_inch_GE_clear.jpg'}.items():
    im=Image.open(textures/file).convert('RGB');im.thumbnail((256,256));out=io.BytesIO();im.save(out,'JPEG',quality=87,optimize=True)
    images[key]='data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
asset={'source':'User supplied 8-inch GE DR6 signals FBX; Cylinder.299 only','headCount':1,'lensDiameter':.2032,'meshes':parts,'textures':images}
path=Path(__file__).resolve().parents[1]/'client/traffic-light-assets.js';path.write_text('const TRAFFIC_LIGHT_ASSET='+json.dumps(asset,separators=(',',':'))+';\n')
print('Packed one horizontal head:',path.stat().st_size,'bytes')
