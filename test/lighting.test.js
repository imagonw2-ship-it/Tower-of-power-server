import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';

test('close shadows follow the player at finer resolution and release their targets when disabled',()=>{
  const deleted=[];
  const {run}=launch(true,{deleteTexture:t=>deleted.push(t)});
  run("resetWorld(true);setMode('playing');settings.quality='medium';settings.shadows='medium';applyQuality();updateCamera(0);updateLight();");
  assert.equal(run('nearShadowTarget.size'),1024);
  assert.ok(run('nearLightVP.every(Number.isFinite)'));
  // Transform a metre along the light's horizontal axis; compare projected widths.
  const scales=run('[Math.hypot(lightVP[0],lightVP[4],lightVP[8]),Math.hypot(nearLightVP[0],nearLightVP[4],nearLightVP[8])]');
  assert.ok(scales[1]/scales[0]>9);
  run('const before=Array.from(nearLightVP);player.x+=60;updateCamera(0);updateLight();');
  assert.notEqual(run('nearLightVP[12]'),run('before[12]'));
  run("settings.shadows='off';applyQuality();");
  assert.equal(run('nearShadowTarget.size'),1);assert.ok(deleted.length>=2);
});

test('near shadow comparison texture is bound separately and the complete frame renders after quality changes',()=>{
  let draws=0;
  const {run}=launch(true,{drawElements:()=>draws++});
  run("resetWorld(true);setMode('playing');locked=true;game.hasFlashlight=true;kitPreviousFlashlight=true;equippedTool='flashlight';equipmentMotion.shown='flashlight';game.torchOn=true;settings.shadows='high';applyQuality();frame(1000);frame(1016);");
  assert.equal(run('nearShadowTarget.size'),2048);assert.ok(draws>50);
  assert.ok(run('torchVP.every(Number.isFinite)&&nearLightVP.every(Number.isFinite)'));
});
