const molecule = VIBRASCOPE_DB.molecules.h2co;

const state = {
  section: "learn",
  tab: "spectrum",
  selectedModeId: "co_stretch",
  stiffnessId: "co",
  practiceModeId: null,
  expertModeId: null,
  amplitude: 1,
  rotation: 22,
  deformation: 0.35,
  lastFrame: 0,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function modeById(id) {
  return molecule.modes.find((mode) => mode.id === id) || molecule.modes[0];
}

function stiffnessById(id) {
  return molecule.stiffnessCoordinates.find((item) => item.id === id) || molecule.stiffnessCoordinates[0];
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function setSection(section) {
  state.section = section;
  $$(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.section === section));
  $$(".section").forEach((el) => el.classList.remove("active"));
  $(`#section-${section}`).classList.add("active");
  if (section === "practice" && !state.practiceModeId) newPracticeQuestion();
  if (section === "expert" && !state.expertModeId) newExpertQuestion();
}

function setTab(tab) {
  state.tab = tab;
  $$(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  $$(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  $(`#tab-${tab}`).classList.add("active");
  renderLearning();
}

function setMode(modeId) {
  state.selectedModeId = modeId;
  $("#modeSelect").value = modeId;
  renderLearning();
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function clear(node) {
  node.innerHTML = "";
}

function gaussian(x, center, width, intensity) {
  const z = (x - center) / width;
  return intensity * Math.exp(-0.5 * z * z);
}

function drawSpectrum(container, selectedId, onSelect, height = 360) {
  const width = container.clientWidth || 720;
  const minX = 900;
  const maxX = 3100;
  const pad = { left: 54, right: 22, top: 24, bottom: 48 };
  clear(container);

  const svg = svgEl("svg", { width: "100%", height, viewBox: `0 0 ${width} ${height}`, role: "img" });
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xScale = (nu) => pad.left + ((nu - minX) / (maxX - minX)) * plotW;
  const yScale = (intensity) => pad.top + plotH - intensity * plotH * 0.86;

  const bg = svgEl("rect", { x: 0, y: 0, width, height, fill: "transparent" });
  svg.appendChild(bg);

  for (let tick = 1000; tick <= 3000; tick += 500) {
    const x = xScale(tick);
    svg.appendChild(svgEl("line", { x1: x, y1: pad.top, x2: x, y2: pad.top + plotH, stroke: "#dfe8f2", "stroke-width": 1 }));
    const text = svgEl("text", { x, y: height - 18, "text-anchor": "middle", class: "axis-label" });
    text.textContent = tick;
    svg.appendChild(text);
  }

  svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top + plotH, x2: pad.left + plotW, y2: pad.top + plotH, stroke: "#9fb0c4", "stroke-width": 1.5 }));
  svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + plotH, stroke: "#9fb0c4", "stroke-width": 1.5 }));

  const xLabel = svgEl("text", { x: pad.left + plotW / 2, y: height - 3, "text-anchor": "middle", class: "axis-label" });
  xLabel.textContent = "Волновое число, см^-1";
  svg.appendChild(xLabel);

  const points = [];
  for (let i = 0; i <= 520; i += 1) {
    const nu = minX + (i / 520) * (maxX - minX);
    const y = molecule.modes.reduce((sum, mode) => sum + gaussian(nu, mode.frequency, 34, mode.intensity), 0);
    points.push([xScale(nu), yScale(Math.min(y, 1.08))]);
  }

  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  svg.appendChild(svgEl("path", { d: path, fill: "none", stroke: "#153b72", "stroke-width": 3.2, "stroke-linejoin": "round" }));

  molecule.modes.forEach((mode) => {
    const x = xScale(mode.frequency);
    const y = yScale(mode.intensity);
    const group = svgEl("g", { class: `peak-hit ${mode.id === selectedId ? "active" : ""}`, tabindex: 0 });
    group.appendChild(svgEl("line", { x1: x, y1: pad.top + plotH, x2: x, y2: y, class: "peak-line" }));
    group.appendChild(svgEl("circle", { cx: x, cy: y, r: 5, class: "peak-dot" }));
    const label = svgEl("text", { x, y: y - 12, "text-anchor": "middle", class: "svg-label" });
    label.textContent = mode.frequency;
    group.appendChild(label);
    group.addEventListener("click", () => onSelect(mode.id));
    svg.appendChild(group);
  });

  container.appendChild(svg);
}

