// Shared by the offline game and the authoritative server. No rendering or DOM.
const combatClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const combatMix = (a, b, t) => a + (b - a) * t;
const combatEase = t => t * t * (3 - 2 * t);

export class SoundTargets {
  constructor() { this.reset(); }
  reset() { this.time = 0; this.tracks = new Map(); this.id = null; this.since = 0; this.revision = -1; }
  hear(player, radius, body, dormant, blocked = false) {
    const distance = Math.hypot(player.x - body.x, player.z - body.z);
    if (!player.alive || distance > radius * (blocked ? .6 : 1) * dormant) return;
    const old = this.tracks.get(player.id);
    const track=old?{sample:[old.x,old.z],sampleTime:old.heard,heardVelocity:old.velocity}:{};
    rememberSoundMotion(track,[player.x,player.z],this.time);
    this.tracks.set(player.id, { id: player.id, x: player.x, z: player.z,
      velocity:track.heardVelocity, heard: this.time, ignoreUntil: old?.ignoreUntil || 0, revision: (old?.revision || 0) + 1 });
  }
  step(dt, players, body, canReach = () => true) {
    this.time += dt;
    const valid = new Set(players.filter(p => p.alive).map(p => p.id));
    for (const [id, t] of this.tracks) {
      if (!valid.has(id) || this.time - t.heard > 8 || Math.hypot(t.x - body.x, t.z - body.z) > 260)
        this.tracks.delete(id);
    }
    let current = this.tracks.get(this.id);
    const candidates = [...this.tracks.values()].filter(t => this.time - t.heard < 2.5 && this.time >= (t.ignoreUntil || 0))
      .sort((a, b) => Math.hypot(a.x - body.x, a.z - body.z) - Math.hypot(b.x - body.x, b.z - body.z) || a.id.localeCompare(b.id));
    // Eight seconds of silence ends pursuit. Never follow an unseen live position.
    // After a firm commitment, a much closer recent sound can replace a stale one.
    const challenger = candidates[0];
    // A sound inside a shelter can be investigated, but cannot monopolize the
    // monster forever when another reachable player is making noise outside.
    if(current && this.time-this.since>6 && !canReach(current)){
      const reachable=candidates.find(t=>t.id!==this.id&&canReach(t));
      if(reachable){current.ignoreUntil=this.time+6;current=reachable;this.id=current.id;this.since=this.time;this.revision=-1;}
    }
    if (!current || (challenger && challenger.id !== this.id && this.time - this.since > 6 &&
        this.time - current.heard > 3 &&
        Math.hypot(challenger.x - body.x, challenger.z - body.z) + 18 < Math.hypot(current.x - body.x, current.z - body.z))) {
      current = challenger || null;
      if (this.id !== current?.id) { this.id = current?.id || null; this.since = this.time; this.revision = -1; }
    }
    const fresh = !!current && current.revision !== this.revision;
    if (current) this.revision = current.revision;
    return { id: this.id, fresh, position: current ? [current.x, current.z] : null,
      velocity:current?.velocity||[0,0], age: current ? this.time - current.heard : Infinity };
  }
}

// Prediction uses successive audible locations, never a silent player's live velocity.
export function rememberSoundMotion(state, position, now) {
  const dt=now-(state.sampleTime??-99),old=state.sample;
  let velocity=[0,0];
  if(old&&dt>.04&&dt<2.5){
    velocity=position.map((v,i)=>(v-old[i])/dt);
    const speed=Math.hypot(...velocity);if(speed>16)velocity=velocity.map(v=>v*16/speed);
    velocity=velocity.map((v,i)=>combatMix(state.heardVelocity?.[i]||0,v,.72));
  }
  state.heardVelocity=velocity;state.sample=position.slice();state.sampleTime=now;
}
export function constrainTurbineFoot(body,state,index,point) {
  const nominal=(state.heading||0)+index*Math.PI*2/3;
  const dx=point[0]-body.x,dz=point[2]-body.z;
  const offset=Math.atan2(Math.sin(Math.atan2(dx,dz)-nominal),Math.cos(Math.atan2(dx,dz)-nominal));
  const angle=nominal+combatClamp(offset,-.82,.82),r=combatClamp(Math.hypot(dx,dz),12,68);
  return [body.x+Math.sin(angle)*r,point[1],body.z+Math.cos(angle)*r];
}
export function constrainTurbineFeet(body,state){
  for(let i=0;i<state.feet.length;i++){
    const f=state.feet[i];f.position=constrainTurbineFoot(body,state,i,f.position);
    if(f.target)f.target=constrainTurbineFoot(body,state,i,f.target);
  }
}

