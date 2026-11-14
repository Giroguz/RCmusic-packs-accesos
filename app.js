/* =====================================================================
   R&Cmusic · app.js
   ---------------------------------------------------------------------
   CONFIGURACIÓN · edita solo esta parte
   backend : URL de tu aplicación web de Google Apps Script (termina en /exec).
             Vacío = modo demostración (todo queda en este navegador).
   Carpetas, precios, portadas, accesos, avisos y fondo se administran
   desde el panel de administrador (candado en el pie de página).
   ===================================================================== */
const CONFIG = {
  marca: "R&Cmusic",
  whatsapp: "51900000000",   // respaldo si aún no lo pones en Ajustes
  moneda: "S/",
  backend: "https://script.google.com/macros/s/AKfycbwjcq3hD3GdNnsjVOYfNy3UiODjC0_vol760SIlfQEgXvjh1Wz42fYRI-s9feZwABc6gA/exec",

  // Solo para el modo demostración (con backend se leen de Google Sheets)
  carpetasDemo: [
    { nombre: "Pack géneros musicales", tipo: "Audio",    precio: 35,  modalidad: "Mensual",       meses: 1,  descripcion: "Reggaetón, salsa, cumbia, bachata y electrónica, ordenados por género y BPM." },
    { nombre: "Transiciones",           tipo: "Video",    precio: 25,  modalidad: "Mensual",       meses: 1,  descripcion: "Videos de transición entre géneros con el BPM marcado, listos para pantalla." },
    { nombre: "Intros y Open Shows",    tipo: "Video",    precio: 30,  modalidad: "Único",         meses: 0,  descripcion: "Intros, cuentas regresivas y aperturas de show para empezar fuerte." },
    { nombre: "Mashups",                tipo: "Audio",    precio: 50,  modalidad: "Personalizado", meses: 3,  descripcion: "Mashups y edits exclusivos para encender la pista." },
    { nombre: "Samples / FX",           tipo: "Audio",    precio: 0,   modalidad: "Único",         meses: 0,  descripcion: "Risers, impactos, sirenas y efectos para tus mezclas." },
    { nombre: "Programas",              tipo: "Software", precio: 120, modalidad: "Anual",         meses: 12, descripcion: "Programas, skins y mapeos para tu software de DJ, con guía de instalación." }
  ]
};
/* ===================== fin de la configuración ===================== */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const hash = s => [...String(s)].reduce((h,c)=>(h*31 + c.charCodeAt(0))>>>0, 7);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const idle = fn => (window.requestIdleCallback || (f => setTimeout(f, 300)))(fn);
const store = {
  get(k, s){ try{ return JSON.parse((s?sessionStorage:localStorage).getItem(k)); }catch(_){ return null; } },
  set(k, v, s){ try{ (s?sessionStorage:localStorage).setItem(k, JSON.stringify(v)); }catch(_){} },
  del(k, s){ try{ (s?sessionStorage:localStorage).removeItem(k); }catch(_){} }
};
const LOGO = document.querySelector(".brand img").getAttribute("src");
const demoMode = () => !CONFIG.backend;

