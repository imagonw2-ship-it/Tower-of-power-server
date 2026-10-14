"""Cut a real top opening in the supplied pack while preserving its UVs.

Clip triangles at the zipper seam instead of assigning whole triangles by their
centres. Keep complete carry handles, shoulder straps and front pockets attached.
The cut contour also defines the recessed fabric lining in the game renderer.
Safe to rerun after prepare_equipment.py; original uploads stay untouched.
"""
import base64
import json
import struct
import sys
from collections import defaultdict
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'client/backpack-assets.js'
asset = json.loads(path.read_text().split('=', 1)[1].strip().removesuffix(';'))
if asset.get('openingVersion') == 2:
    print('Backpack zipper cut and lining contour are already current')
    sys.exit(0)
layout = struct.Struct('<3f3h6B2f')
triangles = []
for mesh in asset['meshes']:
    raw = base64.b64decode(mesh['vertices'])
    vertices = [layout.unpack_from(raw, i * 32) for i in range(mesh['vertexCount'])]
    raw_indices = base64.b64decode(mesh['indices'])
    indices = struct.unpack('<' + 'I' * (len(raw_indices) // 4), raw_indices)
    triangles.extend([vertices[i] for i in indices[j:j + 3]] for j in range(0, len(indices), 3))

# Position welding finds pieces even when texture seams duplicate their vertices.
parents = {}
def point(v):
    return tuple(round(c, 5) for c in v[:3])
def root(p):
    parents.setdefault(p, p)
    while parents[p] != p:
        parents[p] = parents[parents[p]]
        p = parents[p]
    return p
for tri in triangles:
    for v in tri[1:]:
        parents[root(point(v))] = root(point(tri[0]))
groups = defaultdict(list)
for tri in triangles:
    groups[root(point(tri[0]))].append(tri)
shell = max(groups.values(), key=len)
seam, back = .398, -.075

def interpolate(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))
def clip(poly, axis, value, positive):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        da, db = (a[axis] - value) * positive, (b[axis] - value) * positive
        if da >= 0:
            out.append(a)
        if (da > 0 and db < 0) or (da < 0 and db > 0):
            out.append(interpolate(a, b, da / (da - db)))
    return out
parts = {'body': [], 'top': []}
def append(name, polygon):
    for i in range(1, len(polygon) - 1):
        parts[name].extend([polygon[0], polygon[i], polygon[i + 1]])

contour = []
for group in groups.values():
    positions = [v[:3] for tri in group for v in tri]
    lo = [min(v[k] for v in positions) for k in range(3)]
    hi = [max(v[k] for v in positions) for k in range(3)]
    carry_handle = lo[1] > .40 and hi[1] > .455 and lo[2] > -.035 and hi[2] < .065 and hi[0] - lo[0] > .20
    fixed = carry_handle or lo[2] < -.14 or hi[1] <= seam
    for tri in group:
        if fixed:
            append('body', tri)
            continue
        below = clip(tri, 1, seam, -1)
        above = clip(tri, 1, seam, 1)
        append('body', below)
        append('body', clip(above, 2, back, -1))
        append('top', clip(above, 2, back, 1))
        if group is shell:
            for a, b in zip(tri, tri[1:] + tri[:1]):
                if (a[1] < seam <= b[1]) or (b[1] < seam <= a[1]):
                    v = interpolate(a, b, (seam - a[1]) / (b[1] - a[1]))
                    contour.append((round(v[0], 6), round(v[2], 6)))

# A convex contour follows the rounded shell and closes tiny zipper seam gaps.
def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
points = sorted(set(contour))
halves = []
for sequence in (points, list(reversed(points))):
    half = []
    for p in sequence:
        while len(half) >= 2 and cross(half[-2], half[-1], p) <= 0:
            half.pop()
        half.append(p)
    halves.append(half[:-1])
rim = clip([(x, seam, z) for x, z in halves[0] + halves[1]], 2, back, 1)

meshes = []
for name, rows in parts.items():
    unique, vertices, indices = {}, [], []
    for row in rows:
        packed = layout.pack(*row[:3], *[round(x) for x in row[3:12]], *row[12:])
        if packed not in unique:
            unique[packed] = len(vertices)
            vertices.append(packed)
        indices.append(unique[packed])
    meshes.append({'name': name, 'vertexCount': len(vertices), 'vertices': base64.b64encode(b''.join(vertices)).decode(), 'indices': base64.b64encode(struct.pack('<' + 'I' * len(indices), *indices)).decode()})
asset.pop('screen', None)
asset.update(meshes=meshes, hinge=[0, seam, back], openingAngle=-1.48, handle=[-.035, .482, -.003], openingRim=rim, openingVersion=2)
path.write_text('const BACKPACK_ASSET=' + json.dumps(asset, separators=(',', ':')) + ';\n')
print('Top-opening backpack:', [(m['name'], m['vertexCount']) for m in meshes], 'rim:', len(rim))
