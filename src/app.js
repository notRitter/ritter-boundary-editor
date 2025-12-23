let boundaries = [];

const listEl = document.getElementById("boundaryList");

document.getElementById("addBoundary").onclick = () => {
  boundaries.push(createEmptyBoundary());
  render();
};

document.getElementById("exportJson").onclick = () => {
  const blob = new Blob([JSON.stringify(boundaries, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ritter-boundaries.json";
  a.click();
};

document.getElementById("importJson").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then(text => {
    boundaries = JSON.parse(text);
    render();
  });
};

function render() {
  listEl.innerHTML = "";
  boundaries.forEach((b, i) => {
    const div = document.createElement("div");
    div.className = "boundary";
    div.innerHTML = `
      <label>Name <input value="${b.name}" /></label><br/>
      <label>Kind 
        <select>
          <option>spawn</option>
          <option>unspawn</option>
        </select>
      </label><br/>
      <label>Size Mode 
        <select>
          <option>streaming</option>
          <option>fixed</option>
        </select>
      </label>
    `;
    listEl.appendChild(div);
  });
}
