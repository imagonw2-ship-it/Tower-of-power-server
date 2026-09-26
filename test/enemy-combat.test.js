import test from 'node:test';
import assert from 'node:assert/strict';
import {SoundTargets,resolveLegCollision,tickStomp,stompHits,legColliders} from '../shared/enemy-combat.js';
import {PYLON_HEADING,PYLON_RIG,PYLON_SOCKETS,STATIC_PYLONS,groundedPylon,pylonPoint,cablePoint,CORRIDOR_SIGNS} from '../shared/power-layout.js';
import {terrainHeight,movePlayer,floorHeight} from '../shared/physics.js';
import {createEnemySimulation} from '../server/enemies.js';
const actor=(id,x=0,z=0)=>({id,x,z,y:terrainHeight(x,z)+1.7,alive:true,connected:true,health:1,input:{x:0,z:0}});
const clear=()=>false;
test('nearest audible player wins; alternating footsteps do not flip the committed target',()=>{
  const tracker=new SoundTargets(),body={x:0,z:0},a=actor('a',35),b=actor('b',50);
  tracker.hear(b,100,body,1);tracker.hear(a,100,body,1);
  assert.equal(tracker.step(.05,[a,b],body).id,'a');
  b.x=10;
  for(let i=0;i<100;i++){
    tracker.hear(i%2?a:b,100,body,1);
    assert.equal(tracker.step(.05,[a,b],body).id,'a');
  }
});
test('silence loses tracking; unseen positions are never read; nearby sounds replace a stale target',()=>{
  const tracker=new SoundTargets(),body={x:0,z:0},a=actor('a',90),b=actor('b',12);
  tracker.hear(a,100,body,1);tracker.step(.05,[a,b],body);a.x=900;
  assert.deepEqual(tracker.step(1,[a,b],body).position,[90,0]);
  for(let i=0;i<130;i++){tracker.hear(b,100,body,1);tracker.step(.05,[a,b],body);}
  assert.equal(tracker.id,'b');
  assert.equal(tracker.step(8.1,[a,b],body).id,null);
});
test('dead or departed targets release immediately; a different room has independent targeting',()=>{
  const one=new SoundTargets(),two=new SoundTargets(),body={x:0,z:0},a=actor('a',10),b=actor('b',20);
  one.hear(a,100,body,1);one.hear(b,100,body,1);one.step(.05,[a,b],body);
  two.hear(b,100,body,1);assert.equal(two.step(.05,[a,b],body).id,'b');
  a.alive=false;assert.equal(one.step(.05,[a,b],body).id,'b');
  assert.equal(one.step(.05,[],body).id,null);
});
test('quiet grass movement outside hearing does not expose a player',()=>{
  const tracker=new SoundTargets(),p=actor('quiet',25),body={x:0,z:0};
  tracker.hear(p,4.5,body,1);assert.equal(tracker.step(.05,[p],body).id,null);
  tracker.hear(p,43,body,1,true);assert.equal(tracker.step(.05,[p],body).id,'quiet');
});
test('an unreachable sheltered target gives way to a reachable sound after the commitment period',()=>{
  const tracker=new SoundTargets(),body={x:0,z:0},inside=actor('inside',10),outside=actor('outside',30);
  tracker.hear(inside,100,body,1);tracker.step(.05,[inside,outside],body);
  for(let i=0;i<125;i++){
    tracker.hear(inside,100,body,1);tracker.hear(outside,100,body,1);
    tracker.step(.05,[inside,outside],body,t=>t.id==='outside');
  }
  assert.equal(tracker.id,'outside');
});
test('low leg sections block movement while high spans can be walked underneath',()=>{
  const leg={a:[0,0,0],b:[0,14,0],r0:.7,r1:1.3},p=actor('p',.1);
  resolveLegCollision(p,[leg],0);assert.ok(p.x>.98);
  const under=actor('under',0);resolveLegCollision(under,[{a:[-4,15,0],b:[4,15,0],r0:2,r1:2}],0);
  assert.equal(under.x,0);assert.equal(under.z,0);
  const crouched=actor('crouch',0);resolveLegCollision(crouched,[{a:[-3,1.6,0],b:[3,1.6,0],r0:.2,r1:.2}],0,true);
  assert.equal(crouched.x,0);
});
test('fast movement is swept in small steps and cannot pass through a planted leg',()=>{
  const p=actor('runner',-1.8),colliders=[{a:[0,-2,0],b:[0,10,0],r0:.4,r1:.4}];
  p.boost=15;
  movePlayer(p,{x:1,z:0,yaw:0,pitch:0,sprint:true},.3,[],q=>resolveLegCollision(q,colliders,terrainHeight(q.x,q.z)));
  assert.ok(p.x<-.65,'must remain on the approaching side');
});
test('stomp lifts and locks its aim before impact, hits at the foot, and allows dodging',()=>{
  const flat=()=>0,feet=[[-15,0,0],[15,0,0],[0,0,18],[0,0,-18]].map(p=>({position:p,progress:1}));
  const state={state:'running',feet,lastKnown:[22,0],memoryAge:0,targetId:'victim'},body={x:0,z:0};
  const victim=actor('victim',22),escaped=actor('escape',22,4),center=actor('center',0);let hits=[],impacts=0;
  const impact=(point,radius)=>{impacts++;hits=[victim,escaped,center].filter(p=>stompHits(p,point,radius,flat,clear)).map(p=>p.id);};
  tickStomp(state,body,'power',.05,flat,clear,impact);
  assert.ok(state.attack);assert.deepEqual(state.attack.point,[22,.08,0]);
  state.lastKnown=[40,0];
  for(let i=0;i<12;i++)tickStomp(state,body,'power',.05,flat,clear,impact);
  assert.equal(impacts,0);assert.ok(feet[state.attack.foot].position[1]>8);
  for(let i=0;i<8;i++)tickStomp(state,body,'power',.05,flat,clear,impact);
  assert.equal(impacts,1);assert.deepEqual(hits,['victim']);
  for(let i=0;i<10;i++)tickStomp(state,body,'power',.05,flat,clear,impact);
  assert.equal(impacts,1);assert.equal(state.attack,null);
});
test('server pylon attacks within leg reach, away from its center, and snapshots commit to one player',()=>{
  const world={turbineStopped:true,powerStopped:false},sim=createEnemySimulation(world),p=sim.powerCreature;
  p.state='running';p.rigBlend=1;
  const near=actor('near',p.x+24,p.z),far=actor('far',p.x-60,p.z);
  sim.noise(far,110);sim.noise(near,110);sim.step(.05,[near,far]);
  assert.equal(p.targetId,'near');assert.ok(p.attack);assert.equal(near.alive,true);
  assert.equal(sim.snapshot().power.attack.targetId,'near');
  for(let i=0;i<25&&near.alive;i++){sim.noise(far,110);sim.step(.05,[near,far]);}
  assert.equal(near.alive,false);assert.equal(far.alive,true);
  sim.step(.05,[near,far]);assert.equal(p.targetId,'far');
});
test('six background pylons have all four feet grounded; every conductor terminates at its sockets',()=>{
  assert.equal(STATIC_PYLONS.length,6);
  const towers=STATIC_PYLONS.map(t=>groundedPylon(t,PYLON_RIG,terrainHeight));
  for(const t of towers){
    assert.equal(t.heading,PYLON_HEADING);
    for(const p of PYLON_RIG.feet){const w=pylonPoint(t,p);assert.ok(w[1]<=terrainHeight(w[0],w[2])+.001);}
  }
  for(let i=1;i<towers.length;i++)for(const socket of PYLON_SOCKETS){
    const a=pylonPoint(towers[i-1],socket),b=pylonPoint(towers[i],socket);
    assert.deepEqual(cablePoint(a,b,0,terrainHeight),a);
    assert.deepEqual(cablePoint(a,b,1,terrainHeight),b);
    assert.ok(cablePoint(a,b,.5,terrainHeight)[1]<(a[1]+b[1])/2);
  }
  assert.ok(CORRIDOR_SIGNS.every(s=>Math.cos(s.heading)>0),'fronts face the southern approach');
});
test('leg geometry remains finite throughout waking, running and attacking',()=>{
  const sim=createEnemySimulation({turbineStopped:false,powerStopped:false});
  const p=actor('walker',-160,-270),t=actor('recorder',120,-210);
  for(let i=0;i<300;i++){
    if(i%12===0){sim.noise(p,110);sim.noise(t,105);}
    sim.step(.05,[p,t]);
    const segments=legColliders(sim.turbine,sim.enemy,sim.powerCreature,PYLON_RIG,terrainHeight);
    assert.ok(segments.every(s=>[...s.a,...s.b,s.r0,s.r1].every(Number.isFinite)));
  }
});

