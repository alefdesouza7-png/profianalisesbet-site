const API = "https://profianalisesbet-api.alefdesouza7.workers.dev";

let mode = "jogos";
let jogos = [];

async function load(m = "jogos") {
  mode = m;

  const status = document.querySelector("#status");

  if (status) {
    status.textContent = "Carregando...";
  }

  try {
    const r = await fetch(`${API}${m === "ao-vivo" ? "/live" : "/api/jogos"}`);
    const d = await r.json();

    jogos = d.jogos || [];
    render(jogos);
  } catch (err) {
    if (status) {
      status.textContent = "Erro ao carregar jogos.";
    }
  }
}

function e(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function render(lista) {
  const shown = document.querySelector("#shown");
  const total = document.querySelector("#total");
  const status = document.querySelector("#status");
  const list = document.querySelector("#list");

  if (shown) shown.textContent = lista.length;
  if (total) total.textContent = jogos.length;

  if (status) {
    status.textContent = `${lista.length} partida(s) encontrada(s).`;
  }

  if (!list) return;

  list.innerHTML = lista.map((j) => `
    <div
      class="game"
      onclick="abrirJogo(${Number(j.fixture_id)})"
      style="cursor:pointer"
    >
      <div class="league">
        ${e(j.campeonato?.nome)} · ${e(j.campeonato?.pais)}
      </div>

      <div class="teams">

        <div class="team">
          ${
            j.jogo?.casa_id
              ? `<img src="${e("https://gateway.profianalisesbet.com.br/media/football/teams/" + j.jogo?.casa_id + ".png")}" alt="">`
              : ""
          }

          <b>${e(j.jogo?.casa)}</b>
        </div>

        <div class="score">
          ${e(j.placar?.casa)} × ${e(j.placar?.fora)}
        </div>

        <div class="team">
          <b>${e(j.jogo?.fora)}</b>

          ${
            j.jogo?.fora_id
              ? `<img src="${e("https://gateway.profianalisesbet.com.br/media/football/teams/" + j.jogo?.fora_id + ".png")}" alt="">`
              : ""
          }
        </div>

      </div>

      <div class="game-status">
        ${e(j.tempo?.descricao)}
        ${j.tempo?.minuto != null ? ` · ${e(j.tempo?.minuto)}'` : ""}
      </div>

      <div
        style="
          text-align:center;
          margin-top:10px;
          color:#2ee58b;
          font-weight:bold;
        "
      >
        Ver análise ›
      </div>
    </div>
  `).join("");
}

function valor(v) {
  if (v === null || v === undefined || v === "") {
    return "-";
  }

  return e(v);
}

function linhaEstatistica(nome, casa, fora) {
  return `
    <div
      style="
        display:grid;
        grid-template-columns:1fr 1.6fr 1fr;
        gap:8px;
        align-items:center;
        padding:12px 4px;
        border-bottom:1px solid rgba(255,255,255,.08);
        text-align:center;
      "
    >
      <strong>${valor(casa)}</strong>

      <span style="opacity:.8">
        ${e(nome)}
      </span>

      <strong>${valor(fora)}</strong>
    </div>
  `;
}

async function abrirJogo(id) {
  document.body.innerHTML = `
    <main
      style="
        padding:20px;
        max-width:850px;
        margin:auto;
      "
    >
      <button
        onclick="location.reload()"
        style="
          padding:12px 18px;
          margin-bottom:20px;
          cursor:pointer;
        "
      >
        ← Voltar
      </button>

      <div
        class="panel"
        style="
          padding:25px;
          text-align:center;
        "
      >
        <h2>Carregando análise...</h2>

        <p>
          Buscando estatísticas da partida.
        </p>
      </div>
    </main>
  `;

  try {
    const r = await fetch(`${API}/api/jogo/${id}`);
    const d = await r.json();

    if (!r.ok || !d.ok) {
      throw new Error(d.erro || "Erro ao carregar partida");
    }

    mostrarAnalise(d);

  } catch (err) {
    document.body.innerHTML = `
      <main
        style="
          padding:20px;
          max-width:850px;
          margin:auto;
        "
      >
        <button
          onclick="location.reload()"
          style="
            padding:12px 18px;
            margin-bottom:20px;
          "
        >
          ← Voltar
        </button>

        <div class="panel" style="padding:25px">
          <h2>Não foi possível carregar a análise</h2>
          <p>${e(err.message)}</p>
        </div>
      </main>
    `;
  }
}

function mostrarAnalise(d) {
  const j = d.jogo;

  const estatisticas = d.estatisticas || [];

  const casa =
    estatisticas.find(
      (x) => Number(x.team_id) === Number(j.home_team_id)
    ) || {};

  const fora =
    estatisticas.find(
      (x) => Number(x.team_id) === Number(j.away_team_id)
    ) || {};

  const possuiEstatisticas =
    d.estatisticas_disponiveis &&
    estatisticas.length >= 2;

  document.body.innerHTML = `
    <main
      style="
        padding:20px;
        max-width:850px;
        margin:auto;
      "
    >

      <button
        onclick="location.reload()"
        style="
          padding:12px 18px;
          margin-bottom:20px;
          cursor:pointer;
        "
      >
        ← Voltar
      </button>

      <p
        style="
          color:#2ee58b;
          font-weight:bold;
          text-align:center;
        "
      >
        ${e(j.competition)} · ${e(j.competition_country)}
      </p>

      <div
        style="
          display:grid;
          grid-template-columns:1fr auto 1fr;
          gap:15px;
          align-items:center;
          margin:25px 0;
          text-align:center;
        "
      >

        <div>
          ${
            j.home_logo
              ? `
                <img
                  src="${e(j.home_logo)}"
                  alt=""
                  style="
                    width:60px;
                    height:60px;
                    object-fit:contain;
                    margin-bottom:8px;
                  "
                >
              `
              : ""
          }

          <div>
            <strong>${e(j.home_team)}</strong>
          </div>
        </div>

        <div>
          <div
            style="
              font-size:30px;
              font-weight:800;
            "
          >
            ${valor(j.home_goals)}
            ×
            ${valor(j.away_goals)}
          </div>

          <div style="margin-top:5px;opacity:.7">
            ${e(j.status)}
            ${j.minute != null ? ` · ${e(j.minute)}'` : ""}
          </div>
        </div>

        <div>
          ${
            j.away_logo
              ? `
                <img
                  src="${e(j.away_logo)}"
                  alt=""
                  style="
                    width:60px;
                    height:60px;
                    object-fit:contain;
                    margin-bottom:8px;
                  "
                >
              `
              : ""
          }

          <div>
            <strong>${e(j.away_team)}</strong>
          </div>
        </div>

      </div>

      ${
        possuiEstatisticas
          ? `
            <section
              class="panel"
              style="
                margin-top:25px;
                padding:20px;
              "
            >
              <h2 style="text-align:center">
                Estatísticas da partida
              </h2>

              <div
                style="
                  display:grid;
                  grid-template-columns:1fr 1.6fr 1fr;
                  gap:8px;
                  text-align:center;
                  margin:20px 0 5px;
                "
              >
                <strong>${e(j.home_team)}</strong>
                <span></span>
                <strong>${e(j.away_team)}</strong>
              </div>

              ${linhaEstatistica(
                "Finalizações",
                casa.total_chutes,
                fora.total_chutes
              )}

              ${linhaEstatistica(
                "Chutes no gol",
                casa.chutes_gol,
                fora.chutes_gol
              )}

              ${linhaEstatistica(
                "Chutes para fora",
                casa.chutes_fora,
                fora.chutes_fora
              )}

              ${linhaEstatistica(
                "Chutes bloqueados",
                casa.chutes_bloqueados,
                fora.chutes_bloqueados
              )}

              ${linhaEstatistica(
                "Escanteios",
                casa.escanteios,
                fora.escanteios
              )}

              ${linhaEstatistica(
                "Posse de bola",
                casa.posse,
                fora.posse
              )}

              ${linhaEstatistica(
                "Faltas",
                casa.faltas,
                fora.faltas
              )}

              ${linhaEstatistica(
                "Cartões amarelos",
                casa.cartoes_amarelos,
                fora.cartoes_amarelos
              )}

              ${linhaEstatistica(
                "Cartões vermelhos",
                casa.cartoes_vermelhos,
                fora.cartoes_vermelhos
              )}

              ${linhaEstatistica(
                "Impedimentos",
                casa.impedimentos,
                fora.impedimentos
              )}

              ${linhaEstatistica(
                "Defesas",
                casa.defesas_goleiro,
                fora.defesas_goleiro
              )}

              ${linhaEstatistica(
                "Passes",
                casa.passes,
                fora.passes
              )}

              ${linhaEstatistica(
                "Passes certos",
                casa.passes_certos,
                fora.passes_certos
              )}

            </section>
          `
          : `
            <section
              class="panel"
              style="
                margin-top:25px;
                padding:20px;
                text-align:center;
              "
            >
              <h2>Estatísticas</h2>

              <p>
                As estatísticas detalhadas não estão
                disponíveis para esta partida.
              </p>
            </section>
          `
      }

    </main>
  `;
}

const q = document.querySelector("#q");

if (q) {
  q.oninput = () => {
    const s = q.value.toLowerCase();

    render(
      jogos.filter((j) =>
        String(j.home_team || "")
          .toLowerCase()
          .includes(s) ||

        String(j.away_team || "")
          .toLowerCase()
          .includes(s) ||

        String(j.competition || "")
          .toLowerCase()
          .includes(s)
      )
    );
  };
}

const todos = document.querySelector("#todos");
const live = document.querySelector("#live");

if (todos) {
  todos.onclick = () => load("jogos");
}

if (live) {
  live.onclick = () => load("ao-vivo");
}

load();
setInterval(() => load(mode), 30000);