export function turbineLegPoints(body, state, index, heightAt) {
  const a = state.heading + index * Math.PI * 2 / 3, dx = Math.sin(a), dz = Math.cos(a);
  const progress = combatClamp((state.awake - (.65 + index * .55)) / 2.6, 0, 1);
  const u = combatEase(progress), ground = heightAt(body.x, body.z);
  const radius = combatMix(17, 53, u), extracting = !state.feet[index];
  const foot = state.feet[index] ? constrainTurbineFoot(body,state,index,state.feet[index].position) : [body.x + dx * radius,
    combatMix(ground - 8, heightAt(body.x + dx * radius, body.z + dz * radius) + .10, u) + Math.sin(progress * Math.PI) * 14,
    body.z + dz * radius];
  const hip = [body.x + dx * 4, body.y + 1, body.z + dz * 4];
  const reach = Math.hypot(foot[0] - hip[0], foot[2] - hip[2]) || 1;
  const radial = [(foot[0] - hip[0]) / reach, 0, (foot[2] - hip[2]) / reach];
  const swing = Math.sin((state.feet[index]?.progress ?? progress) * Math.PI);
  const at = (r, y) => [hip[0] + radial[0] * reach * r, y, hip[2] + radial[2] * reach * r];
  const points = [hip, at(.30, body.y + 15 - state.crouch * 7 + swing * 2),
    at(.78, foot[1] + 20 + (body.y - ground) * .12), at(.965, foot[1] + 6.4), [foot[0], foot[1] - .24, foot[2]]];
  if (extracting) for (let i = 0; i < 4; i++) points[i][1] = combatMix(heightAt(points[i][0], points[i][2]) - 9, points[i][1], u);
  return { points, radial, progress };
}

export function pylonLegPoints(body, rig, index) {
  const c = Math.cos(body.heading), s = Math.sin(body.heading);
  const world = v => [body.x + v[0] * c + v[2] * s, body.y + v[1], body.z - v[0] * s + v[2] * c];
  const local = v => [(v[0] - body.x) * c - (v[2] - body.z) * s, v[1] - body.y, (v[0] - body.x) * s + (v[2] - body.z) * c];
  const hip = rig.hips[index], knee = rig.knees[index], rest = rig.feet[index];
  if (!body.rigBlend) return [world(hip), world(knee), world(rest)];
  const foot = local(body.feet[index].position), delta = foot.map((v, k) => v - hip[k]), distance = Math.hypot(...delta) || 1;
  const direction = delta.map(v => v / distance);
  const l1 = Math.hypot(...knee.map((v, k) => v - hip[k])), l2 = Math.hypot(...rest.map((v, k) => v - knee[k]));
  const reach = Math.min(distance, (l1 + l2) * .998), along = (l1*l1 - l2*l2 + reach*reach)/(2*reach);
  const out = Math.sqrt(Math.max(0, l1*l1 - along*along)), bendLength = Math.hypot(rest[0],rest[2]) || 1;
  const bend = [rest[0]/bendLength, 0, rest[2]/bendLength], dot = bend.reduce((n,v,k)=>n+v*direction[k],0);
  const side = bend.map((v,k)=>v-direction[k]*dot), length = Math.hypot(...side) || 1;
  const posed = hip.map((v,k)=>v+direction[k]*along+side[k]/length*out);
  const blend = body.rigBlend;
  return [world(hip), world(knee.map((v,k)=>combatMix(v,posed[k],blend))), world(rest.map((v,k)=>combatMix(v,foot[k],blend)))];
}

export function legColliders(turbine, enemy, power, rig, heightAt) {
  const segments = [], add = (points, radii) => {
    for (let i=0;i<points.length-1;i++) segments.push({ a: points[i], b: points[i+1], r0:radii[i], r1:radii[i+1] });
  };
  if (enemy.state !== 'dormant') for (let i=0;i<3;i++) add(turbineLegPoints(turbine,enemy,i,heightAt).points,[3.32,2.9,2.08,1.03,.32]);
  for (let i=0;i<4;i++) add(pylonLegPoints(power,rig,i),[1.25,1.05,.65]);
  return segments;
}

export function resolveLegCollision(player, segments, ground, crouching = player.crouching) {
  const low = ground + .12, high = ground + (crouching ? .98 : 1.88), pr = .29;
  for (let pass=0;pass<2;pass++) for (const {a,b,r0,r1} of segments) {
    const radius = Math.max(r0,r1), dy=b[1]-a[1];
    let lo=0,hi=1;
    if (Math.abs(dy)<1e-6) { if(a[1]+radius<low||a[1]-radius>high)continue; }
    else { let t0=(low-radius-a[1])/dy,t1=(high+radius-a[1])/dy;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(0,t0);hi=Math.min(1,t1);if(lo>hi)continue; }
    const dx=b[0]-a[0],dz=b[2]-a[2],len=dx*dx+dz*dz;
    const samples=[combatClamp(((player.x-a[0])*dx+(player.z-a[2])*dz)/(len||1),lo,hi)];
    if(Math.abs(dy)>1e-6)for(const y of [low,(low+high)/2,high])samples.push(combatClamp((y-a[1])/dy,lo,hi));
    let deepest=null;
    for(const t of samples){
      const x=a[0]+dx*t,z=a[2]+dz*t,y=a[1]+dy*t,r=combatMix(r0,r1,t);
      const vertical=Math.max(low-y,y-high,0);if(vertical>=r)continue;
      const horizontal=Math.sqrt(r*r-vertical*vertical)+pr,px=player.x-x,pz=player.z-z,d=Math.hypot(px,pz),penetration=horizontal-d;
      if(penetration>0&&(!deepest||penetration>deepest.penetration))deepest={x,z,horizontal,px,pz,d,penetration};
    }
    if(!deepest)continue;
    const {x,z,horizontal,px,pz,d}=deepest;
    player.x=x+(d>.0001?px/d:1)*horizontal;player.z=z+(d>.0001?pz/d:0)*horizontal;
  }
}