/* ---------- Google Drive ---------- */
function driveId(v){
  if(!v) return "";
  v = String(v).trim();
  const m = v.match(/folders\/([\w-]+)/) || v.match(/\/d\/([\w-]+)/) || v.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : (/^[\w-]{10,}$/.test(v) ? v : "");
}
const isDemoId = id => !id || String(id).startsWith("EJEMPLO");
// authuser = abre Drive con la cuenta aprobada (evita el "Necesitas acceso" cuando hay varias cuentas abiertas)
const au = sep => (typeof U !== "undefined" && U.cuenta) ? `${sep}authuser=${encodeURIComponent(U.cuenta.correo)}` : "";
const D = {
  preview: id => `https://drive.google.com/file/d/${id}/preview${au("?")}`,
  view:    id => `https://drive.google.com/file/d/${id}/view${au("?")}`,
  dl:      id => `https://drive.google.com/uc?export=download&confirm=t&id=${id}${au("&")}`,   // descarga directa, también archivos grandes
  folder:  id => `https://drive.google.com/drive/folders/${id}${au("?")}`,
  thumb:   (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w||400}`
};
const waLink = (num, txt) => `https://wa.me/${String(num).replace(/\D/g,"")}${txt ? "?text="+encodeURIComponent(txt) : ""}`;
function coverUrl(v){
  v = String(v || "").trim();
  if(!v) return "";
  if(/^data:image\//.test(v) || /^https?:\/\/(?!drive\.google\.com|docs\.google\.com)/.test(v) || /thumbnail\?id=/.test(v)) return v;
  const id = driveId(v);
  return id ? D.thumb(id, 1000) : "";
}

/* ---------- Formatos ---------- */
let AJ = { whatsapp:"", moneda:CONFIG.moneda, fondo:"", luces:true };
const wa = () => AJ.whatsapp || CONFIG.whatsapp;
const money = p => Number(p) > 0 ? `${AJ.moneda || CONFIG.moneda} ${Number(p).toFixed(2)}` : "Gratis";
const MODS = { "Único":0, "Mensual":1, "Anual":12, "Personalizado":null };
const mesesDe = c => { const m = MODS[c.modalidad||"Único"]; return m == null ? (Number(c.meses)||0) : m; };
const plural = n => n===1 ? "1 mes" : `${n} meses`;
function periodo(c, corto){
  const m = c.modalidad || "Único";
  if(m==="Mensual") return corto ? "/mes" : "por mes";
  if(m==="Anual") return corto ? "/año" : "por año";
  if(m==="Personalizado") return corto ? `/${plural(mesesDe(c))}` : `por ${plural(mesesDe(c))}`;
  return corto ? "" : "pago único";
}
// Etiqueta de la modalidad que define el administrador: Mensual, Anual, Por N meses o Pago único
function perLabel(c){
  if(!(Number(c.precio) > 0)) return "";
  const m = c.modalidad || "Único";
  return m === "Mensual" ? "Mensual" : m === "Anual" ? "Anual" : m === "Personalizado" ? `Por ${plural(mesesDe(c))}` : "Pago único";
}
const perClass = c => (c.modalidad || "Único") === "Único" ? "per once" : "per";
const priceBlock = c => { const free = !(Number(c.precio) > 0);
  return `<div class="pp"><strong class="amt${free?" free":""}">${free ? "Gratis" : esc(money(c.precio))}</strong>${free ? "" : `<span class="${perClass(c)}">${esc(perLabel(c))}</span>`}</div>`; };
const priceTxt = c => Number(c.precio) > 0 ? `${money(c.precio)}${periodo(c,true) ? " " + periodo(c,true) : ""}` : "Gratis";
const durTxt = c => mesesDe(c) ? `Acceso por ${plural(mesesDe(c))}` : "Acceso sin vencimiento";
const fechaCorta = s => { const d = new Date(s); return isNaN(d) ? "" : d.toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"}); };
const dias = s => Math.ceil((new Date(s).getTime() - Date.now()) / 864e5);
const hace = s => { const m = Math.round((Date.now() - new Date(s).getTime())/60000); return isNaN(m) ? "" : m < 1 ? "hace un momento" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m/60)} h` : fechaCorta(s); };
const fmtNum = n => Number(n||0).toLocaleString("es-PE");
function parseBpm(s){
  const n = String(s ?? "").match(/(\d{2,3})(?:\s*[-–a]\s*(\d{2,3}))?\s*bpm/i);
  if(!n) return null;
  const a = [n[1], n[2]].filter(Boolean).map(Number).filter(x => x >= 40 && x <= 220);
  return a.length ? { ini:a[0], fin:a[a.length-1], txt:a.join("–") } : null;
}
// Orden por BPM de inicio (en "95-128bpm" cuenta 95), luego de llegada; sin BPM al final por nombre
const byBpm = (a,b) => (a.bpm?a.bpm.ini:9999) - (b.bpm?b.bpm.ini:9999) || (a.bpm&&b.bpm ? a.bpm.fin-b.bpm.fin : 0) || a.nombre.localeCompare(b.nombre,"es",{numeric:true});
const ext = n => (String(n).match(/\.([a-z0-9]{2,5})$/i) || [,""])[1].toLowerCase();
const initials = n => String(n||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("") || "?";

/* ---------- Iconos ---------- */
const I = {
  play:'<svg viewBox="0 0 24 24"><path class="fill" d="M7 4v16l13-8z"/></svg>',
  pause:'<svg viewBox="0 0 24 24"><path class="fill" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  open:'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  dl:'<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
  folder:'<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  file:'<svg viewBox="0 0 24 24"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/></svg>',
  img:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  chev:'<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  wa:'<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.7-1.1-4.4-3.9-4.6-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.6-.1 1.2z"/></svg>'
};
// Arte de portada según el tipo de pack (si el administrador no subió una portada propia)
const ART = { generos:"cover-generos.webp", transiciones:"cover-transiciones.webp", intros:"cover-intros.webp",
              mashups:"cover-mashups.webp", samples:"cover-samples.webp", programas:"cover-programas.webp" };
function artFor(c){
  const t = ((c.nombre||"") + " " + (c.tipo||"")).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(/transici/.test(t)) return ART.transiciones;
  if(/intro|open ?show|apertura/.test(t)) return ART.intros;
  if(/mashup|remix|edit/.test(t)) return ART.mashups;
  if(/sample|fx|efecto|sonido/.test(t)) return ART.samples;
  if(/programa|software|plugin|skin|mapeo/.test(t)) return ART.programas;
  if(/genero|musica|audio|pack/.test(t)) return ART.generos;
  const k = Object.keys(ART); return ART[k[hash(c.nombre||"x") % k.length]];
}
function coverHtml(c, mini){
  const h = hash(c.nombre || "x"), url = coverUrl(c.portada), art = artFor(c);
  return `<div class="cover has-art${mini?" mini":""}">
    <img class="art" src="${art}" alt="" loading="lazy" decoding="async">
    <div class="gen" style="--h1:${180 + h%40};--h2:${285 + (h>>4)%45}"><img src="${LOGO}" alt=""></div>
    ${url ? `<img class="cimg" data-fb src="${esc(url)}" alt="Portada de ${esc(c.nombre)}" loading="lazy" decoding="async">` : ""}
  </div>`;
}
// Si una imagen de Drive no carga, se queda la portada generada
document.addEventListener("error", e => { const t = e.target; if(t && t.matches && t.matches("img[data-fb]")) t.remove(); }, true);

/* ---------- Avisos ---------- */
function toast(msg, type){
  const box = $("#toasts"), el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.innerHTML = `<i></i><span>${esc(msg)}</span>`;
  box.appendChild(el);
  while(box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, type === "err" ? 5200 : 3800);
}
function busy(btn, on){ if(!btn) return; btn.disabled = on; btn.classList.toggle("busy", on); }

/* =====================================================================
   API · Google Apps Script (o modo demostración)
   ===================================================================== */
async function api(accion, data){
  if(demoMode()) return demoApi(accion, data || {});
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 35000);
  try{
    const r = await fetch(CONFIG.backend, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ accion, ...(data||{}) }), signal: ctrl.signal, redirect:"follow" });
    let j;
    try{ j = await r.json(); }catch(_){ throw new Error("El servidor respondió algo inesperado. Revisa que Codigo.gs esté publicado como aplicación web."); }
    if(!j.ok) throw new Error(j.error || "Error desconocido.");
    return j;
  }catch(e){
    if(e.name === "AbortError") throw new Error("El servidor tardó demasiado. Inténtalo otra vez.");
    if(e instanceof TypeError) throw new Error("No hay conexión con el servidor. Revisa tu internet.");
    throw e;
  }finally{ clearTimeout(t); }
}

/* ---------- Modo demostración (imita al servidor en este navegador) ---------- */
const DEMO_FILES = {
  "Pack géneros musicales": { subs: {
      "Reggaetón": ["Reggaetón Mix Vol 1 90-100bpm.mp3","Reggaetón Clásicos Edit 95bpm.mp3","Reggaetón Nuevo Hits 92bpm.mp3"],
      "Salsa": { files: ["Salsa Brava Mix 180bpm.mp3","Salsa Dura Edit 186bpm.mp3"], subs: { "Salsa Romántica": ["Salsa Romántica Edit 170bpm.mp3","Salsa Sensual Mix 165bpm.mp3"] } },
      "Cumbia": ["Cumbia Peruana Mix 95bpm.mp3","Cumbia Sonidera Edit 98bpm.mp3"],
      "Bachata": ["Bachata Sensual Mix 128bpm.mp3"],
      "Electrónica": ["Tech House Set 126bpm.mp3","Guaracha Aleteo 130bpm.mp3"] },
    files: ["Lista de canciones del pack.pdf"] },
  "Transiciones": { files: ["Transición Reggaetón a Guaracha 95-128bpm.mp4","Transición Salsa a Cumbia 180-95bpm.mp4","Transición House a Tech House 124-128bpm.mp4","Transición Bachata a Merengue 130-150bpm.mp4","Transición Dembow a Reggaetón 115-95bpm.mp4","Transición Cumbia a Electro Latino 95-126bpm.mp4","Transición Moombahton a Afro House 108-122bpm.mp4"] },
  "Intros y Open Shows": { subs: { "Open Shows": ["Open Show Neón 128bpm.mp4","Open Show Fuego 126bpm.mp4","Open Show Galaxia 130bpm.mp4"] },
    files: ["Intro Countdown 10 segundos 128bpm.mp4","Intro Logo Glitch 100bpm.mp4","Intro Año Nuevo 2027 126bpm.mp4","Intro Hora Loca 130bpm.mp4"] },
  "Mashups": { files: ["Mashup Salsa Clásica 180bpm.mp3","Mashup Reggaetón Old School 95bpm.mp3","Mashup Cumbia vs House 124bpm.mp3","Mashup Bachata Remix 128bpm.mp3","Mashup Huayno Fusión 112bpm.mp3"] },
  "Samples / FX": { subs: { "Risers": ["Riser 8 compases 128bpm.wav","Riser Blanco 16 compases.wav"], "Impactos": ["Sub Drop Impacto.wav","Boom Cinemático.wav"] },
    files: ["Air Horn Clásico.wav","Sirena Cabina.wav","Voz Arriba las manos.wav","Scratch Corto.wav"] },
  "Programas": { files: ["Guía de instalación.pdf","Skins Virtual DJ Pack.zip","Mapeo controladora DDJ.zip","Plugins efectos VST.zip"] }
};
const kOf = n => { const e = ext(n); return ["mp4","mov","webm","mkv"].includes(e) ? "v" : ["mp3","wav","m4a","flac","aac"].includes(e) ? "a" : ["jpg","png","webp"].includes(e) ? "i" : "o"; };
function demoTree(nombre, v, ids){
  const node = Array.isArray(v) ? { files:v } : v;
  return { n:nombre, f:(node.files||[]).map(x => ids ? [x, kOf(x), "EJEMPLO_" + hash(x).toString(36)] : [x, kOf(x)]),
           s:Object.entries(node.subs||{}).map(([k,x]) => demoTree(k, x, ids)) };
}
const countTree = t => t.f.length + t.s.reduce((n,x)=>n+countTree(x),0);
const DK = { car:"rc5_demo_car", regs:"rc5_demo_regs", sols:"rc5_demo_sols", aj:"rc5_demo_aj" };
const isoIn = n => new Date(Date.now()+n*864e5).toISOString();
const addMonths = (iso, n) => { const x = new Date(iso); x.setMonth(x.getMonth()+n); return x.toISOString(); };
const uid = () => Math.random().toString(36).slice(2,10);
const demoCars = () => store.get(DK.car) || CONFIG.carpetasDemo.map((c,i)=>({ id:"c"+(i+1), orden:i+1, portada:"", drive:"", visible:true, ...c }));
const demoAj = () => store.get(DK.aj) || { correoAvisos:"", whatsapp:"", moneda:CONFIG.moneda, avisarUsuario:true, sitio:"", fondo:"", luces:true };
function demoRegs(){
  return store.get(DK.regs) || [
    { id:"ej01", fecha:isoIn(-0.02), nombre:"DJ Ejemplo Uno", correo:"ejemplo.uno@gmail.com", whatsapp:"51911111111", estado:"Registrado", nota:"", accesos:[] },
    { id:"ej02", fecha:isoIn(-12), nombre:"VJ Ejemplo Dos", correo:"ejemplo.dos@gmail.com", whatsapp:"51922222222", estado:"Aprobado", nota:"Pagó por Yape",
      accesos:[ { id:"ac1", carpetaId:"c2", carpeta:"Transiciones", desde:isoIn(-25), hasta:isoIn(5), estado:"Activo" },
                { id:"ac2", carpetaId:"c3", carpeta:"Intros y Open Shows", desde:isoIn(-25), hasta:"", estado:"Activo" } ] },
    { id:"ej03", fecha:isoIn(-40), nombre:"Ejemplo Tres", correo:"ejemplo.tres@gmail.com", whatsapp:"51933333333", estado:"Vencido", nota:"",
      accesos:[ { id:"ac3", carpetaId:"c4", carpeta:"Mashups", desde:isoIn(-100), hasta:isoIn(-8), estado:"Vencido" } ] }
  ];
}
const demoSols = () => store.get(DK.sols) || [
  { id:"s1", fecha:isoIn(-0.01), registroId:"ej01", nombre:"DJ Ejemplo Uno", correo:"ejemplo.uno@gmail.com", whatsapp:"51911111111", packId:"c2", pack:"Transiciones", precio:25, modalidad:"Mensual", meses:1, estado:"Pendiente" }
];
const activo = a => a.estado==="Activo" && (!a.hasta || new Date(a.hasta) > new Date());
function demoResumen(x, sinAcceso){
  const act = x.accesos.filter(a=>a.estado==="Activo");
  x.estado = act.length ? "Aprobado" : sinAcceso || (x.accesos.some(a=>a.estado==="Vencido") ? "Vencido" : x.estado);
}
async function demoApi(accion, d){
  await sleep(accion==="contenido" || accion==="indice" ? 380 : 260);
  const regs = demoRegs(), cars = demoCars(), sols = demoSols();
  const saveR = () => store.set(DK.regs, regs), saveC = () => store.set(DK.car, cars), saveS = () => store.set(DK.sols, sols);
  const tok = () => { if(d.token !== "demo-token") throw new Error("SESION: Tu sesión expiró. Vuelve a ingresar."); };
  const find = id => { const x = regs.find(r=>r.id===id); if(!x) throw new Error("Registro no encontrado."); return x; };
  const findAcc = id => { for(const r of regs){ const a = r.accesos.find(a=>a.id===id); if(a) return [r,a]; } throw new Error("Acceso no encontrado."); };
  const user = () => { const m = String(d.token||"").match(/^demo-user:(.+)$/); return m ? regs.find(r=>r.correo===m[1]) : null; };
  const vis = cars.filter(c=>c.visible!==false).sort((a,b)=>a.orden-b.orden);
  const grant = (x, c, m) => {
    m = Math.max(0, Math.round(Number(m)||0));
    const prev = x.accesos.find(a=>a.carpetaId===c.id && a.estado!=="Revocado");
    if(prev){ const base = prev.hasta && new Date(prev.hasta) > new Date() ? prev.hasta : new Date().toISOString(); prev.hasta = m ? addMonths(base, m) : ""; prev.estado = "Activo"; }
    else x.accesos.push({ id:uid(), carpetaId:c.id, carpeta:c.nombre, desde:new Date().toISOString(), hasta: m ? addMonths(new Date().toISOString(), m) : "", estado:"Activo" });
    sols.filter(s=>s.registroId===x.id && s.packId===c.id && s.estado==="Pendiente").forEach(s => { s.estado = "Aprobada"; s.resuelto = new Date().toISOString(); });
  };
  switch(accion){
    case "catalogo": { const aj = demoAj();
      return { ok:true, v:3, ajustes:{ whatsapp:aj.whatsapp, moneda:aj.moneda, fondo:aj.fondo, luces:aj.luces!==false },
        carpetas: vis.map(c => ({ ...c, cantidad: DEMO_FILES[c.nombre] ? countTree(demoTree(c.nombre, DEMO_FILES[c.nombre])) : 0 })) }; }
    case "indice": { const packs = {}; vis.forEach(c => { if(DEMO_FILES[c.nombre]) packs[c.id] = demoTree(c.nombre, DEMO_FILES[c.nombre], false); }); return { ok:true, packs }; }
    case "contenido": {
      const c = cars.find(x=>x.id===d.id); if(!c) throw new Error("Este pack ya no está disponible.");
      const u = user(), acc = u && u.accesos.find(a=>a.carpetaId===c.id && activo(a)), acceso = d.admin==="demo-token" || !!acc;
      if(!DEMO_FILES[c.nombre]) return { ok:true, sinEnlace:true, acceso, arbol:{ n:c.nombre, f:[], s:[] } };
      if(window.__demoPend > 0){ window.__demoPend--; return { ok:true, pendiente:true, acceso, arbol:{ n:c.nombre, f:[], s:[] } }; }
      return acceso ? { ok:true, acceso:true, hasta:acc ? acc.hasta : "", drive:"", arbol:demoTree(c.nombre, DEMO_FILES[c.nombre], true) }
                    : { ok:true, acceso:false, arbol:demoTree(c.nombre, DEMO_FILES[c.nombre], false) };
    }
    case "registrar": {
      const c = String(d.datos.correo).toLowerCase(), ex = regs.find(x=>x.correo===c);
      if(ex) return { ok:true, existente:true, estado:ex.estado };
      regs.unshift({ id:uid(), fecha:new Date().toISOString(), nombre:d.datos.nombre, correo:c, whatsapp:d.datos.whatsapp, estado:"Registrado", nota:"", accesos:[] });
      saveR(); return { ok:true, estado:"Registrado" };
    }
    case "estado": { const x = regs.find(x=>x.correo===String(d.correo).toLowerCase()); return x ? { ok:true, estado:x.estado } : { ok:true, estado:"No registrado" }; }
    case "pedirCodigo": {
      const x = regs.find(x=>x.correo===String(d.correo||"").trim().toLowerCase());
      if(!x) throw new Error("Ese correo no está registrado. Regístrate primero.");
      return { ok:true, demoCodigo:"123456" };
    }
    case "verificarCodigo":
      if(String(d.codigo).trim()!=="123456") throw new Error("Código incorrecto. En modo demostración es 123456.");
      return { ok:true, token:"demo-user:"+String(d.correo).trim().toLowerCase() };
    case "miCuenta": {
      const u = user(); if(!u) throw new Error("SESION: Tu sesión expiró. Vuelve a ingresar.");
      return { ok:true, nombre:u.nombre, correo:u.correo, whatsapp:u.whatsapp, estado:u.estado,
        accesos:u.accesos.filter(a=>a.estado!=="Revocado").map(a=>({ carpetaId:a.carpetaId, carpeta:a.carpeta, desde:a.desde, hasta:a.hasta, activo:activo(a) })),
        solicitudes:sols.filter(s=>s.registroId===u.id && s.estado==="Pendiente").map(s=>({ id:s.id, packId:s.packId, pack:s.pack, fecha:s.fecha, estado:s.estado })) };
    }
    case "solicitarPack": {
      const u = user(); if(!u) throw new Error("SESION: Inicia sesión para comprar este pack.");
      const c = vis.find(x=>x.id===d.packId); if(!c) throw new Error("Este pack ya no está disponible.");
      if(u.accesos.some(a=>a.carpetaId===c.id && activo(a))) throw new Error("Ya tienes acceso activo a este pack.");
      const old = sols.find(s=>s.registroId===u.id && s.packId===c.id && s.estado==="Pendiente");
      if(old) return { ok:true, existente:true, id:old.id };
      const s = { id:uid(), fecha:new Date().toISOString(), registroId:u.id, nombre:u.nombre, correo:u.correo, whatsapp:u.whatsapp, packId:c.id, pack:c.nombre,
                  precio:Number(c.precio)||0, modalidad:c.modalidad||"Único", meses:mesesDe(c), estado:"Pendiente" };
      sols.unshift(s); saveS(); return { ok:true, id:s.id, notificado:false, demo:true };
    }
    case "login": if(d.clave!=="demo") throw new Error("Clave incorrecta. En modo demostración la clave es demo."); return { ok:true, token:"demo-token" };
    case "salir": return { ok:true };
    case "listar": { tok(); const cnt = {}; cars.forEach(c => cnt[c.id] = DEMO_FILES[c.nombre] ? countTree(demoTree(c.nombre, DEMO_FILES[c.nombre])) : 0);
      return { ok:true, registros:regs.map(r=>({ ...r, accesos:r.accesos.filter(a=>a.estado!=="Revocado") })), solicitudes:sols,
               carpetas:cars.slice().sort((a,b)=>a.orden-b.orden), ajustes:demoAj(), conteos:cnt, indexado:new Date().toISOString(), hoja:"", cuota:null }; }
    case "resolverSolicitud": { tok(); const s = sols.find(x=>x.id===d.id); if(!s) throw new Error("Solicitud no encontrada.");
      if(s.estado!=="Pendiente") throw new Error("Esta solicitud ya fue resuelta.");
      if(d.decision==="rechazar"){ s.estado = "Rechazada"; s.resuelto = new Date().toISOString(); saveS(); return { ok:true }; }
      const x = find(s.registroId), c = cars.find(c=>c.id===s.packId); if(!c) throw new Error("El pack ya no existe.");
      grant(x, c, d.meses ?? s.meses); demoResumen(x); saveR(); saveS(); return { ok:true, carpetas:[c.nombre], errores:[] }; }
    case "aprobar": { tok(); const x = find(d.id); if(!d.items.length) throw new Error("Elige al menos una carpeta.");
      const dados = []; d.items.forEach(it => { const c = cars.find(c=>c.id===it.carpeta); if(c){ grant(x, c, it.meses); dados.push(c.nombre); } });
      demoResumen(x); saveR(); saveS(); return { ok:true, carpetas:dados, errores:[] }; }
    case "renovar": { tok(); const [r,a] = findAcc(d.acceso); const m = Math.max(0, Math.round(Number(d.meses)||0));
      const base = a.hasta && new Date(a.hasta) > new Date() ? a.hasta : new Date().toISOString();
      a.hasta = m ? addMonths(base, m) : ""; a.estado = "Activo"; demoResumen(r); saveR(); return { ok:true }; }
    case "quitarAcceso": { tok(); const [r,a] = findAcc(d.acceso); a.estado = "Revocado"; demoResumen(r, "Revocado"); saveR(); return { ok:true }; }
    case "revocar": case "rechazar": { tok(); const x = find(d.id); x.accesos.forEach(a=>a.estado="Revocado"); x.estado = accion==="revocar"?"Revocado":"Rechazado"; saveR(); return { ok:true }; }
    case "eliminar": tok(); store.set(DK.regs, regs.filter(x=>x.id!==d.id)); return { ok:true };
    case "revisarAhora": { tok(); let n = 0;
      regs.forEach(r => { r.accesos.forEach(a => { if(a.estado==="Activo" && a.hasta && new Date(a.hasta) <= new Date()){ a.estado="Vencido"; n++; } }); demoResumen(r); });
      saveR(); return { ok:true, vencidos:n, porVencer:0 }; }
    case "reindexar": { tok(); await sleep(500); return { ok:true, packs:vis.length, archivos:vis.reduce((t,c)=>t+(DEMO_FILES[c.nombre]?countTree(demoTree(c.nombre,DEMO_FILES[c.nombre])):0),0), ms:500, fecha:new Date().toISOString() }; }
    case "guardarRegistro": { tok(); const r = d.registro, w = String(r.whatsapp||"").replace(/\D/g,"");
      if(String(r.nombre||"").trim().length<2) throw new Error("Escribe el nombre.");
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.correo||"")) throw new Error("El correo no es válido.");
      if(w.length<8||w.length>15) throw new Error("El WhatsApp debe tener entre 8 y 15 dígitos con código de país.");
      if(regs.some(x=>x.correo===r.correo.toLowerCase() && x.id!==r.id)) throw new Error("Ya existe un registro con ese correo.");
      if(r.id) Object.assign(find(r.id), { nombre:r.nombre.trim(), correo:r.correo.toLowerCase(), whatsapp:w, nota:r.nota||"" });
      else regs.unshift({ id:uid(), fecha:new Date().toISOString(), nombre:r.nombre.trim(), correo:r.correo.toLowerCase(), whatsapp:w, estado:"Registrado", nota:r.nota||"", accesos:[] });
      saveR(); return { ok:true }; }
    case "guardarCarpeta": { tok(); const c = d.carpeta;
      if(String(c.nombre||"").trim().length<2) throw new Error("Escribe el nombre de la carpeta.");
      const mod = MODS.hasOwnProperty(c.modalidad) ? c.modalidad : "Único";
      let meses = MODS[mod];
      if(meses == null){ meses = Math.round(Number(c.meses)||0); if(meses<1||meses>120) throw new Error("Para la modalidad personalizada escribe de 1 a 120 meses."); }
      const row = { nombre:c.nombre.trim(), descripcion:c.descripcion||"", precio:Math.max(0, Number(c.precio)||0), portada:c.portada||"", drive:driveId(c.drive),
        tipo:c.tipo||"Video", orden:Number(c.orden)||cars.length+1, visible:c.visible!==false, modalidad:mod, meses };
      if(c.id) Object.assign(cars.find(x=>x.id===c.id), row); else cars.push({ id:"c"+Date.now().toString(36), ...row });
      saveC(); return { ok:true }; }
    case "eliminarCarpeta": tok(); store.set(DK.car, cars.filter(x=>x.id!==d.id)); return { ok:true };
    case "subirPortada": tok(); return { ok:true, url:"data:"+d.mime+";base64,"+d.datos };
    case "guardarAjustes": { tok(); const a = d.ajustes;
      if(a.correoAvisos && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.correoAvisos)) throw new Error("El correo para avisos no es válido.");
      if(a.sitio && !/^https:\/\//.test(a.sitio)) throw new Error("La dirección de la web debe empezar con https://");
      const aj = { correoAvisos:a.correoAvisos||"", whatsapp:String(a.whatsapp||"").replace(/\D/g,""), moneda:a.moneda||"S/", avisarUsuario:a.avisarUsuario!==false, sitio:a.sitio||"", fondo:a.fondo||"", luces:a.luces!==false };
      store.set(DK.aj, aj); return { ok:true, ajustes:aj }; }
    case "probarCorreo": tok(); throw new Error("En modo demostración no se envían correos. Conecta el servidor para probarlo.");
  }
  throw new Error("Acción desconocida.");
}

/* =====================================================================
   Catálogo (se pinta al instante desde la última visita y se actualiza)
   ===================================================================== */
let CARP = [], IDX = {}, IDXP = null;
const OWN = {};                     // contenido completo (con enlaces) de los packs del usuario
const CK = { cat:"rc5_cat", idx:"rc5_idx", mail:"rc5_mail", user:"rc5_user", own:"rc5_own_" };

function applyCatalog(r){
  CARP = r.carpetas || [];
  const aj = r.ajustes || {};
  AJ = { whatsapp:aj.whatsapp||"", moneda:aj.moneda||CONFIG.moneda, fondo:aj.fondo||"", luces:aj.luces!==false };
  applyFondo(); renderPacks(); renderHome();
}
async function loadCatalog(force){
  const cached = store.get(CK.cat);
  if(cached && !force) applyCatalog(cached.v);
  try{
    const r = await api("catalogo");
    if(!r.v && !demoMode()) console.warn("R&Cmusic: el servidor no es la versión 3. Actualiza Codigo.gs.");
    store.set(CK.cat, { t:Date.now(), v:{ carpetas:r.carpetas, ajustes:r.ajustes } });
    applyCatalog(r);
  }catch(ex){
    if(!cached) $("#packGrid").innerHTML = `<div class="empty" style="grid-column:1/-1">No se pudo cargar el catálogo. ${esc(ex.message)}<br><br><button type="button" class="btn" data-retry>Reintentar</button></div>`;
  }
}
// Índice público de todos los packs: un solo pedido, guardado en el navegador → abrir un pack es instantáneo
function loadIndex(force){
  const cached = store.get(CK.idx);
  if(cached && !force){ IDX = cached.v || {}; if(Date.now() - cached.t < 5*60e3) return (IDXP = Promise.resolve(IDX)); }
  IDXP = api("indice").then(r => {
    IDX = r.packs || {}; store.set(CK.idx, { t:Date.now(), v:IDX });
    if(F.c && !F.own && $("#fModal").classList.contains("open")) renderTree(); // refresca la vista abierta
    return IDX;
  }).catch(() => IDX);
  return cached && !force ? Promise.resolve(IDX) : IDXP;
}
function renderHome(){
  $$(".js-wa").forEach(a => a.href = waLink(wa(), `Hola ${CONFIG.marca}, quiero información sobre sus packs.`));
  $("#sPacks").textContent = CARP.length || "—";
  const tot = CARP.reduce((t,c)=>t+(Number(c.cantidad)||0),0);
  $("#sFiles").textContent = tot ? fmtNum(tot) : "—";
  const pagos = CARP.map(c=>Number(c.precio)||0).filter(p=>p>0);
  $("#sFrom").textContent = CARP.some(c=>!(Number(c.precio)>0)) ? "Gratis" : pagos.length ? money(Math.min(...pagos)) : "—";
}
function packState(id){
  if(miAcceso(id)) return "own";
  if(miSolicitud(id)) return "req";
  return "";
}
function renderPacks(){
  const grid = $("#packGrid");
  if(!CARP.length){ grid.innerHTML = `<div class="empty" style="grid-column:1/-1">Aún no hay packs publicados.</div>`; return; }
  grid.innerHTML = CARP.map(c => {
    const free = !(Number(c.precio) > 0), st = packState(c.id), mine = miAcceso(c.id);
    const badge = st==="own" ? `<span class="badge-st own">Tu pack${mine.hasta?` · hasta ${esc(fechaCorta(mine.hasta))}`:""}</span>`
                : st==="req" ? `<span class="badge-st req">Solicitud enviada</span>` : "";
    const foot = st==="own" ? `<button type="button" class="btn grad sm" data-pack="${esc(c.id)}">Abrir y reproducir</button>`
               : `<button type="button" class="btn light sm" data-pack="${esc(c.id)}">Ver contenido</button>` +
                 (st==="req" ? `<button type="button" class="btn sm done" disabled>Solicitado</button>`
                             : `<button type="button" class="btn sm" data-buy="${esc(c.id)}">${free?"Pedir acceso":"Comprar"}</button>`);
    return `<article class="pack" data-prefetch="${esc(c.id)}">
      <button type="button" class="cbtn" data-pack="${esc(c.id)}" aria-label="Ver contenido de ${esc(c.nombre)}">
        ${coverHtml(c)}${badge}
      </button>
      <div class="pbody">
        <div class="pmeta"><span>${esc(c.tipo||"Pack")}</span>${c.cantidad?`<span>${fmtNum(c.cantidad)} archivos</span>`:""}</div>
        <h3>${esc(c.nombre)}</h3>
        ${priceBlock(c)}
        ${c.descripcion?`<p>${esc(c.descripcion)}</p>`:""}
      </div>
      <div class="pfoot">${foot}</div>
    </article>`;
  }).join("");
  const n = U.cuenta ? U.cuenta.accesos.filter(a=>a.activo).length : 0;
  $("#mineNote").hidden = !n; $("#mineNote").textContent = n ? `Tienes ${n} pack${n===1?"":"s"} activo${n===1?"":"s"}.` : "";
}

/* =====================================================================
   Vista de un pack
   ===================================================================== */
const F = { c:null, tree:null, own:false, q:"", groups:[], view:[], req:0, open:new Set() };
const canOpenAll = id => !!(miAcceso(id) || A.token);
async function openPack(id, push){
  const c = CARP.find(x=>String(x.id)===String(id)); if(!c) return;
  F.c = c; F.q = ""; $("#fq").value = ""; F.open = new Set(); F.tree = null; F.own = false; F.drive = ""; F.sinEnlace = false;
  $("#fCover").innerHTML = coverHtml(c);
  $("#fMeta").innerHTML = `<span>${esc(c.tipo||"Pack")}</span>${c.cantidad?`<span>/</span>${fmtNum(c.cantidad)} archivos`:""}`;
  $("#fName").textContent = c.nombre;
  $("#fDesc").textContent = c.descripcion || "";
  const free = !(Number(c.precio) > 0);
  [["#fPrice","#fPer"],["#bbPrice","#bbPer"]].forEach(([a,p]) => {
    $(a).textContent = free ? "Gratis" : money(c.precio); $(a).className = "amt" + (free ? " free" : "");
    $(p).textContent = perLabel(c); $(p).className = perClass(c);
  });
  $("#fPriceNote").textContent = free ? "Gratis con tu cuenta" : durTxt(c) + (mesesDe(c) ? " · renovable" : "");
  $("#bbNote").textContent = free ? "Con tu cuenta" : durTxt(c);
  paintPackState();
  if(push){ try{ history.replaceState(null,"","#pack-"+slug(c.nombre)); }catch(_){} }
  openModal("#fModal");
  $(".pcontent").scrollTop = 0; $(".pack-sheet").scrollTop = 0;
  const seq = ++F.req;
  // 1) Lo que ya está en el navegador se muestra al instante
  if(canOpenAll(c.id) && OWN[c.id]){ F.tree = OWN[c.id].arbol; F.own = true; F.drive = OWN[c.id].drive; }
  else if(IDX[c.id]) F.tree = IDX[c.id];
  if(F.tree) renderTree(); else $("#fList").innerHTML = Array.from({length:8},()=>`<div class="sk row-sk"></div>`).join("");
  // 2) Si el usuario tiene acceso, se piden los enlaces (en segundo plano si ya se ve la lista)
  try{
    if(canOpenAll(c.id) && !(OWN[c.id] && Date.now() - OWN[c.id].t < 10*60e3)) await loadContent(c, seq, 0);
    else if(!F.tree){
      await (IDXP || loadIndex());
      if(seq !== F.req) return;
      if(IDX[c.id]){ F.tree = IDX[c.id]; renderTree(); }
      else await loadContent(c, seq, 0);
    }
  }catch(ex){ if(seq === F.req && !F.tree) $("#fList").innerHTML = `<div class="empty">${esc(ex.message)}<br><br><button type="button" class="btn" data-reopen>Reintentar</button></div>`; }
}
// Pide el contenido al servidor. Si el pack es nuevo o enorme y su lista aún se está preparando en segundo plano,
// muestra un aviso y vuelve a preguntar solo (nunca se queda esperando hasta agotar el tiempo).
async function loadContent(c, seq, n){
  const own = canOpenAll(c.id);
  const r = own ? await fetchOwn(c.id) : await api("contenido", { id:c.id });
  if(seq !== F.req) return;
  if(r.pendiente){
    if(own) paintPackState(r);
    if(!F.tree) $("#fList").innerHTML = `<div class="empty prep"><span class="loader" aria-hidden="true"></span><b>Preparando la lista de este pack…</b><span>Tiene muchos archivos o es nuevo, así que Google Drive la está ordenando por primera vez. Aparecerá aquí sola en unos instantes; no hace falta recargar.</span></div>`;
    clearTimeout(F.poll);
    if(n < 45) F.poll = setTimeout(() => { if(seq === F.req) loadContent(c, seq, n + 1).catch(() => {}); }, n < 4 ? 5000 : 9000);
    return;
  }
  if(own){ if(r.acceso){ F.tree = r.arbol; F.own = true; F.drive = r.drive; } else if(!F.tree) F.tree = r.arbol; paintPackState(r); }
  else { F.tree = r.arbol; F.sinEnlace = !!r.sinEnlace; if(!r.sinEnlace){ IDX[c.id] = r.arbol; store.set(CK.idx, { t:0, v:IDX }); } }
  renderTree();
}
async function fetchOwn(id){
  const r = await api("contenido", { id, token:U.token||"", admin:A.token||"" });
  if(r.acceso && !r.pendiente){ OWN[id] = { t:Date.now(), arbol:r.arbol, drive:r.drive||"", hasta:r.hasta||"" }; store.set(CK.own+id, OWN[id], true); }
  return r;
}
function paintPackState(r){
  const c = F.c, free = !(Number(c.precio) > 0), mine = miAcceso(c.id), req = miSolicitud(c.id), admin = !!A.token && !mine;
  const on = !!(mine || admin || (r && r.acceso));
  const st = $("#fState");
  st.className = "fstate" + (on ? " on" : req ? " req" : "");
  if(admin) st.innerHTML = `<b>Vista de administrador.</b> Ves y reproduces todo el contenido.`;
  else if(on){ const h = (mine && mine.hasta) || (r && r.hasta); st.innerHTML = `<b>Tienes acceso</b>${h ? ` hasta el ${esc(fechaCorta(h))} (${Math.max(0,dias(h))} días)` : " sin vencimiento"}. Para reproducir, tu navegador debe tener abierta la cuenta de Google ${esc(U.cuenta ? U.cuenta.correo : "aprobada")}.`; }
  else if(req) st.innerHTML = `<b>Solicitud enviada.</b> El administrador ya recibió tu pedido y te escribirá por WhatsApp para activarlo.`;
  else if(U.cuenta) st.innerHTML = `Puedes ver la lista completa. Para reproducir y descargar, pulsa <b>${free?"Pedir acceso":"Comprar"}</b>.`;
  else st.innerHTML = `Vista previa de la lista. Pulsa <b>${free?"Pedir acceso":"Comprar"}</b>: te registras en un minuto y el administrador te contacta por WhatsApp.`;
  const label = on ? "" : req ? "Solicitud enviada" : free ? "Pedir acceso" : "Comprar";
  [["#fBuy","grad lg"],["#bbBuy","grad"]].forEach(([s,cls]) => {
    const b = $(s); b.hidden = on; b.textContent = label; b.disabled = !!req;
    b.className = "btn " + (req ? "done" : cls) + (s === "#fBuy" ? " lg" : "");
  });
  $("#buybar").hidden = on;
  const drive = (F.own && F.tree && F.tree.d) ? D.folder(F.tree.d) : ((r && r.drive) || F.drive);
  $("#fDrive").hidden = !(on && drive); if(drive) $("#fDrive").href = drive;
}
// Árbol → grupos (archivos sueltos primero, luego cada subcarpeta), ordenado por BPM
function buildGroups(){
  const q = F.q.trim().toLowerCase(), out = [];
  (function walk(node, ruta){
    const enRuta = q && ruta.join(" / ").toLowerCase().includes(q);
    const files = (node.f||[]).map(x => ({ nombre:x[0], k:x[1], id:x[2]||"", bpm:parseBpm(x[0]) }))
      .filter(f => !q || enRuta || f.nombre.toLowerCase().includes(q) || (f.bpm && f.bpm.txt.includes(q))).sort(byBpm);
    const g = { ruta, key:ruta.join("\u0001"), nivel:ruta.length, files, total:(node.f||[]).length, d:node.d || "" };
    out.push(g);
    let deep = g.total, hit = files.length;
    (node.s||[]).forEach(s => { const r = walk(s, ruta.concat(s.n)); deep += r[0]; hit += r[1]; });
    g.deep = deep; g.hit = hit;
    return [deep, hit];
  })(F.tree || { f:[], s:[] }, []);
  return out;
}
// Carpetas: empiezan cerradas; cada una se abre con un clic (y sus subcarpetas aparecen dentro).
// Al buscar, se abren solas las carpetas que tienen resultados.
const keyOf = ruta => ruta.join("\u0001");
const isOpen = g => !g.ruta.length || (F.q ? g.hit > 0 : F.open.has(g.key));
const isShown = g => { if(F.q && !g.hit) return false; for(let n = 1; n < g.ruta.length; n++) if(!isOpen({ ruta:g.ruta.slice(0,n), key:keyOf(g.ruta.slice(0,n)), hit:1 })) return false; return true; };
function toggleGroup(key, force){
  const sc = $(".pcontent"), y = sc ? sc.scrollTop : 0, msc = $(".pack-sheet"), my = msc ? msc.scrollTop : 0;
  const on = force !== undefined ? force : !F.open.has(key);
  if(on) F.open.add(key); else F.open.delete(key);
  renderTree();
  if(sc) sc.scrollTop = y; if(msc) msc.scrollTop = my;
}
function renderTree(){
  if(!F.tree) return;
  const gs = F.groups = buildGroups();
  const total = gs.reduce((t,g)=>t+g.total,0), shown = gs.reduce((t,g)=>t+g.files.length,0), nsub = gs.length - 1;
  const vis = gs.map((g,i) => [g,i]).filter(([g]) => isShown(g));
  F.view = vis.filter(([g]) => isOpen(g)).flatMap(([g]) => g.files);
  $("#fCount").textContent = total ? `${F.q ? `${shown} de ${total}` : fmtNum(total)} archivos${nsub?` · ${nsub} subcarpetas`:""} · ordenado por BPM` : "";
  const top = (F.tree.s||[]);
  $("#fSubs").innerHTML = top.length > 1 && !F.q ? top.map(s => {
    const g = gs.find(x => x.nivel===1 && x.ruta[0]===s.n);
    return `<button type="button" class="sub-btn${g && F.open.has(g.key)?" on":""}" data-jump="${esc(g ? g.key : "")}">${I.folder}<span>${esc(s.n)}</span><small>${g ? g.deep : 0}</small></button>`;
  }).join("") : "";
  requestAnimationFrame(() => { const ps = $("#pstick"); if(ps) $(".pack-sheet").style.setProperty("--stick", ps.offsetHeight + "px"); });
  const L = $("#fList");
  if(!total){ L.innerHTML = `<div class="empty">${F.sinEnlace ? "Este pack aún no tiene archivos publicados." : "Esta carpeta está vacía."}</div>`; return; }
  if(!shown){ L.innerHTML = `<div class="empty">Ningún archivo coincide con “${esc(F.q)}”.</div>`; return; }
  // Solo se dibujan los archivos de las carpetas abiertas, por tandas, para que todo responda al instante.
  const pending = []; let budget = 160;
  const rowsFor = (i, files) => { if(budget > 0){ const now = files.slice(0, budget); budget -= now.length; if(files.length > now.length) pending.push([i, now.length]); return now.map(fileRow).join(""); } pending.push([i, 0]); return ""; };
  L.innerHTML = vis.map(([g,i]) => {
    if(!g.ruta.length) return g.files.length ? `<div class="rows" data-rows="${i}">${rowsFor(i, g.files)}</div>` : "";
    const open = isOpen(g), name = g.ruta[g.ruta.length-1];
    const link = F.own && g.d && !isDemoId(g.d) ? `<a class="ico" href="${D.folder(g.d)}" target="_blank" rel="noopener" title="Abrir esta carpeta en Drive (descargar todo)" aria-label="Abrir ${esc(name)} en Google Drive">${I.open}</a>` : "";
    const cnt = g.deep ? (F.q && g.hit !== g.deep ? `${g.hit} de ${g.deep}` : fmtNum(g.deep)) + ` archivo${g.deep===1?"":"s"}` : "vacía";
    return `<div class="fgroup${open?" open":""}" style="--lvl:${g.nivel-1}" id="fg-${i}">
      <div class="fhead"><button type="button" class="fsum" data-group="${esc(g.key)}" aria-expanded="${open}">${I.chev}<span class="fic">${I.folder}</span><span class="gname">${esc(name)}</span><small>${cnt}</small></button>${link}</div>
      ${open && g.files.length ? `<div class="rows" data-rows="${i}">${rowsFor(i, g.files)}</div>` : ""}
    </div>`;
  }).join("");
  const seq = F.paint = (F.paint||0) + 1;
  (function fill(){
    if(seq !== F.paint) return;
    const t0 = performance.now();
    while(pending.length && performance.now() - t0 < 12){
      const [i, from] = pending[0], g = F.groups[i], box = L.querySelector(`[data-rows="${i}"]`);
      const to = Math.min(g.files.length, from + 120);
      if(box) box.insertAdjacentHTML("beforeend", g.files.slice(from, to).map(fileRow).join(""));
      if(to >= g.files.length) pending.shift(); else pending[0] = [i, to];
    }
    if(pending.length) requestAnimationFrame(fill); else refreshRows();
  })();
}
function fileRow(f){
  const locked = !f.id, demo = !locked && isDemoId(f.id), on = current && current.id === f.id, playable = f.k==="v" || f.k==="a";
  const icon = locked ? I.lock : f.k==="i" ? I.img : playable ? (on ? I.pause : I.play) : I.file;
  const lead = playable && !locked
    ? `<button type="button" class="fthumb" data-play="${esc(f.id)}" aria-label="${on?"Detener":"Reproducir"} ${esc(f.nombre)}">${icon}</button>`
    : `<span class="fthumb"${locked?' title="Disponible al comprar el pack"':""}>${icon}</span>`;
  const lk = (u,l,ic) => `<a class="ico" href="${demo?"#":u}" ${demo?'data-demo="1"':'target="_blank" rel="noopener"'} aria-label="${l}" title="${l}">${ic}</a>`;
  return `<div class="frow${on?" playing":""}${locked?" locked":""}">${lead}
    <div class="ti"><div class="name">${esc(f.nombre.replace(/\.[^.]+$/,""))}</div><div class="sub"><span class="kind">${esc((ext(f.nombre)||"archivo").toUpperCase())}</span></div></div>
    <span class="bpm${f.bpm?"":" none"}">${f.bpm ? esc(f.bpm.txt)+" bpm" : "—"}</span>
    <div class="racts">${locked ? "" : lk(D.view(f.id),"Abrir en Google Drive",I.open) + lk(D.dl(f.id),"Descargar",I.dl)}</div>
  </div>`;
}

/* =====================================================================
   Comprar → solicitud al administrador
   ===================================================================== */
let PEND = null;   // acción pendiente después de ingresar (comprar un pack)
async function buy(id){
  const c = CARP.find(x=>String(x.id)===String(id)); if(!c) return;
  if(U.token && !U.cuenta) await loadCuenta();
  if(!U.cuenta){ PEND = { buy:c.id }; openSection("registro"); return; }
  if(miAcceso(c.id)){ toast("Ya tienes acceso a este pack.", "ok"); openPack(c.id, true); return; }
  if(miSolicitud(c.id)){ toast("Ya enviaste esta solicitud. El administrador te escribirá por WhatsApp."); return; }
  $("#bCover").innerHTML = coverHtml(c, true);
  $("#bPack").textContent = c.nombre;
  $("#bPrice").innerHTML = priceBlock(c);
  $("#bDur").textContent = durTxt(c);
  $("#bWho").innerHTML = `<dt>Nombre</dt><dd>${esc(U.cuenta.nombre)}</dd><dt>Gmail</dt><dd>${esc(U.cuenta.correo)}</dd>${U.cuenta.whatsapp?`<dt>WhatsApp</dt><dd>+${esc(U.cuenta.whatsapp)}</dd>`:""}`;
  $("#bErr").textContent = ""; $("#bAsk").hidden = false; $("#bDone").hidden = true;
  $("#bSend").dataset.id = c.id;
  openModal("#bModal");
}
async function sendRequest(){
  const btn = $("#bSend"), c = CARP.find(x=>String(x.id)===btn.dataset.id); if(!c) return;
  $("#bErr").textContent = ""; busy(btn, true);
  try{
    const r = await api("solicitarPack", { token:U.token, packId:c.id });
    U.cuenta.solicitudes = (U.cuenta.solicitudes||[]).filter(s=>s.packId!==c.id).concat([{ id:r.id, packId:c.id, pack:c.nombre, fecha:new Date().toISOString(), estado:"Pendiente" }]);
    $("#bAsk").hidden = true; $("#bDone").hidden = false;
    $("#bDoneT").textContent = r.existente ? "Ya habías enviado esta solicitud" : "Solicitud enviada";
    $("#bDoneP").textContent = r.existente ? "El administrador ya la tiene. Te escribirá por WhatsApp para activar tu acceso."
      : r.demo ? "En la versión real, el administrador recibe un correo al instante con este pack y tus datos. Revisa el panel → Solicitudes."
      : r.notificado === false ? "Tu solicitud quedó registrada y el administrador la verá en su panel. Te escribirá por WhatsApp."
      : `Avisamos al administrador al instante. Te escribirá por WhatsApp${U.cuenta.whatsapp?` al +${U.cuenta.whatsapp}`:""} para coordinar el pago. Cuando lo apruebe, este pack se abrirá aquí con tu Gmail.`;
    $("#bWa").href = waLink(wa(), `Hola ${CONFIG.marca}, acabo de solicitar el pack "${c.nombre}" (${priceTxt(c)}). Mi Gmail es ${U.cuenta.correo}.`);
    renderPacks(); if(F.c && F.c.id===c.id) paintPackState(); paintAccount();
  }catch(ex){
    if(/^SESION/.test(ex.message)){ logoutUser(true); closeModal($("#bModal")); PEND = { buy:c.id }; openAuth("Tu sesión expiró. Ingresa otra vez para enviar la solicitud."); }
    else $("#bErr").textContent = ex.message;
  }finally{ busy(btn, false); }
}

/* =====================================================================
   Cuenta: registro → código → sesión
   ===================================================================== */
const U = { token: store.get(CK.user), cuenta: null, correo: "" };
const miAcceso = id => U.cuenta && U.cuenta.accesos.find(a => String(a.carpetaId)===String(id) && a.activo);
const miSolicitud = id => U.cuenta && (U.cuenta.solicitudes||[]).find(s => String(s.packId)===String(id) && s.estado==="Pendiente");
async function loadCuenta(){
  if(!U.token){ U.cuenta = null; paintAccount(); return; }
  try{ U.cuenta = await api("miCuenta", { token:U.token }); }
  catch(ex){ if(/^SESION/.test(ex.message)){ U.token = null; store.del(CK.user); } U.cuenta = null; }
  paintAccount(); renderPacks();
  if(U.cuenta) prefetchOwn();
}
// Precarga en segundo plano el contenido de los packs del usuario
async function prefetchOwn(){
  for(const a of (U.cuenta ? U.cuenta.accesos.filter(a=>a.activo) : [])){
    const s = store.get(CK.own + a.carpetaId, true);
    if(s && Date.now() - s.t < 10*60e3){ OWN[a.carpetaId] = s; continue; }
    try{ await fetchOwn(a.carpetaId); }catch(_){}
  }
}
function paintAccount(){
  const c = U.cuenta;
  $("#hdrLogin").hidden = !!c; $("#hdrReg").hidden = !!c; $("#hdrUser").hidden = !c;
  $("#tabAccount").textContent = c ? "Mi cuenta" : "Ingresar";
  if(c){ $("#hdrAvatar").textContent = initials(c.nombre); $("#hdrName").textContent = String(c.nombre).split(/\s+/)[0]; }
  $("#mTitleTxt").textContent = c ? "Mi cuenta" : "Ingresar";
  $("#mStep1").hidden = !!c || !!U.correo; $("#mStep2").hidden = !!c || !U.correo; $("#mIn").hidden = !c;
  if(!c) return;
  $("#mAvatar").textContent = initials(c.nombre); $("#mName").textContent = c.nombre; $("#mWho").textContent = c.correo;
  const list = c.accesos.slice().sort((a,b)=>(b.activo?1:0)-(a.activo?1:0));
  $("#mList").innerHTML = list.length ? list.map(a => {
    const car = CARP.find(x=>String(x.id)===String(a.carpetaId)) || { nombre:a.carpeta };
    const d = a.hasta ? dias(a.hasta) : null;
    const st = a.activo ? (a.hasta ? `Activo hasta el ${fechaCorta(a.hasta)}${d<=7?` · quedan ${d} días`:""}` : "Activo · sin vencimiento") : `Vencido el ${fechaCorta(a.hasta)}`;
    return `<div class="mrow">${coverHtml(car, true)}<div><b>${esc(a.carpeta)}</b><span class="pill ${a.activo?(d!=null&&d<=7?"Pendiente":"si"):"no"}">${esc(st)}</span></div>
      ${a.activo ? `<button type="button" class="btn sm grad" data-pack="${esc(a.carpetaId)}">Abrir</button>` : `<button type="button" class="btn sm" data-buy="${esc(a.carpetaId)}">Renovar</button>`}</div>`;
  }).join("") : `<p class="note" style="padding:8px 0">Aún no tienes packs activos. Elige uno y pulsa <b>Comprar</b>: el administrador recibe tu solicitud al instante.</p>`;
  const reqs = c.solicitudes || [];
  $("#mReqs").innerHTML = reqs.length ? `<h4 class="subt">Solicitudes en revisión</h4>` + reqs.map(s => {
    const car = CARP.find(x=>String(x.id)===String(s.packId)) || { nombre:s.pack };
    return `<div class="mrow">${coverHtml(car, true)}<div><b>${esc(s.pack)}</b><span class="pill Pendiente">Enviada ${esc(hace(s.fecha))}</span></div><button type="button" class="btn sm" data-pack="${esc(s.packId)}">Ver</button></div>`;
  }).join("") : "";
}
function openAuth(context){
  const ctx = $("#mContext"); ctx.hidden = !context; ctx.textContent = context || "";
  if(!U.cuenta && !U.correo){ const m = store.get(CK.mail); if(m && !$("#mMail").value) $("#mMail").value = m; }
  $$(".demo-only").forEach(e => e.hidden = !demoMode());
  paintAccount(); openModal("#mModal");
}
async function requestCode(correo, btn){
  const r = await api("pedirCodigo", { correo });
  U.correo = correo; store.set(CK.mail, correo);
  $("#mSentTo").textContent = `Te enviamos un código de 6 dígitos a ${correo}. Revisa también la carpeta de spam o promociones.`;
  if(r.demoCodigo) toast(`Modo demostración: tu código es ${r.demoCodigo}`);
  paintAccount(); setTimeout(()=>$("#mCode").focus(), 60);
}
async function sendCode(e){
  e.preventDefault();
  const err = $("#mErr1"), b = $("#mSend"), correo = $("#mMail").value.trim().toLowerCase(); err.textContent = "";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){ err.textContent = "Escribe un correo válido."; return; }
  busy(b, true);
  try{ await requestCode(correo, b); }
  catch(ex){
    if(/Ya te enviamos/.test(ex.message)){ U.correo = correo; paintAccount(); $("#mSentTo").textContent = `Usa el código que te enviamos a ${correo}.`; }
    else err.innerHTML = esc(ex.message) + (/no está registrado/.test(ex.message) ? ` <button type="button" class="linkbtn" data-open="registro">Crear cuenta</button>` : "");
  }finally{ busy(b, false); }
}
async function checkCode(e){
  e.preventDefault();
  const err = $("#mErr2"), b = $("#mGo"), code = $("#mCode").value.replace(/\D/g,""); err.textContent = "";
  if(code.length !== 6){ err.textContent = "El código tiene 6 dígitos."; return; }
  busy(b, true);
  try{
    const r = await api("verificarCodigo", { correo:U.correo, codigo:code });
    U.token = r.token; store.set(CK.user, r.token); U.correo = ""; $("#mCode").value = "";
    await loadCuenta();
    $("#mContext").hidden = true;
    toast(`Hola, ${U.cuenta ? String(U.cuenta.nombre).split(/\s+/)[0] : ""}. Ya ingresaste.`, "ok");
    if(F.c && $("#fModal").classList.contains("open")) openPack(F.c.id, false);
    if(PEND && PEND.buy){ const id = PEND.buy; PEND = null; closeModal($("#mModal")); setTimeout(() => buy(id), 180); }
  }catch(ex){ err.textContent = ex.message; }
  finally{ busy(b, false); }
}
async function submitReg(e){
  e.preventDefault();
  const err = $("#rErr"); err.textContent = "";
  const nombre = $("#rNom").value.trim(), correo = $("#rMail").value.trim().toLowerCase();
  const num = $("#rWa").value.replace(/\D/g,""), whatsapp = $("#rPais").value + num;
  if(nombre.length < 2){ err.textContent = "Escribe tu nombre."; return $("#rNom").focus(); }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){ err.textContent = "Escribe un correo válido. Usa una cuenta de Google (Gmail)."; return $("#rMail").focus(); }
  if(num.length < 6 || whatsapp.length > 15){ err.textContent = "Escribe tu número de WhatsApp sin el código de país."; return $("#rWa").focus(); }
  if(!$("#rOk").checked){ err.textContent = "Marca la casilla de aceptación para continuar."; return; }
  const btn = $("#rSend"); busy(btn, true);
  try{
    const r = await api("registrar", { datos:{ nombre, correo, whatsapp, web:$("#rWeb").value } });
    store.set(CK.mail, correo);
    // Sin pasos extra: se envía el código para entrar de inmediato
    closeModal($("#rModal"));
    $("#mMail").value = correo;
    openAuth(r.existente ? "Ya tenías una cuenta con este Gmail. Te enviamos un código para entrar." : "¡Cuenta creada! Te enviamos un código a tu Gmail para entrar.");
    try{ await requestCode(correo); }
    catch(ex){ if(/Ya te enviamos/.test(ex.message)){ U.correo = correo; paintAccount(); } else { $("#mErr1").textContent = ex.message; } }
    $("#regForm").reset();
  }catch(ex){ err.textContent = ex.message; }
  finally{ busy(btn, false); }
}
function logoutUser(silent){
  U.token = null; U.cuenta = null; U.correo = ""; store.del(CK.user);
  Object.keys(OWN).forEach(k => { delete OWN[k]; store.del(CK.own + k, true); });
  paintAccount(); renderPacks(); if(current) stop();
  if(!silent) toast("Sesión cerrada.");
}

