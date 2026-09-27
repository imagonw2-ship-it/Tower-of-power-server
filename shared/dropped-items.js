export const itemRestHeight={flashlight:.0542,soda:.036,camera:.043,flare:.031};
export function dropSurface(x,z,floor,shed){
  const a=x-shed.x,b=z-shed.z;
  if((a>=-2.5&&a<=-.44&&b>=-.19&&b<=.79)||(a>=1.45&&a<=2.55&&b>=-1.135&&b<=-.135))return shed.y+1.06;
  if(a>=1.36&&a<=2.6&&b>=-2.45&&b<=-1.32)return shed.y+1.12;
  return floor(x,z);
}
export function droppedItemPose(p,kind,elapsed,floor,blocked,shed){
  const eye=[p.x,p.y,p.z],dir=[-Math.sin(p.yaw),-Math.cos(p.yaw)];let x=p.x,z=p.z;
  for(let d=.12;d<=.96;d+=.12){const nx=p.x+dir[0]*d,nz=p.z+dir[1]*d;if(blocked(eye,[nx,p.y,nz]))break;x=nx;z=nz;}
  x=p.x+(x-p.x)*.8;z=p.z+(z-p.z)*.8;
  const y=dropSurface(x,z,floor,shed)+itemRestHeight[kind];
  return{x,y,z,yaw:p.yaw,dropped:true,dropAt:elapsed,dropFromY:Math.max(y,p.y-.3)};
}
