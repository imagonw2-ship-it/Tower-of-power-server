import test from 'node:test';import assert from 'node:assert/strict';
import {launch} from './game-harness.js';import {makeLayout} from '../shared/world-layout.js';import {groundedPylon,pylonPoint,PYLON_RIG} from '../shared/power-layout.js';import {terrainHeight} from '../shared/physics.js';
const {run,document}=launch();
test('all pylon support footprints contact the seeded terrain',()=>{
 for(const seed of [0,42,19391])for(const tower of makeLayout(seed).pylons){const p=groundedPylon(tower,PYLON_RIG,terrainHeight);for(let i=0;i<4;i++){const v=pylonPoint(p,[PYLON_RIG.feet[i][0],PYLON_RIG.bottoms[i],PYLON_RIG.feet[i][2]]);for(const dx of [-.8,0,.8])for(const dz of [-.8,0,.8])assert.ok(v[1]<terrainHeight(v[0]+dx,v[2]+dz)+.02);}}
});
test('settings tabs keep values and percent readouts while showing one category',()=>{
 for(const name of ['graphics','camera','audio','world']){document.querySelector(`[data-settings-tab=${name}]`).click();assert.equal([...document.querySelectorAll('[data-settings-page]')].filter(e=>!e.hidden).length,1);assert.equal(document.querySelector(`[data-settings-page=${name}]`).hidden,false);}
 const v=document.getElementById('vhs');v.value='.35';v.dispatchEvent(new document.defaultView.Event('input'));assert.equal(run('settings.vhs'),.35);assert.equal(document.querySelector('output[for=vhs]').textContent,'35%');
});
test('physical backpack has uniform scale, readable unwarped inventory and valid hands',()=>{
 run("resetWorld(true,0);setMode('playing');locked=true;game.hasBackpack=true;openFieldKit();for(let i=0;i<150;i++)updateBackpack(1/60);updateCamera(0);objectDraws.length=0;appendBackpack();positionBackpackInventory();");
 const scales=run('[0,4,8].map(i=>Math.hypot(...backpack.model.slice(i,i+3)))');assert.ok(Math.max(...scales)-Math.min(...scales)<1e-6);assert.ok(run('objectDraws.every(o=>o.model.every(Number.isFinite)&&(!o.bones||o.bones.every(Number.isFinite)))'));assert.match(document.getElementById('fieldKit').style.transform,/translate.*scale/);assert.ok(!document.getElementById('fieldKit').style.transform.includes('matrix3d'));
});
test('yard meshes and contact supports render, unload and rebuild without stale references',()=>{
 run("resetWorld(true,0);setMode('playing');Object.assign(player,{x:POWER_ZONE.x,z:POWER_ZONE.z});objectDraws.length=0;appendPowerObjects();");assert.ok(run('objectDraws.some(o=>o.pylonContact)&&objectDraws.some(o=>o.pylonYard)'));run('unloadMeadowGeometry();');assert.equal(run('corridorTowers.length'),0);run('restoreMeadowGeometry();');assert.ok(run('corridorTowers.every(t=>t.yard&&t.shoes)'));
});