/* =====================================================================
   Reproducción
   ===================================================================== */
let current = null, queue = [];
function play(f){
  if(current && current.id === f.id && f.k === "a"){ stop(); return; }
  const demo = isDemoId(f.id);
  if(demo) toast("Archivo de ejemplo: con tu Drive conectado aquí suena el archivo real.");
  current = f; queue = F.view.filter(x => x.id && (x.k==="v" || x.k==="a"));
  document.body.classList.add("playing"); $("#dock").classList.add("on"); $("#disc").classList.add("spin");
  $("#dockT").textContent = f.nombre.replace(/\.[^.]+$/,"");
  $("#dockS").textContent = [F.c.nombre, f.bpm ? f.bpm.txt + " BPM" : ""].filter(Boolean).join(" · ");
  $("#hudL").textContent = "SEÑAL · EN VIVO"; $("#hudL").className = "live";
  $("#hudR").textContent = (f.bpm ? f.bpm.txt : "—") + " BPM"; $("#hudNow").textContent = "▶ " + f.nombre;
  const frame = `<iframe src="${D.preview(f.id)}" allow="autoplay; fullscreen" allowfullscreen title="${esc(f.nombre)}"></iframe>`;
  if(f.k === "v"){
    $("#dockFrame").textContent = "Reproduciendo en la ventana de video";
    $("#vTitle").textContent = f.nombre.replace(/\.[^.]+$/,""); $("#vMeta").textContent = $("#dockS").textContent;
    $("#vFrame").innerHTML = demo ? "Vista previa de ejemplo · con tu Drive conectado aquí se ve el video" : frame;
    [["#vOpen",D.view],["#vDl",D.dl]].forEach(([s,fn]) => { const a = $(s); if(demo){ a.href="#"; a.dataset.demo="1"; } else { a.href=fn(f.id); delete a.dataset.demo; } });
    openModal("#vModal");
  } else $("#dockFrame").innerHTML = demo ? "Ejemplo · sin archivo conectado" : frame;
  refreshRows();
}
function stop(){
  current = null;
  document.body.classList.remove("playing"); $("#dock").classList.remove("on"); $("#disc").classList.remove("spin");
  setTimeout(() => { if(!current) $("#dockFrame").innerHTML = ""; }, 400);
  $("#hudL").textContent = "SEÑAL · EN ESPERA"; $("#hudL").className = ""; $("#hudR").textContent = "— BPM";
  $("#hudNow").textContent = "Abre un pack y reproduce una pista";
  refreshRows();
}
function step(d){
  if(!queue.length) return;
  const i = current ? queue.findIndex(x => x.id === current.id) : -1;
  play(queue[(i + d + queue.length) % queue.length]);
}
// Actualiza solo los botones de reproducción (sin redibujar la lista ni perder el scroll)
function refreshRows(){
  $$("#fList .frow").forEach(r => {
    const b = r.querySelector("[data-play]"); if(!b) return;
    const on = !!(current && current.id === b.dataset.play);
    r.classList.toggle("playing", on); b.innerHTML = on ? I.pause : I.play;
  });
}

