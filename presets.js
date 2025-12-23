// presets.js

// Your plugin parameter presets, normalized into real objects
window.RITTER_PRESETS = {
  streaming: {
    spawn: [
      {
        name: "Static Spawn",
        distance: 4,
        thickness: 2,
        type: "FillOn",
        updateMode: "Movement",
        wait: 10,
        maxEvents: 800,
        enabled: true
      },
      {
        name: "Mover Spawn",
        distance: 2,
        thickness: 1,
        type: "FillOn",
        updateMode: "Movement",
        wait: 5,
        maxEvents: 400, // your preset doesn't include this; sensible default
        enabled: true
      }
    ],
    unspawn: [
      {
        name: "Static Unspawn",
        distance: 6,
        thickness: 2,
        updateMode: "Movement",
        wait: 10,
        boundaries: ["Static Spawn"],
        enabled: true
      },
      {
        name: "Mover Unspawn",
        distance: 3,
        thickness: 2,
        updateMode: "WaitTime",
        wait: 5,
        boundaries: ["Mover Spawn"],
        enabled: true
      }
    ]
  }
};
