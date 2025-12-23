let state = {
  version: 1,
  boundaries: []
};

let selectedIndex = -1;

const boundaryListEl = document.getElementById("boundaryList");
const editorEl = document.getElementById("editorContent");

function renderBoundaryList() {
  boundaryListEl.innerHTML = "";

  state.boundaries.forEach((b, i) => {
    const li = document.createElement("li");
    li.textContent = b.name || "(unnamed)";
    li.onclick = () => selectBoundary(i);
    if (i === selectedIndex) li.classList.add("active");
    boundaryListEl.appendChild(li);
  });
}

function selectBoundary(index) {
  selectedIndex = index;
  renderEditor();
  renderBoundaryList();
}

function renderEditor() {
  if (selectedIndex === -1) {
    editorEl.textContent = "Select a boundary to edit";
    return;
  }

  const b = state.boundaries[selectedIndex];

  editorEl.innerHTML = `
    <label>Name
      <input value="${b.name}" id="b_name">
    </label>

    <label>Type
      <select id="b_type">
        <option value="spawn" ${b.type === "spawn" ? "selected" : ""}>Spawn</option>
        <option value="unspawn" ${b.type === "unspawn" ? "selected" : ""}>Unspawn</option>
      </select>
    </label>
  `;

  document.getElementById("b_name").oninput = e => {
    b.name = e.target.value;
    renderBoundaryList();
  };

  document.getElementById("b_type").onchange = e => {
    b.type = e.target.value;
  };
}

document.getElementById("addBoundary").onclick = () => {
  state.boundaries.push(Schema.boundaryTemplate());
  renderBoundaryList();
};

