const STORAGE_KEY = 'rutina_progreso_v2';
const statusText = document.getElementById('statusText');

const MUSCLE_NAMES = {
  espalda:'Espalda', pecho:'Pecho', biceps:'Bíceps', triceps:'Tríceps',
  delts_lat:'Deltoide lateral', delts_post:'Deltoide posterior', delts_ant:'Deltoide anterior',
  cuadriceps:'Cuádriceps', isquios:'Isquios/Glúteo', gemelos:'Gemelos',
  antebrazo:'Antebrazo', abdomen:'Abdomen', trapecio:'Trapecio'
};

// Natación
const swA_en = document.getElementById('swA_en');
const swA_m  = document.getElementById('swA_m');
const swB_en = document.getElementById('swB_en');
const swB_m  = document.getElementById('swB_m');
const swTotal = document.getElementById('swTotal');
const swTotalAside = document.getElementById('swTotalAside');

function collectRows(){
  return Array.from(document.querySelectorAll('tbody tr')).filter(r => r.dataset.muscle);
}
function rowActive(row){
  if (row.dataset.optional){
    const chk = row.querySelector('.toggle');
    return chk && chk.checked;
  }
  return true;
}
function rowSets(row){
  const inp = row.querySelector('.seriesInput');
  if (!inp) return 0;
  return Number(inp.value || 0);
}

function recalc(){
  const totals = {};
  for (const r of collectRows()){
    const muscle = r.dataset.muscle;
    if (!totals[muscle]) totals[muscle]=0;
    if (rowActive(r)) totals[muscle] += rowSets(r);
  }
  renderSummary(totals);
  recalcSwim();
}

function renderSummary(totals){
  const cont = document.getElementById('summary');
  cont.innerHTML = '';
  const order = ['espalda','pecho','biceps','triceps','delts_lat','delts_post','delts_ant','cuadriceps','isquios','gemelos','trapecio','antebrazo','abdomen'];
  for (const m of order){
    const val = totals[m] || 0;
    const div = document.createElement('div');
    div.className = 'muscleRow';
    div.innerHTML = `<span>${MUSCLE_NAMES[m]}</span><span>${val} sets/sem</span>`;
    cont.appendChild(div);
  }
}

function recalcSwim(){
  const a = swA_en && swA_en.checked ? Number(swA_m.value||0) : 0;
  const b = swB_en && swB_en.checked ? Number(swB_m.value||0) : 0;
  const total = (isNaN(a)?0:a) + (isNaN(b)?0:b);
  if (swTotal) swTotal.textContent = total;
  if (swTotalAside) swTotalAside.textContent = total;
  return total;
}

// ---------- Persistence (localStorage) ----------
function serialize(){
  const rows = collectRows();
  const data = { rows: [], ts: Date.now() };
  rows.forEach(r => {
    const entry = {
      muscle: r.dataset.muscle,
      optional: !!r.dataset.optional,
      active: rowActive(r),
      series: rowSets(r),
      fields: {}
    };
    r.querySelectorAll('[data-field]').forEach(cell => {
      entry.fields[cell.dataset.field] = cell.innerText;
    });
    const chk = r.querySelector('.toggle');
    if (chk) entry.toggle = chk.checked;
    data.rows.push(entry);
  });
  // swim
  data.swim = {
    A: { en: swA_en ? swA_en.checked : false, m: swA_m ? Number(swA_m.value||0) : 0 },
    B: { en: swB_en ? swB_en.checked : false, m: swB_m ? Number(swB_m.value||0) : 0 },
    total: recalcSwim()
  };
  return data;
}

function deserialize(data){
  if (!data) return;
  if (data.rows){
    const rows = collectRows();
    rows.forEach((r, i) => {
      const entry = data.rows[i];
      if (!entry) return;
      const chk = r.querySelector('.toggle');
      const seriesInput = r.querySelector('.seriesInput');
      if (chk){
        chk.checked = !!entry.toggle;
        if (seriesInput) seriesInput.disabled = !chk.checked;
        r.classList.toggle('disabled', !chk.checked);
      }
      if (seriesInput){
        const min = Number(seriesInput.min), max = Number(seriesInput.max);
        let v = Number(entry.series);
        if (isNaN(v)) v = min;
        v = Math.min(max, Math.max(min, v));
        seriesInput.value = v;
      }
      r.querySelectorAll('[data-field]').forEach(cell => {
        const val = entry.fields && entry.fields[cell.dataset.field];
        if (typeof val === 'string') cell.innerText = val;
      });
    });
  }
  if (data.swim){
    if (swA_en) swA_en.checked = !!data.swim.A?.en;
    if (swA_m && typeof data.swim.A?.m === 'number') swA_m.value = data.swim.A.m;
    if (swB_en) swB_en.checked = !!data.swim.B?.en;
    if (swB_m && typeof data.swim.B?.m === 'number') swB_m.value = data.swim.B.m;
  }
  recalc();
}

function saveNow(){
  try {
    const payload = serialize();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const d = new Date(payload.ts);
    statusText.textContent = 'Guardado ' + d.toLocaleString();
  } catch(e){
    console.error(e);
    statusText.textContent = 'Error al guardar (localStorage lleno o bloqueado)';
  }
}
function loadSaved(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw){ statusText.textContent = 'Sin datos guardados'; recalc(); return; }
    const data = JSON.parse(raw);
    deserialize(data);
    const d = new Date(data.ts);
    statusText.textContent = 'Cargado ' + d.toLocaleString();
  } catch(e){
    console.error(e);
    statusText.textContent = 'No se pudo cargar';
  }
}

// Auto-save (debounced)
let t;
function scheduleSave(){ clearTimeout(t); t = setTimeout(saveNow, 400); }

document.addEventListener('input', (e)=>{
  if (e.target.classList.contains('seriesInput')){
    const inp = e.target;
    const min = Number(inp.min), max = Number(inp.max);
    if (inp.value==='') inp.value = min;
    let v = Number(inp.value);
    if (v<min) v=min;
    if (v>max) v=max;
    inp.value = v;
    recalc();
    scheduleSave();
  }
  if (e.target.matches('[data-field]')){
    scheduleSave();
  }
  if (e.target.id === 'swA_m' || e.target.id === 'swB_m'){
    recalcSwim();
    scheduleSave();
  }
});

document.addEventListener('change', (e)=>{
  if (e.target.classList.contains('toggle')){
    const row = e.target.closest('tr');
    const input = row.querySelector('.seriesInput');
    if (input) input.disabled = !e.target.checked;
    row.classList.toggle('disabled', !e.target.checked);
    recalc();
    scheduleSave();
  }
  if (e.target.id === 'swA_en' || e.target.id === 'swB_en'){
    recalcSwim();
    scheduleSave();
  }
});

document.getElementById('saveNow').addEventListener('click', saveNow);

document.getElementById('exportBtn').addEventListener('click', ()=>{
  const data = JSON.stringify(serialize(), null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'rutina_guardada.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', ()=>{
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      deserialize(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      statusText.textContent = 'Importado correctamente';
    } catch (err){
      alert('Archivo no válido');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  if (!confirm('¿Seguro que quieres borrar todos tus datos guardados?')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

// Init
document.querySelectorAll('tr[data-optional]').forEach(r => {
  const chk = r.querySelector('.toggle');
  const inp = r.querySelector('.seriesInput');
  if (chk && inp){
    inp.disabled = !chk.checked;
    r.classList.toggle('disabled', !chk.checked);
  }
});
loadSaved();
recalc();
