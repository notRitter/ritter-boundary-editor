function createEmptyBoundary() {
  return {
    name: "",
    kind: "spawn",
    maps: [],

    size: {
      mode: "streaming",
      distance: 2,
      width: null,
      height: null
    },

    thickness: 1,
    type: "FillOn",
    updateMode: "Movement",
    wait: 10,
    maxEvents: 400,
    enabled: true,

    autoHandler: {
      enabled: true,
      spawnMap: 1,
      boundaries: []
    }
  };
}
