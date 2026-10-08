// Two-metre triangles are shared by the renderer, feet, props and server.
const forestSmooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const FOREST_CYCLE_SECONDS=600;
export function forestRawHeight(x,z){
  const hills=5.6*Math.sin(x*.010+Math.sin(z*.004)*1.1)+4.2*Math.cos(z*.013-x*.004)+2.3*Math.sin(x*.032+z*.021)+1.4*Math.cos(z*.043-x*.017);
  const channel=(x-46-Math.sin(z*.010)*24-Math.sin(z*.025)*8)/11;
  const gully=3.8*Math.exp(-channel*channel);
  const shelf=2.8*forestSmooth(-.045,.045,Math.sin(z*.024+x*.009)+.28*Math.sin(x*.029));
  return .18+forestSmooth(13,42,Math.hypot(x,z+8))*(hills+shelf-gully);
}
export function forestTerrainHeight(x,z){
  const gx=Math.floor(x/2)*2,gz=Math.floor(z/2)*2,u=(x-gx)/2,v=(z-gz)/2;
  const b=forestRawHeight(gx+2,gz),c=forestRawHeight(gx,gz+2);
  return u+v<=1?forestRawHeight(gx,gz)*(1-u-v)+b*u+c*v:forestRawHeight(gx+2,gz+2)*(u+v-1)+b*(1-v)+c*(1-u);
}
export function forestSlope(x,z){return Math.hypot(forestTerrainHeight(x+.35,z)-forestTerrainHeight(x-.35,z),forestTerrainHeight(x,z+.35)-forestTerrainHeight(x,z-.35))/.7;}
export function forestStepAllowed(a,b){
  const d=Math.hypot(b.x-a.x,b.z-a.z);
  return forestTerrainHeight(b.x,b.z)-forestTerrainHeight(a.x,a.z)<=d*.90+.00001;
}
export function forestTrailDistance(x,z){return Math.abs(x-Math.sin(z*.012)*18-Math.sin(z*.033)*7);}
export const FOREST_TERRAIN_GLSL=`
  float forestRawHeight(vec2 p){
    float x=p.x,z=p.y;
    float hills=5.6*sin(x*.010+sin(z*.004)*1.1)+4.2*cos(z*.013-x*.004)+2.3*sin(x*.032+z*.021)+1.4*cos(z*.043-x*.017);
    float channel=(x-46.-sin(z*.010)*24.-sin(z*.025)*8.)/11.;
    float gully=3.8*exp(-channel*channel);
    float shelf=2.8*smoothstep(-.045,.045,sin(z*.024+x*.009)+.28*sin(x*.029));
    return .18+smoothstep(13.,42.,length(p+vec2(0.,8.)))*(hills+shelf-gully);
  }
  float forestHeight(vec2 p){
    vec2 g=floor(p/2.)*2.,f=(p-g)/2.;
    float b=forestRawHeight(g+vec2(2.,0.)),c=forestRawHeight(g+vec2(0.,2.));
    return f.x+f.y<=1.?forestRawHeight(g)*(1.-f.x-f.y)+b*f.x+c*f.y:forestRawHeight(g+2.)*(f.x+f.y-1.)+b*(1.-f.y)+c*(1.-f.x);
  }
`;
