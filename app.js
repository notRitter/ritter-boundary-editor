// app.js
(() => {
  const state = {
    meta: { version: 1, tool: "Ritter Boundary Builder" },
    global: { streamingMaps: [] },
    boundaries: []
  };

  let selectedId = null;
  let activeTab = "general";

  const uid = () => "b_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const byId = (id) => document.getElementById(id);

  const parseNumberList = (s) =>
    String(s || "")
      .split(",")
      .map(x => Number(x.trim()))
      .filter(n => Number.isFinite(n));

  function setStatus(text, meta = "") {
    byId("statusText").textContent = text;
    byId("statusMeta").textContent = meta;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeBoundaryBase(kind = "spawn") {
    return {
      id: uid(),
      name: kind === "spawn" ? "New Spawn Boundary" : "New Unspawn Boundary",
      kind,
      maps: [],
      size: { mode: "streaming", distance: 2, width: null, height: null },
      thickness: 1,
      type: "FillOn",
      updateMode: "Movement",
      wait: 10,
      maxEvents: 400,
      enabled: true,
      autoHandler: {
        enabled: true,
        // spawn boundaries use spawnMaps array
        spawnMaps: [1],
        // unspawn boundaries use boundaries list
        boundaries: []
      },
      preloads: []
    };
  }

  function getSelectedBoundary() {
    return state.boundaries.find(b => b.id === selectedId) || null;
  }

  // DOM
  const el = {
    newProjectBtn: byId("newProjectBtn"),
    importFile: byId("importFile"),
    exportBtn: byId("exportBtn"),

    addBoundaryBtn: byId("addBoundaryBtn"),
    addStreamingPresetBtn: byId("addStreamingPresetBtn"),
    boundaryList: byId("boundaryList"),
    globalMaps: byId("globalMaps"),

    editorTitle: byId("editorTitle"),
    editorSubtitle: byId("editorSubtitle"),
    deleteBoundaryBtn: byId("deleteBoundaryBtn"),
    selectedKindPill: byId("selectedKindPill"),
    selectedEnabledToggle: byId("selectedEnabledToggle"),

    editorTabs: byId("editorTabs"),
    emptyState: byId("emptyState"),
    emptyAddBoundaryBtn: byId("emptyAddBoundaryBtn"),
    emptyAddPresetBtn: byId("emptyAddPresetBtn"),

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

    // handler fields (new)
    ahEnabled: byId("ahEnabled"),
    ahSpawnFields: byId("ahSpawnFields"),
    ahUnspawnFields: byId("ahUnspawnFields"),
    ahSpawnMaps: byId("ahSpawnMaps"),
    ahBoundariesChecklist: byId("ahBoundariesChecklist"),

    // preloads
    addPreloadXYBtn: byId("addPreloadXYBtn"),
    addPreloadRegionBtn: byId("addPreloadRegionBtn"),
    preloadList: byId("preloadList"),
    preloadFilter: byId("preloadFilter")
  };

  function setInvalid(inputEl, invalid, messageEl = null, message = "") {
    if (!inputEl) return;
    inputEl.classList.toggle("is-invalid", !!invalid);
    if (messageEl) {
      messageEl.classList.toggle("help--error", !!invalid);
      if (message) messageEl.textContent = message;
    }
  }
  
  function anyStreamingBoundariesExist() {
    return state.boundaries.some(b => b?.size?.mode === "streaming");
  }
  
  // Mirrors global streaming maps into each streaming boundary.maps (non-destructive-ish)
  // Rule: if boundary is streaming AND boundary.maps is empty, copy from global.
  function mirrorGlobalMapsToStreamingBoundaries() {
    const g = state.global.streamingMaps || [];
    if (!Array.isArray(g) || g.length === 0) return;
  
    for (const b of state.boundaries) {
      if (b?.size?.mode !== "streaming") continue;
      if (!Array.isArray(b.maps) || b.maps.length === 0) {
        b.maps = g.slice();
      }
    }
  }
  
  // Returns {ok:boolean, errors:string[]}
  function validateProject() {
    const errors = [];
  
    if (!Array.isArray(state.boundaries) || state.boundaries.length === 0) {
      errors.push("Add at least one boundary before exporting.");
    }
  
    // If any streaming boundaries exist, global maps must not be empty
    if (anyStreamingBoundariesExist()) {
      if (!Array.isArray(state.global.streamingMaps) || state.global.streamingMaps.length === 0) {
        errors.push("Global Streaming Maps is required when you have streaming boundaries.");
      }
    }
  
    // Basic boundary-level checks
    const names = new Set();
    for (const b of state.boundaries) {
      if (!b.name || !b.name.trim()) errors.push("A boundary is missing a name.");
      const key = (b.name || "").trim().toLowerCase();
      if (key) {
        if (names.has(key)) errors.push(`Duplicate boundary name: "${b.name}"`);
        names.add(key);
      }
  
      if (b.size?.mode === "fixed") {
        if (!Number.isFinite(Number(b.size.width)) || Number(b.size.width) <= 0) errors.push(`Fixed width invalid for "${b.name}"`);
        if (!Number.isFinite(Number(b.size.height)) || Number(b.size.height) <= 0) errors.push(`Fixed height invalid for "${b.name}"`);
      } else if (b.size?.mode === "streaming") {
        if (!Number.isFinite(Number(b.size.distance)) || Number(b.size.distance) < 0) errors.push(`Streaming distance invalid for "${b.name}"`);
      }
  
      if (b.kind === "spawn") {
        const spawnMaps = b.autoHandler?.spawnMaps || [];
        if (b.autoHandler?.enabled && (!Array.isArray(spawnMaps) || spawnMaps.length === 0)) {
          errors.push(`Spawn boundary "${b.name}" auto handler requires Spawn Map ID(s).`);
        }
      } else {
        const targets = b.autoHandler?.boundaries || [];
        if (b.autoHandler?.enabled && (!Array.isArray(targets) || targets.length === 0)) {
          errors.push(`Unspawn boundary "${b.name}" should target at least one spawn boundary.`);
        }
      }
    }
  
    return { ok: errors.length === 0, errors };
  }

  
  // ----------------------------
  // Render
  // ----------------------------
  function renderGlobalMaps() {
    el.globalMaps.value = state.global.streamingMaps.join(",");
  }

  function renderBoundaryList() {
    el.boundaryList.innerHTML = "";

    if (state.boundaries.length === 0) {
      const msg = document.createElement("div");
      msg.className = "help";
      msg.textContent = "No boundaries yet. Add one or use presets.";
      el.boundaryList.appendChild(msg);
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
      const sizeMeta = b.size.mode === "streaming"
        ? `Streaming (d=${b.size.distance ?? 0})`
        : `Fixed (${b.size.width ?? "?"}×${b.size.height ?? "?"})`;

      li.innerHTML = `
        <div class="listItem__main">
          <div class="listItem__name">${escapeHtml(b.name || "(unnamed)")}</div>
          <div class="listItem__meta">${enabledLabel} • ${sizeMeta}</div>
        </div>
        <span class="badge ${badgeClass}">${kindLabel}</span>
      `;
      el.boundaryList.appendChild(li);
    });
  }

  function setTabVisibilityForKind(kind) {
    // Hide Preloads tab button for unspawn boundaries
    const preloadsBtn = el.editorTabs.querySelector('[data-tab="preloads"]');
    if (preloadsBtn) {
      preloadsBtn.style.display = (kind === "spawn") ? "" : "none";
      // If we are on preloads tab and switch to unspawn, force to general
      if (kind !== "spawn" && activeTab === "preloads") activeTab = "general";
    }
  }

  function renderEditorShell() {
    const b = getSelectedBoundary();
    const has = !!b;

    if (el.emptyState) {
      el.emptyState.hidden = has;
      el.emptyState.style.display = has ? "none" : "";
    }


    el.deleteBoundaryBtn.disabled = !has;
    el.selectedEnabledToggle.disabled = !has;

    // tabs enable/disable & active state
    [...el.editorTabs.querySelectorAll(".tab")].forEach(btn => {
      btn.disabled = !has;
      btn.classList.toggle("tab--active", has && btn.dataset.tab === activeTab);
    });

    if (!has) {
      el.editorTitle.textContent = "Select a boundary";
      el.editorSubtitle.textContent = "Choose one on the left to edit properties";
      el.selectedKindPill.textContent = "—";
      el.selectedEnabledToggle.checked = false;

      el.tabGeneral.hidden = true;
      el.tabSize.hidden = true;
      el.tabHandler.hidden = true;
      el.tabPreloads.hidden = true;
      return;
    }

    setTabVisibilityForKind(b.kind);

    el.editorTitle.textContent = b.name || "(unnamed)";
    el.editorSubtitle.textContent = `${b.kind === "spawn" ? "Spawn boundary" : "Unspawn boundary"} • ID: ${b.id}`;
    el.selectedKindPill.textContent = b.kind === "spawn" ? "Spawn" : "Unspawn";
    el.selectedEnabledToggle.checked = !!b.enabled;

    el.tabGeneral.hidden = activeTab !== "general";
    el.tabSize.hidden = activeTab !== "size";
    el.tabHandler.hidden = activeTab !== "handler";
    el.tabPreloads.hidden = activeTab !== "preloads";
  }

  function renderHandlerChecklist(b) {
    // Only for unspawn boundaries
    el.ahBoundariesChecklist.innerHTML = "";

    const spawnBoundaries = state.boundaries.filter(x => x.kind === "spawn");
    if (spawnBoundaries.length === 0) {
      const msg = document.createElement("div");
      msg.className = "help";
      msg.textContent = "No spawn boundaries exist yet. Add spawn boundaries first.";
      el.ahBoundariesChecklist.appendChild(msg);
      return;
    }

    const selected = new Set(b.autoHandler.boundaries || []);

    spawnBoundaries.forEach(sb => {
      const row = document.createElement("label");
      row.className = "checkItem";

      const checked = selected.has(sb.name);

      row.innerHTML = `
        <input type="checkbox" ${checked ? "checked" : ""} />
        <div class="checkItem__text">
          <div class="checkItem__name">${escapeHtml(sb.name)}</div>
          <div class="checkItem__meta">${sb.enabled ? "Enabled" : "Disabled"}</div>
        </div>
      `;

      const cb = row.querySelector("input");
      cb.onchange = () => {
        const set = new Set(b.autoHandler.boundaries || []);
        if (cb.checked) set.add(sb.name);
        else set.delete(sb.name);
        b.autoHandler.boundaries = Array.from(set);
        setStatus("Unspawn targets updated.", b.autoHandler.boundaries.join(", "));
      };

      el.ahBoundariesChecklist.appendChild(row);
    });
  }

  function renderEditorFields() {
    const b = getSelectedBoundary();
    if (!b) return;

    // Ensure empty state stays hidden when selected
    el.emptyState.hidden = true;

    // General
    el.bName.value = b.name ?? "";
    el.bKind.value = b.kind ?? "spawn";
    el.bMaps.value = (b.maps || []).join(",");
    el.bThickness.value = Number(b.thickness ?? 1);
    el.bUpdateMode.value = b.updateMode ?? "Movement";
    el.bWait.value = Number(b.wait ?? 0);

    // Spawn-only fields
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

    // Spawn boundaries: show spawn map list
    // Unspawn boundaries: hide spawn map list, show checklist
    el.ahSpawnFields.style.display = (b.kind === "spawn") ? "" : "none";
    el.ahUnspawnFields.style.display = (b.kind === "unspawn") ? "" : "none";

    if (b.kind === "spawn") {
      const maps = b.autoHandler?.spawnMaps || [1];
      el.ahSpawnMaps.value = maps.join(",");
    } else {
      renderHandlerChecklist(b);
    }

    // Preloads section only for spawn boundaries (tab is hidden too)
    el.tabPreloads.querySelector(".card").style.display = b.kind === "spawn" ? "" : "none";
    renderPreloadList(b);
  }

  function renderPreloadList(b) {
    el.preloadList.innerHTML = "";
    if (b.kind !== "spawn") return;
  
    const filter = String(el.preloadFilter?.value || "").trim().toLowerCase();
  
    const preloads = Array.isArray(b.preloads) ? b.preloads : [];
    const filtered = preloads
      .map((p, idx) => ({ p, idx }))
      .filter(({ p, idx }) => {
        if (!filter) return true;
        const hay = [
          p.mode,
          p.mapId, p.spawnMap, p.spawnEventId,
          p.x, p.y,
          Array.isArray(p.regions) ? p.regions.join(",") : "",
          p.quantity,
          idx
        ].join(" ").toLowerCase();
        return hay.includes(filter);
      });
  
    if (preloads.length === 0) {
      const msg = document.createElement("div");
      msg.className = "help";
      msg.textContent = "No preloads yet. Add XY or Region preloads.";
      el.preloadList.appendChild(msg);
      return;
    }
  
    if (filtered.length === 0) {
      const msg = document.createElement("div");
      msg.className = "help";
      msg.textContent = "No preloads match your filter.";
      el.preloadList.appendChild(msg);
      return;
    }
  
    filtered.forEach(({ p, idx }) => {
      const card = document.createElement("div");
      card.className = "card";
  
      const title =
        p.mode === "xy"
          ? `XY: map ${p.mapId} @ (${p.x},${p.y})`
          : `Region: map ${p.mapId} regions [${(p.regions || []).join(",")}] × ${p.quantity || 1}`;
  
      card.innerHTML = `
        <div class="card__title">${escapeHtml(title)}</div>
        <div class="card__desc">spawnMap ${p.spawnMap} • eventId ${p.spawnEventId} • #${idx + 1}</div>
  
        <div class="row" style="margin-top:10px; gap:10px; flex-wrap:wrap;">
          <button class="btn btn--ghost" data-up="${idx}">↑ Up</button>
          <button class="btn btn--ghost" data-down="${idx}">↓ Down</button>
          <button class="btn btn--danger btn--ghost" data-del="${idx}">Delete</button>
        </div>
      `;
  
      card.querySelector(`[data-del="${idx}"]`).onclick = () => {
        b.preloads.splice(idx, 1);
        renderAll();
        setStatus("Preload deleted.");
      };
  
      card.querySelector(`[data-up="${idx}"]`).onclick = () => {
        if (idx <= 0) return;
        const tmp = b.preloads[idx - 1];
        b.preloads[idx - 1] = b.preloads[idx];
        b.preloads[idx] = tmp;
        renderAll();
        setStatus("Preload moved up.");
      };
  
      card.querySelector(`[data-down="${idx}"]`).onclick = () => {
        if (idx >= b.preloads.length - 1) return;
        const tmp = b.preloads[idx + 1];
        b.preloads[idx + 1] = b.preloads[idx];
        b.preloads[idx] = tmp;
        renderAll();
        setStatus("Preload moved down.");
      };
  
      el.preloadList.appendChild(card);
    });
  }


  function renderAll() {
    // If nothing selected but boundaries exist, auto-select first
    if (!selectedId && state.boundaries.length > 0) {
      selectedId = state.boundaries[0].id;
    }

    renderGlobalMaps();
    renderBoundaryList();
    renderEditorShell();
    renderEditorFields();

    // Validation + export enable/disable
    const v = validateProject();
    el.exportBtn.disabled = !v.ok;
    
    // highlight global maps when required
    const needsGlobalMaps = anyStreamingBoundariesExist();
    const globalEmpty = !state.global.streamingMaps || state.global.streamingMaps.length === 0;
    setInvalid(el.globalMaps, needsGlobalMaps && globalEmpty);
    
    // status message
    if (!v.ok) {
      setStatus("Fix issues before export.", v.errors[0] || "");
    } else {
      setStatus("Ready.", `Boundaries: ${state.boundaries.length}`);
    }
  }

  // ----------------------------
  // Actions
  // ----------------------------
  function addBoundary(kind = "spawn") {
    const b = makeBoundaryBase(kind);
    state.boundaries.push(b);

    // Always auto-select newly created boundary
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

    const startIndex = state.boundaries.length;

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
      b.autoHandler.spawnMaps = [1]; // default
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
      b.autoHandler.boundaries = Array.isArray(p.boundaries) ? p.boundaries.slice() : [];
      state.boundaries.push(b);
    });

    // Auto-select the first preset we just added
    if (state.boundaries.length > startIndex) {
      selectedId = state.boundaries[startIndex].id;
      activeTab = "general";
    }

    renderAll();
    setStatus("Streaming presets added.", `+${state.boundaries.length - startIndex}`);
  }

  function deleteSelectedBoundary() {
    const b = getSelectedBoundary();
    if (!b) return;

    const idx = state.boundaries.findIndex(x => x.id === b.id);
    if (idx >= 0) state.boundaries.splice(idx, 1);

    selectedId = state.boundaries[idx]?.id || state.boundaries[idx - 1]?.id || null;
    activeTab = "general";
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

  function exportJson() {
    // Mirror global maps into streaming boundaries for completeness
    mirrorGlobalMapsToStreamingBoundaries();
  
    const v = validateProject();
    renderAll(); // refresh UI highlights + export enabled state
  
    if (!v.ok) {
      alert("Cannot export yet:\n\n- " + v.errors.join("\n- "));
      return;
    }
  
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


  async function importJsonFile(file) {
    const text = await file.text();
    const json = JSON.parse(text);

    if (Array.isArray(json)) {
      state.boundaries = json;
      state.global.streamingMaps = [];
    } else {
      state.meta = json.meta || state.meta;
      state.global = json.global || state.global;
      state.boundaries = json.boundaries || [];
    }

    // Normalize
    state.boundaries.forEach(b => {
      if (!b.id) b.id = uid();
      if (!b.size) b.size = { mode: "streaming", distance: 2, width: null, height: null };
      if (!b.autoHandler) b.autoHandler = { enabled: true, spawnMaps: [1], boundaries: [] };
      if (!Array.isArray(b.maps)) b.maps = [];
      if (!Array.isArray(b.preloads)) b.preloads = [];
      if (b.kind !== "spawn" && b.kind !== "unspawn") b.kind = "spawn";
      if (!b.updateMode) b.updateMode = "Movement";
      if (typeof b.enabled !== "boolean") b.enabled = true;

      // Back-compat if older import has spawnMap instead of spawnMaps
      if (!Array.isArray(b.autoHandler.spawnMaps)) {
        if (Number.isFinite(Number(b.autoHandler.spawnMap))) {
          b.autoHandler.spawnMaps = [Number(b.autoHandler.spawnMap)];
        } else {
          b.autoHandler.spawnMaps = [1];
        }
      }
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
    if (el.preloadFilter) {
      el.preloadFilter.oninput = () => {
        renderAll();
      };
    }

    el.importFile.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await importJsonFile(file);
      } catch (err) {
        console.error(err);
        setStatus("Import failed.", err.message || String(err));
      } finally {
        e.target.value = "";
      }
    };

    // left panel
    el.addBoundaryBtn.onclick = () => addBoundary("spawn");
    el.addStreamingPresetBtn.onclick = () => addStreamingPresets();
    el.globalMaps.oninput = (e) => {
      state.global.streamingMaps = parseNumberList(e.target.value);
      mirrorGlobalMapsToStreamingBoundaries();
      renderAll();

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

    // spawn maps list (spawn only)
    el.ahSpawnMaps.oninput = (e) => {
      const b = getSelectedBoundary();
      if (!b || b.kind !== "spawn") return;
      b.autoHandler.spawnMaps = parseNumberList(e.target.value);
    };

    // preloads add buttons
    el.addPreloadXYBtn.onclick = () => {
      const b = getSelectedBoundary();
      if (!b || b.kind !== "spawn") return;
      b.preloads.push({
        mode: "xy",
        spawnMap: (b.autoHandler.spawnMaps?.[0] ?? 1),
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
        spawnMap: (b.autoHandler.spawnMaps?.[0] ?? 1),
        spawnEventId: 1,
        mapId: (b.maps?.[0] ?? state.global.streamingMaps?.[0] ?? 1),
        regions: [1],
        quantity: 10
      });
      renderAll();
      setStatus("Region preload added.");
    };
  }

  wireEvents();
  renderAll();
})();
