let signTexture,
  signFace,
  signPosts,
  collarPieces = [],
  ankleSteel;
function infraGeometry() {
  return { positions: [], colors: [], indices: [], uvs: [] };
}
function infraFace(g, pts, c, uvs = []) {
  const start = g.positions.length / 3;
  pts.forEach((p, i) => {
    g.positions.push(...p);
    g.colors.push(...c);
    g.uvs.push(...(uvs[i] || [0, 0]));
  });
  for (let i = 1; i < pts.length - 1; i++)
    g.indices.push(start, start + i, start + i + 1);
}
function infraBox(x, y, z, w, h, d, c, g = infraGeometry()) {
  const ps = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ].map((p) => [x + (p[0] * w) / 2, y + (p[1] * h) / 2, z + (p[2] * d) / 2]);
  for (const f of [
    [4, 5, 6, 7],
    [1, 0, 3, 2],
    [0, 4, 7, 3],
    [5, 1, 2, 6],
    [3, 7, 6, 2],
    [0, 1, 5, 4],
  ])
    infraFace(
      g,
      f.map((i) => ps[i]),
      c,
    );
  return g;
}
function buildInfrastructure() {
  signTexture = importedTexture(SIGN_TEXTURE, 7);
  const g = infraGeometry();
  infraFace(
    g,
    [
      [-0.9, 0, 0.041],
      [0.9, 0, 0.041],
      [0.9, 1.22, 0.041],
      [-0.9, 1.22, 0.041],
    ],
    [1, 1, 1],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  );
  signFace = mesh3D(g);
  const posts = infraGeometry();
  for (const x of [-0.62, 0.62]) {
    infraBox(x, -0.02, 0, 0.068, 2.65, 0.068, [0.43, 0.46, 0.44], posts);
    infraBox(x, -1.39, 0, 0.27, 0.23, 0.29, [0.4, 0.4, 0.36], posts);
    for (let j = 0; j < 8; j++)
      infraBox(
        x,
        -1 + j * 0.19,
        0.037,
        0.018,
        0.028,
        0.008,
        [0.1, 0.12, 0.12],
        posts,
      );
  }
  infraBox(0, 0.61, 0, 1.84, 1.26, 0.065, [0.43, 0.45, 0.41], posts);
  for (const x of [-0.8, 0.8])
    for (const y of [0.1, 1.1])
      infraBox(x, y, 0.055, 0.027, 0.027, 0.018, [0.6, 0.6, 0.56], posts);
  signPosts = mesh3D(posts);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.014,
      b = ((i + 1) * Math.PI) / 4 - 0.014,
      r = 2.65,
      pts = [
        [Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55],
        [Math.cos(a) * r, 0, Math.sin(a) * r],
        [Math.cos(b) * r, 0, Math.sin(b) * r],
        [Math.cos(b) * 0.55, 0, Math.sin(b) * 0.55],
      ],
      top = pts.map((p, j) => [
        p[0] * (j === 1 || j === 2 ? 0.84 : 1),
        1.6 + Math.sin(i * 5 + j * 2) * 0.08,
        p[2] * (j === 1 || j === 2 ? 0.84 : 1),
      ]),
      g = infraGeometry();
    infraFace(g, top, [0.52, 0.53, 0.49]);
    infraFace(g, pts.slice().reverse(), [0.34, 0.35, 0.33]);
    for (let j = 0; j < 4; j++)
      infraFace(
        g,
        [pts[j], pts[(j + 1) % 4], top[(j + 1) % 4], top[j]],
        [0.41 + 0.015 * (i % 3), 0.42, 0.39],
      );
    collarPieces.push(mesh3D(g));
  }
  const steel = infraGeometry();
  infraBox(0, 1.05, 0, 0.25, 2.2, 0.25, [0.28, 0.31, 0.3], steel);
  infraBox(0, 0.13, 0, 0.85, 0.17, 0.85, [0.3, 0.32, 0.3], steel);
  ankleSteel = mesh3D(steel);
}
function appendInfrastructure() {
  if (Math.hypot(player.x - POWER_ZONE.x, player.z - POWER_ZONE.z) > 550)
    return;
  for (const s of [
    [POWER_ZONE.x + 36, POWER_ZONE.z + 25, -0.5],
    [POWER_ZONE.x - 27, POWER_ZONE.z + 34, 0.45],
  ]) {
    const model = multiply(
      transform(s[0], terrainHeight(s[0], s[1]) + 1.52, s[1]),
      rotateY(s[2]),
    );
    objectDraws.push(
      { mesh: signPosts, model, material: 2 },
      { mesh: signFace, model, material: 5, assetKind: 4 },
    );
  }
  const order = [0, 3, 1, 2];
  for (let foot = 0; foot < 4; foot++) {
    const rest = POWER_RIG.feet[foot],
      center = [POWER_ZONE.x + rest[0], 0.18, POWER_ZONE.z + rest[2]],
      t = clamp(
        (powerCreature.wake - (0.25 + order.indexOf(foot) * 0.75)) / 0.75,
        0,
        1,
      ),
      e = ease(t);
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * Math.PI) / 4,
        r = e * (1.2 + (i % 3) * 0.28),
        y = Math.sin(t * Math.PI) * 1.5 - e * 0.22,
        pose = multiply(
          transform(
            center[0] + Math.cos(a) * r,
            center[1] + y,
            center[2] + Math.sin(a) * r,
          ),
          multiply(
            rotateY(e * Math.sin(i * 3) * 0.22),
            rotateX(e * Math.sin(a) * 0.19),
          ),
        );
      objectDraws.push({ mesh: collarPieces[i], model: pose });
    }
    objectDraws.push({
      mesh: ankleSteel,
      model: transform(...powerCreature.feet[foot].position),
      material: 2,
    });
  }
}
