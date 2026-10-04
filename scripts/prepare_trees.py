"""Convert user-provided Blender tree packs to shared textured mobile LODs.
blender -b -t 2 --python scripts/prepare_trees.py -- SOURCE_DIR OUTPUT_DIR
"""
from pathlib import Path
import base64, json, random, struct, sys
import bpy, bmesh, numpy as np
source,output=map(Path,sys.argv[sys.argv.index('--')+1:]);output.mkdir(parents=True,exist_ok=True)
assets=[];specs=[]

def reduced_bark(vertices,uvs,faces,target,components):
    mesh=bpy.data.meshes.new('mobile-bark');mesh.from_pydata(vertices,[],faces);mesh.update()
    layer=mesh.uv_layers.new(name='UVMap')
    for p in mesh.polygons:
        for i in p.loop_indices:layer.data[i].uv=uvs[mesh.loops[i].vertex_index]
    obj=bpy.data.objects.new('mobile-bark',mesh);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('weld','WELD');mod.merge_threshold=.00001;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();pending=set(bm.verts);groups=[]
    while pending:
        group=[pending.pop()]
        for v in group:
            for edge in v.link_edges:
                n=edge.other_vert(v)
                if n in pending:pending.remove(n);group.append(n)
        groups.append(group)
    groups.sort(key=len,reverse=True);remove=[v for group in groups[components:] for v in group]
    if remove:bmesh.ops.delete(bm,geom=remove,context='VERTS')
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
    if triangles>target:
        mod=obj.modifiers.new('mobile-lod','DECIMATE');mod.ratio=target/triangles;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    mesh=obj.data;mesh.calc_loop_triangles();layer=mesh.uv_layers.active;result=[]
    for tri in mesh.loop_triangles:
        for loop in tri.loops:
            v=mesh.vertices[mesh.loops[loop].vertex_index];result.append((tuple(v.co),tuple(v.normal),tuple(layer.data[loop].uv)))
    bpy.data.objects.remove(obj,do_unlink=True);return result

