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

function prioridadeLiga(j) {
  const nome = String(j.league?.name || "")
    .trim()
    .toLowerCase();

  const pais = String(j.league?.country || "")
    .trim()
    .toLowerCase();

  const igual = (liga, paisLiga = null) => {
    if (nome !== liga) return false;
    if (paisLiga && pais !== paisLiga) return false;
    return true;
  };

  // Competições internacionais
  if (igual("uefa champions league")) return 1;
  if (igual("champions league")) return 1;

  if (igual("copa libertadores")) return 2;
  if (igual("libertadores")) return 2;

  if (igual("copa sudamericana")) return 3;
  if (igual("sudamericana")) return 3;

  // Brasil
  if (igual("serie a", "brazil")) return 10;
  if (igual("brasileirão", "brazil")) return 10;
  if (igual("brasileirao", "brazil")) return 10;

  if (igual("serie b", "brazil")) return 11;

  if (igual("copa do brasil", "brazil")) return 12;

  // Inglaterra
  if (igual("premier league", "england")) return 20;

  // Espanha
  if (igual("la liga", "spain")) return 30;
  if (igual("laliga", "spain")) return 30;

  // Alemanha
  if (igual("bundesliga", "germany")) return 40;

  // Itália
  if (igual("serie a", "italy")) return 50;

  // França
  if (igual("ligue 1", "france")) return 60;

  // Portugal
  if (igual("primeira liga", "portugal")) return 70;
  if (igual("liga portugal", "portugal")) return 70;

  // Holanda
  if (igual("eredivisie", "netherlands")) return 80;

  // Estados Unidos
  if (igual("major league soccer", "usa")) return 90;

  // Argentina
  if (
    igual("liga profesional argentina", "argentina") ||
    igual("primera division", "argentina")
  ) {
    return 100;
  }

  return 999;
}

function jogoEstaAoVivo(j) {
  const status = String(j.status?.short || "").toUpperCase();

  return [
    "1H",
    "HT",
    "2H",
    "ET",
    "BT",
    "P",
    "SUSP",
    "INT",
    "LIVE"
  ].includes(status);
}

function horarioJogo(j) {
  if (!j.date) return "--:--";

  try {
    return new Date(j.date).toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  } catch (_) {
    return "--:--";
  }
}

function textoStatusJogo(j) {
  const status = String(j.status?.short || "").toUpperCase();
  const minuto = j.status?.elapsed;

  if (jogoEstaAoVivo(j)) {
    if (status === "HT") {
      return "Intervalo";
    }

    if (minuto != null) {
      return `${minuto}'`;
    }

    return "AO VIVO";
  }

  if (["FT", "AET", "PEN"].includes(status)) {
    return "Encerrado";
  }

  if (status === "PST") {
    return "Adiado";
  }

  if (status === "CANC") {
    return "Cancelado";
  }

  return horarioJogo(j);
}

