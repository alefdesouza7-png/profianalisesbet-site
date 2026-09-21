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
    const rota = m === "ao-vivo" ? "/live" : "/jogos";

    const r = await fetch(`${API}${rota}`);
    const d = await r.json();

    if (!r.ok || !d.ok) {
      throw new Error(d.error || "Erro ao carregar jogos");
    }

    jogos = Array.isArray(d.jogos) ? d.jogos : [];

    render(jogos);
  } catch (err) {
    console.error(err);

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

function valor(v) {
  if (v === null || v === undefined || v === "") {
    return "-";
  }

  return e(v);
}

function render(lista) {
  const shown = document.querySelector("#shown");
  const total = document.querySelector("#total");
  const status = document.querySelector("#status");
  const list = document.querySelector("#list");

  if (shown) {
    shown.textContent = lista.length;
  }

  if (total) {
    total.textContent = jogos.length;
  }

  if (status) {
    status.textContent =
      `${lista.length} partida(s) encontrada(s).`;
  }

  if (!list) return;

  list.innerHTML = lista.map((j) => {
    const id = Number(j.fixture_id);

    const casa = j.jogo?.casa || "-";
    const fora = j.jogo?.fora || "-";

    const casaId = j.jogo?.casa_id;
    const foraId = j.jogo?.fora_id;

    const campeonato =
      j.campeonato?.nome || "-";

    const pais =
      j.campeonato?.pais || "-";

    const golsCasa =
      j.placar?.casa ?? "-";

    const golsFora =
      j.placar?.fora ?? "-";

    const descricao =
      j.tempo?.descricao || "";

    const minuto =
      j.tempo?.minuto;

    const logoCasa = casaId
      ? `https://gateway.profianalisesbet.com.br/media/football/teams/${casaId}.png`
      : "";

    const logoFora = foraId
      ? `https://gateway.profianalisesbet.com.br/media/football/teams/${foraId}.png`
      : "";

    return `
      <div
        class="game"
        onclick="abrirJogo(${id})"
        style="cursor:pointer"
      >

        <div class="league">
          ${e(campeonato)} · ${e(pais)}
        </div>

        <div class="teams">

          <div class="team">

            ${
              logoCasa
                ? `<img src="${e(logoCasa)}" alt="">`
                : ""
            }

            <b>${e(casa)}</b>

          </div>

          <div class="score">
            ${e(golsCasa)} × ${e(golsFora)}
          </div>

          <div class="team">

            <b>${e(fora)}</b>

            ${
              logoFora
                ? `<img src="${e(logoFora)}" alt="">`
                : ""
            }

          </div>

        </div>

        <div class="game-status">
          ${e(descricao)}
          ${
            minuto != null
              ? ` · ${e(minuto)}'`
              : ""
          }
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
    `;
  }).join("");
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

function pegarEstatistica(lista, tipo) {
  if (!Array.isArray(lista)) {
    return null;
  }

  const item = lista.find(
    (x) =>
      String(x?.type || "")
        .toLowerCase() ===
      String(tipo).toLowerCase()
  );

  return item?.value ?? null;
}

function normalizarEstatisticas(dados) {
  if (!Array.isArray(dados)) {
    return [];
  }

  return dados.map((item) => {
    const stats = item.statistics || [];

    return {
      team_id: item.team?.id,
      team_name: item.team?.name,

      chutes_gol:
        pegarEstatistica(stats, "Shots on Goal"),

      chutes_fora:
        pegarEstatistica(stats, "Shots off Goal"),

      total_chutes:
        pegarEstatistica(stats, "Total Shots"),

      chutes_bloqueados:
        pegarEstatistica(stats, "Blocked Shots"),

      escanteios:
        pegarEstatistica(stats, "Corner Kicks"),

      impedimentos:
        pegarEstatistica(stats, "Offsides"),

      posse:
        pegarEstatistica(stats, "Ball Possession"),

      faltas:
        pegarEstatistica(stats, "Fouls"),

      cartoes_amarelos:
        pegarEstatistica(stats, "Yellow Cards"),

      cartoes_vermelhos:
        pegarEstatistica(stats, "Red Cards"),

      defesas_goleiro:
        pegarEstatistica(stats, "Goalkeeper Saves"),

      passes:
        pegarEstatistica(stats, "Total passes"),

      passes_certos:
        pegarEstatistica(stats, "Passes accurate")
    };
  });
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
          Buscando dados, estatísticas e jogadores.
        </p>
      </div>

    </main>
  `;

  try {
    const [
      fixtureResult,
      statsResult,
      eventsResult,
      playersResult
    ] = await Promise.allSettled([

      fetch(
        `${API}/fixture?id=${encodeURIComponent(id)}`
      ).then(async (r) => {
        const d = await r.json();

        if (!r.ok || !d.ok) {
          throw new Error(
            d.error || "Erro ao carregar partida"
          );
        }

        return d;
      }),

      fetch(
        `${API}/fixture/statistics?id=${encodeURIComponent(id)}`
      ).then(async (r) => {
        const d = await r.json();

        if (!r.ok || !d.ok) {
          throw new Error(
            d.error || "Erro nas estatísticas"
          );
        }

        return d;
      }),

      fetch(
        `${API}/fixture/events?id=${encodeURIComponent(id)}`
      ).then(async (r) => {
        const d = await r.json();

        if (!r.ok || !d.ok) {
          throw new Error(
            d.error || "Erro nos eventos"
          );
        }

        return d;
      }),

      fetch(
        `${API}/fixture/players?id=${encodeURIComponent(id)}`
      ).then(async (r) => {
        const d = await r.json();

        if (!r.ok || !d.ok) {
          throw new Error(
            d.error || "Erro nos jogadores"
          );
        }

        return d;
      })

    ]);

    if (fixtureResult.status !== "fulfilled") {
      throw fixtureResult.reason;
    }

    const fixtureData =
      fixtureResult.value;

    const fixture =
      fixtureData.dados?.[0];

    if (!fixture) {
      throw new Error(
        "Partida não encontrada na API."
      );
    }

    const estatisticasBrutas =
      statsResult.status === "fulfilled"
        ? statsResult.value.estatisticas || []
        : [];

    const eventos =
      eventsResult.status === "fulfilled"
        ? eventsResult.value.eventos || []
        : [];

    const jogadores =
      playersResult.status === "fulfilled"
        ? playersResult.value.jogadores || []
        : [];

    const estatisticas =
      normalizarEstatisticas(
        estatisticasBrutas
      );

    const d = {
      jogo: {
        fixture_id:
          fixture.fixture?.id,

        competition:
          fixture.league?.name,

        competition_country:
          fixture.league?.country,

        round:
          fixture.league?.round,

        home_team_id:
          fixture.teams?.home?.id,

        away_team_id:
          fixture.teams?.away?.id,

        home_team:
          fixture.teams?.home?.name,

        away_team:
          fixture.teams?.away?.name,

        home_logo:
  fixture.teams?.home?.id
    ? `https://gateway.profianalisesbet.com.br/media/football/teams/${fixture.teams.home.id}.png`
    : "",

away_logo:
  fixture.teams?.away?.id
    ? `https://gateway.profianalisesbet.com.br/media/football/teams/${fixture.teams.away.id}.png`
    : "",
          
        home_goals:
          fixture.goals?.home,

        away_goals:
          fixture.goals?.away,

        status:
          fixture.fixture?.status?.long,

        status_short:
          fixture.fixture?.status?.short,

        minute:
          fixture.fixture?.status?.elapsed,

        date:
          fixture.fixture?.date
      },

      estatisticas,

      estatisticas_disponiveis:
        estatisticas.length >= 2,

      eventos,

      jogadores
    };

    mostrarAnalise(d);

  } catch (err) {
    console.error(err);

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
          style="padding:25px"
        >
          <h2>
            Não foi possível carregar a análise
          </h2>

          <p>${e(
            err?.message ||
            "Erro ao carregar partida"
          )}</p>

        </div>

      </main>
    `;
  }
}

function mostrarAnalise(d) {
  const j = d.jogo;

  const estatisticas =
    d.estatisticas || [];

  const casa =
    estatisticas.find(
      (x) =>
        Number(x.team_id) ===
        Number(j.home_team_id)
    ) || {};

  const fora =
    estatisticas.find(
      (x) =>
        Number(x.team_id) ===
        Number(j.away_team_id)
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
        ${e(j.competition)}
        ·
        ${e(j.competition_country)}
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
            <strong>
              ${e(j.home_team)}
            </strong>
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

          <div
            style="
              margin-top:5px;
              opacity:.7;
            "
          >
            ${e(j.status)}

            ${
              j.minute != null
                ? ` · ${e(j.minute)}'`
                : ""
            }
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
            <strong>
              ${e(j.away_team)}
            </strong>
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
                <strong>
                  ${e(j.home_team)}
                </strong>

                <span></span>

                <strong>
                  ${e(j.away_team)}
                </strong>
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

      <section
        class="panel"
        style="
          margin-top:25px;
          padding:20px;
        "
      >
        <h2 style="text-align:center">
          Dados disponíveis
        </h2>

        <p style="text-align:center;opacity:.8">
          Eventos: ${d.eventos?.length || 0}
          ·
          Times com dados de jogadores:
          ${d.jogadores?.length || 0}
        </p>

      </section>

    </main>
  `;
}

const q =
  document.querySelector("#q");

if (q) {
  q.oninput = () => {
    const s =
      q.value
        .trim()
        .toLowerCase();

    render(
      jogos.filter((j) => {

        const casa =
          String(j.jogo?.casa || "")
            .toLowerCase();

        const fora =
          String(j.jogo?.fora || "")
            .toLowerCase();

        const campeonato =
          String(j.campeonato?.nome || "")
            .toLowerCase();

        const pais =
          String(j.campeonato?.pais || "")
            .toLowerCase();

        return (
          casa.includes(s) ||
          fora.includes(s) ||
          campeonato.includes(s) ||
          pais.includes(s)
        );
      })
    );
  };
}

const todos =
  document.querySelector("#todos");

const live =
  document.querySelector("#live");

if (todos) {
  todos.onclick = () =>
    load("jogos");
}

if (live) {
  live.onclick = () =>
    load("ao-vivo");
}

load();

setInterval(
  () => load(mode),
  30000
);