def encode(bark,leaves,high):
    blob=bytearray();indices=[]
    def vertex(p,n,uv,leaf=False):
        x,y,z=p;nx,ny,nz=n;u,v=uv
        if leaf:u=max(0,min(1,u));v=max(0,min(1,v))
        else:u%=1;v%=1
        u=((512 if leaf else 0)+3+u*506)/1024;v=((512 if high else 0)+3+v*506)/1024
        blob.extend(struct.pack('<3f3h6B2f',x,z,-y,*[int(max(-1,min(1,c))*32767) for c in (nx,nz,-ny)],127,127,127,0,0,255,u,v))
    for p,n,uv in bark:indices.append(len(blob)//32);vertex(p,n,uv)
    for corners,uvs in leaves:
        n=np.cross(corners[1]-corners[0],corners[2]-corners[0]);n/=max(np.linalg.norm(n),1e-9);base=len(blob)//32
        for p,uv in zip(corners,uvs):vertex(p,n,uv,True)
        indices.extend([base,base+1,base+2,base,base+2,base+3])
    return dict(vertexCount=len(blob)//32,vertices=base64.b64encode(blob).decode(),indices=base64.b64encode(struct.pack('<%dI'%len(indices),*indices)).decode())

packs=[('low-poly-trees-free/LowPolyTrees.blend',[['Tree'],['Tree-1'],['Tree-2']],False),('realistic-trees-pack-of-2-free/Tree-Pack-of-2-Free.blend',[['Tree_Bark','Tree_Leaves'],['Tree_Bark.001','Tree_Leaves.001']],True),('more-realistic-trees-free/More Trees Free.blend',[['Tree'],['Tree.001']],True)]
for filename,groups,high in packs:
    bpy.ops.wm.open_mainfile(filepath=str(source/filename),load_ui=False,use_scripts=False)
    print('SOURCE',filename,[(o.name,len(o.data.vertices)) for o in bpy.data.objects if o.type=='MESH'],flush=True)
    images={'bark':'PineBark_diffuse.png','leaf':'Tree_Leaf_Diffuse.png','alpha':'Tree_Leaf_opacity.png'} if high else {'bark':'bark_brown_02_diff_1k.jpg','leaf':'Ivy_branch_Variation_1_Diffuse.png','alpha':'Ivy_branch_Variation_1_Opacity.png'}
    for role,name in images.items():
        image=bpy.data.images.get(name)
        if image and image.packed_file:(output/(('high' if high else 'low')+'-'+role+Path(name).suffix)).write_bytes(image.packed_file.data)
    for names in groups:
        objects=[bpy.data.objects[name] for name in names];origin=objects[0].location.copy();origin.z=0
        height=max((o.matrix_world@v.co).z for o in objects for v in o.data.vertices)
        bark_vertices=[];bark_uvs=[];bark_faces=[];islands=[]
        for obj in objects:
            mesh=obj.data;layer=mesh.uv_layers.active;positions=np.array([tuple((obj.matrix_world@v.co-origin)/height) for v in mesh.vertices])
            leaf_faces=[];parent=list(range(len(positions)))
            def find(i):
                while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
                return i
            for face in mesh.polygons:
                leaf=any(word in mesh.materials[face.material_index].name.lower() for word in ['leaf','leaves'])
                if leaf:
                    leaf_faces.append(face);root=find(face.vertices[0])
                    for i in face.vertices[1:]:parent[find(i)]=root
                else:
                    indices=[]
                    for loop in face.loop_indices:
                        indices.append(len(bark_vertices));bark_vertices.append(tuple(positions[mesh.loops[loop].vertex_index]));bark_uvs.append(tuple(layer.data[loop].uv))
                    bark_faces.append(indices)
            parts={}
            for face in leaf_faces:
                points=parts.setdefault(find(face.vertices[0]),{})
                for loop in face.loop_indices:
                    index=mesh.loops[loop].vertex_index;points[index]=(positions[index],tuple(layer.data[loop].uv))
            for points in parts.values():
                coords=np.array([x[0] for x in points.values()]);uv=np.array([x[1] for x in points.values()]);lower=uv.min(axis=0);upper=uv.max(axis=0)
                if np.prod(upper-lower)<1e-10:continue
                fit=np.linalg.lstsq(np.column_stack([uv,np.ones(len(uv))]),coords,rcond=None)[0]
                quad_uv=np.array([[lower[0],lower[1]],[upper[0],lower[1]],[upper[0],upper[1]],[lower[0],upper[1]]]);quad=np.column_stack([quad_uv,np.ones(4)])@fit
                if np.linalg.norm(np.cross(quad[1]-quad[0],quad[2]-quad[0]))<1e-12:continue
                islands.append((quad,quad_uv))
        order=list(range(len(islands)));random.Random(701+len(assets)).shuffle(order);lods=[]
        for lod in range(2):
            bark=reduced_bark(bark_vertices,bark_uvs,bark_faces,(1000 if high else 600) if lod==0 else (160 if high else 140),12 if lod==0 else 3)
            limit=(3200 if high else 1000) if lod==0 else (380 if high else 120);keep=min(len(order),limit);spread=min(4.4,max(1,(len(order)/max(keep,1))**.4));leaves=[]
            for index in order[:keep]:
                p,uv=islands[index];center=p.mean(axis=0);leaves.append((center+(p-center)*spread,uv))
            lods.append(encode(bark,leaves,high))
        specs.append({'radius':.045 if high else .012,'minHeight':11 if high else 9,'maxHeight':21 if high else 17});assets.append(dict(name=Path(filename).stem+' / '+names[0],lods=lods))
        print('BAKED',names,'height',height,'leaves',len(islands),'triangles',[len(base64.b64decode(x['indices']))//12 for x in lods],flush=True)
(output/'models.json').write_text(json.dumps(assets,separators=(',',':')));(output/'shapes.json').write_text(json.dumps(specs,separators=(',',':')))
