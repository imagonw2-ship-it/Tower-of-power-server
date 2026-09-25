// The imported crossarms run along local Z. Quarter-turn the towers so the
// conductors follow the corridor, and derive both cable ends from these sockets.
export const PYLON_HEADING = Math.PI / 2;
export const STATIC_PYLONS = [-445,-620,-795,-970,-1145,-1320].map((z,i)=>({x:-185,z,scale:i===0?.72:.62,heading:PYLON_HEADING}));
export const PYLON_SOCKETS = [
  [-1.591,89.665,-29.661],[.351,93.824,-29.544],[.495,102.148,-28.313],
  [-.801,82.777,36.049],[-.149,94.229,30.114],[-.643,112.898,27.716],
];
export function pylonPoint(tower,point) {
  const c=Math.cos(tower.heading),s=Math.sin(tower.heading),scale=tower.scale||1;
  return [tower.x+(point[0]*c+point[2]*s)*scale,tower.y+point[1]*scale,tower.z+(-point[0]*s+point[2]*c)*scale];
}
export function groundedPylon(tower,rig,heightAt) {
  const pose={...tower,y:0};
  // The lowest contact plane buries at most a small part of a foot on uneven
  // terrain; it cannot leave any of the four supports hovering above the soil.
  pose.y=Math.min(...rig.feet.map(p=>{const w=pylonPoint(pose,p);return heightAt(w[0],w[2])-w[1];}))-.08;
  return pose;
}
export function cablePoint(a,b,t,heightAt) {
  const span=Math.hypot(b[0]-a[0],b[2]-a[2]);
  const x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
  return [x,Math.max(heightAt(x,z)+.09,a[1]+(b[1]-a[1])*t-Math.min(12,span*.052)*4*t*(1-t)),z];
}
export const CORRIDOR_SIGNS = [
  {x:-147,z:-243,heading:Math.atan2(1,.65)},
  {x:-211,z:-234,heading:Math.atan2(.25,1)},
];

export const PYLON_RIG = {"feet":[[-15.008241653442383,0.0,-13.531598567962646],[16.8116512298584,0.0,-12.085808753967285],[-15.29408073425293,0.0,18.465094566345215],[15.616836547851562,0.0,19.969297409057617]],"hips":[[-10.21045970916748,33.0,-7.294733285903931],[9.826166152954102,33.0,-5.4003448486328125],[-8.394546031951904,33.0,10.25119161605835],[8.402820587158203,33.0,10.678690910339355]],"knees":[[-12.70530632019043,15.84,-10.537903232574463],[13.458618392944336,15.84,-8.876786079406738],[-11.982304077148438,15.84,14.522421150207519],[12.15410888671875,15.84,15.509806289672852]],"bottoms":[0.0174331646412611,0.049592941999435425,0.0,0.053768374025821686],"height":124.75720977783203};
