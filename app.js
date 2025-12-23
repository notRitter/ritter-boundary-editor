// app.js
(() => {
  // ----------------------------
  // State
  // ----------------------------
  const state = {
    meta: {
      version: 1,
      tool: "Ritter Boundary Builder"
    },
    global: {
      streamingMaps: []
    },
    boundaries: []
  };

  let selectedId = null;
  let activeTab = "general";

  // ----------------------------
  // Helpers
  // ----------------------------
  const uid = () => "b_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  const parseNumberList = (s) =>
    String(s || "")
      .split(",")
      .map(x => Number(x.trim()))
      .filter(n => Number.isFinite(n));

  const parseStringList = (s) =>
    String(s || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

  const byId = (id) => document.getElementById(id);

  function setStatus(text, meta = "") {
    const st = byId("statusText");
    const sm = byId("statusMeta");
    if (st) st.textContent = text;
    if (sm) sm.textContent = meta;
  }

  function makeBoundaryBase(kind = "spawn") {
    return {
      id: uid(),
      name: kind === "spawn" ? "New Spawn Boundary" : "New Unspawn Boundary",
      kind, // "spawn" | "unspawn"
      maps: [],
      size: {
        mode: "streaming", // "streaming" | "fixed"
        distance: 2,
        width: null,
        height: null
      },
      thickness: 1,
      type: "FillOn",       // spawn only (legacy)
      updateMode: "Movement",
      wait: 10,
      maxEvents: 400,       // spawn only
      enabled: true,
      autoHandler: {
        enabled: true,
        spawnMap: 1,
        boundaries: []      // unspawn only
      },
      preloads: []          // spawn only
    };
  }

  function getSelectedBoundary() {
    return state.boundaries.find(b => b.id === selectedId) || null;
  }

  function deselect() {
    selectedId = null;
    renderAll();
  }

  // ----------------------------
  // DOM refs
  // ----------------------------
  const el = {
    // topbar
    newProjectBtn: byId("newProjectBtn"),
    importFile: byId("importFile"),
    exportBtn: byId("exportBtn"),

    // left panel
    addBoundaryBtn: byId("addBoundaryBtn"),
    addStreamingPresetBtn: byId("addStreamingPresetBtn"),
    boundaryList: byId("boundaryList"),
    globalMaps: byId("globalMaps"),

    // editor header
    editorTitle: byId("editorTitle"),
    editorSubtitle: byId("editorSubtitle"),
    deleteBoundaryBtn: byId("deleteBoundaryBtn"),
    selectedKindPill: byId("selectedKindPill"),
    selectedEnabledToggle: byId("selectedEnabledToggle"),

    // tabs
    editorTabs: byId("editorTabs"),

    // empty state buttons
    emptyState: byId("emptyState"),
    emptyAddBoundaryBtn: byId("emptyAddBoundaryBtn"),
    emptyAddPresetBtn: byId("emptyAddPresetBtn"),

    // sections
    tabGeneral: byId("tab-general"),
    tabSize: byId("tab-size"),
    tabHandler: byId("tab-handler"),
    tabPreloads: byId("tab-preloads"),

    // general fields
    bName: byId("bName"),
    bKind: byId("bKind"),
    bMaps: byId("bMaps"),
    bThickness: byId("bThickness"),
    bUpdateMode: byId("bUpdateMode"),
    bWait: byId("bWait"),
    bType: byId("bType"),
    bMaxEvents: byId("bMaxEvents"),

    // size fields
    sizeStreaming: byId("sizeStreaming"),
    sizeFixed: byId("sizeFixed"),
    streamingDistanceField: byId("streamingDistanceField"),
    fixedSizeField: byId("fixedSizeField"),
    bDistance: byId("bDistance"),
    bWidth: byId("bWidth"),
    bHeight: byId("bHeight"),

    // handler fields
    ahEnabled: byId("ahEnabled"),
    ahSpawnMap: byId("ahSpawnMap"),
    ahBoundaryListField: byId("ahBoundaryListField"),
    ahBoundaries: byId("ahBoundaries"),

    // preloads
    addPreloadXYBtn: byId("addPreloadXYBtn"),
    addPreloadRegionBtn: byId("addPreloadRegionBtn"),
    preloadList: byId("preloadList")
  };

  // ----------------------------
  // Rendering
  // ----------------------------
  function renderBoundaryList() {
    el.boundaryList.innerHTML = "";

    if (state.boundaries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "help";
      empty.textContent = "No boundaries yet. Add one or use presets.";
      el.boundaryList.appendChild(empty);
      return;
    }

    state.boundaries.forEach(b => {
      const li = document.createElement("li");
      li.className = "listItem" + (b.id === selectedId ? " listItem--active" : "");
      li.onclick = () => {
        selectedId = b.id;
        renderAll();
      };

      const badgeClass = b.kind === "spawn" ? "badge--spawn" : "badge--unspawn";
      const kindLabel = b.kind === "spawn" ? "Spawn" : "Unspawn";
      const enabledLabel = b.enabled ? "Enabled" : "Disabled";

      li.innerHTML = `
        <div class="listItem__main">
          <div class="listItem__name">${escapeHtml(b.name || "(unnamed)")}</div>
          <div class="listItem__meta">${enabledLabel} • ${b.size.mode === "streaming" ? `Streaming (d=${b.size.distance})` : `Fixed (${b.size.width}×${b.size.height})`}</div>
        </div>
        <span class="badge ${badgeClass}">${kindLabel}</span>
      `;
      el.boundaryList.appendChild(li);
    });
  }

  function renderEditorShell() {
    const b = getSelectedBoundary();

    // enable/disable editor controls
    const has = !!b;

    el.deleteBoundaryBtn.disabled = !has;
    el.selectedEnabledToggle.disabled = !has;

    // tabs enable/disable
    [...el.editorTabs.querySelectorAll(".tab")].forEach(btn => {
      btn.disabled = !has;
      btn.classList.toggle("tab--active", has && btn.dataset.tab === activeTab);
    });

    if (!has) {
      el.editorTitle.textContent = "Select a boundary";
      el.editorSubtitle.textContent = "Choose one on the left to edit properties";
      el.selectedKindPill.textContent = "—";
      el.selectedEnabledToggle.checked = false;

      el.emptyState.hidden = false;
      el.tabGeneral.hidden = true;
      el.tabSize.hidden = true;
      el.tabHandler.hidden = true;
      el.tabPreloads.hidden = true;
      return;
    }

    el.editorTitle.textContent = b.name || "(unnamed)";
    el.editorSubtitle.textContent = `${b.kind === "spawn" ? "Spawn boundary" : "Unspawn boundary"} • ID: ${b.id}`;
    el.selectedKindPill.textContent = b.kind === "spawn" ? "Spawn" : "Unspawn";
    el.selectedEnabledToggle.checked = !!b.enabled;

    el.emptyState.hidden = true;

    // show active tab section
    el.tabGeneral.hidden = activeTab !== "general";
    el.tabSize.hidden = activeTab !== "size";
    el.tabHandler.hidden = activeTab !== "handler";
    el.tabPreloads.hidden = activeTab !== "preloads";
  }

  function renderEditorFields() {
    const b = getSelectedBoundary();
    if (!b) return;

    // General
    el.bName.value = b.name ?? "";
    el.bKind.value = b.kind ?? "spawn";
    el.bMaps.value = (b.maps || []).join(",");
    el.bThickness.value = Number(b.thickness ?? 1);
    el.bUpdateMode.value = b.updateMode ?? "Movement";
    el.bWait.value = Number(b.wait ?? 0);

    // Spawn-only fields show/hide by kind
    const spawnOnlyFields = [el.bType.closest(".field"), el.bMaxEvents.closest(".field")].filter(Boolean);
    spawnOnlyFields.forEach(f => (f.style.display = b.kind === "spawn" ? "" : "none"));

    if (b.kind === "spawn") {
      el.bType.value = b.type ?? "FillOn";
      el.bMaxEvents.value = Number(b.maxEvents ?? 0);
    }

    // Size
    if (b.size?.mode === "fixed") {
      el.sizeFixed.checked = true;
      el.sizeStreaming.checked = false;
      el.streamingDistanceField.hidden = true;
      el.fixedSizeField.hidden = false;
      el.bWidth.value = Number(b.size.width ?? 1);
      el.bHeight.value = Number(b.size.height ?? 1);
    } else {
      el.sizeStreaming.checked = true;
      el.sizeFixed.checked = false;
      el.streamingDistanceField.hidden = false;
      el.fixedSizeField.hidden = true;
      el.bDistance.value = Number(b.size.distance ?? 0);
    }

    // Auto Handler
    el.ahEnabled.checked = !!b.autoHandler?.enabled;
    el.ahSpawnMap.value = Number(b.autoHandler?.spawnMap ?? 1);
    el.ahBoundaryListField.style.display = b.kind === "unspawn" ? "" : "none";
    el.ahBoundaries.value = (b.autoHandler?.boundaries || []).join(",");

    // Preloads (spawn only)
    el.tabPreloads.querySelector(".card").style.display = b.kind === "spawn" ? "" : "none";

    renderPreloadList(b);
  }

  function renderPreloadList(b) {
    // For now: just show count + simple list; we’ll build full cards next.
    el.preloadList.innerHTML = "";
    if (b.kind !== "spawn") return;

    if (!Array.isArray(b.preloads) || b.preloads.length === 0) {
      const msg = document.createElement("div");
      msg.className = "help";
      msg.textContent = "No preloads yet. Add XY or Region preloads.";
      el.preloadList.appendChild(msg);
      return;
    }

    b.preloads.forEach((p, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      const title =
        p.mode === "xy"
          ? `XY: map ${p.mapId} @ (${p.x},${p.y})`
          : `Region: map ${p.mapId} regions [${(p.regions || []).join(",")}] × ${p.quantity || 1}`;
      card.innerHTML = `
        <div class="card__title">${escapeHtml(title)}</div>
        <div class="card__desc">spawnMap ${p.spawnMap} • eventId ${p.spawnEventId}</div>
        <div class="row" style="margin-top:10px;">
          <button class="btn btn--danger btn--ghost" data-del="${idx}">Delete</button>
        </div>
      `;
      card.querySelector("[data-del]").onclick = () => {
        b.preloads.splice(idx, 1);
        renderAll();
        setStatus("Preload deleted.");
      };
      el.preloadList.appendChild(card);
    });
  }

  function renderGlobalMaps() {
    el.globalMaps.value = state.global.streamingMaps.join(",");
  }

  function renderAll() {
    renderGlobalMaps();
    renderBoundaryList();
    renderEditorShell();
    renderEditorFields();
    setStatus("Ready.", `Boundaries: ${state.boundaries.length}`);
  }

  // Basic HTML escape for list rendering
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ----------------------------
  // Actions
  // ----------------------------
  function addBoundary(kind = "spawn") {
    const b = makeBoundaryBase(kind);
    state.boundaries.push(b);
    selectedId = b.id;
    activeTab = "general";
    renderAll();
    setStatus("Boundary added.", b.name);
  }

  function addStreamingPresets() {
    const preset = window.RITTER_PRESETS?.streaming;
    if (!preset) {
      setStatus("Preset data missing.", "presets.js not loaded");
      return;
    }

    // Spawn presets
    preset.spawn.forEach(p => {
      const b = makeBoundaryBase("spawn");
      b.name = p.name;
      b.size.mode = "streaming";
      b.size.distance = p.distance;
      b.thickness = p.thickness;
      b.type = p.type;
      b.updateMode = p.updateMode;
      b.wait = p.wait;
      b.maxEvents = p.maxEvents ?? b.maxEvents;
      b.enabled = !!p.enabled;
      // auto handler default enabled + spawnMap 1
      state.boundaries.push(b);
    });

    // Unspawn presets
    preset.unspawn.forEach(p => {
      const b = makeBoundaryBase("unspawn");
      b.name = p.name;
      b.size.mode = "streaming";
      b.size.distance = p.distance;
      b.thickness = p.thickness;
      b.updateMode = p.updateMode;
      b.wait = p.wait;
      b.enabled = !!p.enabled;
      b.autoHandler.enabled = true;
      b.autoHandler.spawnMap = 1;
      b.autoHandler.boundaries = Array.isArray(p.boundaries) ? p.boundaries.slice() : [];
      state.boundaries.push(b);
    });

    // auto-select first boundary
    if (!selectedId && state.boundaries.length) selectedId = state.boundaries[0].id;

    renderAll();
    setStatus("Streaming presets added.", `+${preset.spawn.length + preset.unspawn.length}`);
  }

  function deleteSelectedBoundary() {
    const b = getSelectedBoundary();
    if (!b) return;

    const idx = state.boundaries.findIndex(x => x.id === b.id);
    if (idx >= 0) state.boundaries.splice(idx, 1);

    // select next if available
    selectedId = state.boundaries[idx]?.id || state.boundaries[idx - 1]?.id || null;
    renderAll();
    setStatus("Boundary deleted.");
  }

  function newProject() {
    state.global.streamingMaps = [];
    state.boundaries = [];
    selectedId = null;
    activeTab = "general";
    renderAll();
    setStatus("New project started.");
  }

  // Export canonical file format
  function exportJson() {
    const payload = {
      meta: state.meta,
      global: state.global,
      boundaries: state.boundaries
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ritter-boundaries.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Exported JSON.", a.download);
  }

  // Import: accepts our format; also tolerates raw array of boundaries
  async function importJsonFile(file) {
    const text = await file.text();
    const json = JSON.parse(text);

    if (Array.isArray(json)) {
      // raw boundaries array
      state.boundaries = json;
      state.global.streamingMaps = [];
    } else {
      state.meta = json.meta || state.meta;
      state.global = json.global || state.global;
      state.boundaries = json.boundaries || [];
    }

    // Normalize required fields
    state.boundaries.forEach(b => {
      if (!b.id) b.id = uid();
      if (!b.size) b.size = { mode: "streaming", distance: 2, width: null, height: null };
      if (!b.autoHandler) b.autoHandler = { enabled: true, spawnMap: 1, boundaries: [] };
      if (!Array.isArray(b.maps)) b.maps = [];
      if (!Array.isArray(b.preloads)) b.preloads = [];
      if (b.kind !== "spawn" && b.kind !== "unspawn") b.kind = "spawn";
      if (!b.updateMode) b.updateMode = "Movement";
      if (typeof b.enabled !== "boolean") b.enabled = true;
    });

    selectedId = state.boundaries[0]?.id || null;
    activeTab = "general";
    renderAll();
    setStatus("Imported JSON.", file.name);
  }

  // ----------------------------
  // Wire events
  // ----------------------------
  function wireEvents() {
    // topbar
    el.newProjectBtn.onclick = () => newProject();
    el.exportBtn.onclick = () => exportJson();
    el.importFile.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await importJsonFile(file);
      } catch (err) {
        console.error(err);
        setStatus("Import failed.", err.message || String(err));
      } finally {
        e.target.value = ""; // allow re-import same file
      }
    };

    // left panel
    el.addBoundaryBtn.onclick = () => addBoundary("spawn");
    el.addStreamingPresetBtn.onclick = () => addStreamingPresets();
    el.globalMaps.oninput = (e) => {
      state.global.streamingMaps = parseNumberList(e.target.value);
      setStatus("Global streaming maps updated.", state.global.streamingMaps.join(","));
    };

    // empty actions
    el.emptyAddBoundaryBtn.onclick = () => addBoundary("spawn");
    el.emptyAddPresetBtn.onclick = () => addStreamingPresets();

    // editor header
    el.deleteBoundaryBtn.onclick = () => deleteSelectedBoundary();

    el.selectedEnabledToggle.onchange = (e) => {
      const b = getSelectedBoundary();
      if (!b) return;
      b.enabled = !!e.target.checked;
      renderAll();
      setStatus("Enabled toggled.", b.enabled ? "Enabled" : "Disabled");
    };

    // tabs
    el.editorTabs.onclick = (e) => {
      const btn = e.target.closest(".tab");
      if (!btn || btn.disabled) return;
      activeTab = btn.dataset.tab;
      renderAll();
    };

    // general fields
    el.bName.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.name = e.target.value;
      renderAll();
    };
    el.bKind.onchange = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.kind = e.target.value;
      renderAll();
    };
    el.bMaps.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.maps = parseNumberList(e.target.value);
      setStatus("Maps updated.", b.maps.join(","));
    };
    el.bThickness.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.thickness = Number(e.target.value || 1);
    };
    el.bUpdateMode.onchange = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.updateMode = e.target.value;
    };
    el.bWait.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.wait = Number(e.target.value || 0);
    };
    el.bType.onchange = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.type = e.target.value;
    };
    el.bMaxEvents.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.maxEvents = Number(e.target.value || 0);
    };

    // size fields
    el.sizeStreaming.onchange = () => {
      const b = getSelectedBoundary(); if (!b) return;
      b.size.mode = "streaming";
      if (typeof b.size.distance !== "number") b.size.distance = 2;
      renderAll();
    };
    el.sizeFixed.onchange = () => {
      const b = getSelectedBoundary(); if (!b) return;
      b.size.mode = "fixed";
      b.size.width = b.size.width ?? 31;
      b.size.height = b.size.height ?? 21;
      renderAll();
    };
    el.bDistance.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.size.distance = Number(e.target.value || 0);
    };
    el.bWidth.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.size.width = Number(e.target.value || 1);
    };
    el.bHeight.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.size.height = Number(e.target.value || 1);
    };

    // auto handler
    el.ahEnabled.onchange = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.autoHandler.enabled = !!e.target.checked;
    };
    el.ahSpawnMap.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.autoHandler.spawnMap = Number(e.target.value || 1);
    };
    el.ahBoundaries.oninput = (e) => {
      const b = getSelectedBoundary(); if (!b) return;
      b.autoHandler.boundaries = parseStringList(e.target.value);
    };

    // preloads (basic add only; edit UI comes next)
    el.addPreloadXYBtn.onclick = () => {
      const b = getSelectedBoundary();
      if (!b || b.kind !== "spawn") return;
      b.preloads.push({
        mode: "xy",
        spawnMap: b.autoHandler?.spawnMap ?? 1,
        spawnEventId: 1,
        mapId: (b.maps?.[0] ?? state.global.streamingMaps?.[0] ?? 1),
        x: 0,
        y: 0
      });
      renderAll();
      setStatus("XY preload added.");
    };

    el.addPreloadRegionBtn.onclick = () => {
      const b = getSelectedBoundary();
      if (!b || b.kind !== "spawn") return;
      b.preloads.push({
        mode: "region",
        spawnMap: b.autoHandler?.spawnMap ?? 1,
        spawnEventId: 1,
        mapId: (b.maps?.[0] ?? state.global.streamingMaps?.[0] ?? 1),
        regions: [1],
        quantity: 10
      });
      renderAll();
      setStatus("Region preload added.");
    };
  }

  // ----------------------------
  // Init
  // ----------------------------
  wireEvents();
  renderAll();
})();