function rotatePoint([x, y, z], rotDeg) {
  const ry = (rotDeg * Math.PI) / 180;
  const rx = (-12 * Math.PI) / 180;
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
}

function projectPoint(point, width, height, rotDeg) {
  const [x, y, z] = rotatePoint(point, rotDeg);
  const scale = Math.min(width, height) * 0.28;
  return {
    x: width / 2 + (x * 0.95 + y * 0.42) * scale,
    y: height / 2 - (z * 0.9 - y * 0.18) * scale,
    z,
  };
}

function animatedPosition(atom, mode, phase, amplitude) {
  const disp = mode.displacement[molecule.atoms.indexOf(atom)] || [0, 0, 0];
  const factor = Math.sin(phase) * amplitude;
  return atom.position.map((coord, index) => coord + disp[index] * factor);
}

function drawMolecule(container, modeId, options = {}) {
  const mode = modeById(modeId);
  const width = container.clientWidth || 520;
  const height = container.clientHeight || 360;
  const phase = options.phase ?? state.lastFrame;
  const amplitude = options.amplitude ?? state.amplitude;
  const rotation = options.rotation ?? state.rotation;
  clear(container);

  const svg = svgEl("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height}`, role: "img" });
  const defs = svgEl("defs");
  const marker = svgEl("marker", {
    id: "arrow",
    markerWidth: 10,
    markerHeight: 10,
    refX: 7,
    refY: 3,
    orient: "auto",
    markerUnits: "strokeWidth",
  });
  marker.appendChild(svgEl("path", { d: "M0,0 L0,6 L8,3 z", fill: "#2764e6" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const positions = molecule.atoms.map((atom) => animatedPosition(atom, mode, phase, amplitude));
  const projected = positions.map((pos) => projectPoint(pos, width, height, rotation));

  molecule.bonds.forEach((bond) => {
    const a = projected[bond.a];
    const b = projected[bond.b];
    const line = svgEl("line", {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      class: `bond-line ${mode.highlightBond && bond.label === mode.highlightBond ? "highlight" : ""}`,
    });
    svg.appendChild(line);
  });

  molecule.atoms.forEach((atom, index) => {
    const p = projected[index];
    const base = projectPoint(atom.position, width, height, rotation);
    const arrowEnd = {
      x: base.x + (p.x - base.x) * 1.8,
      y: base.y + (p.y - base.y) * 1.8,
    };
    if (Math.hypot(arrowEnd.x - base.x, arrowEnd.y - base.y) > 4) {
      svg.appendChild(svgEl("line", {
        x1: base.x,
        y1: base.y,
        x2: arrowEnd.x,
        y2: arrowEnd.y,
        class: "arrow-line",
        "marker-end": "url(#arrow)",
      }));
    }
  });

  molecule.atoms
    .map((atom, index) => ({ atom, p: projected[index], index }))
    .sort((a, b) => a.p.z - b.p.z)
    .forEach(({ atom, p }) => {
      svg.appendChild(svgEl("circle", {
        cx: p.x,
        cy: p.y,
        r: atom.radius,
        fill: atom.color,
        stroke: atom.element === "H" ? "#9fb0c4" : "#ffffff",
        "stroke-width": atom.element === "H" ? 2 : 3,
      }));
      const label = svgEl("text", {
        x: p.x,
        y: p.y + 1,
        class: "atom-label",
        style: `fill:${atom.element === "H" ? "#203247" : "#ffffff"}`,
      });
      label.textContent = atom.label;
      svg.appendChild(label);
    });

  const caption = svgEl("text", { x: 18, y: height - 18, class: "axis-label" });
  caption.textContent = `${mode.frequency} см^-1 — ${mode.title}`;
  svg.appendChild(caption);

  container.appendChild(svg);
}

function renderPeakCard() {
  const mode = modeById(state.selectedModeId);
  $("#peakCard").innerHTML = `
    <div class="peak-title">
      <div class="peak-frequency">${mode.frequency} см^-1</div>
      <div class="peak-type">${mode.title}</div>
    </div>
    <div class="info-block"><b>Что происходит</b><p>${mode.happens}</p></div>
    <div class="info-block"><b>Почему такой пик</b><p>${mode.why}</p></div>
    <div class="info-block"><b>Химический смысл</b><p>${mode.chemical}</p></div>
    <div class="info-block"><b>Линейная алгебра</b><p>${mode.linear}</p></div>
    <div class="tag-row">
      <span class="tag">${mode.motionType}</span>
      <span class="tag">жесткость: ${mode.stiffness}</span>
      <span class="tag">главное: ${mode.coordinate}</span>
    </div>
  `;
}

function renderModeSelect() {
  const select = $("#modeSelect");
  clear(select);
  molecule.modes.forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode.id;
    option.textContent = `${mode.frequency} см^-1 — ${mode.title}`;
    select.appendChild(option);
  });
  select.value = state.selectedModeId;
}

function renderModeGrid() {
  const container = $("#modeGrid");
  clear(container);
  molecule.modes.forEach((mode) => {
    const card = document.createElement("button");
    card.className = `mode-card ${mode.id === state.selectedModeId ? "active" : ""}`;
    card.innerHTML = `
      <strong>Мода ${mode.number}</strong>
      <span>${mode.frequency} см^-1</span>
      <p>${mode.title}</p>
      <p>${mode.short}</p>
    `;
    card.addEventListener("click", () => setMode(mode.id));
    container.appendChild(card);
  });
}

function drawStiffnessChart() {
  const container = $("#stiffnessChart");
  const selected = stiffnessById(state.stiffnessId);
  const width = container.clientWidth || 660;
  const height = 300;
  const pad = { left: 48, right: 18, top: 18, bottom: 40 };
  clear(container);

  const svg = svgEl("svg", { width: "100%", height, viewBox: `0 0 ${width} ${height}` });
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xScale = (x) => pad.left + ((x + 1) / 2) * plotW;
  const yMax = 5.8;
  const yScale = (y) => pad.top + plotH - (y / yMax) * plotH;

  for (let y = 0; y <= 5; y += 1) {
    const yy = yScale(y);
    svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: pad.left + plotW, y2: yy, stroke: "#e2eaf3" }));
  }
  svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top + plotH, x2: pad.left + plotW, y2: pad.top + plotH, stroke: "#9fb0c4" }));
  svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + plotH, stroke: "#9fb0c4" }));

  molecule.stiffnessCoordinates.forEach((coord) => {
    const pts = [];
    for (let i = 0; i <= 150; i += 1) {
      const x = -1 + (i / 150) * 2;
      const y = 0.5 * coord.k * x * x;
      pts.push([xScale(x), yScale(y)]);
    }
    const path = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
    svg.appendChild(svgEl("path", {
      d: path,
      fill: "none",
      stroke: coord.id === selected.id ? "#138a5b" : "#b9c8d8",
      "stroke-width": coord.id === selected.id ? 4 : 2,
    }));
  });

  const x = state.deformation;
  const energy = 0.5 * selected.k * x * x;
  svg.appendChild(svgEl("circle", { cx: xScale(x), cy: yScale(energy), r: 7, fill: "#153b72", stroke: "#fff", "stroke-width": 3 }));

  const label = svgEl("text", { x: pad.left + 10, y: pad.top + 22, class: "svg-label" });
  label.textContent = `${selected.label}: V = 1/2 · ${selected.k.toFixed(1)} · delta^2`;
  svg.appendChild(label);

  const energyLabel = svgEl("text", { x: pad.left + 10, y: pad.top + 44, class: "axis-label" });
  energyLabel.textContent = `При выбранной деформации энергия: ${energy.toFixed(2)} отн. ед.`;
  svg.appendChild(energyLabel);

  container.appendChild(svg);
}