/* =====================================================================
   Ventanas (animadas, con foco controlado)
   ===================================================================== */
const focusStack = [];
function openModal(sel){
  const m = typeof sel === "string" ? $(sel) : sel;
  if(!m.classList.contains("open")){ focusStack.push(document.activeElement); m.classList.add("open"); }
  document.body.classList.add("modal-open");
  setTimeout(() => {
    const f = m.id === "fModal" ? m.querySelector("[data-close]") : m.querySelector("form:not([hidden]) input:not([type=checkbox]):not([tabindex='-1']), [data-close]");
    if(f && !m.contains(document.activeElement)) f.focus({ preventScroll:true });
  }, 60);
}
function closeModal(m){
  if(!m || !m.classList.contains("open")) return;
  m.classList.remove("open");
  if(m.id === "vModal"){ $("#vFrame").innerHTML = ""; if(current && current.k === "v") $("#dockFrame").textContent = "Video cerrado · pulsa ▶ para verlo otra vez"; }
  if(m.id === "fModal"){ F.req++; clearTimeout(F.poll); try{ history.replaceState(null,"",location.pathname+location.search); }catch(_){} }
  if(m.id === "aModal") stopPoll();
  if(!document.querySelector(".modal.open")) document.body.classList.remove("modal-open");
  const f = focusStack.pop(); if(f && f.focus && document.contains(f)) f.focus({ preventScroll:true });
}
function dismiss(m){
  closeModal(m);
  if(m && (m.id === "mModal" || m.id === "rModal")) setTimeout(() => { if(!$("#mModal").classList.contains("open") && !$("#rModal").classList.contains("open")) PEND = null; }, 60);
}
const topModal = () => { const o = $$(".modal.open"); return o.sort((a,b) => (+getComputedStyle(a).zIndex) - (+getComputedStyle(b).zIndex)).pop(); };
function openSection(k){
  if(k === "registro"){ const m = $("#mModal"); if(m.classList.contains("open")) closeModal(m);
    const pc = PEND && CARP.find(x => String(x.id) === String(PEND.buy));
    $("#rContext").hidden = !pc;
    $("#rContext").innerHTML = pc ? `<b>Para ${Number(pc.precio)>0?"comprar":"pedir"} «${esc(pc.nombre)}»${Number(pc.precio)>0?` (${esc(money(pc.precio))} · ${esc(perLabel(pc))})`:""}:</b>
      <ol><li>Crea tu cuenta: nombre, Gmail y WhatsApp.</li><li>Escribe el código de 6 dígitos que llega a tu Gmail.</li><li>Confirma la solicitud: el administrador recibe el aviso y te escribe por WhatsApp para activarla.</li></ol>` : "";
    if(!$("#rMail").value){ const mm = store.get(CK.mail); if(mm) $("#rMail").value = mm; }
    openModal("#rModal"); }
  else if(k === "cuenta"){ const r = $("#rModal"); if(r.classList.contains("open")) closeModal(r);
    const pc = PEND && CARP.find(x => String(x.id) === String(PEND.buy));
    openAuth(pc ? `Ingresa con tu Gmail para continuar con la compra de «${pc.nombre}».` : ""); }
  else if(k === "admin") adminOpen();
}

