"""Pack Poly Haven Camera_01 glTF into the existing offline mobile mesh format.

Usage: python3 scripts/prepare_camera.py /path/to/Camera_01.gltf
CC0 original by Rajil Jose Macatangay. No engine or runtime loader required.
"""
from pathlib import Path
import base64, io, json, struct, sys
import numpy as np
from PIL import Image

source = Path(sys.argv[1]); g = json.loads(source.read_text())
buffers = [(source.parent / b['uri']).read_bytes() for b in g['buffers']]
def access(index):
    a = g['accessors'][index]; v = g['bufferViews'][a['bufferView']]
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[a['componentType']]
    return np.frombuffer(buffers[v['buffer']], dtype=dtype, count=a['count']*components,
                         offset=v.get('byteOffset', 0)+a.get('byteOffset', 0)).reshape(-1, components).copy()

# One atlas and one draw call. The loose tabletop strap is omitted from a held camera.
atlas = Image.new('RGB', (1024, 1024), (22, 31, 36))
slots = {0: (0, 512), 1: (512, 0), 2: (512, 512), 3: (0, 0)}
for index, material in enumerate(g['materials']):
    tex = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if tex:
        uri = g['images'][g['textures'][tex['index']]['source']]['uri']
        im = Image.open(source.parent/uri).convert('RGB').resize((508, 508), Image.Resampling.LANCZOS)
        x, y = slots[index]; atlas.paste(im, (x+2, y+2))

packed = []; indices = []
for primitive in g['meshes'][g['nodes'][1]['mesh']]['primitives']:
    attr = primitive['attributes']; pos = access(attr['POSITION']); normal = access(attr['NORMAL']); uv = access(attr['TEXCOORD_0'])
    x, y = slots[primitive['material']]
    uv[:, 0] = (x+2+uv[:, 0]*508)/1024
    uv[:, 1] = 1-(y+2+uv[:, 1]*508)/1024
    # Local camera: back at +Z, lens points -Z, height centered at the grip.
    pos[:, 1] -= .039; pos[:, 2] *= -1; pos[:, 0] *= -1
    normal[:, 0] *= -1; normal[:, 2] *= -1
    indices.extend((access(primitive['indices']).ravel()+len(packed)).tolist())
    for p, n, t in zip(pos, normal, uv):
        packed.append(struct.pack('<3f3h6B2f', *p, *np.clip(n*32767, -32767, 32767).astype(int), 127, 127, 127, 0, 0, 255, *t))

out = io.BytesIO(); atlas.save(out, 'JPEG', quality=86, optimize=True)
asset = {'source': 'https://polyhaven.com/a/Camera_01', 'author': 'Rajil Jose Macatangay', 'license': 'CC0',
         'vertexCount': len(packed), 'vertices': base64.b64encode(b''.join(packed)).decode(),
         'indices': base64.b64encode(np.array(indices, dtype='<u4').tobytes()).decode(),
         'texture': 'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()}
target = Path(__file__).resolve().parents[1]/'client/camera-assets.js'
target.write_text('const CAMERA_ASSET='+json.dumps(asset, separators=(',', ':'))+';\n')
print('Camera:', len(packed), 'vertices,', len(indices)//3, 'triangles,', target.stat().st_size, 'bytes')
