let signTexture,
  signFace,
  signPosts,
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
  // A readable face on each side prevents mirrored lettering on approach.
  infraFace(g,[[.9,0,-.041],[-.9,0,-.041],[-.9,1.22,-.041],[.9,1.22,-.041]],
    [1,1,1],[[0,0],[1,0],[1,1],[0,1]]);
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
  const steel = infraGeometry();
  infraBox(0, 1.05, 0, 0.25, 2.2, 0.25, [0.28, 0.31, 0.3], steel);
  infraBox(0, 0.13, 0, 0.85, 0.17, 0.85, [0.3, 0.32, 0.3], steel);
  ankleSteel = mesh3D(steel);
}
function appendInfrastructure() {
  if (Math.hypot(player.x - POWER_ZONE.x, player.z - POWER_ZONE.z) > 550)
    return;
  for (const s of CORRIDOR_SIGNS) {
    const model = multiply(
      transform(s.x, terrainHeight(s.x, s.z) + 1.52, s.z),
      rotateY(s.heading),
    );
    objectDraws.push(
      { mesh: signPosts, model, material: 2 },
      { mesh: signFace, model, material: 5, assetKind: 4 },
    );
  }
  for (const foot of powerCreature.feet) objectDraws.push({
    mesh: ankleSteel, model: transform(...foot.position), material: 2,
  });
}
