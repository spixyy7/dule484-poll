/* ===========================================================================
   dule484 referendum — frontend logic
   Anonimno: imena (ko je glasao) i glasovi (za/protiv) žive u ODVOJENIM
   tabelama na backendu, pa veza "ko je kako glasao" fizički ne postoji.
   =========================================================================== */

const VOTERS = [
  { id: "spale",      name: "spale",      sub: "bivši vlasnik — sam predao server 💀", color: "#5865f2", online: true },
  { id: "Aca",        name: "Aca",        sub: "",                                  color: "#eb459e", online: false },
  { id: "CikaJohnny", name: "CikaJohnny", sub: "jednog dana oženiću porno zvezdu",  color: "#f0b232", online: false, crown: true },
  { id: "Goku",       name: "Goku",       sub: "",                                  color: "#23a55a", online: false },
  { id: "Ivanko",     name: "Ivanko",     sub: "",                                  color: "#00a8fc", online: false },
  { id: "lazar",      name: "lazar",      sub: "",                                  color: "#f23f43", online: false },
];

const LS_KEY = "dule_poll_voted_as";

const $ = (id) => document.getElementById(id);

// ---- backend config guard ----------------------------------------------------
const URL = window.SUPA_URL;
const ANON = window.SUPA_ANON;
const headers = {
  apikey: ANON,
  Authorization: "Bearer " + ANON,
  "Content-Type": "application/json",
};

function configured() {
  return URL && ANON && !URL.includes("PASTE_") && !ANON.includes("PASTE_");
}

function showError(msg) {
  const el = $("error-banner");
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ---- backend calls -----------------------------------------------------------
async function fetchTally() {
  const r = await fetch(`${URL}/rest/v1/dule_poll_tally?select=choice,count`, { headers });
  if (!r.ok) throw new Error("tally " + r.status);
  const rows = await r.json();
  const out = { za: 0, protiv: 0 };
  for (const row of rows) out[row.choice] = row.count;
  return out;
}

async function fetchVoters() {
  const r = await fetch(`${URL}/rest/v1/dule_poll_voters?select=name`, { headers });
  if (!r.ok) throw new Error("voters " + r.status);
  const rows = await r.json();
  return rows.map((x) => x.name);
}

async function castVote(name, choice) {
  const r = await fetch(`${URL}/rest/v1/rpc/dule_poll_cast_vote`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_name: name, p_choice: choice }),
  });
  if (!r.ok) throw new Error("rpc " + r.status);
  return await r.json(); // "ok" | "already_voted" | "invalid_name" | "invalid_choice"
}

// ---- screen routing ----------------------------------------------------------
function show(screen) {
  for (const s of ["screen-identity", "screen-vote", "screen-results"]) {
    $(s).classList.toggle("hidden", s !== `screen-${screen}`);
  }
  // kompaktno "Trenutno stanje" se vidi svuda OSIM na punom results ekranu
  $("scoreboard").classList.toggle("hidden", screen === "results");
}

let selectedVoter = null;

function avatarHTML(v, cls) {
  const dot = v.online ? '<span class="dot"></span>' : "";
  return `<span class="${cls}" style="background:${v.color}">${v.name[0].toUpperCase()}${dot}</span>`;
}

// ---- identity screen ---------------------------------------------------------
function renderIdentity(votedNames) {
  const grid = $("voter-grid");
  grid.innerHTML = "";
  const remaining = VOTERS.filter((v) => !votedNames.includes(v.id));

  $("all-voted").classList.toggle("hidden", remaining.length !== 0);

  for (const v of remaining) {
    const btn = document.createElement("button");
    btn.className = "voter";
    btn.innerHTML = `
      ${avatarHTML(v, "voter-av")}
      <span class="voter-meta">
        <span class="voter-name">${v.name}${v.crown ? " 👑" : ""}</span>
        ${v.sub ? `<span class="voter-sub">${v.sub}</span>` : ""}
      </span>`;
    btn.addEventListener("click", () => {
      selectedVoter = v;
      $("voting-as-name").textContent = v.name;
      $("vote-status").textContent = "";
      enableVoteButtons(true);
      show("vote");
    });
    grid.appendChild(btn);
  }
}

// ---- vote screen -------------------------------------------------------------
function enableVoteButtons(on) {
  document.querySelectorAll(".vote-btn").forEach((b) => (b.disabled = !on));
}

