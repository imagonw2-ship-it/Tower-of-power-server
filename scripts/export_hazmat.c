#include "ufbx.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
static void matrix(ufbx_matrix m){printf("[");for(int i=0;i<12;i++)printf("%s%.9g",i?",":"",m.v[i]);printf("]");}
int main(int argc,char**argv){
 if(argc<2)return 2;ufbx_load_opts opts={0};opts.target_axes=ufbx_axes_right_handed_y_up;opts.target_unit_meters=1;opts.generate_missing_normals=true;ufbx_error err;
 ufbx_scene*s=ufbx_load_file(argv[1],&opts,&err);if(!s){char msg[2048];ufbx_format_error(msg,sizeof(msg),&err);fputs(msg,stderr);return 1;}
 printf("{\"nodes\":[");
 for(size_t i=0;i<s->nodes.count;i++){ufbx_node*n=s->nodes.data[i];printf("%s{\"id\":%u,\"name\":\"%s\",\"parent\":%d,\"world\":",i?",":"",n->typed_id,n->name.data,n->parent?(int)n->parent->typed_id:-1);matrix(n->node_to_world);printf("}");}
 printf("],\"meshes\":[");
 for(size_t mi=0;mi<s->meshes.count;mi++){
  ufbx_mesh*m=s->meshes.data[mi];ufbx_node*n=m->instances.data[0];ufbx_skin_deformer*skin=m->skin_deformers.data[0];ufbx_matrix normal=ufbx_matrix_for_normals(&n->geometry_to_world);
  printf("%s{\"name\":\"%s\",\"material\":\"%s\",\"vertices\":[",mi?",":"",n->name.data,m->materials.data[0]->name.data);
  for(size_t vi=0;vi<m->num_vertices;vi++){
   ufbx_vec3 v=ufbx_transform_position(&n->geometry_to_world,m->vertices.data[vi]);ufbx_skin_vertex sv=skin->vertices.data[vi];
   printf("%s[%.9g,%.9g,%.9g,[",vi?",":"",v.x,v.y,v.z);
   for(size_t wi=0;wi<sv.num_weights;wi++){ufbx_skin_weight w=skin->weights.data[sv.weight_begin+wi];printf("%s[%u,%.7g]",wi?",":"",skin->clusters.data[w.cluster_index]->bone_node->typed_id,w.weight);}
   printf("]]");
  }
  printf("],\"corners\":[");uint32_t *ix=malloc(m->max_face_triangles*3*sizeof(uint32_t));size_t count=0;
  for(size_t fi=0;fi<m->faces.count;fi++){ufbx_face face=m->faces.data[fi];uint32_t tris=ufbx_triangulate_face(ix,m->max_face_triangles*3,m,face);
   for(uint32_t ti=0;ti<tris*3;ti++){
    uint32_t at=ix[ti],vi=m->vertex_indices.data[at];ufbx_vec3 vn=ufbx_transform_direction(&normal,ufbx_get_vertex_vec3(&m->vertex_normal,at));vn=ufbx_vec3_normalize(vn);ufbx_vec2 uv=ufbx_get_vertex_vec2(&m->vertex_uv,at);
    printf("%s[%u,%.7g,%.7g,%.7g,%.7g,%.7g]",count++?",":"",vi,vn.x,vn.y,vn.z,uv.x,uv.y);
   }
  }free(ix);printf("]}");
 }
 printf("]}\n");ufbx_free_scene(s);return 0;
}