function cardJogo(j) {
  const id = Number(j.id);

  const casa = j.teams?.home?.name || "-";
  const fora = j.teams?.away?.name || "-";

  const casaId = j.teams?.home?.id;
  const foraId = j.teams?.away?.id;

  const logoCasa =
    j.teams?.home?.logo ||
    (
      casaId
        ? `https://gateway.profianalisesbet.com.br/media/football/teams/${casaId}.png`
        : ""
    );

  const logoFora =
    j.teams?.away?.logo ||
    (
      foraId
        ? `https://gateway.profianalisesbet.com.br/media/football/teams/${foraId}.png`
        : ""
    );

  const golsCasa = j.goals?.home;
  const golsFora = j.goals?.away;

  const aoVivo = jogoEstaAoVivo(j);

  const terminou = [
    "FT",
    "AET",
    "PEN"
  ].includes(
    String(j.status?.short || "").toUpperCase()
  );

  let centro = horarioJogo(j);

  if (aoVivo || terminou) {
    centro =
      `${golsCasa ?? 0} × ${golsFora ?? 0}`;
  }

  return `
    <div
      class="game"
      onclick="abrirJogo(${id})"
      style="
        cursor:pointer;
        margin:0;
        border-radius:0;
        border-left:0;
        border-right:0;
        border-bottom:0;
      "
    >

      <div
        style="
          display:grid;
          grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);
          gap:12px;
          align-items:center;
          padding:4px 0;
        "
      >

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:12px;
            min-width:0;
          "
        >

          <div
            style="
              display:flex;
              align-items:center;
              gap:9px;
              min-width:0;
            "
          >
            ${
              logoCasa
                ? `
                  <img
                    src="${e(logoCasa)}"
                    alt=""
                    style="
                      width:32px;
                      height:32px;
                      object-fit:contain;
                      flex:none;
                    "
                  >
                `
                : ""
            }

            <b
              style="
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              "
            >
              ${e(casa)}
            </b>
          </div>

          <div
            style="
              display:flex;
              align-items:center;
              gap:9px;
              min-width:0;
            "
          >
            ${
              logoFora
                ? `
                  <img
                    src="${e(logoFora)}"
                    alt=""
                    style="
                      width:32px;
                      height:32px;
                      object-fit:contain;
                      flex:none;
                    "
                  >
                `
                : ""
            }

            <b
              style="
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              "
            >
              ${e(fora)}
            </b>
          </div>

        </div>

        <div
          style="
            min-width:70px;
            text-align:center;
          "
        >

          <div
            style="
              font-size:20px;
              font-weight:900;
              ${
                aoVivo
                  ? "color:#2ee58b;"
                  : ""
              }
            "
          >
            ${e(centro)}
          </div>

          <div
            style="
              margin-top:5px;
              font-size:12px;
              font-weight:800;
              ${
                aoVivo
                  ? "color:#2ee58b;"
                  : "opacity:.65;"
              }
            "
          >
            ${
  aoVivo || terminou
    ? e(textoStatusJogo(j))
    : ""
            }
          </div>

        </div>

        <div
          style="
            text-align:right;
            font-weight:800;
            color:#2ee58b;
            font-size:14px;
          "
        >
          Análise ›
        </div>

      </div>

    </div>
  `;
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
      mode === "ao-vivo"
        ? `${lista.length} partida(s) ao vivo.`
        : `${lista.length} partida(s) de hoje.`;
  }

  if (!list) return;

  if (!lista.length) {
    list.innerHTML = `
      <div
        style="
          padding:30px 20px;
          text-align:center;
          opacity:.7;
        "
      >
        ${
          mode === "ao-vivo"
            ? "Nenhuma partida ao vivo neste momento."
            : "Nenhuma partida encontrada."
        }
      </div>
    `;

    return;
  }

  const ordenados = [...lista].sort((a, b) => {
    const prioridadeA = prioridadeLiga(a);
    const prioridadeB = prioridadeLiga(b);

    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    const ligaA =
      String(a.league?.name || "");

    const ligaB =
      String(b.league?.name || "");

    const comparacaoLiga =
      ligaA.localeCompare(
        ligaB,
        "pt-BR"
      );

    if (comparacaoLiga !== 0) {
      return comparacaoLiga;
    }

    return (
      new Date(a.date || 0).getTime() -
      new Date(b.date || 0).getTime()
    );
  });

  const grupos = new Map();

  for (const j of ordenados) {
    const leagueId =
      j.league?.id || 0;

    const season =
      j.league?.season || "";

    const chave =
      `${leagueId}-${season}`;

    if (!grupos.has(chave)) {
      grupos.set(
        chave,
        {
          league: j.league || {},
          prioridade: prioridadeLiga(j),
          jogos: []
        }
      );
    }

    grupos.get(chave).jogos.push(j);
  }

  const principais = [];
  const outras = [];

  for (const grupo of grupos.values()) {
    if (grupo.prioridade < 999) {
      principais.push(grupo);
    } else {
      outras.push(grupo);
    }
  }

  principais.sort(
    (a, b) =>
      a.prioridade - b.prioridade
  );

  outras.sort((a, b) => {
    const paisA =
      String(a.league?.country || "");

    const paisB =
      String(b.league?.country || "");

    const p =
      paisA.localeCompare(
        paisB,
        "pt-BR"
      );

    if (p !== 0) return p;

    return String(
      a.league?.name || ""
    ).localeCompare(
      String(b.league?.name || ""),
      "pt-BR"
    );
  });

  function blocoLiga(grupo) {
    const liga =
      grupo.league?.name || "Competição";

    const pais =
      grupo.league?.country || "";

    const logo =
  grupo.league?.logo || "";

    return `
      <section
        style="
          margin:0 0 18px;
          border:1px solid rgba(46,229,139,.22);
          border-radius:18px;
          overflow:hidden;
          background:rgba(255,255,255,.015);
        "
      >

        <div
          style="
            display:flex;
            align-items:center;
            gap:10px;
            padding:14px 16px;
            background:rgba(255,255,255,.045);
          "
        >

          ${
            logo
              ? `
                <img
                  src="${e(logo)}"
                  alt=""
                  onerror="this.style.display='none'"
                  style="
                    width:30px;
                    height:30px;
                    object-fit:contain;
                  "
                >
              `
              : ""
          }

          <div style="min-width:0">

            <div
              style="
                font-size:12px;
                opacity:.65;
                font-weight:800;
                text-transform:uppercase;
              "
            >
              ${e(pais)}
            </div>

            <div
              style="
                font-size:17px;
                font-weight:900;
              "
            >
              ${e(liga)}
            </div>

          </div>

          <div
            style="
              margin-left:auto;
              opacity:.6;
              font-weight:800;
            "
          >
            ${grupo.jogos.length}
          </div>

        </div>

        ${grupo.jogos.map(cardJogo).join("")}

      </section>
    `;
  }

  let html = "";

  if (principais.length) {
    html += `
      <div
        style="
          margin:8px 0 12px;
          font-size:13px;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:#2ee58b;
        "
      >
        Principais competições
      </div>
    `;

    html +=
      principais
        .map(blocoLiga)
        .join("");
  }

  if (outras.length) {
    html += `
      <div
        style="
          margin:24px 0 12px;
          font-size:13px;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
          opacity:.7;
        "
      >
        Outras competições
      </div>
    `;

    html +=
      outras
        .map(blocoLiga)
        .join("");
  }

  list.innerHTML = html;
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
      playersResult,
      historicoResult
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
      }),

      fetch(
        `${API}/historico/fixture/${encodeURIComponent(id)}`
      ).then(async (r) => {
        const d = await r.json();

        if (!r.ok || !d.ok) {
          throw new Error(
            d.erro || d.error || "Erro no histórico"
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
  fixtureData.dados?.[0] ||
  fixtureData.fixture ||
  fixtureData.response?.[0] ||
  fixtureData.jogo ||
  fixtureData.dados;

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

    const historico =
      historicoResult.status === "fulfilled"
        ? historicoResult.value
        : null;

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

      jogadores,

      historico
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
function numeroSeguro(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cardJogadorHistorico(p, jogos) {
  const partidas = numeroSeguro(
    p.partidas ?? p.jogos ?? p.aparicoes ?? p.games
  );

  return `
    <div style="
      padding:14px 0;
      border-bottom:1px solid rgba(255,255,255,.10);
    ">
      <div style="
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:10px;
      ">
        ${p.foto ? `
          <img
            src="${e(p.foto)}"
            alt=""
            style="
              width:44px;
              height:44px;
              border-radius:50%;
              object-fit:cover;
            "
          >
        ` : ""}

        <div>
          <div style="font-weight:800">
            ${e(p.nome ?? p.name ?? "Jogador")}
          </div>

          <div style="opacity:.7;font-size:13px">
            ${partidas ? `${partidas} partida(s)` : ""}
          </div>
        </div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:repeat(2,1fr);
        gap:7px;
        font-size:13px;
      ">
        <div>
          ⚽ Gols:
          <b>${valor(p.gols ?? p.goals ?? 0)}</b>
        </div>

        <div>
          🎯 Assist.:
          <b>${valor(p.assistencias ?? p.assists ?? 0)}</b>
        </div>

        <div>
          🥅 Chutes:
          <b>${valor(p.chutes ?? p.shots ?? 0)}</b>
        </div>

        <div>
          🎯 No gol:
          <b>${valor(
            p.chutesGol ??
            p.chutes_no_gol ??
            p.shotsOn ??
            0
          )}</b>
        </div>

        <div>
          ❌ Faltas:
          <b>${valor(
            p.faltasCometidas ??
            p.faltas_cometidas ??
            0
          )}</b>
        </div>

        <div>
          ✅ Sofridas:
          <b>${valor(
            p.faltasSofridas ??
            p.faltas_sofridas ??
            0
          )}</b>
        </div>

        <div>
          🟨 Amarelos:
          <b>${valor(p.amarelos ?? 0)}</b>
        </div>

        <div>
          🟥 Vermelhos:
          <b>${valor(p.vermelhos ?? 0)}</b>
        </div>

        <div>
          👟 Passes:
          <b>${valor(p.passes ?? 0)}</b>
        </div>

        <div>
          🔑 P. chave:
          <b>${valor(
            p.passesChave ??
            p.passes_chave ??
            0
          )}</b>
        </div>

        <div>
          🛡 Desarmes:
          <b>${valor(p.desarmes ?? 0)}</b>
        </div>

        <div>
          ⏱ Minutos:
          <b>${valor(p.minutos ?? 0)}</b>
        </div>
      </div>
    </div>
  `;
}

function blocoHistoricoTime(titulo, dados, periodo) {
  if (!dados) {
    return "";
  }

  const grupo =
    periodo === 5
      ? dados.ultimas5
      : dados.ultimas10;

  const partidas =
    Array.isArray(grupo?.partidas)
      ? grupo.partidas
      : [];

  const jogadores =
    Array.isArray(grupo?.jogadores)
      ? grupo.jogadores
      : [];

  return `
    <div style="
      margin-top:22px;
      padding-top:10px;
    ">
      <h3 style="
        margin-bottom:6px;
        color:#2ee58b;
      ">
        ${e(titulo)} · Últimas ${periodo}
      </h3>

      <div style="
        opacity:.7;
        margin-bottom:12px;
      ">
        ${partidas.length} partida(s)
        ·
        ${jogadores.length} jogador(es)
      </div>

      ${
        jogadores.length
          ? jogadores.map(
              (p) =>
                cardJogadorHistorico(
                  p,
                  partidas.length
                )
            ).join("")
          : `
            <p style="opacity:.7">
              Sem estatísticas de jogadores
              disponíveis para este período.
            </p>
          `
      }
    </div>
  `;
}

function secaoHistorico(d, j) {
  const h = d.historico;

  if (!h || !h.ok) {
    return `
      <section
        class="panel"
        style="
          margin-top:25px;
          padding:20px;
        "
      >
        <h2 style="text-align:center">
          Histórico dos jogadores
        </h2>

        <p style="
          text-align:center;
          opacity:.75;
        ">
          Histórico indisponível para esta partida.
        </p>
      </section>
    `;
  }

  const casa =
    h.casa || h.home;

  const fora =
    h.fora || h.away;

  return `
    <section
      class="panel"
      style="
        margin-top:25px;
        padding:20px;
      "
    >
      <h2 style="text-align:center">
        Histórico dos jogadores
      </h2>

      <p style="
        text-align:center;
        opacity:.75;
      ">
        Casa e fora · últimas 5 e últimas 10 partidas
      </p>

      ${blocoHistoricoTime(
        casa?.team?.name ||
        j.home_team ||
        "Casa",
        casa,
        5
      )}

      ${blocoHistoricoTime(
        casa?.team?.name ||
        j.home_team ||
        "Casa",
        casa,
        10
      )}

      ${blocoHistoricoTime(
        fora?.team?.name ||
        j.away_team ||
        "Fora",
        fora,
        5
      )}

      ${blocoHistoricoTime(
        fora?.team?.name ||
        j.away_team ||
        "Fora",
        fora,
        10
      )}
    </section>
  `;
}

function mostrarAnalise(d) {
  const j = d.jogo;

  const jogadoresTimes =
    Array.isArray(d.jogadores)
      ? d.jogadores
      : [];

  const jogadoresLista =
    jogadoresTimes.flatMap((time) => {

      const nomeTime =
        time.team?.name || "";

      return (time.players || []).map((item) => {
        const s =
          item.statistics?.[0] || {};

        return {
          time: nomeTime,
          nome:
            item.player?.name || "-",
          foto:
            item.player?.photo || "",
          numero:
            s.games?.number ?? "-",
          posicao:
            s.games?.position || "-",
          minutos:
            s.games?.minutes ?? 0,
          nota:
            s.games?.rating || "-",

          chutes:
            s.shots?.total ?? 0,

          chutesGol:
            s.shots?.on ?? 0,

          gols:
            s.goals?.total ?? 0,

          assistencias:
            s.goals?.assists ?? 0,

          passes:
            s.passes?.total ?? 0,

          passesChave:
            s.passes?.key ?? 0,

          desarmes:
            s.tackles?.total ?? 0,

          faltasCometidas:
            s.fouls?.committed ?? 0,

          faltasSofridas:
            s.fouls?.drawn ?? 0,

          amarelos:
            s.cards?.yellow ?? 0,

          vermelhos:
            s.cards?.red ?? 0
        };
      });
    });

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

      ${
        Array.isArray(d.eventos) &&
        d.eventos.length > 0
          ? `
            <section
              class="panel"
              style="
                margin-top:25px;
                padding:20px;
              "
            >
              <h2 style="text-align:center">
                Eventos da partida
              </h2>

              ${d.eventos.map((ev) => {
                const minuto =
                  ev.time?.elapsed != null
                    ? `${ev.time.elapsed}${
                        ev.time?.extra
                          ? `+${ev.time.extra}`
                          : ""
                      }'`
                    : "-";

                const tipo =
                  ev.type || "";

                const detalhe =
                  ev.detail || "";

                const jogador =
                  ev.player?.name || "";

                const assistencia =
                  ev.assist?.name || "";

                const time =
                  ev.team?.name || "";

                let icone = "⚽";

                if (tipo === "Card") {
                  icone =
                    detalhe
                      .toLowerCase()
                      .includes("red")
                      ? "🟥"
                      : "🟨";

                } else if (
                  tipo === "subst"
                ) {
                  icone = "🔄";

                } else if (
                  tipo === "Var"
                ) {
                  icone = "📺";
                }

                return `
                  <div
                    style="
                      padding:14px 4px;
                      border-bottom:1px solid rgba(255,255,255,.08);
                    "
                  >
                    <div
                      style="
                        display:flex;
                        gap:12px;
                        align-items:flex-start;
                      "
                    >
                      <strong
                        style="
                          min-width:45px;
                          color:#2ee58b;
                        "
                      >
                        ${e(minuto)}
                      </strong>

                      <span
                        style="font-size:20px"
                      >
                        ${icone}
                      </span>

                      <div>
                        <strong>
                          ${e(
                            jogador ||
                            detalhe ||
                            tipo
                          )}
                        </strong>

                        ${
                          time
                            ? `
                              <div
                                style="
                                  opacity:.75;
                                  margin-top:3px;
                                "
                              >
                                ${e(time)}
                              </div>
                            `
                            : ""
                        }

                        ${
                          detalhe
                            ? `
                              <div
                                style="
                                  opacity:.65;
                                  margin-top:3px;
                                "
                              >
                                ${e(detalhe)}
                              </div>
                            `
                            : ""
                        }

                        ${
                          assistencia
                            ? `
                              <div
                                style="
                                  opacity:.65;
                                  margin-top:3px;
                                "
                              >
                                Assistência:
                                ${e(assistencia)}
                              </div>
                            `
                            : ""
                        }

                      </div>
                    </div>
                  </div>
                `;
              }).join("")}

            </section>
          `
          : ""
      }

      ${
        jogadoresLista.length > 0
          ? `
            <section
              class="panel"
              style="
                margin-top:25px;
                padding:20px;
              "
            >
              <h2 style="text-align:center">
                Jogadores da partida
              </h2>

              ${jogadoresLista.map((p) => `
                <div
                  style="
                    padding:16px 0;
                    border-bottom:1px solid rgba(255,255,255,.10);
                  "
                >

                  <div
                    style="
                      display:flex;
                      align-items:center;
                      gap:12px;
                      margin-bottom:12px;
                    "
                  >

                    ${
                      p.foto
                        ? `
                          <img
                            src="${e(p.foto)}"
                            alt="${e(p.nome)}"
                            style="
                              width:48px;
                              height:48px;
                              border-radius:50%;
                              object-fit:cover;
                            "
                          >
                        `
                        : ""
                    }

                    <div>
                      <div
                        style="
                          font-weight:700;
                          font-size:17px;
                        "
                      >
                        ${
                          p.numero !== "-"
                            ? `#${e(p.numero)} `
                            : ""
                        }
                        ${e(p.nome)}
                      </div>

                      <div
                        style="opacity:.7"
                      >
                        ${e(p.time)}
                        ·
                        ${e(p.posicao)}
                      </div>
                    </div>

                  </div>

                  <div
                    style="
                      display:grid;
                      grid-template-columns:repeat(2,1fr);
                      gap:8px;
                      font-size:14px;
                    "
                  >

                    <div>
                      ⏱ Minutos:
                      <b>${valor(p.minutos)}</b>
                    </div>

                    <div>
                      ⭐ Nota:
                      <b>${valor(p.nota)}</b>
                    </div>

                    <div>
                      ⚽ Gols:
                      <b>${valor(p.gols)}</b>
                    </div>

                    <div>
                      🎯 Assistências:
                      <b>${valor(p.assistencias)}</b>
                    </div>

                    <div>
                      🥅 Chutes:
                      <b>${valor(p.chutes)}</b>
                    </div>

                    <div>
                      🎯 No gol:
                      <b>${valor(p.chutesGol)}</b>
                    </div>

                    <div>
                      ❌ Faltas cometidas:
                      <b>${valor(p.faltasCometidas)}</b>
                    </div>

                    <div>
                      ✅ Faltas sofridas:
                      <b>${valor(p.faltasSofridas)}</b>
                    </div>

                    <div>
                      🟨 Amarelos:
                      <b>${valor(p.amarelos)}</b>
                    </div>

                    <div>
                      🟥 Vermelhos:
                      <b>${valor(p.vermelhos)}</b>
                    </div>

                    <div>
                      👟 Passes:
                      <b>${valor(p.passes)}</b>
                    </div>

                    <div>
                      🔑 Passes-chave:
                      <b>${valor(p.passesChave)}</b>
                    </div>

                    <div>
                      🛡 Desarmes:
                      <b>${valor(p.desarmes)}</b>
                    </div>

                  </div>
                </div>
              `).join("")}

            </section>
          `
          : ""
      }

      ${secaoHistorico(d, j)}

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

        <p
          style="
            text-align:center;
            opacity:.8;
          "
        >
          Eventos:
          ${d.eventos?.length || 0}
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
          String(
            j.teams?.home?.name || ""
          ).toLowerCase();

        const fora =
          String(
            j.teams?.away?.name || ""
          ).toLowerCase();

        const campeonato =
          String(
            j.league?.name || ""
          ).toLowerCase();

        const pais =
          String(
            j.league?.country || ""
          ).toLowerCase();

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