async function onVote(choice) {
  if (!selectedVoter) return;
  enableVoteButtons(false);
  $("vote-status").textContent = "šaljem glas…";
  try {
    const res = await castVote(selectedVoter.id, choice);
    if (res === "ok") {
      localStorage.setItem(LS_KEY, selectedVoter.id);
      burstConfetti();
      await refreshAll();
      show("results");
    } else if (res === "already_voted") {
      $("vote-status").textContent = "Hmm, " + selectedVoter.name + " je već glasao. 👀";
      await refreshAll();
      setTimeout(() => show("identity"), 1400);
    } else {
      $("vote-status").textContent = "Nešto ne valja: " + res;
      enableVoteButtons(true);
    }
  } catch (e) {
    $("vote-status").textContent = "Greška u mreži, probaj opet.";
    enableVoteButtons(true);
  }
}

// ---- render (scoreboard + results) -------------------------------------------
let lastVotedKey = null;

function renderScoreboard(za, protiv, votedCount) {
  $("sb-za").textContent = za;
  $("sb-protiv").textContent = protiv;
  const total = za + protiv;
  $("sb-bar-za").style.width = (total ? (za / total) * 100 : 0) + "%";
  $("sb-bar-protiv").style.width = (total ? (protiv / total) * 100 : 0) + "%";
  $("sb-progress").textContent = `${votedCount} / ${VOTERS.length} glasalo`;
}

function renderResults(za, protiv, voted) {
  const total = za + protiv;
  $("za-count").textContent = za;
  $("protiv-count").textContent = protiv;
  $("za-bar").style.width = (total ? (za / total) * 100 : 0) + "%";
  $("protiv-bar").style.width = (total ? (protiv / total) * 100 : 0) + "%";

  const verdict = $("verdict");
  verdict.className = "verdict";
  if (total === 0) {
    verdict.textContent = "Još niko nije glasao. Budi prvi. 🗳️";
  } else if (za > protiv) {
    verdict.textContent = "🚪 Trenutno: DULE IDE NAPOLJE.";
    verdict.classList.add("za");
  } else if (protiv > za) {
    verdict.textContent = "🛡️ Trenutno: DULE OSTAJE (za sada).";
    verdict.classList.add("protiv");
  } else {
    verdict.textContent = "⚖️ Nerešeno! Sudbina duleta visi.";
    verdict.classList.add("tie");
  }

  $("voted-progress").textContent = `${voted.length} / ${VOTERS.length} glasalo`;
  const wrap = $("voted-names");
  wrap.innerHTML = "";
  if (voted.length === 0) {
    wrap.innerHTML = '<span class="voted-empty">još niko</span>';
  } else {
    for (const name of voted) {
      const v = VOTERS.find((x) => x.id === name) || { name, color: "#80848e" };
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${avatarHTML(v, "chip-av")}${v.name}`;
      wrap.appendChild(chip);
    }
  }
}

function applyData(tally, voted) {
  const za = tally.za || 0;
  const protiv = tally.protiv || 0;
  renderScoreboard(za, protiv, voted.length);
  renderResults(za, protiv, voted);
  // meni (spisak imena) osveži samo kad se zaista promeni ko je glasao
  const key = voted.slice().sort().join(",");
  if (key !== lastVotedKey) {
    lastVotedKey = key;
    renderIdentity(voted);
  }
}

async function refreshAll() {
  const [tally, voted] = await Promise.all([fetchTally(), fetchVoters()]);
  applyData(tally, voted);
  return voted;
}

// ---- confetti ----------------------------------------------------------------
function burstConfetti() {
  const canvas = $("confetti");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#5865f2", "#23a55a", "#f23f43", "#f0b232", "#eb459e", "#fff"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 3,
    vx: (Math.random() - 0.5) * 14,
    vy: Math.random() * -16 - 4,
    s: Math.random() * 7 + 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
    life: 1,
  }));
  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.vy += 0.5;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.012;
      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
    }
    frame++;
    if (frame < 140) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
}

// ---- wire up -----------------------------------------------------------------
document.querySelectorAll(".vote-btn").forEach((b) =>
  b.addEventListener("click", () => onVote(b.dataset.choice))
);
$("back-btn").addEventListener("click", () => {
  selectedVoter = null;
  show("identity");
});
$("refresh-btn").addEventListener("click", () => refreshAll());

// ---- boot --------------------------------------------------------------------
async function boot() {
  if (!configured()) {
    showError("Sajt još nije povezan sa bazom (config.js nije popunjen).");
    return;
  }
  try {
    const voted = await refreshAll();

    const me = localStorage.getItem(LS_KEY);
    if (me && voted.includes(me)) {
      show("results"); // ovaj browser je već glasao → pravo na pune rezultate
    } else {
      show("identity");
    }

    // uživo osvežavanje na svim ekranima (stanje + meni + rezultati)
    setInterval(refreshAll, 6000);
  } catch (e) {
    showError("Ne mogu da se povežem sa bazom. Probaj da osvežiš stranicu.");
  }
}

boot();
