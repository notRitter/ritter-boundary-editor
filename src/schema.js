const Schema = {
  version: 1,
  boundaryTemplate() {
    return {
      name: "New Boundary",
      type: "spawn", // spawn | unspawn
      maps: [],
      distance: 4,
      thickness: 1,
      updateMode: "Movement",
      wait: 0,
      maxEvents: 0,
      enabled: true,
      preloads: [],
      boundaryList: []
    };
  }
};