test('audible velocity leads the next stomp without following a silent player',()=>{
  const tracker=new SoundTargets(),body={x:0,y:30,z:0},p=actor('runner',0,48);
  tracker.hear(p,100,body,1);tracker.step(.5,[p],body);p.x=4;tracker.hear(p,100,body,1);
  const heard=tracker.step(.05,[p],body);assert.ok(heard.velocity[0]>4);
  p.x=100;const quiet=tracker.step(.1,[p],body);assert.deepEqual(quiet.position,[4,48]);
  const state={state:'running',heading:0,awake:8,crouch:0,memoryAge:0,lastKnown:heard.position,heardVelocity:heard.velocity,feet:[0,1,2].map(i=>({position:[Math.sin(i*Math.PI*2/3)*53,0,Math.cos(i*Math.PI*2/3)*53],progress:1}))};
  tickStomp(state,body,'turbine',.05,()=>0,clear,()=>{});assert.ok(state.attack.point[0]>4&&state.attack.point[0]<12);
  const aim=state.attack.point.slice();state.lastKnown=[20,50];tickStomp(state,body,'turbine',.05,()=>0,clear,()=>{});assert.deepEqual(state.attack.point,aim);
});
test('turbine feet remain in distinct angular sectors during attacks and turning',async()=>{
  const {constrainTurbineFeet,turbineLegPoints}=await import('../shared/enemy-combat.js');
  const body={x:0,y:32,z:0},state={heading:0,awake:8,crouch:0,feet:[0,1,2].map(i=>({position:[0,0,-45],progress:1}))};
  for(let t=0;t<200;t++){
    state.heading=t*.02;constrainTurbineFeet(body,state);
    for(let i=0;i<3;i++){
      const foot=turbineLegPoints(body,state,i,()=>0).points.at(-1),a=Math.atan2(foot[0],foot[2]),nominal=state.heading+i*Math.PI*2/3,delta=Math.atan2(Math.sin(a-nominal),Math.cos(a-nominal));
      assert.ok(Math.abs(delta)<=.820001);assert.ok(Math.hypot(foot[0],foot[2])>=11.99);
    }
  }
});
test('both giants telegraph a body drop under their center; escaping avoids the impact',()=>{
  for(const kind of ['turbine','power']){
    const body={x:0,y:kind==='turbine'?32:-4.8,z:0},state={state:'running',heading:0,awake:8,crouch:0,lastKnown:[1,0],memoryAge:0,feet:[0,1,2].map(i=>({position:[Math.sin(i*2.1)*40,0,Math.cos(i*2.1)*40],progress:1}))};
    let impacts=0;const stay=actor('stay',1),escape=actor('escape',1);let hits=[];
    const hit=(point,radius)=>{impacts++;hits=[stay,escape].filter(p=>stompHits(p,point,radius,()=>0,clear)).map(p=>p.id);};
    tickStomp(state,body,kind,.05,()=>0,clear,hit);assert.equal(state.attack.kind,'bodyDrop');const initial=body.y;
    for(let i=0;i<8;i++)tickStomp(state,body,kind,.05,()=>0,clear,hit);assert.equal(impacts,0);assert.ok(body.y<initial);
    escape.x=12;for(let i=0;i<9;i++)tickStomp(state,body,kind,.05,()=>0,clear,hit);
    assert.equal(impacts,1);assert.deepEqual(hits,['stay']);
    for(let i=0;i<25;i++)tickStomp(state,body,kind,.05,()=>0,clear,hit);assert.equal(state.attack,null);assert.ok(state.attackCooldown>1);
  }
});