// Commit to one attack and one target. The downswing cannot home after the player.
export function tickStomp(state, body, kind, dt, heightAt, blocked, impact) {
  state.attackCooldown=Math.max(0,(state.attackCooldown||0)-dt);
  if(kind==='turbine')constrainTurbineFeet(body,state);
  if(state.attack){
    const a=state.attack,old=a.age;a.age+=dt;
    state.vx=state.vz=0;
    if(a.kind==='bodyDrop'){
      const fold=combatEase(combatClamp(a.age/.44,0,1));
      const slam=combatEase(combatClamp((a.age-.48)/.30,0,1));
      const recover=combatEase(combatClamp((a.age-.98)/.95,0,1));
      const amount=(fold*.16+slam*.84)*(1-recover);
      body.y=combatMix(a.baseY,a.bottomY,amount);
      if(old<.78&&a.age>=.78){state.impact=1;impact(a.point,a.radius);}
      if(a.age>=1.93){body.y=a.baseY;state.attack=null;state.attackCooldown=2.6;}
      return;
    }
    const foot=state.feet[a.foot];if(!foot){state.attack=null;return;}
    const lift=kind==='turbine'?13:9,rise=combatEase(combatClamp(a.age/.55,0,1));
    const drop=combatEase(combatClamp((a.age-.72)/.2,0,1));
    foot.position=a.start.map((v,k)=>combatMix(v,a.point[k],rise));
    foot.position[1]=combatMix(a.start[1],a.point[1],rise)+lift*rise*(1-drop);
    foot.progress=combatClamp(a.age/1.32,0,1);
    if(kind==='turbine')foot.position=constrainTurbineFoot(body,state,a.foot,foot.position);
    if(old<.92&&a.age>=.92){state.impact=1;impact(a.point,kind==='turbine'?2.6:2.25);}
    if(a.age>=1.32){foot.position=a.point.slice();foot.target=a.point.slice();foot.start=a.point.slice();foot.progress=1;state.attack=null;state.attackCooldown=kind==='turbine'?.75:.55;}
    return;
  }
  if(state.state!=='running'||state.memoryAge>1.6||state.attackCooldown>0||!state.feet.length)return;
  const distance=Math.hypot(state.lastKnown[0]-body.x,state.lastKnown[1]-body.z);
  const heardPoint=[state.lastKnown[0],heightAt(...state.lastKnown)+1,state.lastKnown[1]];
  if(blocked([body.x,heightAt(body.x,body.z)+2,body.z],heardPoint))return;
  if(distance<(kind==='turbine'?10:8)){
    const ground=heightAt(body.x,body.z),radius=kind==='turbine'?7.6:6.6;
    state.attack={kind:'bodyDrop',foot:-1,age:0,point:[body.x,ground+.08,body.z],radius,
      baseY:body.y,bottomY:kind==='turbine'?ground+.65:ground-32.4,targetId:state.targetId||null};
    state.vx=state.vz=0;return;
  }
  const velocity=state.heardVelocity||[0,0],lead=Math.max(0,.72-state.memoryAge*.35);
  const speed=Math.hypot(...velocity)||1,scale=Math.min(1,7/(speed*lead||1));
  const x=state.lastKnown[0]+velocity[0]*lead*scale,z=state.lastKnown[1]+velocity[1]*lead*scale;
  const point=[x,heightAt(x,z)+.08,z],range=kind==='turbine'?66:30;
  if(Math.hypot(x-body.x,z-body.z)>range||blocked([body.x,heightAt(body.x,body.z)+2,body.z],[x,point[1]+1,z]))return;
  let foot=-1,nearest=Infinity;
  state.feet.forEach((f,i)=>{
    if(kind==='turbine'){
      const limited=constrainTurbineFoot(body,state,i,point);
      if(Math.hypot(limited[0]-x,limited[2]-z)>.1)return;
    }
    const d=Math.hypot(f.position[0]-x,f.position[2]-z);
    if(f.progress>=1&&d<nearest){foot=i;nearest=d;}
  });
  if(foot<0)return;
  state.attack={kind:'stomp',foot,age:0,start:state.feet[foot].position.slice(),point,targetId:state.targetId||null};
  state.vx=state.vz=0;
}

export function stompHits(player, point, radius, heightAt, blocked) {
  return player.alive && Math.hypot(player.x-point[0],player.z-point[2])<radius+.29 &&
    Math.abs(heightAt(player.x,player.z)-point[1])<2.2 &&
    !blocked([point[0],point[1]+.6,point[2]],[player.x,player.y,player.z]);
}
