// Compile with the official ufbx.c / ufbx.h (https://github.com/ufbx/ufbx).
// Export static FBX geometry, with source UVs, normals and material names.
#include "ufbx.h"
#include <stdio.h>
#include <stdlib.h>
int main(int argc,char **argv){
  if(argc<2)return 2;
  ufbx_load_opts opts={0};opts.target_axes=ufbx_axes_right_handed_y_up;opts.target_unit_meters=1;opts.generate_missing_normals=true;
  ufbx_error err;ufbx_scene *s=ufbx_load_file(argv[1],&opts,&err);
  if(!s){char msg[2048];ufbx_format_error(msg,sizeof(msg),&err);fputs(msg,stderr);return 1;}
  puts("[");int first=1;
  for(size_t mi=0;mi<s->meshes.count;mi++){
    ufbx_mesh *m=s->meshes.data[mi];if(!m->instances.count)continue;
    ufbx_node *n=m->instances.data[0];ufbx_matrix normal=ufbx_matrix_for_normals(&n->geometry_to_world);
    uint32_t *ix=malloc(m->max_face_triangles*3*sizeof(uint32_t));
    for(size_t pi=0;pi<m->material_parts.count;pi++){
      ufbx_mesh_part *part=&m->material_parts.data[pi];if(!part->num_triangles)continue;
      printf("%s{\"name\":\"%s\",\"material\":\"%s\",\"corners\":[",first?"":",",n->name.data,m->materials.data[part->index]->name.data);first=0;size_t count=0;
      for(size_t fi=0;fi<part->num_faces;fi++){
        ufbx_face face=m->faces.data[part->face_indices.data[fi]];uint32_t tris=ufbx_triangulate_face(ix,m->max_face_triangles*3,m,face);
        for(uint32_t ti=0;ti<tris*3;ti++){
          uint32_t at=ix[ti];ufbx_vec3 v=ufbx_transform_position(&n->geometry_to_world,ufbx_get_vertex_vec3(&m->vertex_position,at));
          ufbx_vec3 vn=ufbx_vec3_normalize(ufbx_transform_direction(&normal,ufbx_get_vertex_vec3(&m->vertex_normal,at)));ufbx_vec2 uv=ufbx_get_vertex_vec2(&m->vertex_uv,at);
          printf("%s[%.7g,%.7g,%.7g,%.6g,%.6g,%.6g,%.7g,%.7g]",count++?",":"",v.x,v.y,v.z,vn.x,vn.y,vn.z,uv.x,uv.y);
        }
      }puts("]}");
    }free(ix);
  }puts("]");ufbx_free_scene(s);return 0;
}