function drawEnergySurface() {
  const canvas = $("#energySurface");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(520, Math.floor(rect.width * ratio));
  canvas.height = Math.max(320, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const w = rect.width || 680;
  const h = rect.height || 360;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f7fbff";
  ctx.fillRect(0, 0, w, h);

  const k1 = stiffnessById(state.stiffnessId).k;
  const k2 = 3.1;
  const coupling = 0.8;
  const scale = Math.min(w, h) * 0.18;
  const origin = { x: w * 0.5, y: h * 0.68 };

  function surface(x, y) {
    return 0.5 * k1 * x * x + 0.5 * k2 * y * y + coupling * x * y;
  }
  function project(x, y, z) {
    return {
      x: origin.x + (x - y) * scale * 1.5,
      y: origin.y - (x + y) * scale * 0.48 - z * scale * 0.28,
    };
  }
  function color(z) {
    const t = Math.max(0, Math.min(1, z / 8));
    const r = Math.round(39 + t * 185);
    const g = Math.round(100 + t * 70);
    const b = Math.round(230 - t * 150);
    return `rgb(${r},${g},${b})`;
  }

  for (let yi = -10; yi <= 10; yi += 1) {
    ctx.beginPath();
    for (let xi = -10; xi <= 10; xi += 1) {
      const x = xi / 10;
      const y = yi / 10;
      const z = surface(x, y);
      const p = project(x, y, z);
      ctx[xi === -10 ? "moveTo" : "lineTo"](p.x, p.y);
    }
    ctx.strokeStyle = "rgba(37, 75, 120, 0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let xi = -10; xi <= 10; xi += 1) {
    ctx.beginPath();
    for (let yi = -10; yi <= 10; yi += 1) {
      const x = xi / 10;
      const y = yi / 10;
      const z = surface(x, y);
      const p = project(x, y, z);
      ctx[yi === -10 ? "moveTo" : "lineTo"](p.x, p.y);
    }
    ctx.strokeStyle = "rgba(37, 75, 120, 0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let xi = -10; xi <= 10; xi += 2) {
    for (let yi = -10; yi <= 10; yi += 2) {
      const x = xi / 10;
      const y = yi / 10;
      const z = surface(x, y);
      const p = project(x, y, z);
      ctx.fillStyle = color(z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#1f3248";
  ctx.font = "700 13px Segoe UI, Arial";
  ctx.fillText("V(delta r, delta theta): энергетическая чаша устойчивой молекулы", 18, 28);
}

function renderStiffness() {
  const controls = $("#stiffnessControls");
  clear(controls);
  molecule.stiffnessCoordinates.forEach((coord) => {
    const btn = document.createElement("button");
    btn.className = `chip ${coord.id === state.stiffnessId ? "active" : ""}`;
    btn.textContent = `${coord.label}: ${coord.type}`;
    btn.addEventListener("click", () => {
      state.stiffnessId = coord.id;
      renderStiffness();
    });
    controls.appendChild(btn);
  });
  drawStiffnessChart();
  drawEnergySurface();
}

function renderInternalChanges() {
  const mode = modeById(state.selectedModeId);
  const container = $("#internalChart");
  clear(container);
  mode.internalChanges.forEach((item) => {
    container.appendChild(barRow(item.label, item.value, "#0a9fb5"));
  });
}

function barRow(label, value, color = "#2764e6") {
  const row = document.createElement("div");
  row.className = "bar-row";
  row.innerHTML = `
    <div class="bar-label">${label}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${percent(value)}; background:${color};"></div></div>
    <div class="bar-value">${percent(value)}</div>
  `;
  return row;
}

function renderHeatmap() {
  const atoms = ["O", "C", "H1", "H2"];
  const table = document.createElement("table");
  table.className = "heatmap-table";
  const head = document.createElement("tr");
  head.innerHTML = `<th>Атом</th>${molecule.modes.map((mode) => `<th>${mode.frequency}</th>`).join("")}`;
  table.appendChild(head);
  atoms.forEach((atom) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<th>${atom}</th>`;
    molecule.modes.forEach((mode) => {
      const value = mode.participation[atom] || 0;
      const cell = document.createElement("td");
      cell.className = "heat-cell";
      const alpha = 0.12 + value * 1.9;
      cell.style.background = `rgba(39, 100, 230, ${Math.min(0.92, alpha)})`;
      cell.style.color = value > 0.28 ? "#fff" : "#13243a";
      cell.textContent = percent(value);
      tr.appendChild(cell);
    });
    table.appendChild(tr);
  });
  const container = $("#atomHeatmap");
  clear(container);
  container.appendChild(table);
}

function renderAtomBars() {
  const mode = modeById(state.selectedModeId);
  const container = $("#atomBars");
  clear(container);
  Object.entries(mode.participation).forEach(([atom, value]) => {
    container.appendChild(barRow(atom, value, value > 0.3 ? "#153b72" : "#0a9fb5"));
  });
}

function renderLearning() {
  renderPeakCard();
  renderModeGrid();
  drawSpectrum($("#spectrumChart"), state.selectedModeId, setMode);
  renderStiffness();
  renderInternalChanges();
  renderHeatmap();
  renderAtomBars();
}

function randomModeId() {
  return molecule.modes[Math.floor(Math.random() * molecule.modes.length)].id;
}

function newPracticeQuestion() {
  state.practiceModeId = randomModeId();
  const mode = modeById(state.practiceModeId);
  $("#practiceQuestion").textContent = `Какое движение соответствует пику ${mode.frequency} см^-1?`;
  const options = [...mode.options].sort(() => Math.random() - 0.5);
  const box = $("#practiceOptions");
  clear(box);
  options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "answer-btn";
    btn.textContent = option;
    btn.addEventListener("click", () => checkPracticeAnswer(btn, option, mode));
    box.appendChild(btn);
  });
  $("#practiceFeedback").className = "feedback-box muted";
  $("#practiceFeedback").textContent = "Выберите ответ, и здесь появится разбор.";
  drawSpectrum($("#practiceMiniSpectrum"), mode.id, () => {});
  drawMolecule($("#practiceMiniMolecule"), mode.id, { phase: Math.PI / 3, amplitude: 1.1, rotation: 24 });
}

function checkPracticeAnswer(button, option, mode) {
  const correct = normalize(option) === normalize(mode.title);
  $$("#practiceOptions .answer-btn").forEach((btn) => {
    btn.disabled = true;
    if (normalize(btn.textContent) === normalize(mode.title)) btn.classList.add("correct");
  });
  if (!correct) button.classList.add("wrong");
  const feedback = $("#practiceFeedback");
  feedback.className = "feedback-box";
  feedback.innerHTML = correct
    ? `<b>Верно.</b> ${mode.short}<br><br>${mode.why}`
    : `<b>Не совсем.</b> Правильный ответ: <b>${mode.title}</b>.<br><br>${mode.happens}<br><br>${mode.why}`;
  state.selectedModeId = mode.id;
  renderPeakCard();
}

function newExpertQuestion() {
  state.expertModeId = randomModeId();
  const mode = modeById(state.expertModeId);
  $("#expertPrompt").textContent = `Пик: ${mode.frequency} см^-1`;
  ["#expertType", "#expertCoordinate", "#expertAtoms", "#expertStiffness", "#expertMeaning"].forEach((id) => {
    $(id).value = "";
  });
  $("#expertResult").className = "feedback-box muted";
  $("#expertResult").textContent = "После проверки здесь появится подробный ответ.";
}

function normalize(text) {
  return text.toLowerCase().replaceAll("ё", "е").trim();
}

function includesAny(text, keywords) {
  const normalized = normalize(text);
  return keywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function checkExpertAnswer() {
  const mode = modeById(state.expertModeId);
  const type = $("#expertType").value;
  const coord = $("#expertCoordinate").value;
  const atoms = $("#expertAtoms").value;
  const stiff = $("#expertStiffness").value;
  const meaning = $("#expertMeaning").value;
  const checks = [
    { label: "тип движения", ok: includesAny(type, mode.answerKeywords.concat(mode.motionType.split(" "))) },
    { label: "связь или угол", ok: includesAny(coord, [mode.coordinate, "c=o", "c-h", "h-c-h", "ch2"]) },
    { label: "атомы", ok: includesAny(atoms, mode.mainAtoms.concat(["водород", "углерод", "кислород"])) },
    { label: "жесткость", ok: includesAny(stiff, [mode.stiffness]) },
    { label: "химический смысл", ok: meaning.trim().length > 20 },
  ];
  const score = checks.filter((item) => item.ok).length;
  const result = $("#expertResult");
  result.className = "feedback-box";
  result.innerHTML = `
    <b>Результат: ${score} из ${checks.length}</b>
    <br><br>
    ${checks.map((item) => `${item.ok ? "Верно" : "Нужно уточнить"}: ${item.label}`).join("<br>")}
    <br><br>
    <b>Правильный разбор:</b><br>
    Тип движения: ${mode.motionType}.<br>
    Связь или угол: ${mode.coordinate}.<br>
    Основные атомы: ${mode.mainAtoms.join(", ")}.<br>
    Жесткость: ${mode.stiffness}.<br>
    Химический смысл: ${mode.chemical}<br><br>
    ${mode.why}
  `;
}

function renderDatabase() {
  const container = $("#databaseTable");
  const rows = molecule.modes
    .map((mode) => `<tr><td>${mode.frequency}</td><td>${mode.title}</td><td>${mode.motionType}</td><td>${mode.coordinate}</td></tr>`)
    .join("");
  container.innerHTML = `
    <table class="heatmap-table">
      <tr><th>Пик, см^-1</th><th>Описание</th><th>Тип</th><th>Координата</th></tr>
      ${rows}
    </table>
  `;
  $("#dataPreview").textContent = JSON.stringify(
    {
      molecule: molecule.formula,
      atoms: molecule.atoms,
      bonds: molecule.bonds,
      modes: molecule.modes.map(({ frequency, title, motionType, coordinate, stiffness }) => ({
        frequency,
        title,
        motionType,
        coordinate,
        stiffness,
      })),
    },
    null,
    2,
  );
}

function downloadData() {
  const blob = new Blob([JSON.stringify(VIBRASCOPE_DB, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vibrascope-data.json";
  link.click();
  URL.revokeObjectURL(url);
}

function animate(time) {
  state.lastFrame = time / 540;
  const viewer = $("#moleculeViewer");
  if (viewer && state.section === "learn") {
    drawMolecule(viewer, state.selectedModeId);
  }
  requestAnimationFrame(animate);
}

function bindEvents() {
  $$(".nav-btn").forEach((btn) => btn.addEventListener("click", () => setSection(btn.dataset.section)));
  $$(".tab-btn").forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));
  $("#modeSelect").addEventListener("change", (event) => setMode(event.target.value));
  $("#ampSlider").addEventListener("input", (event) => {
    state.amplitude = Number(event.target.value);
  });
  $("#rotSlider").addEventListener("input", (event) => {
    state.rotation = Number(event.target.value);
  });
  $("#deformSlider").addEventListener("input", (event) => {
    state.deformation = Number(event.target.value);
    drawStiffnessChart();
    drawEnergySurface();
  });
  $("#newPractice").addEventListener("click", newPracticeQuestion);
  $("#newExpert").addEventListener("click", newExpertQuestion);
  $("#checkExpert").addEventListener("click", checkExpertAnswer);
  $("#downloadData").addEventListener("click", downloadData);
  window.addEventListener("resize", () => {
    renderLearning();
    renderDatabase();
  });
}

function init() {
  renderModeSelect();
  bindEvents();
  renderLearning();
  renderDatabase();
  newPracticeQuestion();
  newExpertQuestion();
  requestAnimationFrame(animate);
}

init();
