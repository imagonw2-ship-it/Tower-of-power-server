// Identical resource and lure rules in the browser and authoritative server.
export function spendStamina(p,wantsSprint,dt){
  if(p.infiniteSprint){p.stamina=100;p.staminaDelay=0;p.exhausted=false;return !!wantsSprint;}
  p.stamina=Number.isFinite(p.stamina)?p.stamina:100;
  p.staminaDelay=Math.max(0,(p.staminaDelay||0)-dt);
  if(p.exhausted&&p.stamina>=24)p.exhausted=false;
  const sprint=wantsSprint&&!p.exhausted&&p.stamina>0;
  if(sprint){p.stamina=Math.max(0,p.stamina-12.5*dt);p.staminaDelay=1.15;if(p.stamina===0)p.exhausted=true;}
  else if(p.staminaDelay===0)p.stamina=Math.min(100,p.stamina+18*dt);
  return sprint;
}
export function spawnFlare(p,id,blocked){
  const cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),sy=Math.sin(p.yaw),cy=Math.cos(p.yaw);
  const forward=[-sy*cp,sp,-cy*cp],right=[cy,0,-sy],up=[sy*sp,cp,cy*sp];
  // Server-owned muzzle offset, matching the equipped launcher model. Never
  // accept projectile positions/velocities or ammunition from a client.
  const eye=[p.x,p.y,p.z],muzzle=eye.map((v,i)=>v+right[i]*.22-up[i]*.011+forward[i]*.804);
  if(blocked?.(eye,muzzle))for(let i=0;i<3;i++)muzzle[i]=eye[i];
  const aim=forward.map((v,i)=>v*40+([p.x,p.y,p.z][i]-muzzle[i])),length=Math.hypot(...aim);
  return{id,owner:p.id||'local',x:muzzle[0],y:muzzle[1],z:muzzle[2],vx:aim[0]/length*26,vy:aim[1]/length*26+4.5,vz:aim[2]/length*26,age:0,life:12,landed:false};
}
export function advanceFlares(flares,dt,heightAt,blocked){
  for(const f of flares){
    f.age+=dt;f.life=Math.max(0,f.life-dt);
    if(!f.landed){
      const count=Math.max(1,Math.ceil(dt/.02)),step=dt/count;
      for(let i=0;i<count;i++){
        const from=[f.x,f.y,f.z],to=[f.x+f.vx*step,f.y+f.vy*step,f.z+f.vz*step];
        if(blocked&&blocked(from,to)){f.landed=true;f.vx=f.vy=f.vz=0;break;}
        [f.x,f.y,f.z]=to;f.vy-=7*step;
        const floor=heightAt(f.x,f.z)+.09;
        if(f.y<=floor){f.y=floor;f.landed=true;f.vx=f.vy=f.vz=0;break;}
      }
    }
  }
  return flares.filter(f=>f.life>0);
}
export function applyFlareLure(state,body,flares,dt,power=false){
  state.anger=Math.max(0,(state.anger||0)-dt);
  const current=flares.find(f=>f.id===state.lureId&&f.life>0&&Math.hypot(f.x-body.x,f.z-body.z)<185);
  const lure=current||flares.find(f=>f.life>0&&Math.hypot(f.x-body.x,f.z-body.z)<160);
  if(lure){
    state.lureId=lure.id;state.targetId=null;state.heardVelocity=[0,0];state.attack=null;
    state.noise=power?[lure.x,lure.z]:{position:[lure.x,lure.z],life:.3};
    return true;
  }
  if(state.lureId){
    state.lureId=null;state.anger=18;state.targetId=null;state.heardVelocity=[0,0];
    state.noise=null;state.memoryAge=99;state.navAge=0;
    if(state.state==='running'){state.state='searching';state.clock=0;}
  }
  return false;
}