/* =====================================================================
   Administrador
   ===================================================================== */
const A = { token: store.get("rc5_admin", true), regs:[], sols:[], cars:[], aj:{}, conteos:{}, indexado:"", cuota:null,
            est:"", q:"", solF:"Pendiente", tab:"sols", approve:null, editReg:null, editCar:null, armed:null, prevSeen:null, knownSols:null, poll:null };
function adminOpen(){
  $$(".demo-only").forEach(e => e.hidden = !demoMode());
  openModal("#aModal");
  if(A.token){ showDash(); loadAdmin(); } else showLogin();
}
function showLogin(){ $("#aLogin").hidden = false; $("#aDash").hidden = true; $("#aOut").hidden = true; $("#aSheet").hidden = true; stopPoll(); setTimeout(()=>$("#aPass").focus(),60); }
function showDash(){ $("#aLogin").hidden = true; $("#aDash").hidden = false; $("#aOut").hidden = false; startPoll(); setTab(A.tab); }
function startPoll(){ stopPoll(); A.poll = setInterval(() => { if(!A.approve && !A.editReg && !A.editCar && document.visibilityState === "visible") loadAdmin(true); }, 40000); }
function stopPoll(){ if(A.poll){ clearInterval(A.poll); A.poll = null; } }
async function doLogin(e){
  e.preventDefault();
  const err = $("#aErr"), b = $("#aGo"); err.textContent = ""; busy(b, true);
  try{
    const r = await api("login", { clave: $("#aPass").value });
    A.token = r.token; store.set("rc5_admin", r.token, true); $("#aPass").value = "";
    showDash(); await loadAdmin();
  }catch(ex){ err.textContent = ex.message; }
  finally{ busy(b, false); }
}
async function adminLogout(){ try{ await api("salir", { token:A.token }); }catch(_){} A.token = null; store.del("rc5_admin", true); showLogin(); }
async function adminCall(accion, data){
  try{ return await api(accion, { token:A.token, ...data }); }
  catch(ex){
    if(/^SESION/.test(ex.message)){ A.token = null; store.del("rc5_admin", true); showLogin(); $("#aErr").textContent = ex.message.replace(/^SESION:\s*/,""); }
    throw ex;
  }
}
async function loadAdmin(silent){
  if(!silent && !A.regs.length) $("#solRows").innerHTML = `<div class="sk row-sk"></div><div class="sk row-sk"></div>`;
  try{
    const r = await adminCall("listar");
    if(A.prevSeen == null) A.prevSeen = Number(store.get("rc5_admin_seen")) || 0;
    const pend = (r.solicitudes||[]).filter(s => s.estado === "Pendiente");
    if(A.knownSols){
      const nuevas = pend.filter(s => !A.knownSols.has(s.id));
      if(nuevas.length) toast(nuevas.length === 1 ? `Nueva solicitud: ${nuevas[0].pack} — ${nuevas[0].nombre}` : `${nuevas.length} solicitudes nuevas`, "ok");
    }
    A.knownSols = new Set(pend.map(s => s.id));
    Object.assign(A, { regs:r.registros||[], sols:r.solicitudes||[], cars:r.carpetas||[], aj:r.ajustes||{}, conteos:r.conteos||{}, indexado:r.indexado||"", cuota:r.cuota });
    store.set("rc5_admin_seen", Date.now());
    if(r.hoja){ $("#aSheet").href = r.hoja; $("#aSheet").hidden = false; }
    renderSols(); renderRegs(); renderCars(); fillAjustes();
  }catch(ex){ if(!silent) $("#solRows").innerHTML = `<div class="empty">No se pudieron cargar los datos: ${esc(ex.message)}</div>`; }
}
function setTab(t){
  A.tab = t;
  $$("[data-atab]").forEach(b => b.setAttribute("aria-selected", b.dataset.atab === t));
  ["sols","regs","cars","ajs"].forEach(k => $("#a" + k[0].toUpperCase() + k.slice(1)).hidden = k !== t);
}

