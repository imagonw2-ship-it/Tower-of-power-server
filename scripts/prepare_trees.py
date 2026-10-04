"""Bake three CC0 Kenney pine models into small, shared mobile meshes."""
from pathlib import Path
import json,zipfile,sys
root=Path(__file__).resolve().parents[1]
assets=[]
with zipfile.ZipFile(sys.argv[1]) as source:
 for name in ['tree_pineTallA_detailed','tree_pineTallB_detailed','tree_pineTallD_detailed']:
  vertices=[];positions=[];colors=[];indices=[];material=''
  for line in source.read('Models/OBJ format/'+name+'.obj').decode().splitlines():
   parts=line.split()
   if not parts:continue
   if parts[0]=='v':vertices.append(list(map(float,parts[1:4])))
   elif parts[0]=='usemtl':material=parts[1]
   elif parts[0]=='f':
    face=[int(p.split('/')[0])-1 for p in parts[1:]]
    color=[.23,.19,.13] if 'wood' in material.lower() else [.14,.22,.10]
    for i in range(1,len(face)-1):
     for index in [face[0],face[i],face[i+1]]:
      indices.append(len(positions)//3);positions.extend(vertices[index]);colors.extend(color)
  low=min(positions[1::3]);height=max(positions[1::3])-low
  positions=[round((v-(low if i%3==1 else 0))/height,6) for i,v in enumerate(positions)]
  assets.append(dict(name=name,positions=positions,colors=colors,indices=indices))
 (root/'client/tree-license.txt').write_bytes(source.read('License.txt'))
(root/'client/tree-assets.js').write_text('// Kenney Nature Kit, CC0. Recoloured and normalized for the field.\nconst TREE_ASSETS='+json.dumps(assets,separators=(',',':'))+';\n')
print([(a['name'],len(a['indices'])//3) for a in assets])
