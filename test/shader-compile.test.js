import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {launch} from './game-harness.js';

test('all shipped shaders compile and link in native ANGLE GLES', {
  skip: !process.env.ANGLE_LIB_DIR && 'Set ANGLE_LIB_DIR to enable the real graphics compiler gate.',
}, () => {
  const {shaders} = launch();
  const result = spawnSync('python3', [fileURLToPath(new URL('../scripts/check_shaders.py', import.meta.url))], {
    input: JSON.stringify(shaders), encoding: 'utf8', timeout: 45000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.programs.length, 6);
  assert.ok(report.programs.every(p => p.linked));
  assert.deepEqual(report.failures, []);
});
