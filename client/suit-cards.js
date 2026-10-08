// Bone-mounted IDs are composited after VHS, with scene-depth occlusion.
// Their whole rectangle follows the camera warp; printed details stay clear.
const suitCards=new Map(),suitCardDraws=[];
let suitPortrait=null,suitPortraitReady=false,suitCardProgram=null;
const SUIT_CARD={width:.142,height:.089,center:[-.072,1.35,.216]};
function clearSuitCards(){for(const c of suitCards.values())gl.deleteTexture(c.texture);suitCards.clear();}
function makeSuitCard(player){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=640;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  if(!suitPortrait){suitPortrait=new Image();suitPortrait.onload=()=>{suitPortraitReady=true;clearSuitCards();};suitPortrait.src=SUIT_PORTRAIT;}
  ctx.fillStyle='#e7e8df';ctx.fillRect(0,0,1024,640);
  ctx.fillStyle='#19211e';ctx.fillRect(0,0,1024,104);ctx.fillStyle='#f4f5ed';ctx.font='bold 48px sans-serif';ctx.fillText('TOWER OF POWER',36,70);
  ctx.fillStyle='#3a4240';ctx.fillRect(34,137,260,448);if(suitPortraitReady)ctx.drawImage(suitPortrait,34,137,260,448);
  ctx.fillStyle='#202622';ctx.font='bold 38px sans-serif';ctx.fillText('FIELD CREW',330,198);
  const name=String(player.username||'GUEST').slice(0,20);let size=88;ctx.font='bold '+size+'px sans-serif';
  while(size>30&&ctx.measureText(name).width>656)ctx.font='bold '+(--size)+'px sans-serif';
  ctx.fillText(name,330,302);
  const id=String(player.id||'guest').replace(/[^a-zA-Z0-9]/g,'').slice(-8).toUpperCase();ctx.font='40px monospace';ctx.fillText('ID '+id,330,408);
  ctx.fillStyle='#858e83';ctx.fillRect(330,458,656,2);ctx.fillStyle='#262d28';ctx.font='36px sans-serif';ctx.fillText('AUTHORIZED PERSONNEL',330,548);
  ctx.strokeStyle='#747e71';ctx.lineWidth=8;ctx.strokeRect(4,4,1016,632);
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);
  const result={texture,name:player.username};suitCards.set(player.id,result);return result;
}
function appendSuitCard(player,root,bones,distance){
  if(distance>16)return;
  let card=suitCards.get(player.id);if(card?.name!==player.username){if(card)gl.deleteTexture(card.texture);card=makeSuitCard(player);}if(!card)return;
  const chest=AVATAR_ASSET.bones.indexOf('spine_03'),skin=bones.subarray(chest*16,chest*16+16),{width,height,center}=SUIT_CARD;
  const mount=new Float32Array([width,0,width*.32,0,0,height,height*.14,0,0,0,1,0,...center,1]),model=multiply(multiply(root,skin),mount);
  if((cameraPosition[0]-model[12])*model[8]+(cameraPosition[1]-model[13])*model[9]+(cameraPosition[2]-model[14])*model[10]<=0)return;
  const m=multiply(viewProjection,model),bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const x of [-.5,.5])for(const y of [-.5,.5]){
    const w=m[3]*x+m[7]*y+m[15];if(w<=.06)return;
    const sx=(m[0]*x+m[4]*y+m[12])/w,sy=(m[1]*x+m[5]*y+m[13])/w;
    bounds[0]=Math.min(bounds[0],sx-.075);bounds[1]=Math.min(bounds[1],sy-.035);bounds[2]=Math.max(bounds[2],sx+.075);bounds[3]=Math.max(bounds[3],sy+.035);
  }
  if(bounds[2]<-1||bounds[0]>1||bounds[3]<-1||bounds[1]>1)return;
  const a=m[0],b=m[4],c=m[12],d=m[1],e=m[5],f=m[13],g=m[3],h=m[7],i=m[15],det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  if(Math.abs(det)<1e-12)return;
  const inv=new Float32Array([e*i-f*h,f*g-d*i,d*h-e*g,c*h-b*i,a*i-c*g,b*g-a*h,b*f-c*e,c*d-a*f,a*e-b*d].map(v=>v/det));
  suitCardDraws.push({texture:card.texture,model,m,inv,bounds,distance});
}
function cardCameraWarp(uv){
  const x=uv[0]-.5,y=uv[1]-.5,curve=1+(x*x+y*y)*cameraLensStrength(),v=.5+y*curve;
  let u=.5+x*curve;const n=Math.sin(Math.floor(v*240)*127.1+Math.floor(time*24)*311.7)*43758.5453,line=n-Math.floor(n);
  const d=Math.abs(v-(time*.055-Math.floor(time*.055))),t=clamp((d-.002)/.013,0,1),roll=1-t*t*(3-2*t);
  u+=(line-.5)*.004*cameraTapeAmount()+roll*Math.sin(time*4)*.015*cameraTapeAmount()+Math.sin(v*19+time*.8)*.0014*cameraTapeAmount();
  return[u,v];
}
function suitCardWarpOffset(m){
  const raw=[m[12]/m[15]*.5+.5,m[13]/m[15]*.5+.5],screen=raw.slice();
  for(let i=0;i<4;i++){const warped=cardCameraWarp(screen);screen[0]+=raw[0]-warped[0];screen[1]+=raw[1]-warped[1];}
  return[raw[0]-screen[0],raw[1]-screen[1]];
}
function buildSuitCardProgram(){
  suitCardProgram=makeProgram('Clear suit IDs',`precision highp float;
    uniform vec4 u_bounds;
    void main(){vec2 p=vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1));gl_Position=vec4(mix(u_bounds.xy,u_bounds.zw,p),0.,1.);}
  `,`precision highp float;
    uniform sampler2D u_card;uniform highp sampler2D u_sceneDepth;
    uniform mat3 u_inverse;uniform vec3 u_z,u_w;uniform vec2 u_texel,u_warpOffset;
    uniform float u_brightness,u_fade;out vec4 color;
    void main(){
      vec2 uv=gl_FragCoord.xy*u_texel+u_warpOffset;vec3 p=u_inverse*vec3(uv*2.-1.,1.);vec2 local=p.xy/p.z;
      if(any(greaterThan(abs(local),vec2(.5))))discard;
      vec3 plane=vec3(local,1.);float depth=dot(u_z,plane)/dot(u_w,plane)*.5+.5;
      if(depth>texture(u_sceneDepth,uv).r+.0000005)discard;
      color=vec4(texture(u_card,local+.5).rgb*u_brightness*(1.-u_fade),1.);
    }
  `);
}
function drawSuitCards(){
  if(!suitCardDraws.length||isMenuScene()||game.mode==='loading')return;
  gl.useProgram(suitCardProgram.p);gl.bindVertexArray(skyVAO);const u=suitCardProgram.uniforms;
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,sceneTarget.depth);gl.uniform1i(u.u_sceneDepth,1);gl.uniform1i(u.u_card,0);
  gl.uniform2f(u.u_texel,1/canvas.width,1/canvas.height);gl.uniform1f(u.u_brightness,.56+.44*world.day);gl.uniform1f(u.u_fade,game.fadeIn);
  suitCardDraws.sort((a,b)=>b.distance-a.distance);
  for(const c of suitCardDraws){
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,c.texture);gl.uniform2fv(u.u_warpOffset,suitCardWarpOffset(c.m));
    gl.uniform4fv(u.u_bounds,c.bounds);gl.uniformMatrix3fv(u.u_inverse,false,c.inv);gl.uniform3f(u.u_z,c.m[2],c.m[6],c.m[14]);gl.uniform3f(u.u_w,c.m[3],c.m[7],c.m[15]);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
}
