import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';

const point=(m,p)=>[0,1,2,3].map(k=>m[k]*p[0]+m[k+4]*p[1]+m[k+8]*p[2]+m[k+12]);
const gap=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('item contact stays in the palm during idle, locomotion, crouch, turning and aiming',()=>{
  const {run}=launch();
  run("resetWorld(true);setMode('playing');const p={id:'grip-test',x:player.x,z:player.z-4,yaw:0,pitch:0,vx:0,vz:0};");
  for(const item of ['camera','flashlight','soda'])for(const state of ['idle','walk','run','crouch'])for(const pitch of [-.65,0,.6]){
    run(`Object.assign(p,{heldItem:'${item}',yaw:1.2,pitch:${pitch},crouching:${state==='crouch'},sprinting:${state==='run'},vx:${state==='idle'?0:4}});avatarCache.clear();objectDraws.length=0;appendHazmat(p,2.4);`);
    const hand=run("Array.from(multiply(multiply(transform(p.x,shedFloor(p.x,p.z),p.z),rotateY(p.yaw+Math.PI)),avatarCache.get(p.id).matrices[AVATAR_ASSET.bones.indexOf('hand_r')]))");
    const mesh=run('Array.from(objectDraws.at(-1).model)');
    const palm=point(hand,run('itemPalm')),contact=point(mesh,run(`itemGripAnchors['${item}']`));
    assert.ok(gap(palm,contact)<.0001,`${item} ${state}: contact separated from glove`);
    if(item==='camera')assert.ok(run('objectDraws.at(-1).texture===cameraItemTexture&&objectDraws.at(-1).mesh.vertexCount>1000'));
    assert.ok(run('avatarCache.get(p.id).bones.every(Number.isFinite)'));
  }
});

test('flat censor encloses the actual skinned head at different angles, poses and zoom levels',()=>{
  const {run}=launch();
  run("resetWorld(true);setMode('playing');locked=true;world.turbineStopped=true;world.powerStopped=true;settings.vhs=0;player.yaw=0;player.pitch=0;const p={id:'head-test',x:player.x,z:player.z-5,yaw:0,pitch:0,vx:0,vz:0,heldItem:'none'};");
  const data=run('AVATAR_ASSET');
  // Use real hood and respirator vertices, not the implementation's bounding box.
  const points=[];
  for(const mesh of data.meshes){
    const b=Buffer.from(mesh.vertices,'base64');
    for(let i=0;i<mesh.vertexCount;i++){
      const o=i*32,p=[b.readFloatLE(o),b.readFloatLE(o+4),b.readFloatLE(o+8)];
      if(p[1]<1.55)continue;
      points.push({p,b0:b[o+21],b1:b[o+22],w:b[o+23]/255});
    }
  }
  for(const yaw of [0,1.57,3.14,4.71])for(const crouch of [false,true])for(const zoom of [1,2.8]){
    run(`game.zoom=${zoom};updateCamera(0);Object.assign(p,{yaw:${yaw},crouching:${crouch}});headCensorCount=0;avatarCache.clear();appendHazmat(p,1.7);`);
    assert.equal(run('headCensorCount'),1);
    const rect=run('Array.from(headCensorRects.slice(0,4))'),bones=run('Array.from(avatarCache.get(p.id).bones)'),vp=run('Array.from(viewProjection)'),root=run('Array.from(multiply(transform(p.x,shedFloor(p.x,p.z),p.z),rotateY(p.yaw+Math.PI)))');
    let visible=0;
    for(const v of points){
      const a=point(bones.slice(v.b0*16,v.b0*16+16),v.p),b=point(bones.slice(v.b1*16,v.b1*16+16),v.p),posed=a.map((x,i)=>x*v.w+b[i]*(1-v.w)),clip=point(vp,point(root,posed));
      if(clip[3]<=0)continue;
      const u=clip[0]/clip[3]*.5+.5,w=clip[1]/clip[3]*.5+.5;
      if(u<0||u>1||w<0||w>1)continue;visible++;
      assert.ok(u>=rect[0]&&u<=rect[2]&&w>=rect[1]&&w<=rect[3],`exposed head: yaw=${yaw} crouch=${crouch} zoom=${zoom}`);
    }
    assert.ok(visible>100);
  }
  run('p.z=player.z+8;headCensorCount=0;appendHazmat(p,3);');assert.equal(run('headCensorCount'),0);
  run('headCensorCount=7;buildObjects();');assert.equal(run('headCensorCount'),0,'stale masks cleared on singleplayer frame');
});
