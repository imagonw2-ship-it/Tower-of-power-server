import { itemSupportPoints } from './item-shapes.js';
import {equipmentSupportPoints} from './equipment-shapes.js';
export const itemRestHeight={flashlight:.0542,soda:.0352,camera:.0188,flare:.0308,gun:.018,backpack:.001};
export function dropSurface(x,z,floor,shed,ground=floor){
  const a=shed?x-shed.x:Infinity,b=shed?z-shed.z:Infinity;
  if((a>=-2.5&&a<=-.44&&b>=-.19&&b<=.79)||(a>=1.45&&a<=2.55&&b>=-1.135&&b<=-.135))return shed.y+1.06;
  if(a>=1.36&&a<=2.6&&b>=-2.45&&b<=-1.32)return shed.y+1.12;
  if(Math.abs(a)<3.05&&Math.abs(b)<2.8)return floor(x,z);
  // Match the actual 4 m triangular ground mesh, including its 15 mm offset.
  const gx=Math.floor(x/4)*4,gz=Math.floor(z/4)*4,u=(x-gx)/4,v=(z-gz)/4;
  const c=ground(gx+4,gz),d=ground(gx,gz+4);
  return (u+v<=1?ground(gx,gz)*(1-u-v)+c*u+d*v:c*(1-v)+d*(1-u)+ground(gx+4,gz+4)*(u+v-1))-.015;
}
export function itemRestPoint(point,kind,yaw,normal=[0,1,0]){
  const [x,y,z]=point,laid=kind==='backpack'?[x,y,z]:kind==='camera'?[x,-z,y]:[-y,x,z];
  const c=Math.cos(yaw),s=Math.sin(yaw),v=[laid[0]*c+laid[2]*s,laid[1],-laid[0]*s+laid[2]*c];
  // Minimal rotation from world up to the supporting surface normal.
  const ax=normal[2],az=-normal[0],den=1+normal[1];
  const w=[-az*v[1],az*v[0]-ax*v[2],ax*v[1]];
  return[v[0]+w[0]-az*w[1]/den,v[1]+w[1]+(az*w[0]-ax*w[2])/den,v[2]+w[2]+ax*w[1]/den];
}
export function droppedItemPose(p,kind,elapsed,floor,blocked,shed,ground=floor){
  const eye=[p.x,p.y,p.z],dir=[-Math.sin(p.yaw),-Math.cos(p.yaw)];let x=p.x,z=p.z;
  for(let d=.12;d<=.96;d+=.12){const nx=p.x+dir[0]*d,nz=p.z+dir[1]*d;if(blocked(eye,[nx,p.y,nz]))break;x=nx;z=nz;}
  x=p.x+(x-p.x)*.8;z=p.z+(z-p.z)*.8;
  const surface=(x,z)=>shed?dropSurface(x,z,floor,shed,ground):floor(x,z),step=.04;
  let normal=[(surface(x-step,z)-surface(x+step,z))/(step*2),1,(surface(x,z-step)-surface(x,z+step))/(step*2)];
  const length=Math.hypot(...normal);normal=normal.map(v=>v/length);
  // A table edge is not a slope; let the model's lowest support find its rest.
  if(normal[1]<.85)normal=[0,1,0];
  let y=-Infinity;
  for(const point of (equipmentSupportPoints[kind]||itemSupportPoints[kind])){const v=itemRestPoint(point,kind,p.yaw,normal);y=Math.max(y,surface(x+v[0],z+v[2])-v[1]);}
  y+=.0005;
  return{x,y,z,yaw:p.yaw,normal,dropped:true,dropAt:elapsed,dropFromY:Math.max(y,p.y-.3)};
}
