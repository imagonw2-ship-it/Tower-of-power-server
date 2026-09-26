"""Extract the uploaded hazmat's right sleeve/glove, preserving its UVs and weights."""
import base64
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / 'client/avatar-assets.js').read_text()
avatar = json.loads(source.split('=', 1)[1].strip().rstrip(';'))
mesh = next(m for m in avatar['meshes'] if m['name'] == 'ClassASuit_low')
raw = base64.b64decode(mesh['vertices'])
indices = list(struct.iter_unpack('<I', base64.b64decode(mesh['indices'])))
bones = [avatar['bones'].index(n) for n in ['upperarm_r', 'lowerarm_r', 'hand_r']]
vertices, triangles, remap = [], [], {}
for offset in range(0, len(indices), 3):
    triangle = [i[0] for i in indices[offset:offset + 3]]
    if not all(raw[i * 32 + 21] in bones for i in triangle):
        continue
    for i in triangle:
        if i not in remap:
            vertex = bytearray(raw[i * 32:(i + 1) * 32])
            vertex[21] = bones.index(vertex[21])
            vertex[22] = bones.index(vertex[22]) if vertex[22] in bones else vertex[21]
            remap[i] = len(vertices)
            vertices.append(vertex)
        triangles.append(remap[i])
asset = dict(vertices=base64.b64encode(b''.join(vertices)).decode(),
             indices=base64.b64encode(struct.pack('<' + 'I' * len(triangles), *triangles)).decode(),
             vertexCount=len(vertices), source='Uploaded hazmat / first-person sleeve and glove')
(root / 'client/pov-arms-assets.js').write_text('const POV_ARM_ASSET=' + json.dumps(asset, separators=(',', ':')) + ';\n')
print(f'First-person arm: {len(vertices)} vertices, {len(triangles)//3} triangles')