/* ---------- Solicitudes de compra ---------- */
function renderSols(){
  const pend = A.sols.filter(s => s.estado === "Pendiente").length;
  $("#solBadge").hidden = !pend; $("#solBadge").textContent = pend;
  const list = A.sols.filter(s => !A.solF || s.estado === A.solF);
  if(!list.length){ $("#solRows").innerHTML = `<div class="empty">${A.solF ? "No hay solicitudes pendientes. Cuando alguien pulse “Comprar”, aparecerá aquí y te llegará un correo." : "Aún no hay solicitudes."}</div>`; return; }
  $("#solRows").innerHTML = list.map(s => {
    const car = A.cars.find(c => String(c.id) === String(s.packId)) || { nombre:s.pack, modalidad:s.modalidad, meses:s.meses };
    const p = { precio:s.precio, modalidad:s.modalidad, meses:s.meses };
    const msg = `Hola ${s.nombre}, recibimos tu solicitud del pack "${s.pack}" (${priceTxt(p)}). Te paso los datos para el pago.`;
    const isP = s.estado === "Pendiente";
    return `<article class="solc${isP?" pend":""}">
      ${coverHtml(car, true)}
      <div class="pk"><b>${esc(s.pack)}</b><span>${esc(Number(s.precio)>0 ? `${money(s.precio)} · ${periodo(p)}` : "Gratis")}</span><div class="dim">${esc(fechaCorta(s.fecha))} · ${esc(hace(s.fecha))}</div></div>
      <div class="who"><b>${esc(s.nombre)}</b><span>${esc(s.correo)}</span><a class="wa" href="${waLink(s.whatsapp, msg)}" target="_blank" rel="noopener">${I.wa}+${esc(s.whatsapp)}</a></div>
      <div class="ra">${isP ? `<span class="mes">Duración <input type="number" min="0" max="120" value="${esc(s.meses ?? mesesDe(car))}" data-solmes="${esc(s.id)}" aria-label="Meses de acceso"> meses</span>
        <button type="button" class="btn sm grad" data-act="solOk" data-id="${esc(s.id)}">Aprobar y dar acceso</button>
        <button type="button" class="btn sm bad${A.armed==="s:"+s.id?" armed":""}" data-act="solNo" data-id="${esc(s.id)}">${A.armed==="s:"+s.id?"¿Rechazar?":"Rechazar"}</button>`
        : `<span class="pill ${esc(s.estado)}">${esc(s.estado)}</span>${s.resuelto?`<span class="dim">${esc(fechaCorta(s.resuelto))}</span>`:""}`}</div>
    </article>`;
  }).join("");
}

/* ---------- Registros ---------- */
const isNew = x => new Date(x.fecha).getTime() > (A.prevSeen||0);
const accActivo = a => a.estado === "Activo" && (!a.hasta || new Date(a.hasta) > new Date());
function fmtDate(s){ const d = new Date(s); return isNaN(d) ? "—" : d.toLocaleDateString("es-PE",{day:"2-digit",month:"short"}) + " " + d.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}); }
function fmtWa(n){ n = String(n).replace(/\D/g,""); return "+" + n.replace(/^(51|52|57|593|591|56|54|58|507|1|34)(\d+)$/, (m,c,r)=>c+" "+r.replace(/(\d{3})(?=\d)/g,"$1 ")); }
function waMsg(x){
  const act = (x.accesos||[]).filter(accActivo), site = A.aj && A.aj.sitio;
  if(act.length) return `Hola ${x.nombre}, tu acceso a ${CONFIG.marca} está activo: ${act.map(a=>a.carpeta + (a.hasta ? ` (hasta el ${fechaCorta(a.hasta)})` : "")).join(", ")}. Entra con “Ingresar” usando ${x.correo}.${site?" "+site:""}`;
  if(x.estado === "Vencido") return `Hola ${x.nombre}, tu acceso a ${CONFIG.marca} venció. ¿Quieres renovarlo?`;
  return `Hola ${x.nombre}, te escribimos de ${CONFIG.marca}.`;
}
function accChip(a){
  const on = accActivo(a), d = a.hasta ? dias(a.hasta) : null, cls = !on ? "off" : d!=null && d<=7 ? "soon" : "on";
  const txt = !on ? `vencido ${fechaCorta(a.hasta)}` : a.hasta ? `hasta ${fechaCorta(a.hasta)}` : "sin vencimiento";
  return `<span class="acc ${cls}">${esc(a.carpeta)} · ${esc(txt)}</span>`;
}
function regForm(x){
  return `<div class="panel" data-regform="${esc(x.id||"")}">
    <span class="lbl">${x.id ? "Editar datos de " + esc(x.nombre) : "Agregar persona"}</span>
    <div class="form">
      <label class="w3">Nombre<input data-f="nombre" value="${esc(x.nombre||"")}"></label>
      <label class="w3">Correo (Gmail)<input data-f="correo" type="email" value="${esc(x.correo||"")}"></label>
      <label class="w2">WhatsApp con código<input data-f="whatsapp" inputmode="tel" value="${esc(x.whatsapp||"")}" placeholder="51987654321"></label>
      <label class="w4">Nota interna<input data-f="nota" value="${esc(x.nota||"")}" placeholder="Ej.: pagó por Yape el 12/11"></label>
    </div>
    <div class="row-end"><p class="err" data-err></p><button type="button" class="btn sm" data-act="regCancel">Cancelar</button><button type="button" class="btn sm grad" data-act="regSave" data-id="${esc(x.id||"")}">Guardar</button></div>
  </div>`;
}
function grantPanel(x){
  const actuales = x.accesos || [], libres = A.cars.filter(c => !actuales.some(a => String(a.carpetaId) === String(c.id) && accActivo(a)));
  return `<div class="panel" data-approve>
    ${actuales.length ? `<span class="lbl">Accesos de ${esc(x.nombre)}</span><div class="grants">${actuales.map(a => {
      const car = A.cars.find(c => String(c.id) === String(a.carpetaId)) || {};
      return `<div class="grant"><div>${accChip(a)}</div><div class="ra"><span class="mes">+<input type="number" min="0" max="120" value="${mesesDe(car) || 1}" data-renew="${esc(a.id)}" aria-label="Meses a agregar"> meses</span>
        <button type="button" class="btn sm ok" data-act="renovar" data-acc="${esc(a.id)}">Renovar</button>
        <button type="button" class="btn sm bad" data-act="quitarAcceso" data-acc="${esc(a.id)}">Quitar</button></div></div>`;
    }).join("")}</div>` : ""}
    ${libres.length ? `<span class="lbl">Dar acceso de lector en Google Drive a ${esc(x.correo)}</span>
    <div class="grants">${libres.map(c => `<div class="grant"><label><input type="checkbox" data-grant value="${esc(c.id)}"><span>${esc(c.nombre)}</span><span class="dim">${esc(priceTxt(c))}</span></label>
      <span class="mes">Duración <input type="number" min="0" max="120" value="${mesesDe(c)}" data-meses="${esc(c.id)}" aria-label="Meses para ${esc(c.nombre)}"> meses</span></div>`).join("")}</div>
    <p class="help">0 meses = sin vencimiento. Al vencer, se quita automáticamente el permiso de lector en Drive.</p>` : `<p class="note">Ya tiene acceso activo a todas las carpetas.</p>`}
    <div class="row-end"><p class="err" data-err></p><button type="button" class="btn sm" data-act="cancel">Cerrar</button>${libres.length ? `<button type="button" class="btn sm grad" data-act="aprobar" data-id="${esc(x.id)}">Dar acceso</button>` : ""}</div>
  </div>`;
}
function renderRegs(){
  const pronto = A.regs.filter(x => (x.accesos||[]).some(a => accActivo(a) && a.hasta && dias(a.hasta) <= 7)).length;
  $("#tTot").textContent = A.regs.length; $("#tPen").textContent = A.sols.filter(s=>s.estado==="Pendiente").length;
  $("#tApr").textContent = A.regs.filter(x=>x.estado==="Aprobado").length; $("#tRec").textContent = pronto;
  const nNew = A.regs.filter(isNew).length; $("#newBadge").hidden = !nNew; $("#newBadge").textContent = nNew;
  $("#regNewBox").innerHTML = A.editReg === "" ? regForm({}) : "";
  const q = A.q.toLowerCase();
  const list = A.regs.filter(x => (!A.est || x.estado === A.est) && (!q || [x.nombre,x.correo,x.whatsapp,x.nota].join(" ").toLowerCase().includes(q)));
  if(!list.length){ $("#aRows").innerHTML = `<div class="empty">${A.regs.length ? "Ningún registro coincide con el filtro." : "Aún no hay registros."}</div>`; return; }
  $("#aRows").innerHTML = list.map(x => {
    const id = esc(x.id), accs = x.accesos || [], acts = [];
    acts.push(`<button type="button" class="btn sm ok" data-act="approve" data-id="${id}">${accs.length ? "Accesos" : "Dar acceso"}</button>`);
    if(x.estado === "Aprobado") acts.push(`<button type="button" class="btn sm" data-act="revocar" data-id="${id}">Revocar todo</button>`);
    acts.push(`<button type="button" class="btn sm" data-act="regEdit" data-id="${id}">Editar</button>`);
    acts.push(`<button type="button" class="btn sm bad${A.armed===x.id?" armed":""}" data-act="eliminar" data-id="${id}">${A.armed===x.id?"¿Eliminar?":"Eliminar"}</button>`);
    const extra = A.approve === x.id ? grantPanel(x) : A.editReg === x.id ? regForm(x) : "";
    const label = x.estado === "Registrado" ? "Sin compra" : x.estado;
    return `<div class="arow">
      <span class="dim c-date">${fmtDate(x.fecha)}</span>
      <div class="who"><b>${esc(x.nombre)}</b>${isNew(x)?`<span class="new" style="display:inline">Nuevo</span>`:""}${x.nota?`<span>${esc(x.nota)}</span>`:""}</div>
      <span class="mail c-mail">${esc(x.correo)}</span>
      <span class="c-wa"><a class="wa" href="${waLink(x.whatsapp, waMsg(x))}" target="_blank" rel="noopener">${I.wa}${esc(fmtWa(x.whatsapp))}</a></span>
      <span class="c-int">${accs.length ? accs.map(accChip).join("") : '<span class="dim">—</span>'}</span>
      <span><span class="pill ${esc(x.estado)}">${esc(label)}</span></span>
      <div class="ra">${acts.join("")}</div>${extra}
    </div>`;
  }).join("");
}
function readPanel(el){ const o = {}; el.querySelectorAll("[data-f]").forEach(i => o[i.dataset.f] = i.type === "checkbox" ? i.checked : i.value); return o; }

