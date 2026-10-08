// Attribute-preserving offline simplification. meshoptimizer is a build-only tool.
// node simplify_prop.mjs raw.json optimized.json /path/to/meshopt_simplifier.module.js
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {MeshoptSimplifier}=await import(pathToFileURL(process.argv[4]));await MeshoptSimplifier.ready;
const parts=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),budgets=[3500,4200,2200,6500,1400,1600];
for(const [mi,p] of parts.entries()){
  const vertices=[],seen=new Map(),indices=[];
  for(const v of p.corners){const key=v.map(x=>x.toFixed(7)).join(',');let id=seen.get(key);if(id===undefined){id=vertices.length;vertices.push(v);seen.set(key,id);}indices.push(id);}
  const [tri,error]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(indices),new Float32Array(vertices.flatMap(v=>v.slice(0,3))),3,new Float32Array(vertices.flatMap(v=>v.slice(3))),5,[.25,.25,.25,4,4],null,budgets[mi]*3,.02,[]);
  p.corners=Array.from(tri,i=>vertices[i]);console.log(p.name,tri.length/3,'triangles',error);
}
fs.writeFileSync(process.argv[3],JSON.stringify(parts));
