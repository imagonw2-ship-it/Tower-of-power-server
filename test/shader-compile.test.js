import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {launch} from './game-harness.js';

test('native GLES compiles the game and verifies flashlight visibility, falloff and shadows', {
  skip: !process.env.ANGLE_LIB_DIR && 'Set ANGLE_LIB_DIR to enable the real graphics compiler gate.',
}, () => {
  const {shaders,run} = launch();
  shaders.push('#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}',
    '#version 300 es\n'+run('commonGLSL')+`\nuniform vec2 u_probe;out vec4 color;
    void main(){vec3 p=vec3(u_probe.x,-1.35,-u_probe.y);
      vec3 c=flashLight(vec3(.035),vec3(.3,.37,.22),p,vec3(0.),vec3(0.,1.,0.),0.);
      vec3 x=pow(c,vec3(2.2));x=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);
      color=vec4(pow(x,vec3(1./2.2)),1.);}`);
  const result = spawnSync('python3', [fileURLToPath(new URL('../scripts/check_shaders.py', import.meta.url))], {
    input: JSON.stringify(shaders), encoding: 'utf8', timeout: 45000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.programs.length, 7);
  assert.ok(report.programs.every(p => p.linked));
  assert.deepEqual(report.failures, []);
});