/* ---------- Carpetas ---------- */
const E = { portada:"" };
let FILE_TARGET = "portada";
function carForm(c){
  E.portada = c.portada || "";
  const isData = /^data:/.test(E.portada), mod = c.modalidad || "Único";
  return `<div class="panel" data-carform="${esc(c.id||"")}" style="margin-bottom:16px">
    <span class="lbl">${c.id ? "Editar carpeta" : "Nueva carpeta"}</span>
    <div class="cedit">
      <div class="side"><div id="cPrev">${coverHtml({ ...c, nombre:c.nombre||"Nueva carpeta" })}</div>
        <button type="button" class="btn sm" data-act="coverPick">Subir portada</button><button type="button" class="btn sm" data-act="coverClear">Quitar portada</button></div>
      <div class="form">
        <label class="w6">Nombre<input data-f="nombre" value="${esc(c.nombre||"")}" maxlength="80"></label>
        <label class="w2">Precio<span class="money"><b>${esc(AJ.moneda||CONFIG.moneda)}</b><input data-f="precio" type="number" min="0" step="0.5" value="${esc(c.precio ?? 0)}" aria-label="Precio"></span><span class="help">0 = Gratis</span></label>
        <label class="w2">Modalidad de pago<select data-f="modalidad">${Object.keys(MODS).map(m=>`<option value="${m}" ${m===mod?"selected":""}>${{"Único":"Pago único","Mensual":"Mensual (1 mes)","Anual":"Anual (12 meses)","Personalizado":"Personalizado (meses)"}[m]}</option>`).join("")}</select></label>
        <label class="w2" data-mesbox ${mod!=="Personalizado"?"hidden":""}>Duración en meses<input data-f="meses" type="number" min="1" max="120" value="${esc(mod==="Personalizado" ? (c.meses||3) : 3)}"></label>
        <label class="w6">Descripción<textarea data-f="descripcion" maxlength="400">${esc(c.descripcion||"")}</textarea></label>
        <label class="w2">Tipo<select data-f="tipo">${["Video","Audio","Mixto","Software"].map(t=>`<option ${t===(c.tipo||"Video")?"selected":""}>${t}</option>`).join("")}</select></label>
        <label class="w2">Orden<input data-f="orden" type="number" min="1" value="${esc(c.orden || A.cars.length+1)}"></label>
        <label class="tick w2" style="align-self:end;padding-bottom:12px"><input type="checkbox" data-f="visible" ${c.visible!==false?"checked":""}><span>Visible en la web</span></label>
        <label class="w6">Enlace de la carpeta en Google Drive<input data-f="drive" value="${esc(c.drive ? D.folder(c.drive) : "")}" placeholder="https://drive.google.com/drive/folders/…"><span class="help">No necesita ser pública: se comparte como lector solo con quien apruebes. Al guardar, su contenido aparece en la web al instante.</span></label>
        <label class="w6">Portada (enlace de imagen o de Google Drive)<input id="cPortada" value="${esc(isData ? "Imagen subida desde tu equipo" : E.portada)}" placeholder="https://drive.google.com/file/d/…/view"></label>
      </div>
    </div>
    <div class="row-end"><p class="err" data-err></p><button type="button" class="btn sm" data-act="carCancel">Cancelar</button><button type="button" class="btn sm grad" data-act="carSave" data-id="${esc(c.id||"")}">Guardar carpeta</button></div>
  </div>`;
}
function renderCars(){
  $("#carEditBox").innerHTML = A.editCar === "" ? carForm({}) : "";
  if(!A.cars.length){ $("#cRows").innerHTML = `<div class="empty">No hay carpetas. Crea la primera con “Nueva carpeta”.</div>`; return; }
  $("#cRows").innerHTML = A.cars.map(c => {
    const id = esc(c.id), n = A.conteos[c.id];
    return `<div class="crow">${coverHtml(c, true)}
      <div class="cn"><b>${esc(c.nombre)}</b><span>${esc(c.drive ? (c.descripcion || "Carpeta de Drive conectada") : "Falta conectar la carpeta de Drive")}</span></div>
      <span class="num c-tipo">${n != null ? fmtNum(n) : "—"}</span>
      <span class="num c-precio" style="color:var(--ink)">${esc(money(c.precio))}<br><span class="dim">${esc(Number(c.precio)>0 ? periodo(c) : "")}</span></span>
      <span class="c-vis"><span class="pill ${c.visible!==false?"si":"no"}">${c.visible!==false?"Visible":"Oculta"}</span></span>
      <div class="ra"><button type="button" class="btn sm" data-act="carEdit" data-id="${id}">Editar</button>
        <button type="button" class="btn sm bad${A.armed==="c:"+c.id?" armed":""}" data-act="carDel" data-id="${id}">${A.armed==="c:"+c.id?"¿Eliminar?":"Eliminar"}</button></div>
      ${A.editCar === c.id ? carForm(c) : ""}
    </div>`;
  }).join("");
}
function refreshPreview(){
  const p = document.querySelector("[data-carform]"); if(!p) return;
  const v = readPanel(p);
  $("#cPrev").innerHTML = coverHtml({ nombre:v.nombre || "Nueva carpeta", tipo:v.tipo, portada:E.portada });
}
function resizeImage(file, max){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width*k); c.height = Math.round(im.height*k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.86));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen.")); };
    im.src = url;
  });
}
async function uploadImage(file){
  if(!file) return;
  if(!/^image\//.test(file.type)){ toast("Elige una imagen JPG, PNG o WebP.", "err"); return; }
  const fondo = FILE_TARGET === "fondo";
  toast(fondo ? "Subiendo imagen de fondo…" : "Subiendo portada…");
  try{
    const dataUrl = await resizeImage(file, fondo ? 1600 : 1000);
    const r = await adminCall("subirPortada", { nombre:(fondo ? "Fondo web" : file.name.replace(/\.[^.]+$/,"")) + ".jpg", datos:dataUrl.split(",")[1], mime:"image/jpeg" });
    if(fondo){ J.fondo = r.url; paintFondoPrev(); toast("Imagen lista. Pulsa “Guardar ajustes” para publicarla.", "ok"); }
    else { E.portada = r.url; $("#cPortada").value = /^data:/.test(r.url) ? "Imagen subida desde tu equipo" : r.url; refreshPreview(); toast("Portada lista. Recuerda guardar la carpeta.", "ok"); }
  }catch(ex){ toast(ex.message, "err"); }
}

/* ---------- Ajustes ---------- */
const J = { fondo:"" };
function fillAjustes(){
  $("#jMail").value = A.aj.correoAvisos || ""; $("#jWa").value = A.aj.whatsapp || ""; $("#jSite").value = A.aj.sitio || "";
  $("#jMon").value = A.aj.moneda || CONFIG.moneda; $("#jUser").checked = A.aj.avisarUsuario !== false; $("#jLuces").checked = A.aj.luces !== false;
  J.fondo = A.aj.fondo || ""; paintFondoPrev();
  const tot = Object.values(A.conteos||{}).reduce((t,n)=>t+(Number(n)||0),0);
  $("#jIdx").textContent = A.indexado ? `Actualizado ${hace(A.indexado)} · ${fmtNum(tot)} archivos. Revisa cambios en Drive cada 10 minutos.` : "Aún no se ha generado. Pulsa “Actualizar contenido ahora”.";
  $("#jQuota").textContent = A.cuota != null ? `Correos disponibles hoy en tu cuenta de Google: ${A.cuota}.` : "";
}
function paintFondoPrev(){
  const u = coverUrl(J.fondo);
  $("#jFondo").value = /^data:/.test(J.fondo) ? "Imagen subida desde tu equipo" : J.fondo;
  $("#jPrev").innerHTML = u ? `<img data-fb src="${esc(u)}" alt=""><span style="z-index:-1">No se pudo cargar la imagen</span>` : `<span>Sin imagen: solo luces animadas</span>`;
}
async function saveAjustes(e){
  e.preventDefault();
  const err = $("#jErr"), b = $("#jSave"); err.textContent = ""; busy(b, true);
  try{
    const r = await adminCall("guardarAjustes", { ajustes:{ correoAvisos:$("#jMail").value.trim(), whatsapp:$("#jWa").value, sitio:$("#jSite").value.trim(),
      moneda:$("#jMon").value.trim(), avisarUsuario:$("#jUser").checked, fondo:J.fondo, luces:$("#jLuces").checked } });
    A.aj = r.ajustes; toast("Ajustes guardados.", "ok"); loadCatalog(true);
  }catch(ex){ err.textContent = ex.message; }
  finally{ busy(b, false); }
}

/* ---------- Acciones del panel ---------- */
async function adminAction(btn){
  const act = btn.dataset.act, id = btn.dataset.id, acc = btn.dataset.acc;
  const simple = {
    approve:()=>{ A.approve = A.approve === id ? null : id; A.editReg = null; A.armed = null; renderRegs(); },
    cancel:()=>{ A.approve = null; renderRegs(); },
    regEdit:()=>{ A.editReg = id; A.approve = null; renderRegs(); },
    regNew:()=>{ A.editReg = ""; A.approve = null; renderRegs(); setTimeout(()=>{ const i = $("[data-regform] input"); if(i) i.focus(); }, 30); },
    regCancel:()=>{ A.editReg = null; renderRegs(); },
    carNew:()=>{ A.editCar = ""; renderCars(); setTimeout(()=>{ const i = $("[data-carform] input"); if(i) i.focus(); }, 30); },
    carEdit:()=>{ A.editCar = id; renderCars(); },
    carCancel:()=>{ A.editCar = null; renderCars(); },
    coverPick:()=>{ FILE_TARGET = "portada"; $("#fileIn").value = ""; $("#fileIn").click(); },
    coverClear:()=>{ E.portada = ""; $("#cPortada").value = ""; refreshPreview(); }
  };
  if(simple[act]) return simple[act]();
  const armKey = act==="carDel" ? "c:"+id : act==="quitarAcceso" ? "a:"+acc : act==="eliminar" ? id : act==="solNo" ? "s:"+id : null;
  if(armKey && A.armed !== armKey){
    A.armed = armKey;
    if(act === "quitarAcceso"){ btn.classList.add("armed"); btn.textContent = "¿Quitar?"; }
    else act === "carDel" ? renderCars() : act === "solNo" ? renderSols() : renderRegs();
    clearTimeout(A.t); A.t = setTimeout(() => { A.armed = null; renderRegs(); renderCars(); renderSols(); }, 4000);
    return;
  }
  const panel = btn.closest(".panel"), perr = panel && panel.querySelector("[data-err]");
  if(perr) perr.textContent = "";
  busy(btn, true);
  try{
    if(act === "solOk"){
      const inp = $(`[data-solmes="${id}"]`), meses = inp ? Number(inp.value)||0 : undefined;
      const r = await adminCall("resolverSolicitud", { id, decision:"aprobar", meses });
      toast(`Aprobada: acceso de lector a ${(r.carpetas||[]).join(", ")}` + (r.errores && r.errores.length ? ` · Falló: ${r.errores.join(", ")}` : ""), "ok");
    } else if(act === "solNo"){
      await adminCall("resolverSolicitud", { id, decision:"rechazar" }); A.armed = null; toast("Solicitud rechazada.");
    } else if(act === "aprobar"){
      const items = [...panel.querySelectorAll("input[data-grant]:checked")].map(i => ({ carpeta:i.value, meses:Number(panel.querySelector(`[data-meses="${i.value}"]`).value)||0 }));
      if(!items.length){ if(perr) perr.textContent = "Elige al menos una carpeta."; busy(btn, false); return; }
      const r = await adminCall("aprobar", { id, items });
      toast(`Acceso de lector dado: ${r.carpetas.join(", ")}` + (r.errores && r.errores.length ? ` · Falló: ${r.errores.join(", ")}` : ""), "ok");
    } else if(act === "renovar"){
      const meses = Number(panel.querySelector(`[data-renew="${acc}"]`).value)||0;
      await adminCall("renovar", { acceso:acc, meses }); toast(meses ? `Acceso renovado por ${plural(meses)}.` : "Acceso renovado sin vencimiento.", "ok");
    } else if(act === "quitarAcceso"){
      await adminCall("quitarAcceso", { acceso:acc }); A.armed = null; toast("Acceso quitado. Ya no es lector de esa carpeta en Drive.");
    } else if(act === "regSave"){
      const v = readPanel(panel);
      await adminCall("guardarRegistro", { registro:{ id, nombre:v.nombre, correo:v.correo.trim().toLowerCase(), whatsapp:v.whatsapp, nota:v.nota } });
      toast("Datos guardados.", "ok"); A.editReg = null;
    } else if(act === "carSave"){
      const v = readPanel(panel);
      const r = await adminCall("guardarCarpeta", { carpeta:{ id, nombre:v.nombre, descripcion:v.descripcion, precio:v.precio, modalidad:v.modalidad, meses:v.meses, tipo:v.tipo, orden:v.orden, visible:v.visible, drive:v.drive, portada:E.portada } });
      toast(r.indexado ? "Carpeta guardada y contenido actualizado." : r.pendiente ? "Carpeta guardada. Su contenido es grande: se termina de preparar en 1 o 2 minutos." : "Carpeta guardada.", "ok"); A.editCar = null;
      loadCatalog(true); loadIndex(true);
    } else if(act === "carDel"){
      await adminCall("eliminarCarpeta", { id }); A.armed = null; toast("Carpeta quitada de la web. Tu Drive no se tocó.");
      loadCatalog(true); loadIndex(true);
    } else {
      await adminCall(act, { id }); A.armed = null; A.approve = null;
      toast({ revocar:"Se quitaron todos sus accesos en Drive.", eliminar:"Registro eliminado." }[act] || "Listo.");
    }
    await loadAdmin(true);
  }catch(ex){ if(perr) perr.textContent = ex.message; else toast(ex.message, "err"); }
  finally{ if(document.contains(btn)) busy(btn, false); }
}

/* =====================================================================
   Fondo animado (luces de escenario) y visual del encabezado
   ===================================================================== */
function applyFondo(){
  const ph = $("#bgPhoto"), u = coverUrl(AJ.fondo);
  if(u){ ph.style.backgroundImage = `url("${u.replace(/"/g,"%22")}")`; ph.hidden = false; } else { ph.style.backgroundImage = ""; ph.hidden = true; }
  $("#bgCanvas").style.opacity = AJ.luces === false ? "0" : "1";
}
function bgLights(){
  const c = $("#bgCanvas"), ctx = c.getContext("2d"), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const K = 0.33, COL = [[47,216,230],[91,92,240],[209,47,208],[255,90,170],[47,216,230],[160,80,255]], rnd = (a,b) => a + Math.random()*(b-a);
  let W = 0, H = 0, t = Math.random()*100, last = 0, heads = [], bokeh = [], crowd = [];
  function setup(){
    W = Math.max(200, Math.round(innerWidth*K)); H = Math.max(150, Math.round(innerHeight*K)); c.width = W; c.height = H;
    const n = innerWidth < 700 ? 4 : 7;
    heads = Array.from({length:n}, (_,i) => ({ x:(i+0.5)/n, col:COL[i%COL.length], ph:rnd(0,6.28), sp:rnd(.25,.55), amp:rnd(.35,.6), w:rnd(.05,.09) }));
    bokeh = Array.from({length:innerWidth < 700 ? 12 : 26}, () => ({ x:rnd(0,1), y:rnd(.05,.8), r:rnd(4,18), col:COL[Math.floor(rnd(0,COL.length))], a:rnd(.08,.28), vx:rnd(-.004,.004), vy:rnd(-.003,.001), ph:rnd(0,6.28) }));
    crowd = []; let x = -0.02;
    while(x < 1.04){ crowd.push({ x, s:rnd(.8,1.25), arm: Math.random() < .38 ? rnd(-.5,.5) : null, arm2: Math.random() < .18 }); x += rnd(.022,.04); }
  }
  function draw(){
    const live = !!current, bpm = live && current.bpm ? current.bpm.ini : 120;
    const beat = live ? Math.pow(Math.max(0, Math.sin(t*bpm/60*Math.PI)), 6) : 0;
    ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#05070f"; ctx.fillRect(0,0,W,H);
    const g0 = ctx.createRadialGradient(W*.5, -H*.05, 0, W*.5, -H*.05, H*.9);
    g0.addColorStop(0, `rgba(120,80,255,${.32+beat*.2})`); g0.addColorStop(1, "rgba(5,7,15,0)"); ctx.fillStyle = g0; ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation = "lighter";
    heads.forEach(h => {
      const ang = Math.sin(t*h.sp + h.ph) * h.amp, len = H*1.25, sx = h.x*W, sy = -4;
      const ex = sx + Math.sin(ang)*len, ey = sy + Math.cos(ang)*len, spread = h.w*W*(1 + beat*.4), nx = Math.cos(ang), ny = -Math.sin(ang);
      const gr = ctx.createLinearGradient(sx, sy, ex, ey), [r,g,b] = h.col, a = live ? .34 + beat*.25 : .26;
      gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(.55, `rgba(${r},${g},${b},${a*.35})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(sx-1, sy); ctx.lineTo(ex + nx*spread, ey + ny*spread); ctx.lineTo(ex - nx*spread, ey - ny*spread); ctx.closePath(); ctx.fill();
      const gl = ctx.createRadialGradient(sx, 2, 0, sx, 2, 14); gl.addColorStop(0, `rgba(${r},${g},${b},.9)`); gl.addColorStop(1, `rgba(${r},${g},${b},0)`); ctx.fillStyle = gl; ctx.fillRect(sx-14, 0, 28, 16);
    });
    bokeh.forEach(o => {
      o.x += o.vx*.2; o.y += o.vy*.2; if(o.x<-.05) o.x=1.05; if(o.x>1.05) o.x=-.05; if(o.y<-.05) o.y=.8;
      const [r,g,b] = o.col, a = o.a * (.7 + .3*Math.sin(t*1.3 + o.ph)) * (1 + beat*.5);
      const gr = ctx.createRadialGradient(o.x*W, o.y*H, 0, o.x*W, o.y*H, o.r);
      gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(.7, `rgba(${r},${g},${b},${a*.5})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(o.x*W, o.y*H, o.r, 0, 6.283); ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
    const gf = ctx.createLinearGradient(0, H*.7, 0, H); gf.addColorStop(0, "rgba(209,47,208,0)"); gf.addColorStop(1, `rgba(209,47,208,${.18+beat*.15})`);
    ctx.fillStyle = gf; ctx.fillRect(0, H*.7, W, H*.3);
    ctx.fillStyle = "rgba(2,3,8,.92)"; ctx.strokeStyle = "rgba(2,3,8,.92)"; ctx.lineCap = "round";
    const base = H*1.02, u = Math.max(H, W*.5) * .05;
    crowd.forEach((p,i) => {
      const x = p.x*W, s = p.s*u, bob = live ? Math.sin(t*bpm/60*Math.PI*2 + i)*s*.12 : Math.sin(t*.8+i)*s*.04, top = base - s*2.4 + bob;
      ctx.beginPath(); ctx.ellipse(x, top + s*1.5, s*.75, s*1.2, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(x, top + s*.2, s*.42, 0, 6.283); ctx.fill(); ctx.lineWidth = s*.28;
      if(p.arm != null){ ctx.beginPath(); ctx.moveTo(x + s*.4, top + s*.9); ctx.lineTo(x + s*(.7 + p.arm), top - s*1.4 + bob); ctx.stroke(); }
      if(p.arm2){ ctx.beginPath(); ctx.moveTo(x - s*.4, top + s*.9); ctx.lineTo(x - s*.9, top - s*1.2 + bob); ctx.stroke(); }
    });
  }
  // Se pausa con la pestaña oculta o con una ventana abierta (ahorra batería y mantiene la interfaz fluida)
  function loop(ts){
    const paused = document.visibilityState !== "visible" || AJ.luces === false || document.body.classList.contains("modal-open");
    if(!paused && ts - last > (innerWidth < 760 ? 50 : 33)){ t += Math.min(ts - last, 100)/1000 * (current ? 1.4 : .7); draw(); last = ts; }
    else if(paused) last = ts;
    requestAnimationFrame(loop);
  }
  setup(); draw();
  addEventListener("resize", () => { setup(); draw(); }, { passive:true });
  if(!reduce) requestAnimationFrame(t0 => { last = t0; requestAnimationFrame(loop); });
}
function scope(){
  const c = $("#scope"), ctx = c.getContext("2d"), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const N = 56; let t = 0, vis = true;
  const lerp = (a,b,f)=>Math.round(a+(b-a)*f);
  function size(){ const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio||1, 2); c.width = r.width*d; c.height = r.height*d; ctx.setTransform(d,0,0,d,0,0); }
  function draw(){
    if(vis && !document.body.classList.contains("modal-open")){
      const w = c.clientWidth, h = c.clientHeight;
      ctx.clearRect(0,0,w,h);
      const live = !!current, bw = (w-36)/N, base = h*0.66, bpm = current && current.bpm ? current.bpm.ini : 120;
      const beat = Math.pow(Math.max(0, Math.sin(t*bpm/60*Math.PI)), 8);
      for(let i=0;i<N;i++){
        const f = i/N;
        let v = 0.18 + 0.5*Math.exp(-f*2.2)*(0.6+0.4*Math.sin(i*0.9+t*1.3)) + 0.12*Math.sin(i*0.37+t*2.1);
        v *= live ? (0.75 + 0.45*beat) : 0.5;
        ctx.fillStyle = `rgba(${lerp(47,209,f)},${lerp(216,47,f)},${lerp(230,208,f)},${live?.95:.35})`;
        for(let y=0;y<Math.max(2, v*h*0.5);y+=4) ctx.fillRect(18+i*bw+1, base-y-2, Math.max(1,bw-3), 2);
      }
      t += live ? 0.016 : 0.006;
    }
    if(!reduce) requestAnimationFrame(draw);
  }
  size(); addEventListener("resize", size, { passive:true });
  new IntersectionObserver(e => { vis = e[0].isIntersecting; }).observe(c);
  draw();
}

/* =====================================================================
   Eventos
   ===================================================================== */
function bind(){
  document.addEventListener("click", e => {
    const t = e.target;
    const o = t.closest("[data-open]"); if(o){ e.preventDefault(); openSection(o.dataset.open); return; }
    const by = t.closest("[data-buy]"); if(by){ const m = t.closest("#mModal"); if(m) closeModal(m); buy(by.dataset.buy); return; }
    const pk = t.closest("[data-pack]"); if(pk){ const m = t.closest("#mModal"); if(m) closeModal(m); openPack(pk.dataset.pack, true); return; }
    const gp = t.closest("[data-group]"); if(gp){ toggleGroup(gp.dataset.group); return; }
    const jp = t.closest("[data-jump]"); if(jp){
      const k = jp.dataset.jump; F.open.add(k); renderTree();
      const g = F.groups.findIndex(x => x.key === k), el = document.getElementById("fg-" + g);
      if(el) el.scrollIntoView({ behavior:"smooth", block:"start" }); return; }
    const p = t.closest("[data-play]"); if(p){ const f = F.view.find(x => x.id === p.dataset.play); if(f) play(f); return; }
    if(t.closest("[data-retry]")){ loadCatalog(true); loadIndex(true); return; }
    if(t.closest("[data-reopen]")){ if(F.c) openPack(F.c.id, false); return; }
    if(t.closest("[data-refresh]")){ loadAdmin(); return; }
    const at = t.closest("[data-atab]"); if(at){ setTab(at.dataset.atab); return; }
    const ac = t.closest("[data-act]"); if(ac){ adminAction(ac); return; }
    const demo = t.closest("[data-demo]"); if(demo){ e.preventDefault(); toast("Enlace de ejemplo: con tus carpetas de Drive conectadas este botón abre el archivo real."); return; }
    if(t.closest("[data-close]")){ dismiss(t.closest(".modal")); return; }
    if(t.classList && t.classList.contains("modal")) dismiss(t);
  });
  // Precarga al pasar el cursor o tocar una tarjeta
  const pre = e => { const card = e.target.closest && e.target.closest("[data-prefetch]"); if(!card) return; const id = card.dataset.prefetch;
    if(canOpenAll(id) && !OWN[id] && !card.dataset.pf){ card.dataset.pf = "1"; fetchOwn(id).catch(()=>{}); } };
  document.addEventListener("pointerenter", pre, true); document.addEventListener("touchstart", pre, { passive:true, capture:true });
  // Grupos grandes: las filas se dibujan al abrirlos
  document.addEventListener("keydown", e => {
    const m = topModal();
    if(e.key === "Escape" && m){ dismiss(m); return; }
    if(e.key === "Tab" && m){ // mantiene el foco dentro de la ventana
      const els = [...m.querySelectorAll("a[href],button:not([disabled]),input:not([type=hidden]):not([tabindex='-1']),select,textarea,summary,[tabindex='0']")].filter(x => x.offsetParent !== null);
      if(!els.length) return;
      const a = els[0], z = els[els.length-1];
      if(e.shiftKey && document.activeElement === a){ z.focus(); e.preventDefault(); }
      else if(!e.shiftKey && document.activeElement === z){ a.focus(); e.preventDefault(); }
    }
  });
  document.addEventListener("input", e => {
    if(e.target.id === "cPortada"){ E.portada = e.target.value.trim(); refreshPreview(); }
    else if(e.target.closest("[data-carform]") && /nombre|tipo/.test(e.target.dataset.f||"")) refreshPreview();
  });
  document.addEventListener("change", e => {
    if(e.target.matches('[data-carform] select[data-f="modalidad"]')){ e.target.closest("[data-carform]").querySelector("[data-mesbox]").hidden = e.target.value !== "Personalizado"; }
  });
  let qt; $("#fq").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { F.q = e.target.value; renderTree(); }, 120); });
  $("#fBuy").addEventListener("click", () => F.c && buy(F.c.id));
  $("#bbBuy").addEventListener("click", () => F.c && buy(F.c.id));
  $("#bSend").addEventListener("click", sendRequest);
  $("#prev").addEventListener("click", () => step(-1));
  $("#next").addEventListener("click", () => step(1));
  $("#dockStop").addEventListener("click", stop);
  $("#regForm").addEventListener("submit", submitReg);
  $("#mStep1").addEventListener("submit", sendCode);
  $("#mStep2").addEventListener("submit", checkCode);
  $("#mCode").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g,"").slice(0,6); if(e.target.value.length === 6) $("#mStep2").requestSubmit(); });
  $("#mBack").addEventListener("click", () => { U.correo = ""; paintAccount(); setTimeout(()=>$("#mMail").focus(), 30); });
  $("#mResend").addEventListener("click", async () => { const b = $("#mResend"); busy(b, true); try{ await requestCode(U.correo); toast("Código reenviado.", "ok"); }catch(ex){ $("#mErr2").textContent = ex.message; } finally{ busy(b, false); } });
  $("#mOut").addEventListener("click", () => { logoutUser(); closeModal($("#mModal")); });
  $("#loginForm").addEventListener("submit", doLogin);
  $("#aOut").addEventListener("click", adminLogout);
  $("#aq").addEventListener("input", e => { A.q = e.target.value; renderRegs(); });
  $$("#segEst button").forEach(b => b.addEventListener("click", () => { A.est = b.dataset.est; $$("#segEst button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderRegs(); }));
  $$("#segSol button").forEach(b => b.addEventListener("click", () => { A.solF = b.dataset.sol; $$("#segSol button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderSols(); }));
  $("#ajForm").addEventListener("submit", saveAjustes);
  $("#jTest").addEventListener("click", async () => { const b = $("#jTest"); $("#jErr").textContent = ""; busy(b, true);
    try{ const r = await adminCall("probarCorreo"); toast(`Correo de prueba enviado a ${r.correo}.`, "ok"); }catch(ex){ $("#jErr").textContent = ex.message; } finally{ busy(b, false); } });
  $("#jCheck").addEventListener("click", async () => { const b = $("#jCheck"); $("#jErr").textContent = ""; busy(b, true);
    try{ const r = await adminCall("revisarAhora"); toast(`Revisión lista: ${r.vencidos} vencidos, ${r.porVencer} por vencer.`, "ok"); loadAdmin(true); }catch(ex){ $("#jErr").textContent = ex.message; } finally{ busy(b, false); } });
  $("#jReindex").addEventListener("click", async () => { const b = $("#jReindex"); $("#jErr").textContent = ""; busy(b, true);
    try{ const r = await adminCall("reindexar"); toast(`Contenido actualizado: ${fmtNum(r.archivos)} archivos en ${r.packs} packs.` + (r.pendientes ? ` ${r.pendientes} pack${r.pendientes===1?"":"s"} grande${r.pendientes===1?"":"s"} se termina${r.pendientes===1?"":"n"} en segundo plano.` : ""), "ok"); loadCatalog(true); loadIndex(true); loadAdmin(true); }
    catch(ex){ $("#jErr").textContent = ex.message; } finally{ busy(b, false); } });
  $("#fileIn").addEventListener("change", e => uploadImage(e.target.files[0]));
  $("#jFondoUp").addEventListener("click", () => { FILE_TARGET = "fondo"; $("#fileIn").value = ""; $("#fileIn").click(); });
  $("#jFondoDel").addEventListener("click", () => { J.fondo = ""; paintFondoPrev(); });
  $("#jFondo").addEventListener("input", e => { J.fondo = e.target.value.trim(); clearTimeout(J.t); J.t = setTimeout(paintFondoPrev, 400); });
  addEventListener("hashchange", fromHash);
  // Resalta la sección visible en el menú y en la barra inferior
  const spy = new IntersectionObserver(es => es.forEach(en => { if(en.isIntersecting) $$("[data-spy]").forEach(a => a.classList.toggle("on", a.dataset.spy === en.target.id)); }), { rootMargin:"-45% 0px -50% 0px" });
  ["inicio","packs","como"].forEach(id => { const el = document.getElementById(id); if(el) spy.observe(el); });
}
function fromHash(){
  const h = location.hash.slice(1);
  if(h === "registro") openSection("registro");
  else if(h === "ingresar" || h === "cuenta") openSection("cuenta");
  else if(h === "admin") openSection("admin");
  else if(h.startsWith("pack-")){ const c = CARP.find(x => "pack-" + slug(x.nombre) === h); if(c && !$("#fModal").classList.contains("open")) openPack(c.id, false); }
}

/* =====================================================================
   Inicio
   ===================================================================== */
(async function init(){
  $("#year").textContent = new Date().getFullYear();
  if(!store.get(CK.cat)) $("#packGrid").innerHTML = Array.from({length:6}, () => `<div class="sk pack-sk"></div>`).join("");
  bind(); bgLights(); scope();
  const cat = loadCatalog();
  loadIndex();                 // en paralelo: lista de contenido de todos los packs
  if(U.token) loadCuenta();    // en paralelo: sesión del usuario y sus packs
  await cat;
  fromHash();
})();
