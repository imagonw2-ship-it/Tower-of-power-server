const cameraClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createBodyCamera(){return{lean:0,pitch:0,speed:0,breath:0,yawLag:0,pitchLag:0,ground:0,vertical:0,exposure:1,turnX:0,turnY:0,previousYaw:null,previousPitch:null,previousX:null,previousZ:null};}
export function stepBodyCamera(c,input,dt){
  const {yaw,pitch,speed=0,sideways=0,ground=0,x=0,z=0,stamina=100,day=1,canopy=0,torch=false,amount=1,enabled=true}=input;
  const jump=c.previousX===null||Math.hypot(x-c.previousX,z-c.previousZ)>4||Math.abs(ground-c.ground)>4;
  const delta=c.previousYaw===null||jump?0:Math.atan2(Math.sin(yaw-c.previousYaw),Math.cos(yaw-c.previousYaw));
  const deltaPitch=c.previousPitch===null||jump?0:pitch-c.previousPitch;
  const t=cameraClamp(dt,0,.05),r=1-Math.exp(-9*t),turn=cameraClamp(delta/Math.max(.001,t),-7,7),tilt=cameraClamp(deltaPitch/Math.max(.001,t),-5,5);
  if(jump){c.ground=ground;c.yawLag=c.pitchLag=c.lean=c.pitch=c.speed=0;}
  c.previousYaw=yaw;c.previousPitch=pitch;c.previousX=x;c.previousZ=z;
  c.speed+=(speed-c.speed)*(1-Math.exp(-6*t));
  c.breath+=t*(stamina<25?2.7:1.35);
  const strength=enabled?amount:0;
  c.yawLag+=(-turn*.012*strength-c.yawLag)*r;
  c.pitchLag+=(-tilt*.010*strength-c.pitchLag)*r;
  c.lean+=(cameraClamp(-turn*.007-sideways*.018,-.05,.05)*strength-c.lean)*r;
  c.pitch+=(cameraClamp((speed-c.speed)*.014,-.035,.035)*strength-c.pitch)*r;
  c.ground+=(ground-c.ground)*(1-Math.exp(-15*t));
  c.vertical=cameraClamp(c.ground-ground,-.16,.16)*strength;
  c.turnX=cameraClamp(turn*.00055,-.003,.003)*strength;
  c.turnY=cameraClamp(tilt*.00045,-.002,.002)*strength;
  const exposure=cameraClamp(.96+(1-day)*.15+canopy*.20-(torch?.08:0),.86,1.30);
  c.exposure+=(exposure-c.exposure)*(1-Math.exp(-(exposure<c.exposure?2.8:1.1)*t));
  if(!enabled)c.yawLag=c.pitchLag=c.lean=c.pitch=c.vertical=c.turnX=c.turnY=0;
  return c;
}
