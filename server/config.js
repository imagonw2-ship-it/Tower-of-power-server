export const config = {
  tickHz: 20,
  snapshotHz: 10,
  maxPlayers: 8,
  maxRooms: 64,
  reconnectMs: 90000,
  emptyRoomMs: 30 * 60000,
  starterItems: {
    flashlight: { base: 0, perPlayer: 1, minimum: 1 },
    flare: { base: 0, perPlayer: 1, minimum: 1 },
    soda: { base: 0, perPlayer: 1, minimum: 1 },
  },
  protocol: 1,
  pylons: { playersPerPylon: 2, maximum: 4 },
  worldSchema: 1,
};
