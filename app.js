const API = "https://profianalisesbet-api.alefdesouza7.workers.dev";

let mode = "jogos";
let jogos = [];
let partidaAtual = null;
let historicoAtual = null;
let jogadoresAtuais = [];
let abaAtual = "resumo";

const CONFIG = {
  frequenciaMinima: 80,
  oddMinima: 1.50,
  ultimosPadrao: 10,
  alvosMultiplas: [2, 2.5, 3, 4, 5]
};

/* =========================================================
   UTILITÁRIOS
========================================================= */

function e(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function n(v, padrao = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : padrao;
}

function valor(v) {
  if (v === null || v === undefined || v === "") return "-";
  return e(v);
}

function pct(acertos, total) {
  if (!total) return 0;
  return Math.round((acertos / total) * 100);
}

function media(total, partidas, casas = 1) {
  if (!partidas) return "0";
  return (n(total) / partidas).toFixed(casas);
}

function formatarOdd(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x.toFixed(2) : "-";
}

function dataCurta(data) {
  if (!data) return "-";

  try {
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit"
    });
  } catch (_) {
    return "-";
  }
}

function horaCurta(data) {
  if (!data) return "--:--";

  try {
    return new Date(data).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_) {
    return "--:--";
  }
}

function fotoJogador(p = {}) {
  return (
    p.foto ||
    p.photo ||
    (p.id ? `${API}/logo/player/${p.id}` : "")
  );
}

function logoTime(id, logo = "") {
  return (
    logo ||
    (id
      ? `https://gateway.profianalisesbet.com.br/media/football/teams/${id}.png`
      : "")
  );
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function soma(lista, campo) {
  return safeArray(lista).reduce(
    (acc, item) => acc + n(item?.[campo]),
    0
  );
}

/* =========================================================
   COMPONENTES VISUAIS
========================================================= */

function botao(texto, onclick, ativo = false) {
  return `
    <button
      onclick="${onclick}"
      style="
        border:1px solid ${
          ativo
            ? "#2ee58b"
            : "rgba(255,255,255,.12)"
        };
        background:${
          ativo
            ? "rgba(46,229,139,.14)"
            : "rgba(255,255,255,.04)"
        };
        color:${ativo ? "#2ee58b" : "#fff"};
        border-radius:10px;
        padding:9px 12px;
        font-weight:800;
        cursor:pointer;
        white-space:nowrap;
      "
    >
      ${e(texto)}
    </button>
  `;
}

function tituloSecao(titulo, subtitulo = "") {
  return `
    <div style="margin-bottom:14px">
      <div
        style="
          font-size:18px;
          font-weight:900;
        "
      >
        ${e(titulo)}
      </div>

      ${
        subtitulo
          ? `
            <div
              style="
                margin-top:4px;
                font-size:12px;
                opacity:.65;
              "
            >
              ${e(subtitulo)}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function painel(conteudo, extra = "") {
  return `
    <section
      style="
        background:rgba(255,255,255,.035);
        border:1px solid rgba(255,255,255,.08);
        border-radius:18px;
        padding:16px;
        margin-bottom:14px;
        ${extra}
      "
    >
      ${conteudo}
    </section>
  `;
}

/* =========================================================
   PRIORIDADE DAS COMPETIÇÕES
========================================================= */

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

  if (igual("uefa champions league")) return 1;
  if (igual("champions league")) return 1;

  if (igual("copa libertadores")) return 2;
  if (igual("libertadores")) return 2;

  if (igual("copa sudamericana")) return 3;
  if (igual("sudamericana")) return 3;

  if (igual("serie a", "brazil")) return 10;
  if (igual("brasileirão", "brazil")) return 10;
  if (igual("brasileirao", "brazil")) return 10;

  if (igual("serie b", "brazil")) return 11;

  if (igual("copa do brasil", "brazil")) return 12;

  if (igual("premier league", "england")) return 20;

  if (igual("la liga", "spain")) return 30;
  if (igual("laliga", "spain")) return 30;

  if (igual("bundesliga", "germany")) return 40;

  if (igual("serie a", "italy")) return 50;

  if (igual("ligue 1", "france")) return 60;

  if (igual("primeira liga", "portugal")) return 70;
  if (igual("liga portugal", "portugal")) return 70;

  if (igual("eredivisie", "netherlands")) return 80;

  if (igual("major league soccer", "usa")) return 90;

  if (
    igual("liga profesional argentina", "argentina") ||
    igual("primera division", "argentina")
  ) {
    return 100;
  }

  return 999;
}

/* =========================================================
   STATUS DA PARTIDA
========================================================= */

function jogoEstaAoVivo(j) {
  const status = String(
    j.status?.short ||
    j.fixture?.status?.short ||
    ""
  ).toUpperCase();

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
  return horaCurta(
    j.date ||
    j.fixture?.date
  );
}

function textoStatusJogo(j) {
  const status = String(
    j.status?.short ||
    j.fixture?.status?.short ||
    ""
  ).toUpperCase();

  const minuto =
    j.status?.elapsed ??
    j.fixture?.status?.elapsed;

  if (jogoEstaAoVivo(j)) {
    if (status === "HT") return "Intervalo";

    if (minuto != null) {
      return `${minuto}'`;
    }

    return "AO VIVO";
  }

  if (["FT", "AET", "PEN"].includes(status)) {
    return "Encerrado";
  }

  if (status === "PST") return "Adiado";
  if (status === "CANC") return "Cancelado";

  return horarioJogo(j);
}

/* =========================================================
   CARREGAMENTO DA HOME
========================================================= */

async function load(m = "jogos") {
  mode = m;

  const status =
    document.querySelector("#status");

  const games =
    document.querySelector("#games");

  const total =
    document.querySelector("#total");

  const shown =
    document.querySelector("#shown");

  const title =
    document.querySelector("#title");

  const btnJogos =
    document.querySelector("#todos");

  const btnLive =
    document.querySelector("#aoVivo");

  if (status) {
    status.textContent =
      m === "ao-vivo"
        ? "Buscando partidas ao vivo..."
        : "Carregando partidas...";
  }

  if (games) {
    games.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>

        <strong>
          Carregando jogos...
        </strong>

        <span>
          Buscando dados do Profianalises
        </span>
      </div>
    `;
  }

  if (btnJogos) {
    btnJogos.classList.toggle(
      "active",
      m !== "ao-vivo"
    );
  }

  if (btnLive) {
    btnLive.classList.toggle(
      "active",
      m === "ao-vivo"
    );
  }

  if (title) {
    title.textContent =
      m === "ao-vivo"
        ? "Jogos ao vivo"
        : "Jogos de hoje";
  }

  try {
    const rota =
      m === "ao-vivo"
        ? "/live"
        : "/jogos";

    const r = await fetch(
      `${API}${rota}`,
      {
        cache: "no-store"
      }
    );

    if (!r.ok) {
      throw new Error(
        `HTTP ${r.status}`
      );
    }

    const d = await r.json();

    if (d?.ok === false) {
      throw new Error(
        d.error ||
        d.erro ||
        "Erro retornado pela API"
      );
    }

    let lista = [];

    if (Array.isArray(d)) {
      lista = d;
    }

    else if (
      Array.isArray(d?.jogos)
    ) {
      lista = d.jogos;
    }

    else if (
      Array.isArray(d?.dados)
    ) {
      lista = d.dados;
    }

    else if (
      Array.isArray(d?.response)
    ) {
      lista = d.response;
    }

    else if (
      Array.isArray(d?.fixtures)
    ) {
      lista = d.fixtures;
    }

    else if (
      Array.isArray(
        d?.data?.response
      )
    ) {
      lista =
        d.data.response;
    }

    else if (
      Array.isArray(
        d?.data?.jogos
      )
    ) {
      lista =
        d.data.jogos;
    }

    else if (
      Array.isArray(
        d?.data
      )
    ) {
      lista =
        d.data;
    }

    if (m === "ao-vivo") {
  jogos = lista;
} else {
  const hojeBrasil = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());

  jogos = lista.filter(j => {
    const dataJogo =
      j.date ||
      j.fixture?.date;

    if (!dataJogo) return false;

    const diaJogo = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).format(new Date(dataJogo));

    return diaJogo === hojeBrasil;
  });
    }

    if (status) {
      status.textContent =
        m === "ao-vivo"
          ? `${jogos.length} partida(s) ao vivo`
          : `${jogos.length} partida(s) disponível(is)`;
    }

    if (total) {
      total.textContent =
        jogos.length;
    }

    if (shown) {
      shown.textContent =
        jogos.length;
    }

    render(jogos);

  } catch (err) {
    console.error(
      "Erro ao carregar jogos:",
      err
    );

    jogos = [];

    if (total) {
      total.textContent = "0";
    }

    if (shown) {
      shown.textContent = "0";
    }

    if (status) {
      status.textContent =
        "Não foi possível carregar as partidas.";
    }

    if (games) {
      games.innerHTML = `
        <div
          style="
            padding:24px 14px;
            text-align:center;
          "
        >
          <div
            style="
              color:#ff6575;
              font-weight:950;
              margin-bottom:7px;
            "
          >
            Erro ao carregar jogos
          </div>

          <div
            style="
              font-size:11px;
              opacity:.6;
              line-height:1.5;
            "
          >
            ${e(
              err?.message ||
              "Falha de comunicação com a API."
            )}
          </div>

          <button
            type="button"
            onclick="load('${m}')"
            style="
              margin-top:14px;
              padding:10px 16px;
              border-radius:9px;
              border:1px solid rgba(0,242,151,.3);
              background:rgba(0,242,151,.1);
              color:#00f297;
              font-weight:900;
            "
          >
            Tentar novamente
          </button>
        </div>
      `;
    }
  }
}

/* =========================================================
   CARD DA PARTIDA
========================================================= */

function cardJogo(j) {
  const id = Number(
    j.id ||
    j.fixture?.id
  );

  const casa =
    j.teams?.home?.name || "-";

  const fora =
    j.teams?.away?.name || "-";

  const casaId =
    j.teams?.home?.id;

  const foraId =
    j.teams?.away?.id;

  const logoCasa = logoTime(
    casaId,
    j.teams?.home?.logo
  );

  const logoFora = logoTime(
    foraId,
    j.teams?.away?.logo
  );

  const golsCasa =
    j.goals?.home;

  const golsFora =
    j.goals?.away;

  const aoVivo =
    jogoEstaAoVivo(j);

  const status = String(
    j.status?.short ||
    j.fixture?.status?.short ||
    ""
  ).toUpperCase();

  const terminou =
    ["FT", "AET", "PEN"].includes(status);

  let centro =
    horarioJogo(j);

  if (aoVivo || terminou) {
    centro =
      `${golsCasa ?? 0} × ${golsFora ?? 0}`;
  }

  return `
    <div
      onclick="abrirJogo(${id})"
      style="
        cursor:pointer;
        padding:14px 16px;
        border-top:1px solid rgba(255,255,255,.07);
      "
    >

      <div
        style="
          display:grid;
          grid-template-columns:minmax(0,1fr) 72px 28px;
          gap:10px;
          align-items:center;
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

        <div style="text-align:center">

          <div
            style="
              font-size:18px;
              font-weight:900;
              color:${
                aoVivo
                  ? "#2ee58b"
                  : "#fff"
              };
            "
          >
            ${e(centro)}
          </div>

          <div
            style="
              margin-top:5px;
              font-size:11px;
              font-weight:800;
              color:${
                aoVivo
                  ? "#2ee58b"
                  : "rgba(255,255,255,.55)"
              };
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
            color:#2ee58b;
            font-size:22px;
            font-weight:900;
            text-align:right;
          "
        >
          ›
        </div>

      </div>

    </div>
  `;
}

/* =========================================================
   RENDERIZAÇÃO DA HOME
========================================================= */

function render(lista) {
  const shown =
    document.querySelector("#shown");

  const total =
    document.querySelector("#total");

  const status =
    document.querySelector("#status");

  const list =
    document.querySelector("#games");

  if (shown) {
    shown.textContent =
      lista.length;
  }

  if (total) {
    total.textContent =
      jogos.length;
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

  const ordenados =
    [...lista].sort((a, b) => {

      const pa =
        prioridadeLiga(a);

      const pb =
        prioridadeLiga(b);

      if (pa !== pb) {
        return pa - pb;
      }

      const ligaA =
        String(a.league?.name || "");

      const ligaB =
        String(b.league?.name || "");

      const comp =
        ligaA.localeCompare(
          ligaB,
          "pt-BR"
        );

      if (comp !== 0) {
        return comp;
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
      grupos.set(chave, {
        league: j.league || {},
        prioridade:
          prioridadeLiga(j),
        jogos: []
      });
    }

    grupos
      .get(chave)
      .jogos
      .push(j);
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
      a.prioridade -
      b.prioridade
  );

  outras.sort((a, b) => {

    const paisA =
      String(
        a.league?.country || ""
      );

    const paisB =
      String(
        b.league?.country || ""
      );

    const p =
      paisA.localeCompare(
        paisB,
        "pt-BR"
      );

    if (p !== 0) return p;

    return String(
      a.league?.name || ""
    ).localeCompare(
      String(
        b.league?.name || ""
      ),
      "pt-BR"
    );
  });

  function blocoLiga(grupo) {

    const liga =
      grupo.league?.name ||
      "Competição";

    const pais =
      grupo.league?.country ||
      "";

    const logo =
      grupo.league?.logo ||
      "";

    return `
      <section
        style="
          margin-bottom:18px;
          border:1px solid rgba(46,229,139,.18);
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
                font-size:11px;
                opacity:.6;
                font-weight:800;
                text-transform:uppercase;
              "
            >
              ${e(pais)}
            </div>

            <div
              style="
                font-size:16px;
                font-weight:900;
              "
            >
              ${e(liga)}
            </div>

          </div>

          <div
            style="
              margin-left:auto;
              opacity:.55;
              font-size:13px;
              font-weight:800;
            "
          >
            ${grupo.jogos.length}
          </div>

        </div>

        ${
          grupo.jogos
            .map(cardJogo)
            .join("")
        }

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

/* =========================================================
   ESTATÍSTICAS DA PARTIDA
========================================================= */

function pegarEstatistica(lista, tipo) {
  if (!Array.isArray(lista)) {
    return null;
  }

  const item =
    lista.find(x =>
      String(x?.type || "")
        .toLowerCase() ===
      String(tipo)
        .toLowerCase()
    );

  return item?.value ?? null;
}

function normalizarEstatisticas(dados) {
  if (!Array.isArray(dados)) {
    return [];
  }

  return dados.map(item => {

    const stats =
      item.statistics || [];

    return {
      team_id:
        item.team?.id,

      team_name:
        item.team?.name,

      chutes_gol:
        pegarEstatistica(
          stats,
          "Shots on Goal"
        ),

      chutes_fora:
        pegarEstatistica(
          stats,
          "Shots off Goal"
        ),

      total_chutes:
        pegarEstatistica(
          stats,
          "Total Shots"
        ),

      chutes_bloqueados:
        pegarEstatistica(
          stats,
          "Blocked Shots"
        ),

      escanteios:
        pegarEstatistica(
          stats,
          "Corner Kicks"
        ),

      impedimentos:
        pegarEstatistica(
          stats,
          "Offsides"
        ),

      posse:
        pegarEstatistica(
          stats,
          "Ball Possession"
        ),

      faltas:
        pegarEstatistica(
          stats,
          "Fouls"
        ),

      cartoes_amarelos:
        pegarEstatistica(
          stats,
          "Yellow Cards"
        ),

      cartoes_vermelhos:
        pegarEstatistica(
          stats,
          "Red Cards"
        ),

      defesas_goleiro:
        pegarEstatistica(
          stats,
          "Goalkeeper Saves"
        ),

      passes:
        pegarEstatistica(
          stats,
          "Total passes"
        ),

      passes_certos:
        pegarEstatistica(
          stats,
          "Passes accurate"
        )
    };
  });
}
  /* =========================================================
   CARREGAMENTO COMPLETO DA PARTIDA
========================================================= */

async function fetchJson(url) {
  const r = await fetch(url);
  const d = await r.json();

  if (!r.ok || d?.ok === false) {
    throw new Error(
      d?.erro ||
      d?.error ||
      "Erro ao carregar dados"
    );
  }

  return d;
}

async function fetchOpcional(url) {
  try {
    return await fetchJson(url);
  } catch (err) {
    console.warn("Dado opcional indisponível:", url, err);
    return null;
  }
}

function voltarParaHome() {
  const url = new URL(window.location.href);

  url.searchParams.delete("jogo");

  window.history.replaceState(
    {},
    "",
    url.pathname + url.search
  );

  partidaAtual = null;
  historicoAtual = null;
  jogadoresAtuais = null;

  window.location.reload();
}
async function abrirJogo(id) {
    id = Number(id);

  if (id) {
    const url = new URL(window.location.href);
    url.searchParams.set("jogo", id);
    window.history.replaceState(
      { jogo: id },
      "",
      url.toString()
    );
  }
  document.body.innerHTML = `
    <main
      style="
        max-width:900px;
        margin:auto;
        padding:16px;
      "
    >
      <button
        onclick="location.reload()"
        style="
          border:0;
          border-radius:10px;
          padding:11px 15px;
          background:rgba(255,255,255,.08);
          color:#fff;
          font-weight:800;
        "
      >
        ← Voltar
      </button>

      ${painel(`
        <div style="text-align:center;padding:28px 10px">
          <div
            style="
              font-size:22px;
              font-weight:900;
            "
          >
            Carregando análise...
          </div>

          <div
            style="
              margin-top:8px;
              opacity:.65;
            "
          >
            Buscando partida, histórico, jogadores e estatísticas.
          </div>
        </div>
      `)}
    </main>
  `;

  try {
    const [
      fixtureData,
      statsData,
      eventsData,
      playersData,
      historicoData,
      lineupsData,
      oddsData
    ] = await Promise.all([

      fetchJson(
        `${API}/fixture?id=${encodeURIComponent(id)}`
      ),

      fetchOpcional(
        `${API}/fixture/statistics?id=${encodeURIComponent(id)}`
      ),

      fetchOpcional(
        `${API}/fixture/events?id=${encodeURIComponent(id)}`
      ),

      fetchOpcional(
        `${API}/fixture/players?id=${encodeURIComponent(id)}`
      ),

      fetchOpcional(
        `${API}/historico/fixture/${encodeURIComponent(id)}`
      ),

      fetchOpcional(
        `${API}/fixture/lineups?id=${encodeURIComponent(id)}`
      ),

      fetchOpcional(
        `${API}/fixture/odds?id=${encodeURIComponent(id)}`
      )
    ]);

    const fixture =
      fixtureData.dados?.[0] ||
      fixtureData.fixture ||
      fixtureData.response?.[0] ||
      fixtureData.jogo ||
      fixtureData.dados;
    const homeIdH2H =
  fixture?.teams?.home?.id ||
  fixture?.home?.id ||
  fixture?.casa?.id ||
  null;

const awayIdH2H =
  fixture?.teams?.away?.id ||
  fixture?.away?.id ||
  fixture?.fora?.id ||
  null;

const h2hData =
  homeIdH2H && awayIdH2H
    ? await fetchOpcional(
        `${API}/h2h?home=${encodeURIComponent(homeIdH2H)}&away=${encodeURIComponent(awayIdH2H)}&last=10`
      )
    : null;

    if (!fixture) {
      throw new Error(
        "Partida não encontrada."
      );
    }

    const estatisticasBrutas =
      statsData?.estatisticas ||
      statsData?.response ||
      statsData?.dados ||
      [];

    const eventos =
      eventsData?.eventos ||
      eventsData?.response ||
      eventsData?.dados ||
      [];

    const jogadores =
      playersData?.jogadores ||
      playersData?.response ||
      playersData?.dados ||
      [];

    const lineups =
      lineupsData?.lineups ||
      lineupsData?.escalacoes ||
      lineupsData?.response ||
      lineupsData?.dados ||
      [];

    const odds =
      oddsData?.odds ||
      oddsData?.response ||
      oddsData?.dados ||
      [];

    const estatisticas =
      normalizarEstatisticas(
        estatisticasBrutas
      );

    partidaAtual = {
  h2h:
    h2hData?.jogos ||
    h2hData?.partidas ||
    h2hData?.response ||
    [],

  id:
      id:
        fixture.fixture?.id ||
        id,

      fixture,

      competition:
        fixture.league?.name,

      competition_id:
        fixture.league?.id,

      country:
        fixture.league?.country,

      season:
        fixture.league?.season,

      round:
        fixture.league?.round,

      date:
        fixture.fixture?.date ||
        fixture.date,

      status:
        fixture.fixture?.status ||
        fixture.status,

      home: {
        id:
          fixture.teams?.home?.id,

        name:
          fixture.teams?.home?.name,

        logo:
          logoTime(
            fixture.teams?.home?.id,
            fixture.teams?.home?.logo
          ),

        goals:
          fixture.goals?.home
      },

      away: {
        id:
          fixture.teams?.away?.id,

        name:
          fixture.teams?.away?.name,

        logo:
          logoTime(
            fixture.teams?.away?.id,
            fixture.teams?.away?.logo
          ),

        goals:
          fixture.goals?.away
      },

      estatisticas,
      eventos,
      jogadores,
      lineups,
      odds
    };

    const homeId = partidaAtual?.teams?.home?.id;
const awayId = partidaAtual?.teams?.away?.id;

if (homeId && awayId) {
  const h2hData = await fetchOpcional(
    `${API}/h2h?home=${homeId}&away=${awayId}&last=10`
  );

  partidaAtual.h2h =
    h2hData?.jogos ||
    h2hData?.response ||
    [];
}
    historicoAtual =
      historicoData || null;

    jogadoresAtuais =
      jogadores;

    abaAtual = "resumo";

    renderPaginaPartida();

  } catch (err) {
    console.error(err);

    document.body.innerHTML = `
      <main
        style="
          max-width:850px;
          margin:auto;
          padding:20px;
        "
      >
        <button
          onclick="location.reload()"
          style="
            padding:11px 15px;
            margin-bottom:15px;
          "
        >
          ← Voltar
        </button>

        ${painel(`
          <div style="text-align:center;padding:20px">
            <h2>Não foi possível carregar a partida</h2>
            <p style="opacity:.7">
              ${e(err.message)}
            </p>
          </div>
        `)}
      </main>
    `;
  }
}

/* =========================================================
   CABEÇALHO DA PARTIDA
========================================================= */

function statusPartidaAtual() {
  if (!partidaAtual) return "";

  const s =
    partidaAtual.status || {};

  const short =
    String(s.short || "")
      .toUpperCase();

  if (
    [
      "1H",
      "HT",
      "2H",
      "ET",
      "BT",
      "P",
      "LIVE"
    ].includes(short)
  ) {
    if (short === "HT") {
      return "INTERVALO";
    }

    return s.elapsed != null
      ? `AO VIVO • ${s.elapsed}'`
      : "AO VIVO";
  }

  if (
    ["FT", "AET", "PEN"]
      .includes(short)
  ) {
    return "ENCERRADO";
  }

  return horaCurta(
    partidaAtual.date
  );
}

function cabecalhoPartida() {
  const p =
    partidaAtual;

  if (!p) return "";

  const iniciado =
    jogoEstaAoVivo(
      p.fixture
    ) ||
    ["FT", "AET", "PEN"].includes(
      String(
        p.status?.short || ""
      ).toUpperCase()
    );

  return `
    ${painel(`
      <div
        style="
          font-size:11px;
          font-weight:800;
          opacity:.65;
          text-align:center;
          margin-bottom:15px;
        "
      >
        ${e(p.competition || "Competição")}
        ${
          p.round
            ? ` • ${e(p.round)}`
            : ""
        }
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:minmax(0,1fr) 75px minmax(0,1fr);
          align-items:center;
          gap:10px;
        "
      >

        <div
          onclick="abrirTime(${Number(p.home.id)})"
          style="
            text-align:center;
            cursor:pointer;
          "
        >
          <img
            src="${e(p.home.logo)}"
            onerror="this.style.display='none'"
            style="
              width:64px;
              height:64px;
              object-fit:contain;
            "
          >

          <div
            style="
              margin-top:8px;
              font-weight:900;
              font-size:15px;
            "
          >
            ${e(p.home.name)}
          </div>

          <div
            style="
              margin-top:4px;
              font-size:11px;
              color:#2ee58b;
              font-weight:800;
            "
          >
            Ver análise
          </div>
        </div>

        <div style="text-align:center">

          <div
            style="
              font-size:${
                iniciado
                  ? "28px"
                  : "20px"
              };
              font-weight:950;
            "
          >
            ${
              iniciado
                ? `${p.home.goals ?? 0} - ${p.away.goals ?? 0}`
                : e(horaCurta(p.date))
            }
          </div>

          <div
            style="
              margin-top:6px;
              font-size:11px;
              font-weight:900;
              color:${
                jogoEstaAoVivo(p.fixture)
                  ? "#2ee58b"
                  : "rgba(255,255,255,.55)"
              };
            "
          >
            ${e(statusPartidaAtual())}
          </div>

        </div>

        <div
          onclick="abrirTime(${Number(p.away.id)})"
          style="
            text-align:center;
            cursor:pointer;
          "
        >
          <img
            src="${e(p.away.logo)}"
            onerror="this.style.display='none'"
            style="
              width:64px;
              height:64px;
              object-fit:contain;
            "
          >

          <div
            style="
              margin-top:8px;
              font-weight:900;
              font-size:15px;
            "
          >
            ${e(p.away.name)}
          </div>

          <div
            style="
              margin-top:4px;
              font-size:11px;
              color:#2ee58b;
              font-weight:800;
            "
          >
            Ver análise
          </div>
        </div>

      </div>
    `)}
  `;
}

/* =========================================================
   ABAS DA PARTIDA
========================================================= */

const ABAS_PARTIDA = [
  ["resumo", "Visão geral"],
  ["oportunidades", "Oportunidades"],
  ["h2h", "H2H"],
  ["analise", "Análise"],
  ["escalacoes", "Escalações"],
  ["jogadores", "Jogadores"],
  ["estatisticas", "Estatísticas"],
  ["eventos", "Eventos"],
  ["odds", "Odds"]
];

function barraAbasPartida() {
  return `
    <div
      style="
        display:flex;
        gap:8px;
        overflow-x:auto;
        padding:2px 0 12px;
        margin-bottom:4px;
        scrollbar-width:none;
      "
    >
      ${
        ABAS_PARTIDA.map(
          ([id, nome]) =>
            botao(
              nome,
              `mudarAbaPartida('${id}')`,
              abaAtual === id
            )
        ).join("")
      }
    </div>
  `;
}

function mudarAbaPartida(aba) {
  abaAtual = aba;
  renderPaginaPartida();
}

/* =========================================================
   SCORE E MATCHUP
   O score NÃO representa probabilidade.
========================================================= */

function calcularScoreBase() {
  const h =
    historicoAtual;

  if (!h) {
    return {
      score: null,
      matchup: "-"
    };
  }

  const casa =
    safeArray(
      h.casa?.ultimas10?.partidas
    );

  const fora =
    safeArray(
      h.fora?.ultimas10?.partidas
    );

  if (!casa.length || !fora.length) {
    return {
      score: null,
      matchup: "-"
    };
  }

  const saldoCasa =
    soma(casa, "golsFavor") -
    soma(casa, "golsContra");

  const saldoFora =
    soma(fora, "golsFavor") -
    soma(fora, "golsContra");

  const amostra =
    Math.min(
      10,
      casa.length,
      fora.length
    );

  let score =
    50 +
    Math.max(
      -18,
      Math.min(
        18,
        (saldoCasa - saldoFora) * 2
      )
    );

  score +=
    Math.min(
      12,
      amostra
    );

  score =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(score)
      )
    );

  let matchup = "C";

  if (score >= 85) matchup = "A";
  else if (score >= 70) matchup = "B";
  else if (score >= 55) matchup = "C";
  else matchup = "D";

  return {
    score,
    matchup
  };
}

function cardScore() {
  const r =
    calcularScoreBase();

  return painel(`
    ${tituloSecao(
      "Score Profianalises / Matchup",
      "Índice interno de análise — não representa probabilidade de acerto."
    )}

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      "
    >

      <div
        style="
          border-radius:14px;
          padding:18px 10px;
          text-align:center;
          background:rgba(46,229,139,.07);
        "
      >
        <div
          style="
            font-size:11px;
            opacity:.65;
            font-weight:800;
          "
        >
          SCORE
        </div>

        <div
          style="
            margin-top:6px;
            font-size:30px;
            font-weight:950;
            color:#2ee58b;
          "
        >
          ${
            r.score == null
              ? "-"
              : `${r.score}/100`
          }
        </div>
      </div>

      <div
        style="
          border-radius:14px;
          padding:18px 10px;
          text-align:center;
          background:rgba(255,255,255,.04);
        "
      >
        <div
          style="
            font-size:11px;
            opacity:.65;
            font-weight:800;
          "
        >
          MATCHUP
        </div>

        <div
          style="
            margin-top:6px;
            font-size:30px;
            font-weight:950;
          "
        >
          ${e(r.matchup)}
        </div>
      </div>

    </div>

    <button
      onclick="mostrarExplicacaoScore()"
      style="
        width:100%;
        margin-top:12px;
        border:1px solid rgba(46,229,139,.25);
        background:transparent;
        color:#2ee58b;
        padding:11px;
        border-radius:11px;
        font-weight:900;
      "
    >
      Por que este score?
    </button>

    <div
      id="explicacao-score"
      style="
        display:none;
        margin-top:12px;
        padding:12px;
        border-radius:12px;
        background:rgba(255,255,255,.035);
        font-size:13px;
        line-height:1.6;
      "
    >
      O Score Profianalises será formado por tendência recente,
      Casa/Fora, campeonato, estabilidade da amostra,
      adversário, projeção versus linha e, quando disponível,
      preço/odd do mercado.

      <br><br>

      Ele é um índice comparativo interno e não deve ser
      interpretado como chance garantida de acerto.
    </div>
  `);
}

function mostrarExplicacaoScore() {
  const el =
    document.querySelector(
      "#explicacao-score"
    );

  if (!el) return;

  el.style.display =
    el.style.display === "none"
      ? "block"
      : "none";
}

/* =========================================================
   RESUMO DAS ÚLTIMAS PARTIDAS
========================================================= */

function resultadoPartidaHistorica(p) {
  const gf =
    n(p.golsFavor);

  const gc =
    n(p.golsContra);

  if (gf > gc) return "V";
  if (gf < gc) return "D";

  return "E";
}

function corResultado(r) {
  if (r === "V") return "#2ee58b";
  if (r === "D") return "#ff6470";

  return "#e6c84f";
}

function miniForma(partidas) {
  const lista =
    safeArray(partidas)
      .slice(0, 5);

  if (!lista.length) {
    return `
      <span style="opacity:.6">
        Sem dados
      </span>
    `;
  }

  return `
    <div
      style="
        display:flex;
        gap:5px;
        flex-wrap:wrap;
      "
    >
      ${
        lista.map(p => {
          const r =
            resultadoPartidaHistorica(p);

          return `
            <span
              style="
                width:26px;
                height:26px;
                border-radius:7px;
                display:flex;
                align-items:center;
                justify-content:center;
                background:${corResultado(r)};
                color:#07120d;
                font-size:12px;
                font-weight:950;
              "
            >
              ${r}
            </span>
          `;
        }).join("")
      }
    </div>
  `;
}

function resumoFormaTimes() {
  const casa =
    historicoAtual?.casa;

  const fora =
    historicoAtual?.fora;

  return painel(`
    ${tituloSecao(
      "Forma recente",
      "Últimos resultados disponíveis"
    )}

    <div
      style="
        display:flex;
        flex-direction:column;
        gap:16px;
      "
    >

      <div>
        <div
          style="
            font-weight:900;
            margin-bottom:8px;
          "
        >
          ${e(
            partidaAtual?.home?.name ||
            "Mandante"
          )}
        </div>

        ${miniForma(
          casa?.ultimas5?.partidas
        )}
      </div>

      <div>
        <div
          style="
            font-weight:900;
            margin-bottom:8px;
          "
        >
          ${e(
            partidaAtual?.away?.name ||
            "Visitante"
          )}
        </div>

        ${miniForma(
          fora?.ultimas5?.partidas
        )}
      </div>

    </div>
  `);
}

/* =========================================================
   OPORTUNIDADES PROFIANALISES
========================================================= */

function cardOportunidade(op) {
  return `
    <div
      style="
        border:1px solid rgba(46,229,139,.22);
        border-radius:15px;
        padding:14px;
        background:rgba(46,229,139,.045);
        margin-top:10px;
      "
    >

      <div
        style="
          color:#2ee58b;
          font-size:11px;
          font-weight:950;
          letter-spacing:.05em;
        "
      >
        OPORTUNIDADE IDENTIFICADA
      </div>

      <div
        style="
          margin-top:8px;
          font-size:16px;
          font-weight:950;
        "
      >
        ${e(op.titulo)}
      </div>

      <div
        style="
          margin-top:8px;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:7px;
          font-size:13px;
        "
      >
        <div>
          Odd atual:
          <strong>
            ${formatarOdd(op.odd)}
          </strong>
        </div>

        <div>
          L10:
          <strong>
            ${e(op.l10 || "-")}
          </strong>
        </div>

        <div>
          Casa/Fora:
          <strong>
            ${e(op.casaFora || "-")}
          </strong>
        </div>

        <div>
          Média:
          <strong>
            ${e(op.media || "-")}
          </strong>
        </div>

        <div>
          Projeção:
          <strong>
            ${e(op.projecao || "-")}
          </strong>
        </div>

        <div>
          Score:
          <strong>
            ${e(op.score || "-")}
          </strong>
        </div>
      </div>

      ${
        op.motivos?.length
          ? `
            <div
              style="
                margin-top:12px;
                padding-top:10px;
                border-top:1px solid rgba(255,255,255,.08);
                font-size:12px;
                line-height:1.7;
              "
            >
              ${
                op.motivos
                  .map(
                    m =>
                      `✓ ${e(m)}`
                  )
                  .join("<br>")
              }
            </div>
          `
          : ""
      }

    </div>
  `;
}

function obterOportunidades() {
  /*
    Esta função já deixa o frontend pronto para receber
    oportunidades calculadas pelo backend.

    NÃO criamos odds ou probabilidades fictícias.
  */

  const fontes = [
    partidaAtual?.oportunidades,
    partidaAtual?.analise?.oportunidades,
    partidaAtual?.odds?.oportunidades
  ];

  for (const f of fontes) {
    if (Array.isArray(f)) {
      return f;
    }
  }

  return [];
}

function renderOportunidades() {
  const oportunidades =
    obterOportunidades();

  if (!oportunidades.length) {
    return painel(`
      ${tituloSecao(
        "Oportunidades Profianalises",
        "Somente mercados que passarem pelos filtros aparecerão aqui."
      )}

      <div
        style="
          padding:18px;
          border-radius:13px;
          background:rgba(255,255,255,.035);
          text-align:center;
        "
      >
        <div style="font-weight:900">
          Nenhuma oportunidade qualificada no momento
        </div>

        <div
          style="
            margin-top:7px;
            font-size:12px;
            opacity:.65;
            line-height:1.5;
              "
            >
              O sistema não força uma indicação quando os
              critérios estatísticos e de odd não são atingidos.
            </div>
          </div>
        `);
  }

  return painel(`
    ${tituloSecao(
      "Oportunidades Profianalises",
      "Frequência histórica não significa probabilidade garantida."
    )}

    ${
      oportunidades
        .map(cardOportunidade)
        .join("")
    }
  `);
}

/* =========================================================
   MÚLTIPLAS PROFIANALISES
========================================================= */

function obterMultiplas() {
  const fontes = [
    partidaAtual?.multiplas,
    partidaAtual?.analise?.multiplas
  ];

  for (const f of fontes) {
    if (Array.isArray(f)) {
      return f;
    }
  }

  return [];
}

function renderMultiplas() {
  const multiplas =
    obterMultiplas();

  return painel(`
    ${tituloSecao(
      "Múltiplas Profianalises",
      "Combinações formadas apenas por seleções previamente qualificadas."
    )}

    <div
      style="
        display:flex;
        gap:7px;
        overflow-x:auto;
        margin-bottom:14px;
      "
    >
      ${
        CONFIG.alvosMultiplas
          .map(
            x =>
              `<span
                style="
                  padding:8px 11px;
                  border-radius:9px;
                  background:rgba(255,255,255,.05);
                  font-size:12px;
                  font-weight:900;
                  white-space:nowrap;
                "
              >
                Odd ~${String(x).replace(".", ",")}
              </span>`
          )
          .join("")
      }
    </div>

    ${
      multiplas.length
        ? multiplas
            .map(m => `
              <div
                style="
                  padding:14px;
                  border:1px solid rgba(46,229,139,.18);
                  border-radius:14px;
                  margin-top:10px;
                "
              >
                <div
                  style="
                    font-weight:950;
                    color:#2ee58b;
                  "
                >
                  Alvo ~${e(m.alvo)}
                  • Odd real ${formatarOdd(m.odd)}
                </div>

                <div
                  style="
                    margin-top:10px;
                    font-size:13px;
                    line-height:1.8;
                  "
                >
                  ${
                    safeArray(m.selecoes)
                      .map(
                        s =>
                          `• ${e(s.titulo)} ${
                            s.odd
                              ? `@${formatarOdd(s.odd)}`
                              : ""
                          }`
                      )
                      .join("<br>")
                  }
                </div>
              </div>
            `)
            .join("")
        : `
          <div
            style="
              padding:17px;
              text-align:center;
              border-radius:12px;
              background:rgba(255,255,255,.035);
            "
          >
            <strong>
              Aguardando mercados qualificados.
            </strong>

            <div
              style="
                margin-top:6px;
                font-size:12px;
                opacity:.65;
              "
            >
              Não será criada uma múltipla apenas para
              alcançar artificialmente uma odd-alvo.
            </div>
          </div>
        `
    }
  `);
}

/* =========================================================
   VISÃO GERAL
========================================================= */

function renderResumoPartida() {
  return `
    ${cardScore()}

    ${renderOportunidades()}

    ${resumoFormaTimes()}

    ${renderMultiplas()}

    ${painel(`
      ${tituloSecao(
        "Acesso rápido",
        "Abra a análise completa de cada equipe."
      )}

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        "
      >
        <button
          onclick="abrirTime(${Number(partidaAtual.home.id)})"
          style="
            padding:14px 8px;
            border-radius:12px;
            border:1px solid rgba(255,255,255,.1);
            background:rgba(255,255,255,.04);
            color:#fff;
            font-weight:900;
          "
        >
          ${e(partidaAtual.home.name)}
        </button>

        <button
          onclick="abrirTime(${Number(partidaAtual.away.id)})"
          style="
            padding:14px 8px;
            border-radius:12px;
            border:1px solid rgba(255,255,255,.1);
            background:rgba(255,255,255,.04);
            color:#fff;
            font-weight:900;
          "
        >
          ${e(partidaAtual.away.name)}
        </button>
      </div>
    `)}
  `;
}

/* =========================================================
   CONTEÚDO DAS ABAS
========================================================= */

function conteudoAbaPartida() {
  switch (abaAtual) {

    case "oportunidades":
      return `
        ${renderOportunidades()}
        ${renderMultiplas()}
      `;

    case "h2h":
      return renderH2H();

    case "analise":
      return renderAnaliseAutomatica();

    case "escalacoes":
      return renderEscalacoes();

    case "jogadores":
      return renderJogadoresPartida();

    case "estatisticas":
      return renderEstatisticasPartida();

    case "eventos":
      return renderEventosPartida();

    case "odds":
      return renderOddsPartida();

    case "resumo":
    default:
      return renderResumoPartida();
  }
}

/* =========================================================
   PÁGINA PRINCIPAL DA PARTIDA
========================================================= */

function renderPaginaPartida() {
  if (!partidaAtual) return;

  document.body.innerHTML = `
    <main
      style="
        width:min(100% - 20px,900px);
        margin:auto;
        padding:12px 0 30px;
      "
    >

      <div
        style="
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:12px;
        "
      >
        <button
          onclick="voltarParaHome()"
          style="
            border:0;
            width:42px;
            height:42px;
            border-radius:12px;
            background:rgba(255,255,255,.07);
            color:#fff;
            font-size:20px;
            cursor:pointer;
          "
        >
          ←
        </button>

        <div>
          <div
            style="
              font-weight:950;
              font-size:18px;
            "
          >
            Profianalises<span style="color:#2ee58b">bet</span>
          </div>

          <div
            style="
              font-size:10px;
              opacity:.55;
              font-weight:800;
            "
          >
            DADOS • ANÁLISES • OPORTUNIDADES
          </div>
        </div>
      </div>

      ${cabecalhoPartida()}

      ${barraAbasPartida()}

      <div id="conteudo-partida">
        ${conteudoAbaPartida()}
      </div>

    </main>
  `;
}
  /* =========================================================
   FILTROS DE HISTÓRICO / ANÁLISE
========================================================= */

let filtroHistorico = {
  quantidade: 10,
  local: "geral",
  campeonato: "todos"
};

let filtroH2H = 5;

function partidasHistoricoLado(lado, quantidade = 10) {
  const h = historicoAtual?.[lado];

  if (!h) return [];

  const origem =
    quantidade === 5
      ? h.ultimas5?.partidas
      : h.ultimas10?.partidas;

  return safeArray(origem);
}

function idLigaHistorica(p) {
  return (
    p?.liga?.id ??
    p?.league?.id ??
    p?.leagueId ??
    null
  );
}

function nomeLigaHistorica(p) {
  return (
    p?.liga?.name ||
    p?.league?.name ||
    p?.campeonato ||
    "Competição"
  );
}

function localHistorico(p) {
  return String(
    p?.local ||
    p?.venue ||
    ""
  ).toLowerCase();
}

function partidaEhCasa(p) {
  const l = localHistorico(p);

  return (
    l === "casa" ||
    l === "home"
  );
}

function partidaEhFora(p) {
  const l = localHistorico(p);

  return (
    l === "fora" ||
    l === "away"
  );
}

function filtrarPartidasHistoricas(
  partidas,
  local = filtroHistorico.local,
  campeonato = filtroHistorico.campeonato
) {
  let lista = [...safeArray(partidas)];

  if (local === "casa") {
    lista = lista.filter(partidaEhCasa);
  }

  if (local === "fora") {
    lista = lista.filter(partidaEhFora);
  }

  if (
    campeonato !== "todos" &&
    campeonato !== null &&
    campeonato !== ""
  ) {
    lista = lista.filter(
      p =>
        String(idLigaHistorica(p)) ===
        String(campeonato)
    );
  }

  return lista;
}

function campeonatosDoHistorico() {
  const todas = [
    ...partidasHistoricoLado("casa", 10),
    ...partidasHistoricoLado("fora", 10)
  ];

  const mapa = new Map();

  todas.forEach(p => {
    const id = idLigaHistorica(p);
    const nome = nomeLigaHistorica(p);

    if (id != null && !mapa.has(String(id))) {
      mapa.set(String(id), {
        id,
        nome
      });
    }
  });

  return [...mapa.values()]
    .sort((a, b) =>
      String(a.nome).localeCompare(
        String(b.nome),
        "pt-BR"
      )
    );
}

function mudarQuantidadeHistorico(qtd) {
  filtroHistorico.quantidade =
    Number(qtd) === 5 ? 5 : 10;

  renderPaginaPartida();
}

function mudarLocalHistorico(local) {
  filtroHistorico.local = local;
  renderPaginaPartida();
}

function mudarCampeonatoHistorico(valor) {
  filtroHistorico.campeonato =
    valor || "todos";

  renderPaginaPartida();
}

function controlesHistorico() {
  const campeonatos =
    campeonatosDoHistorico();

  return `
    <div
      style="
        display:flex;
        flex-direction:column;
        gap:10px;
        margin-bottom:14px;
      "
    >

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
        "
      >
        ${botao(
          "Últimos 5",
          "mudarQuantidadeHistorico(5)",
          filtroHistorico.quantidade === 5
        )}

        ${botao(
          "Últimos 10",
          "mudarQuantidadeHistorico(10)",
          filtroHistorico.quantidade === 10
        )}
      </div>

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
        "
      >
        ${botao(
          "Geral",
          "mudarLocalHistorico('geral')",
          filtroHistorico.local === "geral"
        )}

        ${botao(
          "Casa",
          "mudarLocalHistorico('casa')",
          filtroHistorico.local === "casa"
        )}

        ${botao(
          "Fora",
          "mudarLocalHistorico('fora')",
          filtroHistorico.local === "fora"
        )}
      </div>

      <select
        onchange="mudarCampeonatoHistorico(this.value)"
        style="
          width:100%;
          border:1px solid rgba(255,255,255,.12);
          border-radius:11px;
          background:#101820;
          color:#fff;
          padding:11px;
          font-weight:800;
        "
      >
        <option
          value="todos"
          ${
            filtroHistorico.campeonato === "todos"
              ? "selected"
              : ""
          }
        >
          Todos os campeonatos
        </option>

        ${
          campeonatos.map(c => `
            <option
              value="${e(c.id)}"
              ${
                String(filtroHistorico.campeonato) ===
                String(c.id)
                  ? "selected"
                  : ""
              }
            >
              ${e(c.nome)}
            </option>
          `).join("")
        }
      </select>

    </div>
  `;
}

/* =========================================================
   H2H — CONFRONTOS DIRETOS
========================================================= */

function mudarFiltroH2H(qtd) {
  filtroH2H =
    Number(qtd) === 10 ? 10 : 5;

  renderPaginaPartida();
}

function extrairH2HExistente() {
  const fontes = [
    partidaAtual?.h2h,
    historicoAtual?.h2h,
    partidaAtual?.fixture?.h2h
  ];

  for (const fonte of fontes) {
    if (Array.isArray(fonte)) {
      return fonte;
    }

    if (Array.isArray(fonte?.partidas)) {
      return fonte.partidas;
    }

    if (Array.isArray(fonte?.response)) {
      return fonte.response;
    }
  }

  return [];
}

function normalizarPartidaH2H(p) {
  const fixture =
    p?.fixture || {};

  const teams =
    p?.teams || {};

  const goals =
    p?.goals || {};

  return {
    id:
      fixture.id ||
      p.fixtureId ||
      p.id,

    data:
      fixture.date ||
      p.data ||
      p.date,

    casa:
      teams.home?.name ||
      p.casa ||
      p.home ||
      "-",

    fora:
      teams.away?.name ||
      p.fora ||
      p.away ||
      "-",

    logoCasa:
      teams.home?.logo ||
      p.logoCasa ||
      "",

    logoFora:
      teams.away?.logo ||
      p.logoFora ||
      "",

    golsCasa:
      goals.home ??
      p.golsCasa ??
      p.homeGoals ??
      "-",

    golsFora:
      goals.away ??
      p.golsFora ??
      p.awayGoals ??
      "-",

    liga:
      p?.league?.name ||
      p?.liga?.name ||
      p?.competicao ||
      ""
  };
}

function linhaH2H(p) {
  const x =
    normalizarPartidaH2H(p);

  return `
    <div
      style="
        padding:12px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          margin-bottom:8px;
          font-size:11px;
          opacity:.55;
        "
      >
        <span>${e(dataCurta(x.data))}</span>
        <span>${e(x.liga)}</span>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:1fr auto 1fr;
          gap:8px;
          align-items:center;
        "
      >

        <div
          style="
            display:flex;
            align-items:center;
            gap:7px;
            min-width:0;
          "
        >
          ${
            x.logoCasa
              ? `
                <img
                  src="${e(x.logoCasa)}"
                  style="
                    width:26px;
                    height:26px;
                    object-fit:contain;
                  "
                >
              `
              : ""
          }

          <strong>
            ${e(x.casa)}
          </strong>
        </div>

        <div
          style="
            font-size:17px;
            font-weight:950;
          "
        >
          ${valor(x.golsCasa)}
          -
          ${valor(x.golsFora)}
        </div>

        <div
          style="
            display:flex;
            justify-content:flex-end;
            align-items:center;
            gap:7px;
            min-width:0;
            text-align:right;
          "
        >
          <strong>
            ${e(x.fora)}
          </strong>

          ${
            x.logoFora
              ? `
                <img
                  src="${e(x.logoFora)}"
                  style="
                    width:26px;
                    height:26px;
                    object-fit:contain;
                  "
                >
              `
              : ""
          }
        </div>

      </div>
    </div>
  `;
}

function renderH2H() {
  const todos =
    extrairH2HExistente();

  const selecionados =
    todos.slice(0, filtroH2H);

  return `
    ${painel(`
      ${tituloSecao(
        "H2H • Confrontos diretos",
        "Histórico entre as duas equipes"
      )}

      <div
        style="
          display:flex;
          gap:8px;
          margin-bottom:14px;
        "
      >
        ${botao(
          "Últimos 5",
          "mudarFiltroH2H(5)",
          filtroH2H === 5
        )}

        ${botao(
          "Últimos 10",
          "mudarFiltroH2H(10)",
          filtroH2H === 10
        )}
      </div>

      ${
        selecionados.length
          ? selecionados
              .map(linhaH2H)
              .join("")
          : `
            <div
              style="
                padding:20px;
                text-align:center;
                border-radius:12px;
                background:rgba(255,255,255,.035);
              "
            >
              <strong>
                H2H aguardando dados do servidor
              </strong>

              <div
                style="
                  margin-top:7px;
                  opacity:.6;
                  font-size:12px;
                  line-height:1.5;
                "
              >
                A interface já está pronta.
                Na etapa do backend adicionaremos a rota
                que busca os últimos confrontos entre
                estas duas equipes.
              </div>
            </div>
          `
      }
    `)}
  `;
}
  /* =========================================================
   MOTOR DE ANÁLISE HISTÓRICA DOS TIMES
========================================================= */

function partidasFiltradasDoLado(lado) {
  const partidas =
    partidasHistoricoLado(
      lado,
      filtroHistorico.quantidade
    );

  return filtrarPartidasHistoricas(
    partidas,
    filtroHistorico.local,
    filtroHistorico.campeonato
  );
}

function numeroHistorico(p, nomes = []) {
  for (const nome of nomes) {
    const valorCampo = p?.[nome];

    if (
      valorCampo !== null &&
      valorCampo !== undefined &&
      valorCampo !== ""
    ) {
      const x = Number(valorCampo);

      if (Number.isFinite(x)) {
        return x;
      }
    }
  }

  return 0;
}

function estatisticasPartidaHistorica(p) {
  return {
    golsFavor:
      numeroHistorico(
        p,
        ["golsFavor", "gols", "goalsFor"]
      ),

    golsContra:
      numeroHistorico(
        p,
        ["golsContra", "goalsAgainst"]
      ),

    chutes:
      numeroHistorico(
        p,
        [
          "chutes",
          "totalChutes",
          "total_chutes",
          "shots"
        ]
      ),

    chutesGol:
      numeroHistorico(
        p,
        [
          "chutesGol",
          "chutesNoGol",
          "chutes_gol",
          "shotsOnGoal"
        ]
      ),

    escanteios:
      numeroHistorico(
        p,
        [
          "escanteios",
          "corners"
        ]
      ),

    faltas:
      numeroHistorico(
        p,
        [
          "faltas",
          "fouls"
        ]
      ),

    amarelos:
      numeroHistorico(
        p,
        [
          "amarelos",
          "cartoesAmarelos",
          "yellowCards"
        ]
      ),

    vermelhos:
      numeroHistorico(
        p,
        [
          "vermelhos",
          "cartoesVermelhos",
          "redCards"
        ]
      )
  };
}

function resumoHistoricoTime(partidas) {
  const lista =
    safeArray(partidas);

  const quantidade =
    lista.length;

  const total = {
    golsFavor: 0,
    golsContra: 0,
    chutes: 0,
    chutesGol: 0,
    escanteios: 0,
    faltas: 0,
    amarelos: 0,
    vermelhos: 0
  };

  lista.forEach(p => {
    const s =
      estatisticasPartidaHistorica(p);

    Object.keys(total).forEach(
      campo => {
        total[campo] +=
          n(s[campo]);
      }
    );
  });

  const medias = {};

  Object.keys(total).forEach(
    campo => {
      medias[campo] =
        quantidade
          ? total[campo] / quantidade
          : 0;
    }
  );

  return {
    quantidade,
    total,
    medias
  };
}

/* =========================================================
   LINHAS AUTOMÁTICAS PARA TESTE DE TENDÊNCIA
========================================================= */

function testarLinha(
  partidas,
  getter,
  linha,
  operador = "mais"
) {
  const lista =
    safeArray(partidas);

  if (!lista.length) {
    return {
      acertos: 0,
      total: 0,
      percentual: 0,
      media: 0
    };
  }

  const valores =
    lista.map(p =>
      n(getter(p))
    );

  const acertos =
    valores.filter(v => {
      if (operador === "menos") {
        return v < linha;
      }

      return v > linha;
    }).length;

  return {
    acertos,
    total: valores.length,
    percentual:
      pct(
        acertos,
        valores.length
      ),
    media:
      valores.reduce(
        (a, b) => a + b,
        0
      ) / valores.length
  };
}

function gerarTendenciasTime(partidas) {
  const lista =
    safeArray(partidas);

  if (!lista.length) {
    return [];
  }

  const mercados = [
    {
      nome: "Gols marcados",
      getter: p =>
        estatisticasPartidaHistorica(p)
          .golsFavor,
      linhas: [0.5, 1.5, 2.5]
    },

    {
      nome: "Gols totais",
      getter: p => {
        const s =
          estatisticasPartidaHistorica(p);

        return (
          s.golsFavor +
          s.golsContra
        );
      },
      linhas: [1.5, 2.5, 3.5]
    },

    {
      nome: "Escanteios",
      getter: p =>
        estatisticasPartidaHistorica(p)
          .escanteios,
      linhas: [
        3.5,
        4.5,
        5.5,
        6.5,
        7.5,
        8.5,
        9.5
      ]
    },

    {
      nome: "Chutes",
      getter: p =>
        estatisticasPartidaHistorica(p)
          .chutes,
      linhas: [
        7.5,
        8.5,
        9.5,
        10.5,
        11.5,
        12.5,
        13.5,
        14.5
      ]
    },

    {
      nome: "Chutes no alvo",
      getter: p =>
        estatisticasPartidaHistorica(p)
          .chutesGol,
      linhas: [
        1.5,
        2.5,
        3.5,
        4.5,
        5.5,
        6.5
      ]
    },

    {
      nome: "Faltas",
      getter: p =>
        estatisticasPartidaHistorica(p)
          .faltas,
      linhas: [
        7.5,
        8.5,
        9.5,
        10.5,
        11.5,
        12.5,
        13.5,
        14.5
      ]
    },

    {
      nome: "Cartões amarelos",
      getter: p =>
        estatisticasPartidaHistorica(p)
          .amarelos,
      linhas: [
        0.5,
        1.5,
        2.5,
        3.5,
        4.5
      ]
    }
  ];

  const tendencias = [];

  mercados.forEach(mercado => {
    mercado.linhas.forEach(linha => {
      const r =
        testarLinha(
          lista,
          mercado.getter,
          linha,
          "mais"
        );

      if (
        r.total > 0 &&
        r.percentual >=
          CONFIG.frequenciaMinima
      ) {
        tendencias.push({
          mercado:
            mercado.nome,

          linha,

          tipo:
            "Mais de",

          acertos:
            r.acertos,

          total:
            r.total,

          percentual:
            r.percentual,

          media:
            r.media
        });
      }
    });
  });

  return tendencias.sort(
    (a, b) => {

      if (
        b.percentual !==
        a.percentual
      ) {
        return (
          b.percentual -
          a.percentual
        );
      }

      return (
        b.total -
        a.total
      );
    }
  );
}

/* =========================================================
   CARDS DE MÉDIAS
========================================================= */

function cardMediaHistorica(
  nome,
  total,
  mediaValor
) {
  return `
    <div
      style="
        border-radius:12px;
        padding:12px;
        background:rgba(255,255,255,.04);
      "
    >
      <div
        style="
          font-size:11px;
          opacity:.6;
          font-weight:800;
        "
      >
        ${e(nome)}
      </div>

      <div
        style="
          margin-top:7px;
          font-size:19px;
          font-weight:950;
        "
      >
        ${n(mediaValor).toFixed(1)}
      </div>

      <div
        style="
          margin-top:3px;
          font-size:10px;
          opacity:.5;
        "
      >
        Total: ${n(total).toFixed(0)}
      </div>
    </div>
  `;
}

function blocoResumoTime(
  lado,
  nomeTime
) {
  const partidas =
    partidasFiltradasDoLado(lado);

  const resumo =
    resumoHistoricoTime(partidas);

  return painel(`
    ${tituloSecao(
      nomeTime,
      `${resumo.quantidade} partida(s) na amostra selecionada`
    )}

    <div
      style="
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      "
    >

      ${cardMediaHistorica(
        "Gols marcados",
        resumo.total.golsFavor,
        resumo.medias.golsFavor
      )}

      ${cardMediaHistorica(
        "Gols sofridos",
        resumo.total.golsContra,
        resumo.medias.golsContra
      )}

      ${cardMediaHistorica(
        "Chutes",
        resumo.total.chutes,
        resumo.medias.chutes
      )}

      ${cardMediaHistorica(
        "Chutes no alvo",
        resumo.total.chutesGol,
        resumo.medias.chutesGol
      )}

      ${cardMediaHistorica(
        "Escanteios",
        resumo.total.escanteios,
        resumo.medias.escanteios
      )}

      ${cardMediaHistorica(
        "Faltas",
        resumo.total.faltas,
        resumo.medias.faltas
      )}

      ${cardMediaHistorica(
        "Amarelos",
        resumo.total.amarelos,
        resumo.medias.amarelos
      )}

      ${cardMediaHistorica(
        "Vermelhos",
        resumo.total.vermelhos,
        resumo.medias.vermelhos
      )}

    </div>
  `);
}

/* =========================================================
   TENDÊNCIAS >= 80%
========================================================= */

function blocoTendenciasTime(
  lado,
  nomeTime
) {
  const partidas =
    partidasFiltradasDoLado(lado);

  const tendencias =
    gerarTendenciasTime(partidas);

  return painel(`
    ${tituloSecao(
      `Tendências • ${nomeTime}`,
      `Somente frequências históricas ≥ ${CONFIG.frequenciaMinima}%`
    )}

    ${
      tendencias.length
        ? tendencias
            .slice(0, 15)
            .map(t => `
              <div
                style="
                  padding:12px 0;
                  border-bottom:1px solid rgba(255,255,255,.07);
                "
              >
                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    gap:12px;
                  "
                >
                  <strong>
                    ${e(t.mercado)}
                    •
                    ${e(t.tipo)}
                    ${e(t.linha)}
                  </strong>

                  <strong
                    style="
                      color:#2ee58b;
                      white-space:nowrap;
                    "
                  >
                    ${t.percentual}%
                  </strong>
                </div>

                <div
                  style="
                    margin-top:5px;
                    display:flex;
                    justify-content:space-between;
                    gap:10px;
                    font-size:11px;
                    opacity:.65;
                  "
                >
                  <span>
                    ${t.acertos}/${t.total} jogos
                  </span>

                  <span>
                    Média:
                    ${n(t.media).toFixed(1)}
                  </span>
                </div>
              </div>
            `)
            .join("")
        : `
          <div
            style="
              padding:18px;
              text-align:center;
              border-radius:12px;
              background:rgba(255,255,255,.035);
            "
          >
            Nenhuma tendência ≥
            ${CONFIG.frequenciaMinima}%
            encontrada nesta amostra.
          </div>
        `
    }

    <div
      style="
        margin-top:12px;
        font-size:11px;
        opacity:.55;
        line-height:1.5;
      "
    >
      Estes percentuais representam frequência histórica
      na amostra selecionada, não probabilidade garantida
      para a próxima partida.
    </div>
  `);
}

/* =========================================================
   LISTA JOGO A JOGO DO TIME
========================================================= */

function linhaHistoricoTime(p) {
  const s =
    estatisticasPartidaHistorica(p);

  const resultado =
    resultadoPartidaHistorica(p);

  return `
    <div
      style="
        padding:12px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          align-items:center;
        "
      >
        <div>
          <strong>
            ${e(
              p.adversario?.name ||
              p.adversario ||
              "Adversário"
            )}
          </strong>

          <div
            style="
              margin-top:3px;
              font-size:10px;
              opacity:.55;
            "
          >
            ${e(dataCurta(p.data))}
            •
            ${e(nomeLigaHistorica(p))}
            •
            ${
              partidaEhCasa(p)
                ? "Casa"
                : partidaEhFora(p)
                  ? "Fora"
                  : "Geral"
            }
          </div>
        </div>

        <span
          style="
            min-width:27px;
            height:27px;
            border-radius:7px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:${corResultado(resultado)};
            color:#07120d;
            font-weight:950;
          "
        >
          ${resultado}
        </span>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:6px;
          margin-top:10px;
          font-size:10px;
          text-align:center;
        "
      >
        <div>
          <strong>
            ${s.golsFavor}-${s.golsContra}
          </strong>
          <br>
          <span style="opacity:.55">
            Gols
          </span>
        </div>

        <div>
          <strong>
            ${s.chutes}
          </strong>
          <br>
          <span style="opacity:.55">
            Chutes
          </span>
        </div>

        <div>
          <strong>
            ${s.chutesGol}
          </strong>
          <br>
          <span style="opacity:.55">
            No alvo
          </span>
        </div>

        <div>
          <strong>
            ${s.escanteios}
          </strong>
          <br>
          <span style="opacity:.55">
            Cantos
          </span>
        </div>

        <div>
          <strong>
            ${s.faltas}
          </strong>
          <br>
          <span style="opacity:.55">
            Faltas
          </span>
        </div>

        <div>
          <strong>
            ${s.amarelos}
          </strong>
          <br>
          <span style="opacity:.55">
            Amarelos
          </span>
        </div>

        <div>
          <strong>
            ${s.vermelhos}
          </strong>
          <br>
          <span style="opacity:.55">
            Vermelhos
          </span>
        </div>

        <div>
          <strong>
            ${e(
              p.golsFavor != null
                ? "OK"
                : "-"
            )}
          </strong>
          <br>
          <span style="opacity:.55">
            Dados
          </span>
        </div>
      </div>
    </div>
  `;
}

function blocoJogosTime(
  lado,
  nomeTime
) {
  const partidas =
    partidasFiltradasDoLado(lado);

  return painel(`
    ${tituloSecao(
      `Jogo a jogo • ${nomeTime}`,
      "Veja o valor registrado em cada partida da amostra"
    )}

    ${
      partidas.length
        ? partidas
            .map(linhaHistoricoTime)
            .join("")
        : `
          <div
            style="
              padding:18px;
              text-align:center;
              opacity:.65;
            "
          >
            Nenhuma partida encontrada com estes filtros.
          </div>
        `
    }
  `);
}

/* =========================================================
   ANÁLISE AUTOMÁTICA
========================================================= */

function renderAnaliseAutomatica() {
  if (!historicoAtual) {
    return painel(`
      ${tituloSecao(
        "Análise automática",
        "Histórico ainda indisponível."
      )}

      <div style="opacity:.65">
        Não há dados históricos suficientes para esta partida.
      </div>
    `);
  }

  return `
    ${painel(`
      ${tituloSecao(
        "Filtros da análise",
        "Escolha a amostra usada nos cálculos."
      )}

      ${controlesHistorico()}
    `)}

    ${blocoResumoTime(
      "casa",
      partidaAtual.home.name
    )}

    ${blocoTendenciasTime(
      "casa",
      partidaAtual.home.name
    )}

    ${blocoJogosTime(
      "casa",
      partidaAtual.home.name
    )}

    ${blocoResumoTime(
      "fora",
      partidaAtual.away.name
    )}

    ${blocoTendenciasTime(
      "fora",
      partidaAtual.away.name
    )}

    ${blocoJogosTime(
      "fora",
      partidaAtual.away.name
    )}
  `;
}
  /* =========================================================
   ESCALAÇÕES
========================================================= */

function normalizarLineupTime(item = {}) {
  const team =
    item.team || {};

  const coach =
    item.coach || {};

  const formation =
    item.formation || "-";

  const titulares =
    safeArray(
      item.startXI ||
      item.startingXI ||
      item.titulares
    ).map(x => {
      const p =
        x.player || x;

      return {
        id: p.id,
        nome:
          p.name ||
          p.nome ||
          "Jogador",

        numero:
          p.number ??
          p.numero ??
          "-",

        posicao:
          p.pos ||
          p.position ||
          p.posicao ||
          "",

        grid:
          p.grid ||
          x.grid ||
          "",

        foto:
          p.photo ||
          p.foto ||
          (p.id
            ? `${API}/logo/player/${p.id}`
            : "")
      };
    });

  const reservas =
    safeArray(
      item.substitutes ||
      item.reservas
    ).map(x => {
      const p =
        x.player || x;

      return {
        id: p.id,

        nome:
          p.name ||
          p.nome ||
          "Jogador",

        numero:
          p.number ??
          p.numero ??
          "-",

        posicao:
          p.pos ||
          p.position ||
          p.posicao ||
          "",

        foto:
          p.photo ||
          p.foto ||
          (p.id
            ? `${API}/logo/player/${p.id}`
            : "")
      };
    });

  return {
    teamId:
      team.id,

    teamName:
      team.name ||
      "Equipe",

    teamLogo:
      team.logo ||
      logoTime(team.id),

    formation,

    coach: {
      id:
        coach.id,

      name:
        coach.name ||
        "-",

      photo:
        coach.photo ||
        ""
    },

    titulares,
    reservas
  };
}

function lineupsNormalizados() {
  const bruto =
    safeArray(
      partidaAtual?.lineups
    );

  return bruto.map(
    normalizarLineupTime
  );
}

/* =========================================================
   POSIÇÃO NO CAMPO
========================================================= */

function gridJogador(grid) {
  if (!grid) {
    return null;
  }

  const partes =
    String(grid)
      .split(":")
      .map(Number);

  if (
    partes.length !== 2 ||
    !Number.isFinite(partes[0]) ||
    !Number.isFinite(partes[1])
  ) {
    return null;
  }

  return {
    linha: partes[0],
    coluna: partes[1]
  };
}

function agruparJogadoresPorLinha(jogadores) {
  const mapa =
    new Map();

  safeArray(jogadores)
    .forEach(j => {
      const grid =
        gridJogador(j.grid);

      const linha =
        grid?.linha || 99;

      if (!mapa.has(linha)) {
        mapa.set(
          linha,
          []
        );
      }

      mapa
        .get(linha)
        .push({
          ...j,
          coluna:
            grid?.coluna || 99
        });
    });

  return [...mapa.entries()]
    .sort(
      (a, b) =>
        a[0] - b[0]
    )
    .map(
      ([linha, jogadoresLinha]) => ({
        linha,

        jogadores:
          jogadoresLinha.sort(
            (a, b) =>
              a.coluna -
              b.coluna
          )
      })
    );
}

/* =========================================================
   JOGADOR NO CAMPO
========================================================= */

function jogadorCampo(j) {
  const foto =
    fotoJogador(j);

  return `
    <button
      onclick="abrirJogador(${Number(j.id)})"
      style="
        width:72px;
        border:0;
        background:transparent;
        color:#fff;
        padding:2px;
        cursor:pointer;
      "
    >

      <div
        style="
          position:relative;
          width:48px;
          height:48px;
          margin:auto;
        "
      >
        ${
          foto
            ? `
              <img
                src="${e(foto)}"
                onerror="
                  this.style.display='none';
                  this.nextElementSibling.style.display='flex';
                "
                style="
                  width:48px;
                  height:48px;
                  border-radius:50%;
                  object-fit:cover;
                  border:2px solid rgba(255,255,255,.9);
                  background:#18231e;
                "
              >
            `
            : ""
        }

        <div
          style="
            ${
              foto
                ? "display:none;"
                : "display:flex;"
            }
            width:48px;
            height:48px;
            border-radius:50%;
            align-items:center;
            justify-content:center;
            background:#18231e;
            border:2px solid rgba(255,255,255,.9);
            font-size:16px;
            font-weight:950;
          "
        >
          ${e(j.numero)}
        </div>

        <span
          style="
            position:absolute;
            right:-4px;
            bottom:-3px;
            min-width:20px;
            height:20px;
            padding:0 3px;
            border-radius:10px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#0c1712;
            border:1px solid #2ee58b;
            color:#2ee58b;
            font-size:10px;
            font-weight:950;
          "
        >
          ${e(j.numero)}
        </span>
      </div>

      <div
        style="
          margin-top:5px;
          font-size:10px;
          line-height:1.15;
          font-weight:900;
          overflow:hidden;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
        "
      >
        ${e(j.nome)}
      </div>

    </button>
  `;
}

/* =========================================================
   CAMPO DE FUTEBOL
========================================================= */

function campoEscalacao(lineup) {
  const linhas =
    agruparJogadoresPorLinha(
      lineup.titulares
    );

  return `
    <div
      style="
        position:relative;
        overflow:hidden;
        border-radius:18px;
        padding:16px 5px;
        min-height:520px;
        background:
          linear-gradient(
            rgba(8,70,43,.94),
            rgba(6,55,34,.96)
          );
        border:2px solid rgba(255,255,255,.28);
      "
    >

      <div
        style="
          position:absolute;
          inset:10px;
          border:1px solid rgba(255,255,255,.45);
          pointer-events:none;
        "
      ></div>

      <div
        style="
          position:absolute;
          left:10px;
          right:10px;
          top:50%;
          border-top:1px solid rgba(255,255,255,.45);
          pointer-events:none;
        "
      ></div>

      <div
        style="
          position:absolute;
          width:76px;
          height:76px;
          border:1px solid rgba(255,255,255,.45);
          border-radius:50%;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          pointer-events:none;
        "
      ></div>

      <div
        style="
          position:relative;
          z-index:2;
          display:flex;
          flex-direction:column;
          justify-content:space-around;
          min-height:485px;
        "
      >
        ${
          linhas.map(linha => `
            <div
              style="
                display:flex;
                justify-content:space-around;
                align-items:flex-start;
                gap:2px;
              "
            >
              ${
                linha.jogadores
                  .map(jogadorCampo)
                  .join("")
              }
            </div>
          `).join("")
        }
      </div>

    </div>
  `;
}

/* =========================================================
   RESERVAS
========================================================= */

function cardReserva(j) {
  const foto =
    fotoJogador(j);

  return `
    <div
      onclick="abrirJogador(${Number(j.id)})"
      style="
        display:grid;
        grid-template-columns:42px 1fr auto;
        gap:10px;
        align-items:center;
        padding:10px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
        cursor:pointer;
      "
    >
      ${
        foto
          ? `
            <img
              src="${e(foto)}"
              onerror="this.style.display='none'"
              style="
                width:42px;
                height:42px;
                border-radius:50%;
                object-fit:cover;
              "
            >
          `
          : `
            <div
              style="
                width:42px;
                height:42px;
                border-radius:50%;
                display:flex;
                align-items:center;
                justify-content:center;
                background:rgba(255,255,255,.06);
                font-weight:950;
              "
            >
              ${e(j.numero)}
            </div>
          `
      }

      <div>
        <div style="font-weight:900">
          ${e(j.nome)}
        </div>

        <div
          style="
            margin-top:3px;
            font-size:11px;
            opacity:.55;
          "
        >
          ${e(j.posicao || "Jogador")}
        </div>
      </div>

      <div
        style="
          font-size:12px;
          font-weight:900;
          color:#2ee58b;
        "
      >
        #${e(j.numero)}
      </div>
    </div>
  `;
}

/* =========================================================
   BLOCO DE UMA EQUIPE NA ESCALAÇÃO
========================================================= */

function blocoEscalacaoTime(lineup) {
  return `
    ${painel(`
      <div
        style="
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:14px;
        "
      >
        ${
          lineup.teamLogo
            ? `
              <img
                src="${e(lineup.teamLogo)}"
                onerror="this.style.display='none'"
                style="
                  width:38px;
                  height:38px;
                  object-fit:contain;
                "
              >
            `
            : ""
        }

        <div>
          <div
            style="
              font-size:17px;
              font-weight:950;
            "
          >
            ${e(lineup.teamName)}
          </div>

          <div
            style="
              margin-top:2px;
              font-size:11px;
              opacity:.6;
            "
          >
            Formação:
            ${e(lineup.formation)}
          </div>
        </div>

        <div
          style="
            margin-left:auto;
            padding:6px 8px;
            border-radius:8px;
            background:rgba(46,229,139,.1);
            color:#2ee58b;
            font-size:10px;
            font-weight:950;
          "
        >
          CONFIRMADA
        </div>
      </div>

      ${campoEscalacao(lineup)}
    `)}

    ${painel(`
      ${tituloSecao(
        `Banco • ${lineup.teamName}`,
        lineup.coach?.name &&
        lineup.coach.name !== "-"
          ? `Técnico: ${lineup.coach.name}`
          : ""
      )}

      ${
        lineup.reservas.length
          ? lineup.reservas
              .map(cardReserva)
              .join("")
          : `
            <div style="opacity:.6">
              Reservas ainda não disponíveis.
            </div>
          `
      }
    `)}
  `;
}

/* =========================================================
   ABA ESCALAÇÕES
========================================================= */

function renderEscalacoes() {
  const lineups =
    lineupsNormalizados();

  if (!lineups.length) {
    return painel(`
      ${tituloSecao(
        "Escalações",
        "A escalação aparecerá quando estiver disponível pela competição."
      )}

      <div
        style="
          padding:20px;
          text-align:center;
          border-radius:12px;
          background:rgba(255,255,255,.035);
        "
      >
        <strong>
          Escalações ainda não confirmadas
        </strong>

        <div
          style="
            margin-top:7px;
            font-size:12px;
            opacity:.6;
            line-height:1.5;
          "
        >
          Quando a API disponibilizar os titulares,
          o campo será preenchido automaticamente.
        </div>
      </div>
    `);
  }

  return `
    ${painel(`
      <div
        style="
          text-align:center;
          color:#2ee58b;
          font-size:12px;
          font-weight:950;
        "
      >
        ✓ ESCALAÇÕES CONFIRMADAS
      </div>

      <div
        style="
          margin-top:5px;
          text-align:center;
          font-size:11px;
          opacity:.55;
        "
      >
        Toque em qualquer jogador para abrir sua análise.
      </div>
    `)}

    ${
      lineups
        .map(blocoEscalacaoTime)
        .join("")
    }
  `;
}
  /* =========================================================
   FICHA INDIVIDUAL DO JOGADOR
========================================================= */

let jogadorSelecionado = null;

let filtroJogador = {
  quantidade: 10,
  local: "geral",
  campeonato: "todos"
};

function todosJogadoresHistoricos() {
  const lados = ["casa", "fora"];
  const resultado = [];

  lados.forEach(lado => {
    const h = historicoAtual?.[lado];

    const blocos = [
      h?.ultimas5?.jogadores,
      h?.ultimas10?.jogadores
    ];

    blocos.forEach(lista => {
      safeArray(lista).forEach(p => {
        resultado.push({
          ...p,
          lado
        });
      });
    });
  });

  return resultado;
}

function acharJogadorHistorico(id) {
  return todosJogadoresHistoricos()
    .find(
      p =>
        String(p.id) ===
        String(id)
    );
}

function acharJogadorAtual(id) {
  const grupos =
    safeArray(
      partidaAtual?.jogadores
    );

  for (const grupo of grupos) {
    const jogadores =
      safeArray(
        grupo.players ||
        grupo.jogadores
      );

    for (const item of jogadores) {
      const p =
        item.player || item;

      if (
        String(p.id) ===
        String(id)
      ) {
        return {
          ...p,
          estatisticas:
            item.statistics ||
            item.estatisticas ||
            []
        };
      }
    }
  }

  return null;
}

function abrirJogador(id) {
  const historico =
    acharJogadorHistorico(id);

  const atual =
    acharJogadorAtual(id);

  jogadorSelecionado = {
    id,

    nome:
      atual?.name ||
      atual?.nome ||
      historico?.nome ||
      historico?.name ||
      "Jogador",

    foto:
      atual?.photo ||
      atual?.foto ||
      historico?.foto ||
      historico?.photo ||
      `${API}/logo/player/${id}`,

    numero:
      atual?.number ??
      atual?.numero ??
      historico?.numero ??
      "-",

    posicao:
      atual?.position ||
      atual?.posicao ||
      historico?.posicao ||
      ""
  };

  renderPaginaJogador();
}

/* =========================================================
   PARTIDAS DO JOGADOR
========================================================= */

function partidasComJogador(id) {
  const lados = [
    {
      nome: "casa",
      dados: historicoAtual?.casa
    },
    {
      nome: "fora",
      dados: historicoAtual?.fora
    }
  ];

  const encontrados = [];

  lados.forEach(lado => {
    const partidas =
      safeArray(
        lado.dados?.ultimas10?.partidas
      );

    partidas.forEach(partida => {
      const jogadores =
        safeArray(
          partida.jogadores
        );

      const jogador =
        jogadores.find(
          j =>
            String(j.id) ===
            String(id)
        );

      if (jogador) {
        encontrados.push({
          partida,
          jogador,
          lado:
            lado.nome
        });
      }
    });
  });

  const unicos =
    new Map();

  encontrados.forEach(item => {
    const chave =
      item.partida.fixtureId ||
      item.partida.id ||
      `${item.partida.data}-${item.partida.adversario?.id || item.partida.adversario}`;

    if (!unicos.has(chave)) {
      unicos.set(
        chave,
        item
      );
    }
  });

  return [...unicos.values()]
    .sort(
      (a, b) =>
        new Date(b.partida.data || 0) -
        new Date(a.partida.data || 0)
    );
}

function filtrarPartidasJogador(id) {
  let lista =
    partidasComJogador(id);

  if (
    filtroJogador.quantidade === 5
  ) {
    lista =
      lista.slice(0, 5);
  } else {
    lista =
      lista.slice(0, 10);
  }

  if (
    filtroJogador.local === "casa"
  ) {
    lista =
      lista.filter(
        x =>
          partidaEhCasa(
            x.partida
          )
      );
  }

  if (
    filtroJogador.local === "fora"
  ) {
    lista =
      lista.filter(
        x =>
          partidaEhFora(
            x.partida
          )
      );
  }

  if (
    filtroJogador.campeonato !==
    "todos"
  ) {
    lista =
      lista.filter(
        x =>
          String(
            idLigaHistorica(
              x.partida
            )
          ) ===
          String(
            filtroJogador.campeonato
          )
      );
  }

  return lista;
}

/* =========================================================
   ESTATÍSTICAS DO JOGADOR
========================================================= */

function estatisticaJogador(j = {}) {
  return {
    minutos:
      n(j.minutos),

    nota:
      n(j.nota),

    chutes:
      n(j.chutes),

    chutesGol:
      n(
        j.chutesGol ??
        j.chutesNoGol
      ),

    gols:
      n(j.gols),

    assistencias:
      n(j.assistencias),

    passes:
      n(j.passes),

    passesChave:
      n(j.passesChave),

    faltasCometidas:
      n(
        j.faltasCometidas
      ),

    faltasSofridas:
      n(
        j.faltasSofridas
      ),

    desarmes:
      n(j.desarmes),

    amarelos:
      n(j.amarelos),

    vermelhos:
      n(j.vermelhos)
  };
}

function resumoJogador(lista) {
  const itens =
    safeArray(lista);

  const total = {
    minutos: 0,
    nota: 0,
    chutes: 0,
    chutesGol: 0,
    gols: 0,
    assistencias: 0,
    passes: 0,
    passesChave: 0,
    faltasCometidas: 0,
    faltasSofridas: 0,
    desarmes: 0,
    amarelos: 0,
    vermelhos: 0
  };

  itens.forEach(item => {
    const s =
      estatisticaJogador(
        item.jogador
      );

    Object.keys(total)
      .forEach(campo => {
        total[campo] +=
          n(s[campo]);
      });
  });

  const quantidade =
    itens.length;

  const medias = {};

  Object.keys(total)
    .forEach(campo => {
      medias[campo] =
        quantidade
          ? total[campo] /
            quantidade
          : 0;
    });

  return {
    quantidade,
    total,
    medias
  };
}

function miniCardJogador(
  titulo,
  mediaValor,
  totalValor
) {
  return `
    <div
      style="
        padding:11px 8px;
        border-radius:12px;
        background:rgba(255,255,255,.045);
        text-align:center;
      "
    >
      <div
        style="
          font-size:10px;
          opacity:.6;
          font-weight:800;
        "
      >
        ${e(titulo)}
      </div>

      <div
        style="
          margin-top:6px;
          font-size:19px;
          font-weight:950;
        "
      >
        ${n(mediaValor).toFixed(1)}
      </div>

      <div
        style="
          margin-top:3px;
          font-size:9px;
          opacity:.5;
        "
      >
        Total ${n(totalValor).toFixed(0)}
      </div>
    </div>
  `;
}

/* =========================================================
   FILTROS DO JOGADOR
========================================================= */

function mudarFiltroJogadorQuantidade(q) {
  filtroJogador.quantidade =
    Number(q) === 5
      ? 5
      : 10;

  renderPaginaJogador();
}

function mudarFiltroJogadorLocal(local) {
  filtroJogador.local =
    local;

  renderPaginaJogador();
}

function mudarFiltroJogadorCampeonato(valor) {
  filtroJogador.campeonato =
    valor || "todos";

  renderPaginaJogador();
}

function campeonatosJogador(id) {
  const mapa =
    new Map();

  partidasComJogador(id)
    .forEach(item => {
      const p =
        item.partida;

      const ligaId =
        idLigaHistorica(p);

      const nome =
        nomeLigaHistorica(p);

      if (
        ligaId != null &&
        !mapa.has(
          String(ligaId)
        )
      ) {
        mapa.set(
          String(ligaId),
          {
            id: ligaId,
            nome
          }
        );
      }
    });

  return [...mapa.values()];
}

function controlesJogador(id) {
  const campeonatos =
    campeonatosJogador(id);

  return `
    <div
      style="
        display:flex;
        flex-direction:column;
        gap:9px;
      "
    >
      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
        "
      >
        ${botao(
          "Últimos 5",
          "mudarFiltroJogadorQuantidade(5)",
          filtroJogador.quantidade === 5
        )}

        ${botao(
          "Últimos 10",
          "mudarFiltroJogadorQuantidade(10)",
          filtroJogador.quantidade === 10
        )}
      </div>

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
        "
      >
        ${botao(
          "Geral",
          "mudarFiltroJogadorLocal('geral')",
          filtroJogador.local === "geral"
        )}

        ${botao(
          "Casa",
          "mudarFiltroJogadorLocal('casa')",
          filtroJogador.local === "casa"
        )}

        ${botao(
          "Fora",
          "mudarFiltroJogadorLocal('fora')",
          filtroJogador.local === "fora"
        )}
      </div>

      <select
        onchange="mudarFiltroJogadorCampeonato(this.value)"
        style="
          width:100%;
          border:1px solid rgba(255,255,255,.12);
          border-radius:11px;
          background:#101820;
          color:#fff;
          padding:11px;
          font-weight:800;
        "
      >
        <option value="todos">
          Todos os campeonatos
        </option>

        ${
          campeonatos
            .map(c => `
              <option
                value="${e(c.id)}"
                ${
                  String(
                    filtroJogador.campeonato
                  ) ===
                  String(c.id)
                    ? "selected"
                    : ""
                }
              >
                ${e(c.nome)}
              </option>
            `)
            .join("")
        }
      </select>
    </div>
  `;
}
  /* =========================================================
   TENDÊNCIAS DO JOGADOR
========================================================= */

function gerarTendenciasJogador(lista) {
  const itens = safeArray(lista);

  if (!itens.length) return [];

  const mercados = [
    {
      nome: "Chutes",
      getter: x =>
        estatisticaJogador(x.jogador).chutes,
      linhas: [0.5, 1.5, 2.5, 3.5, 4.5]
    },
    {
      nome: "Chutes no alvo",
      getter: x =>
        estatisticaJogador(x.jogador).chutesGol,
      linhas: [0.5, 1.5, 2.5, 3.5]
    },
    {
      nome: "Faltas cometidas",
      getter: x =>
        estatisticaJogador(x.jogador).faltasCometidas,
      linhas: [0.5, 1.5, 2.5, 3.5]
    },
    {
      nome: "Faltas sofridas",
      getter: x =>
        estatisticaJogador(x.jogador).faltasSofridas,
      linhas: [0.5, 1.5, 2.5, 3.5]
    },
    {
      nome: "Desarmes",
      getter: x =>
        estatisticaJogador(x.jogador).desarmes,
      linhas: [0.5, 1.5, 2.5, 3.5, 4.5]
    },
    {
      nome: "Passes-chave",
      getter: x =>
        estatisticaJogador(x.jogador).passesChave,
      linhas: [0.5, 1.5, 2.5]
    }
  ];

  const saida = [];

  mercados.forEach(mercado => {
    mercado.linhas.forEach(linha => {
      const valores =
        itens.map(mercado.getter);

      const acertos =
        valores.filter(
          v => n(v) > linha
        ).length;

      const percentual =
        pct(acertos, valores.length);

      if (
        percentual >=
        CONFIG.frequenciaMinima
      ) {
        const mediaValor =
          valores.reduce(
            (a, b) => a + n(b),
            0
          ) / valores.length;

        saida.push({
          mercado: mercado.nome,
          linha,
          acertos,
          total: valores.length,
          percentual,
          media: mediaValor
        });
      }
    });
  });

  return saida.sort(
    (a, b) =>
      b.percentual - a.percentual ||
      b.total - a.total ||
      b.linha - a.linha
  );
}

/* =========================================================
   JOGO A JOGO DO JOGADOR
========================================================= */

function linhaPartidaJogador(item) {
  const p = item.partida;
  const j = item.jogador;
  const s = estatisticaJogador(j);

  return `
    <div
      style="
        padding:13px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:10px;
        "
      >
        <div>
          <strong>
            ${e(
              p.adversario?.name ||
              p.adversario ||
              "Adversário"
            )}
          </strong>

          <div
            style="
              margin-top:3px;
              font-size:10px;
              opacity:.55;
            "
          >
            ${e(dataCurta(p.data))}
            • ${e(nomeLigaHistorica(p))}
            • ${
              partidaEhCasa(p)
                ? "Casa"
                : partidaEhFora(p)
                  ? "Fora"
                  : "Geral"
            }
          </div>
        </div>

        <div
          style="
            font-size:12px;
            text-align:right;
          "
        >
          <strong>
            ${s.minutos}'
          </strong>

          <div
            style="
              margin-top:3px;
              opacity:.55;
              font-size:10px;
            "
          >
            Nota ${
              s.nota
                ? s.nota.toFixed(1)
                : "-"
            }
          </div>
        </div>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:7px;
          margin-top:11px;
        "
      >
        ${miniValorJogo("Chutes", s.chutes)}
        ${miniValorJogo("No alvo", s.chutesGol)}
        ${miniValorJogo("Desarmes", s.desarmes)}

        ${miniValorJogo(
          "Faltas feitas",
          s.faltasCometidas
        )}

        ${miniValorJogo(
          "Faltas sofridas",
          s.faltasSofridas
        )}

        ${miniValorJogo(
          "Passes-chave",
          s.passesChave
        )}

        ${miniValorJogo("Passes", s.passes)}
        ${miniValorJogo("Gols", s.gols)}
        ${miniValorJogo("Assist.", s.assistencias)}
      </div>
    </div>
  `;
}

function miniValorJogo(nome, v) {
  return `
    <div
      style="
        padding:8px 5px;
        border-radius:9px;
        background:rgba(255,255,255,.035);
        text-align:center;
      "
    >
      <strong>
        ${n(v).toFixed(0)}
      </strong>

      <div
        style="
          margin-top:2px;
          font-size:9px;
          opacity:.55;
        "
      >
        ${e(nome)}
      </div>
    </div>
  `;
}

/* =========================================================
   TELA COMPLETA DO JOGADOR
========================================================= */

function renderPaginaJogador() {
  const p = jogadorSelecionado;

  if (!p) {
    renderPaginaPartida();
    return;
  }

  const partidas =
    filtrarPartidasJogador(p.id);

  const resumo =
    resumoJogador(partidas);

  const tendencias =
    gerarTendenciasJogador(partidas);

  const foto =
    fotoJogador(p);

  document.body.innerHTML = `
    <main
      style="
        width:min(100% - 20px,800px);
        margin:auto;
        padding:12px 0 30px;
      "
    >
      <button
        onclick="renderPaginaPartida()"
        style="
          border:0;
          padding:11px 14px;
          border-radius:11px;
          background:rgba(255,255,255,.07);
          color:#fff;
          font-weight:900;
          margin-bottom:12px;
        "
      >
        ← Voltar para partida
      </button>

      ${painel(`
        <div
          style="
            display:flex;
            align-items:center;
            gap:14px;
          "
        >
          ${
            foto
              ? `
                <img
                  src="${e(foto)}"
                  onerror="this.style.display='none'"
                  style="
                    width:72px;
                    height:72px;
                    border-radius:50%;
                    object-fit:cover;
                    background:rgba(255,255,255,.05);
                  "
                >
              `
              : ""
          }

          <div>
            <div
              style="
                font-size:21px;
                font-weight:950;
              "
            >
              ${e(p.nome)}
            </div>

            <div
              style="
                margin-top:5px;
                font-size:12px;
                opacity:.65;
              "
            >
              ${
                p.numero !== "-"
                  ? `Camisa ${e(p.numero)} • `
                  : ""
              }
              ${e(p.posicao || "Jogador")}
            </div>

            <div
              style="
                margin-top:5px;
                color:#2ee58b;
                font-size:11px;
                font-weight:900;
              "
            >
              ANÁLISE INDIVIDUAL
            </div>
          </div>
        </div>
      `)}

      ${painel(`
        ${tituloSecao(
          "Filtros",
          "Altere a amostra da análise individual."
        )}

        ${controlesJogador(p.id)}
      `)}

      ${painel(`
        ${tituloSecao(
          "Médias por partida",
          `${resumo.quantidade} partida(s) encontradas`
        )}

        <div
          style="
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:8px;
          "
        >
          ${miniCardJogador(
            "Chutes",
            resumo.medias.chutes,
            resumo.total.chutes
          )}

          ${miniCardJogador(
            "Chutes no alvo",
            resumo.medias.chutesGol,
            resumo.total.chutesGol
          )}

          ${miniCardJogador(
            "Faltas cometidas",
            resumo.medias.faltasCometidas,
            resumo.total.faltasCometidas
          )}

          ${miniCardJogador(
            "Faltas sofridas",
            resumo.medias.faltasSofridas,
            resumo.total.faltasSofridas
          )}

          ${miniCardJogador(
            "Desarmes",
            resumo.medias.desarmes,
            resumo.total.desarmes
          )}

          ${miniCardJogador(
            "Passes",
            resumo.medias.passes,
            resumo.total.passes
          )}

          ${miniCardJogador(
            "Passes-chave",
            resumo.medias.passesChave,
            resumo.total.passesChave
          )}

          ${miniCardJogador(
            "Minutos",
            resumo.medias.minutos,
            resumo.total.minutos
          )}

          ${miniCardJogador(
            "Gols",
            resumo.medias.gols,
            resumo.total.gols
          )}

          ${miniCardJogador(
            "Assistências",
            resumo.medias.assistencias,
            resumo.total.assistencias
          )}

          ${miniCardJogador(
            "Amarelos",
            resumo.medias.amarelos,
            resumo.total.amarelos
          )}

          ${miniCardJogador(
            "Nota",
            resumo.medias.nota,
            resumo.total.nota
          )}
        </div>
      `)}

      ${painel(`
        ${tituloSecao(
          "Tendências do jogador",
          `Somente frequências históricas ≥ ${CONFIG.frequenciaMinima}%`
        )}

        ${
          tendencias.length
            ? tendencias
                .slice(0, 15)
                .map(t => `
                  <div
                    style="
                      padding:11px 0;
                      border-bottom:1px solid rgba(255,255,255,.07);
                    "
                  >
                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        gap:10px;
                      "
                    >
                      <strong>
                        ${e(t.mercado)}
                        • Mais de ${e(t.linha)}
                      </strong>

                      <strong style="color:#2ee58b">
                        ${t.percentual}%
                      </strong>
                    </div>

                    <div
                      style="
                        margin-top:4px;
                        font-size:11px;
                        opacity:.6;
                      "
                    >
                      ${t.acertos}/${t.total}
                      partidas • média
                      ${n(t.media).toFixed(1)}
                    </div>
                  </div>
                `)
                .join("")
            : `
              <div
                style="
                  padding:16px;
                  text-align:center;
                  opacity:.65;
                "
              >
                Nenhuma tendência ≥
                ${CONFIG.frequenciaMinima}%
                nesta amostra.
              </div>
            `
        }

        <div
          style="
            margin-top:12px;
            font-size:10px;
            opacity:.5;
            line-height:1.5;
          "
        >
          Frequência histórica não é garantia de que
          o mesmo evento ocorrerá na próxima partida.
        </div>
      `)}

      ${painel(`
        ${tituloSecao(
          "Jogo a jogo",
          "Aqui conseguimos ver se a média é realmente regular."
        )}

        ${
          partidas.length
            ? partidas
                .map(linhaPartidaJogador)
                .join("")
            : `
              <div
                style="
                  padding:18px;
                  text-align:center;
                  opacity:.65;
                "
              >
                Nenhum jogo encontrado com estes filtros.
              </div>
            `
        }
      `)}
    </main>
  `;
}
  /* =========================================================
   ABA JOGADORES — RANKINGS
========================================================= */

let filtroRankingJogadores = {
  lado: "casa",
  quantidade: 10,
  criterio: "chutes"
};

const CRITERIOS_RANKING = {
  chutes: {
    nome: "Chutes",
    campo: "chutes"
  },

  chutesGol: {
    nome: "No alvo",
    campo: "chutesGol"
  },

  faltasCometidas: {
    nome: "Faltas cometidas",
    campo: "faltasCometidas"
  },

  faltasSofridas: {
    nome: "Faltas sofridas",
    campo: "faltasSofridas"
  },

  desarmes: {
    nome: "Desarmes",
    campo: "desarmes"
  },

  passes: {
    nome: "Passes",
    campo: "passes"
  },

  passesChave: {
    nome: "Passes-chave",
    campo: "passesChave"
  },

  gols: {
    nome: "Gols",
    campo: "gols"
  },

  assistencias: {
    nome: "Assistências",
    campo: "assistencias"
  },

  minutos: {
    nome: "Minutos",
    campo: "minutos"
  },

  nota: {
    nome: "Avaliação",
    campo: "nota"
  }
};

function mudarRankingLado(lado) {
  filtroRankingJogadores.lado =
    lado;

  renderPaginaPartida();
}

function mudarRankingQuantidade(qtd) {
  filtroRankingJogadores.quantidade =
    Number(qtd) === 5
      ? 5
      : 10;

  renderPaginaPartida();
}

function mudarRankingCriterio(criterio) {
  if (
    CRITERIOS_RANKING[criterio]
  ) {
    filtroRankingJogadores.criterio =
      criterio;
  }

  renderPaginaPartida();
}

/* =========================================================
   AGREGA JOGADORES JOGO A JOGO
========================================================= */

function jogadoresAgregadosDoLado(lado) {
  const quantidade =
    filtroRankingJogadores.quantidade;

  const partidas =
    partidasHistoricoLado(
      lado,
      quantidade
    );

  const mapa =
    new Map();

  partidas.forEach(partida => {
    safeArray(
      partida.jogadores
    ).forEach(j => {

      const id =
        j.id;

      if (!id) return;

      if (!mapa.has(String(id))) {
        mapa.set(
          String(id),
          {
            id,

            nome:
              j.nome ||
              j.name ||
              "Jogador",

            foto:
              j.foto ||
              j.photo ||
              `${API}/logo/player/${id}`,

            numero:
              j.numero ??
              j.number ??
              "-",

            posicao:
              j.posicao ||
              j.position ||
              "",

            partidas: 0,

            total: {
              minutos: 0,
              nota: 0,
              chutes: 0,
              chutesGol: 0,
              gols: 0,
              assistencias: 0,
              passes: 0,
              passesChave: 0,
              faltasCometidas: 0,
              faltasSofridas: 0,
              desarmes: 0,
              amarelos: 0,
              vermelhos: 0
            }
          }
        );
      }

      const item =
        mapa.get(String(id));

      const s =
        estatisticaJogador(j);

      item.partidas++;

      Object.keys(item.total)
        .forEach(campo => {
          item.total[campo] +=
            n(s[campo]);
        });

      if (
        item.numero === "-" &&
        j.numero != null
      ) {
        item.numero =
          j.numero;
      }
    });
  });

  return [...mapa.values()]
    .map(j => {
      const medias = {};

      Object.keys(j.total)
        .forEach(campo => {
          medias[campo] =
            j.partidas
              ? j.total[campo] /
                j.partidas
              : 0;
        });

      return {
        ...j,
        medias
      };
    });
}

/* =========================================================
   CARD DO RANKING
========================================================= */

function cardRankingJogador(
  jogador,
  posicao
) {
  const criterio =
    CRITERIOS_RANKING[
      filtroRankingJogadores.criterio
    ];

  const campo =
    criterio.campo;

  const mediaValor =
    n(
      jogador.medias?.[campo]
    );

  const totalValor =
    n(
      jogador.total?.[campo]
    );

  const foto =
    fotoJogador(jogador);

  return `
    <div
      onclick="abrirJogador(${Number(jogador.id)})"
      style="
        position:relative;
        padding:13px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:14px;
        background:rgba(255,255,255,.03);
        cursor:pointer;
      "
    >

      <div
        style="
          position:absolute;
          top:10px;
          left:10px;
          width:32px;
          height:32px;
          border-radius:10px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:rgba(46,229,139,.12);
          color:#2ee58b;
          font-weight:950;
        "
      >
        ${posicao}
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:52px 1fr;
          gap:10px;
          align-items:center;
          margin-left:42px;
        "
      >
        ${
          foto
            ? `
              <img
                src="${e(foto)}"
                onerror="this.style.display='none'"
                style="
                  width:52px;
                  height:52px;
                  border-radius:50%;
                  object-fit:cover;
                  background:rgba(255,255,255,.05);
                "
              >
            `
            : `
              <div
                style="
                  width:52px;
                  height:52px;
                  border-radius:50%;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  background:rgba(255,255,255,.06);
                  font-weight:950;
                "
              >
                ${e(jogador.numero)}
              </div>
            `
        }

        <div style="min-width:0">

          <div
            style="
              font-weight:950;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            "
          >
            ${e(jogador.nome)}
          </div>

          ${
            jogador.numero !== "-"
              ? `
                <div
                  style="
                    margin-top:2px;
                    font-size:10px;
                    opacity:.6;
                  "
                >
                  Camisa ${e(jogador.numero)}
                </div>
              `
              : ""
          }

          <div
            style="
              margin-top:3px;
              font-size:10px;
              opacity:.55;
            "
          >
            ${jogador.partidas}
            partida(s)
          </div>

        </div>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:7px;
          margin-top:12px;
        "
      >

        <div
          style="
            padding:9px;
            border-radius:10px;
            background:rgba(46,229,139,.07);
            text-align:center;
          "
        >
          <div
            style="
              font-size:9px;
              opacity:.6;
            "
          >
            MÉDIA
          </div>

          <strong
            style="
              display:block;
              margin-top:4px;
              color:#2ee58b;
              font-size:18px;
            "
          >
            ${mediaValor.toFixed(1)}
          </strong>
        </div>

        <div
          style="
            padding:9px;
            border-radius:10px;
            background:rgba(255,255,255,.04);
            text-align:center;
          "
        >
          <div
            style="
              font-size:9px;
              opacity:.6;
            "
          >
            TOTAL
          </div>

          <strong
            style="
              display:block;
              margin-top:4px;
              font-size:18px;
            "
          >
            ${totalValor.toFixed(
              campo === "nota"
                ? 1
                : 0
            )}
          </strong>
        </div>

      </div>

      <div
        style="
          margin-top:9px;
          text-align:right;
          color:#2ee58b;
          font-size:11px;
          font-weight:900;
        "
      >
        Ver análise ›
      </div>

    </div>
  `;
}

/* =========================================================
   RANKING ORDENADO
========================================================= */

function rankingJogadoresAtual() {
  const jogadores =
    jogadoresAgregadosDoLado(
      filtroRankingJogadores.lado
    );

  const criterio =
    CRITERIOS_RANKING[
      filtroRankingJogadores.criterio
    ];

  return jogadores.sort(
    (a, b) =>
      n(
        b.medias?.[
          criterio.campo
        ]
      ) -
      n(
        a.medias?.[
          criterio.campo
        ]
      )
  );
}

/* =========================================================
   ABA JOGADORES
========================================================= */

function renderJogadoresPartida() {
  const jogadores =
    rankingJogadoresAtual();

  const nomeTime =
    filtroRankingJogadores.lado ===
    "casa"
      ? partidaAtual.home.name
      : partidaAtual.away.name;

  return `
    ${painel(`
      ${tituloSecao(
        "Análise dos jogadores",
        "Ranking por média na amostra selecionada"
      )}

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
          margin-bottom:10px;
        "
      >
        ${botao(
          partidaAtual.home.name,
          "mudarRankingLado('casa')",
          filtroRankingJogadores.lado ===
          "casa"
        )}

        ${botao(
          partidaAtual.away.name,
          "mudarRankingLado('fora')",
          filtroRankingJogadores.lado ===
          "fora"
        )}
      </div>

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
          margin-bottom:10px;
        "
      >
        ${botao(
          "Últimos 5",
          "mudarRankingQuantidade(5)",
          filtroRankingJogadores.quantidade ===
          5
        )}

        ${botao(
          "Últimos 10",
          "mudarRankingQuantidade(10)",
          filtroRankingJogadores.quantidade ===
          10
        )}
      </div>

      <select
        onchange="mudarRankingCriterio(this.value)"
        style="
          width:100%;
          border:1px solid rgba(255,255,255,.12);
          border-radius:11px;
          background:#101820;
          color:#fff;
          padding:11px;
          font-weight:800;
        "
      >
        ${
          Object.entries(
            CRITERIOS_RANKING
          )
            .map(
              ([id, c]) => `
                <option
                  value="${e(id)}"
                  ${
                    filtroRankingJogadores.criterio ===
                    id
                      ? "selected"
                      : ""
                  }
                >
                  ${e(c.nome)}
                </option>
              `
            )
            .join("")
        }
      </select>
    `)}

    ${painel(`
      ${tituloSecao(
        nomeTime,
        `${jogadores.length} jogador(es) encontrados`
      )}

      ${
        jogadores.length
          ? `
            <div
              style="
                display:grid;
                grid-template-columns:repeat(
                  auto-fit,
                  minmax(240px,1fr)
                );
                gap:9px;
              "
            >
              ${
                jogadores
                  .map(
                    (j, i) =>
                      cardRankingJogador(
                        j,
                        i + 1
                      )
                  )
                  .join("")
              }
            </div>
          `
          : `
            <div
              style="
                padding:20px;
                text-align:center;
                opacity:.65;
              "
            >
              Nenhum jogador encontrado
              nesta amostra.
            </div>
          `
      }
    `)}
  `;
}
  /* =========================================================
   ESTATÍSTICAS DA PARTIDA
========================================================= */

function nomeEstatistica(tipo) {
  const nomes = {
    "Shots on Goal": "Chutes no alvo",
    "Shots off Goal": "Chutes para fora",
    "Total Shots": "Chutes",
    "Blocked Shots": "Chutes bloqueados",
    "Shots insidebox": "Chutes dentro da área",
    "Shots outsidebox": "Chutes fora da área",
    "Fouls": "Faltas",
    "Corner Kicks": "Escanteios",
    "Offsides": "Impedimentos",
    "Ball Possession": "Posse de bola",
    "Yellow Cards": "Cartões amarelos",
    "Red Cards": "Cartões vermelhos",
    "Goalkeeper Saves": "Defesas",
    "Total passes": "Passes",
    "Passes accurate": "Passes certos",
    "Passes %": "Precisão dos passes",
    "expected_goals": "xG",
    "goals_prevented": "Gols evitados"
  };

  return nomes[tipo] || tipo;
}

function valorEstatisticaTime(stats, tipo) {
  const item =
    safeArray(stats).find(
      x =>
        String(x.type).toLowerCase() ===
        String(tipo).toLowerCase()
    );

  return item?.value ?? "-";
}

function numeroEstatisticaVisual(v) {
  if (
    v === null ||
    v === undefined ||
    v === "-"
  ) {
    return 0;
  }

  const x =
    Number(
      String(v)
        .replace("%", "")
        .replace(",", ".")
    );

  return Number.isFinite(x)
    ? x
    : 0;
}

function linhaComparacaoEstatistica(
  nome,
  casa,
  fora
) {
  const nc =
    numeroEstatisticaVisual(casa);

  const nf =
    numeroEstatisticaVisual(fora);

  const total =
    nc + nf;

  const pc =
    total > 0
      ? (nc / total) * 100
      : 50;

  const pf =
    100 - pc;

  return `
    <div
      style="
        padding:12px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          display:grid;
          grid-template-columns:55px 1fr 55px;
          gap:8px;
          align-items:center;
        "
      >
        <strong style="text-align:left">
          ${e(casa)}
        </strong>

        <div
          style="
            text-align:center;
            font-size:11px;
            font-weight:800;
            opacity:.7;
          "
        >
          ${e(nome)}
        </div>

        <strong style="text-align:right">
          ${e(fora)}
        </strong>
      </div>

      <div
        style="
          display:flex;
          gap:3px;
          height:5px;
          margin-top:8px;
          overflow:hidden;
          border-radius:6px;
          background:rgba(255,255,255,.05);
        "
      >
        <div
          style="
            width:${pc}%;
            background:#2ee58b;
          "
        ></div>

        <div
          style="
            width:${pf}%;
            background:rgba(255,255,255,.32);
          "
        ></div>
      </div>
    </div>
  `;
}

function renderEstatisticasPartida() {
  const stats =
    safeArray(
      partidaAtual?.estatisticas
    );

  if (!stats.length) {
    return painel(`
      ${tituloSecao(
        "Estatísticas da partida",
        "Dados ainda não disponíveis."
      )}

      <div
        style="
          padding:18px;
          text-align:center;
          opacity:.65;
        "
      >
        As estatísticas aparecerão quando
        forem disponibilizadas pela competição.
      </div>
    `);
  }

  const casa =
    stats.find(
      x =>
        String(x.team?.id) ===
        String(partidaAtual.home.id)
    ) || stats[0];

  const fora =
    stats.find(
      x =>
        String(x.team?.id) ===
        String(partidaAtual.away.id)
    ) || stats[1];

  const sc =
    safeArray(
      casa?.statistics
    );

  const sf =
    safeArray(
      fora?.statistics
    );

  const tipos =
    [
      "expected_goals",
      "Total Shots",
      "Shots on Goal",
      "Shots off Goal",
      "Blocked Shots",
      "Shots insidebox",
      "Shots outsidebox",
      "Corner Kicks",
      "Fouls",
      "Yellow Cards",
      "Red Cards",
      "Offsides",
      "Ball Possession",
      "Goalkeeper Saves",
      "Total passes",
      "Passes accurate",
      "Passes %"
    ];

  return painel(`
    ${tituloSecao(
      "Estatísticas da partida",
      "Comparativo entre as equipes"
    )}

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-bottom:10px;
        text-align:center;
      "
    >
      <strong>
        ${e(partidaAtual.home.name)}
      </strong>

      <strong>
        ${e(partidaAtual.away.name)}
      </strong>
    </div>

    ${
      tipos
        .filter(tipo => {
          const a =
            valorEstatisticaTime(
              sc,
              tipo
            );

          const b =
            valorEstatisticaTime(
              sf,
              tipo
            );

          return !(
            a === "-" &&
            b === "-"
          );
        })
        .map(tipo =>
          linhaComparacaoEstatistica(
            nomeEstatistica(tipo),

            valorEstatisticaTime(
              sc,
              tipo
            ),

            valorEstatisticaTime(
              sf,
              tipo
            )
          )
        )
        .join("")
    }
  `);
}

/* =========================================================
   EVENTOS DA PARTIDA
========================================================= */

function iconeEvento(ev) {
  const tipo =
    String(
      ev.type || ""
    ).toLowerCase();

  const detalhe =
    String(
      ev.detail || ""
    ).toLowerCase();

  if (tipo === "goal") {
    return "⚽";
  }

  if (
    detalhe.includes("yellow")
  ) {
    return "🟨";
  }

  if (
    detalhe.includes("red")
  ) {
    return "🟥";
  }

  if (tipo === "subst") {
    return "↔";
  }

  if (tipo === "var") {
    return "VAR";
  }

  return "•";
}

function descricaoEvento(ev) {
  const tipo =
    String(
      ev.type || ""
    );

  const detalhe =
    String(
      ev.detail || ""
    );

  if (
    tipo.toLowerCase() ===
    "goal"
  ) {
    return detalhe ||
      "Gol";
  }

  if (
    tipo.toLowerCase() ===
    "subst"
  ) {
    return "Substituição";
  }

  return detalhe || tipo;
}

function linhaEvento(ev) {
  const minuto =
    ev.time?.elapsed ??
    ev.elapsed ??
    "-";

  const extra =
    ev.time?.extra;

  const jogador =
    ev.player?.name ||
    ev.jogador ||
    "";

  const assistencia =
    ev.assist?.name ||
    "";

  const time =
    ev.team?.name ||
    "";

  return `
    <div
      style="
        display:grid;
        grid-template-columns:42px 32px 1fr;
        gap:8px;
        align-items:flex-start;
        padding:11px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <strong
        style="
          color:#2ee58b;
          font-size:12px;
        "
      >
        ${e(minuto)}${
          extra
            ? `+${e(extra)}`
            : ""
        }'
      </strong>

      <div
        style="
          font-size:17px;
          text-align:center;
        "
      >
        ${iconeEvento(ev)}
      </div>

      <div>
        <div
          style="
            font-weight:900;
            font-size:13px;
          "
        >
          ${e(
            jogador ||
            descricaoEvento(ev)
          )}
        </div>

        <div
          style="
            margin-top:3px;
            font-size:10px;
            opacity:.6;
          "
        >
          ${e(time)}

          ${
            assistencia
              ? ` • Assistência: ${e(assistencia)}`
              : ""
          }
        </div>

        <div
          style="
            margin-top:2px;
            font-size:10px;
            opacity:.45;
          "
        >
          ${e(descricaoEvento(ev))}
        </div>
      </div>
    </div>
  `;
}

function renderEventosPartida() {
  const eventos =
    safeArray(
      partidaAtual?.eventos
    );

  return painel(`
    ${tituloSecao(
      "Eventos",
      "Linha do tempo da partida"
    )}

    ${
      eventos.length
        ? eventos
            .slice()
            .sort(
              (a, b) =>
                n(a.time?.elapsed) -
                n(b.time?.elapsed)
            )
            .map(linhaEvento)
            .join("")
        : `
          <div
            style="
              padding:20px;
              text-align:center;
              opacity:.65;
            "
          >
            Nenhum evento disponível
            para esta partida.
          </div>
        `
    }
  `);
}

/* =========================================================
   ODDS DA PARTIDA
========================================================= */

function extrairBookmakersOdds() {
  const origem =
    partidaAtual?.odds;

  const resposta =
    Array.isArray(origem)
      ? origem
      : safeArray(
          origem?.response ||
          origem?.dados
        );

  const bookmakers = [];

  resposta.forEach(item => {
    safeArray(
      item.bookmakers
    ).forEach(book => {
      bookmakers.push(book);
    });
  });

  return bookmakers;
}

function mercadosOdds() {
  const books =
    extrairBookmakersOdds();

  const mercados = [];

  books.forEach(book => {
    safeArray(book.bets)
      .forEach(bet => {
        mercados.push({
          bookmaker:
            book.name ||
            "Casa",

          bookmakerId:
            book.id,

          mercado:
            bet.name ||
            "Mercado",

          mercadoId:
            bet.id,

          valores:
            safeArray(
              bet.values
            )
        });
      });
  });

  return mercados;
}

function linhaMercadoOdd(m) {
  return `
    <div
      style="
        padding:13px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          margin-bottom:8px;
        "
      >
        <strong>
          ${e(m.mercado)}
        </strong>

        <span
          style="
            font-size:10px;
            opacity:.55;
          "
        >
          ${e(m.bookmaker)}
        </span>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(
            auto-fit,
            minmax(90px,1fr)
          );
          gap:6px;
        "
      >
        ${
          m.valores
            .map(v => `
              <div
                style="
                  padding:9px 6px;
                  border-radius:9px;
                  background:rgba(255,255,255,.045);
                  text-align:center;
                "
              >
                <div
                  style="
                    font-size:10px;
                    opacity:.6;
                  "
                >
                  ${e(v.value)}
                </div>

                <strong
                  style="
                    display:block;
                    margin-top:4px;
                    color:#2ee58b;
                  "
                >
                  ${formatarOdd(v.odd)}
                </strong>
              </div>
            `)
            .join("")
        }
      </div>
    </div>
  `;
}

function renderOddsPartida() {
  const mercados =
    mercadosOdds();

  return painel(`
    ${tituloSecao(
      "Odds",
      "Mercados disponíveis na fonte de dados"
    )}

    ${
      mercados.length
        ? mercados
            .slice(0, 40)
            .map(linhaMercadoOdd)
            .join("")
        : `
          <div
            style="
              padding:20px;
              text-align:center;
              border-radius:12px;
              background:rgba(255,255,255,.035);
            "
          >
            <strong>
              Odds ainda não disponíveis
            </strong>

            <div
              style="
                margin-top:7px;
                font-size:11px;
                opacity:.6;
                line-height:1.5;
              "
            >
              Não exibiremos uma odd fictícia.
              Quando o servidor retornar os mercados,
              eles aparecerão aqui automaticamente.
            </div>
          </div>
        `
    }
  `);
            }
  /* =========================================================
   PÁGINA INDIVIDUAL DO TIME
========================================================= */

let timeSelecionado = null;

let filtroTime = {
  quantidade: 10,
  local: "geral",
  campeonato: "todos"
};

function ladoDoTime(id) {
  if (
    String(partidaAtual?.home?.id) ===
    String(id)
  ) {
    return "casa";
  }

  if (
    String(partidaAtual?.away?.id) ===
    String(id)
  ) {
    return "fora";
  }

  return null;
}

function dadosTimeSelecionado(id) {
  const lado =
    ladoDoTime(id);

  if (!lado) {
    return null;
  }

  const atual =
    lado === "casa"
      ? partidaAtual.home
      : partidaAtual.away;

  return {
    id: atual.id,
    nome: atual.name,
    logo:
      atual.logo ||
      logoTime(atual.id),
    lado
  };
}

function abrirTime(id) {
  const time =
    dadosTimeSelecionado(id);

  if (!time) {
    return;
  }

  timeSelecionado =
    time;

  filtroTime = {
    quantidade: 10,
    local: "geral",
    campeonato: "todos"
  };

  renderPaginaTime();
}

/* =========================================================
   HISTÓRICO DO TIME SELECIONADO
========================================================= */

function historicoDoTimeSelecionado() {
  if (!timeSelecionado) {
    return null;
  }

  return historicoAtual?.[
    timeSelecionado.lado
  ] || null;
}

function todasPartidasTimeSelecionado() {
  const h =
    historicoDoTimeSelecionado();

  return safeArray(
    h?.ultimas10?.partidas
  );
}

function campeonatosTimeSelecionado() {
  const mapa =
    new Map();

  todasPartidasTimeSelecionado()
    .forEach(p => {
      const id =
        idLigaHistorica(p);

      const nome =
        nomeLigaHistorica(p);

      if (
        id != null &&
        !mapa.has(String(id))
      ) {
        mapa.set(
          String(id),
          {
            id,
            nome
          }
        );
      }
    });

  return [...mapa.values()];
}

function partidasFiltradasTime() {
  let lista =
    todasPartidasTimeSelecionado();

  if (
    filtroTime.quantidade === 5
  ) {
    lista =
      lista.slice(0, 5);
  } else {
    lista =
      lista.slice(0, 10);
  }

  if (
    filtroTime.local === "casa"
  ) {
    lista =
      lista.filter(
        partidaEhCasa
      );
  }

  if (
    filtroTime.local === "fora"
  ) {
    lista =
      lista.filter(
        partidaEhFora
      );
  }

  if (
    filtroTime.campeonato !==
    "todos"
  ) {
    lista =
      lista.filter(
        p =>
          String(
            idLigaHistorica(p)
          ) ===
          String(
            filtroTime.campeonato
          )
      );
  }

  return lista;
}

/* =========================================================
   FILTROS DO TIME
========================================================= */

function mudarFiltroTimeQuantidade(q) {
  filtroTime.quantidade =
    Number(q) === 5
      ? 5
      : 10;

  renderPaginaTime();
}

function mudarFiltroTimeLocal(local) {
  filtroTime.local =
    local;

  renderPaginaTime();
}

function mudarFiltroTimeCampeonato(id) {
  filtroTime.campeonato =
    id || "todos";

  renderPaginaTime();
}

function controlesTime() {
  const campeonatos =
    campeonatosTimeSelecionado();

  return `
    <div
      style="
        display:flex;
        flex-direction:column;
        gap:9px;
      "
    >

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
        "
      >
        ${botao(
          "Últimos 5",
          "mudarFiltroTimeQuantidade(5)",
          filtroTime.quantidade === 5
        )}

        ${botao(
          "Últimos 10",
          "mudarFiltroTimeQuantidade(10)",
          filtroTime.quantidade === 10
        )}
      </div>

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
        "
      >
        ${botao(
          "Geral",
          "mudarFiltroTimeLocal('geral')",
          filtroTime.local === "geral"
        )}

        ${botao(
          "Casa",
          "mudarFiltroTimeLocal('casa')",
          filtroTime.local === "casa"
        )}

        ${botao(
          "Fora",
          "mudarFiltroTimeLocal('fora')",
          filtroTime.local === "fora"
        )}
      </div>

      <select
        onchange="mudarFiltroTimeCampeonato(this.value)"
        style="
          width:100%;
          border:1px solid rgba(255,255,255,.12);
          border-radius:11px;
          background:#101820;
          color:#fff;
          padding:11px;
          font-weight:800;
        "
      >
        <option value="todos">
          Todos os campeonatos
        </option>

        ${
          campeonatos
            .map(c => `
              <option
                value="${e(c.id)}"
                ${
                  String(
                    filtroTime.campeonato
                  ) ===
                  String(c.id)
                    ? "selected"
                    : ""
                }
              >
                ${e(c.nome)}
              </option>
            `)
            .join("")
        }

      </select>

    </div>
  `;
}

/* =========================================================
   RESULTADOS DO TIME
========================================================= */

function resultadoPartidaTime(p) {
  const gf =
    numeroHistorico(
      p,
      ["golsFavor", "goalsFor"]
    );

  const gc =
    numeroHistorico(
      p,
      ["golsContra", "goalsAgainst"]
    );

  if (gf > gc) {
    return "V";
  }

  if (gf < gc) {
    return "D";
  }

  return "E";
}

function corResultadoTime(r) {
  if (r === "V") {
    return "#2ee58b";
  }

  if (r === "D") {
    return "#ff6262";
  }

  return "#f1c75b";
}

function resumoResultadosTime(partidas) {
  let vitorias = 0;
  let empates = 0;
  let derrotas = 0;

  safeArray(partidas)
    .forEach(p => {
      const r =
        resultadoPartidaTime(p);

      if (r === "V") {
        vitorias++;
      }

      if (r === "E") {
        empates++;
      }

      if (r === "D") {
        derrotas++;
      }
    });

  return {
    vitorias,
    empates,
    derrotas
  };
}

/* =========================================================
   JOGADORES DO TIME
========================================================= */

function jogadoresDoTimeFiltrado(partidas) {
  const mapa =
    new Map();

  safeArray(partidas)
    .forEach(partida => {
      safeArray(
        partida.jogadores
      ).forEach(j => {

        if (!j.id) {
          return;
        }

        const chave =
          String(j.id);

        if (!mapa.has(chave)) {
          mapa.set(
            chave,
            {
              id: j.id,

              nome:
                j.nome ||
                j.name ||
                "Jogador",

              foto:
                j.foto ||
                j.photo ||
                `${API}/logo/player/${j.id}`,

              numero:
                j.numero ??
                j.number ??
                "-",

              posicao:
                j.posicao ||
                j.position ||
                "",

              partidas: 0,

              total: {
                minutos: 0,
                nota: 0,
                chutes: 0,
                chutesGol: 0,
                gols: 0,
                assistencias: 0,
                passes: 0,
                passesChave: 0,
                faltasCometidas: 0,
                faltasSofridas: 0,
                desarmes: 0,
                amarelos: 0,
                vermelhos: 0
              }
            }
          );
        }

        const item =
          mapa.get(chave);

        const s =
          estatisticaJogador(j);

        item.partidas++;

        Object.keys(
          item.total
        ).forEach(campo => {
          item.total[campo] +=
            n(s[campo]);
        });
      });
    });

  return [...mapa.values()]
    .map(j => {
      const medias = {};

      Object.keys(
        j.total
      ).forEach(campo => {
        medias[campo] =
          j.partidas
            ? j.total[campo] /
              j.partidas
            : 0;
      });

      return {
        ...j,
        medias
      };
    });
}

/* =========================================================
   CABEÇALHO DA PÁGINA DO TIME
========================================================= */

function cabecalhoPaginaTime() {
  const t =
    timeSelecionado;

  return painel(`
    <div
      style="
        display:flex;
        align-items:center;
        gap:14px;
      "
    >
      ${
        t.logo
          ? `
            <img
              src="${e(t.logo)}"
              onerror="this.style.display='none'"
              style="
                width:72px;
                height:72px;
                object-fit:contain;
              "
            >
          `
          : ""
      }

      <div>
        <div
          style="
            font-size:22px;
            font-weight:950;
          "
        >
          ${e(t.nome)}
        </div>

        <div
          style="
            margin-top:5px;
            color:#2ee58b;
            font-size:11px;
            font-weight:950;
          "
        >
          ANÁLISE DO TIME
        </div>

        <div
          style="
            margin-top:4px;
            font-size:11px;
            opacity:.55;
          "
        >
          Histórico, médias, tendências e jogadores
        </div>
      </div>
    </div>
  `);
}

/* =========================================================
   RESUMO DA PÁGINA DO TIME
========================================================= */

function resumoPaginaTime(partidas) {
  const resumo =
    resumoHistoricoTime(
      partidas
    );

  const resultados =
    resumoResultadosTime(
      partidas
    );

  return painel(`
    ${tituloSecao(
      "Resumo",
      `${resumo.quantidade} partida(s) na amostra`
    )}

    <div
      style="
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
        margin-bottom:10px;
      "
    >
      <div
        style="
          padding:10px;
          border-radius:10px;
          background:rgba(46,229,139,.08);
          text-align:center;
        "
      >
        <strong
          style="
            color:#2ee58b;
            font-size:19px;
          "
        >
          ${resultados.vitorias}
        </strong>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:.6;
          "
        >
          VITÓRIAS
        </div>
      </div>

      <div
        style="
          padding:10px;
          border-radius:10px;
          background:rgba(241,199,91,.08);
          text-align:center;
        "
      >
        <strong
          style="
            color:#f1c75b;
            font-size:19px;
          "
        >
          ${resultados.empates}
        </strong>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:.6;
          "
        >
          EMPATES
        </div>
      </div>

      <div
        style="
          padding:10px;
          border-radius:10px;
          background:rgba(255,98,98,.08);
          text-align:center;
        "
      >
        <strong
          style="
            color:#ff6262;
            font-size:19px;
          "
        >
          ${resultados.derrotas}
        </strong>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:.6;
          "
        >
          DERROTAS
        </div>
      </div>
    </div>

    <div
      style="
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      "
    >
      ${cardMediaHistorica(
        "Gols marcados",
        resumo.total.golsFavor,
        resumo.medias.golsFavor
      )}

      ${cardMediaHistorica(
        "Gols sofridos",
        resumo.total.golsContra,
        resumo.medias.golsContra
      )}

      ${cardMediaHistorica(
        "Chutes",
        resumo.total.chutes,
        resumo.medias.chutes
      )}

      ${cardMediaHistorica(
        "Chutes no alvo",
        resumo.total.chutesGol,
        resumo.medias.chutesGol
      )}

      ${cardMediaHistorica(
        "Escanteios",
        resumo.total.escanteios,
        resumo.medias.escanteios
      )}

      ${cardMediaHistorica(
        "Faltas",
        resumo.total.faltas,
        resumo.medias.faltas
      )}

      ${cardMediaHistorica(
        "Amarelos",
        resumo.total.amarelos,
        resumo.medias.amarelos
      )}

      ${cardMediaHistorica(
        "Vermelhos",
        resumo.total.vermelhos,
        resumo.medias.vermelhos
      )}
    </div>
  `);
}
  /* =========================================================
   TENDÊNCIAS DA PÁGINA DO TIME
========================================================= */

function tendenciasPaginaTime(partidas) {
  const tendencias =
    gerarTendenciasTime(partidas);

  return painel(`
    ${tituloSecao(
      "Tendências",
      `Frequências históricas ≥ ${CONFIG.frequenciaMinima}%`
    )}

    ${
      tendencias.length
        ? tendencias
            .slice(0, 20)
            .map(t => `
              <div
                style="
                  padding:12px 0;
                  border-bottom:1px solid rgba(255,255,255,.07);
                "
              >
                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    gap:10px;
                    align-items:center;
                  "
                >
                  <strong>
                    ${e(t.mercado)}
                    • ${e(t.tipo)}
                    ${e(t.linha)}
                  </strong>

                  <strong
                    style="
                      color:#2ee58b;
                      white-space:nowrap;
                    "
                  >
                    ${t.percentual}%
                  </strong>
                </div>

                <div
                  style="
                    margin-top:5px;
                    display:flex;
                    justify-content:space-between;
                    gap:10px;
                    font-size:11px;
                    opacity:.6;
                  "
                >
                  <span>
                    ${t.acertos}/${t.total}
                    jogos
                  </span>

                  <span>
                    Média:
                    ${n(t.media).toFixed(1)}
                  </span>
                </div>
              </div>
            `)
            .join("")
        : `
          <div
            style="
              padding:18px;
              text-align:center;
              opacity:.65;
            "
          >
            Nenhuma tendência ≥
            ${CONFIG.frequenciaMinima}%
            nesta amostra.
          </div>
        `
    }

    <div
      style="
        margin-top:12px;
        font-size:10px;
        opacity:.5;
        line-height:1.5;
      "
    >
      Os percentuais representam frequência histórica
      na amostra selecionada e não garantia de ocorrência
      na próxima partida.
    </div>
  `);
}

/* =========================================================
   JOGO A JOGO — PÁGINA DO TIME
========================================================= */

function jogoPaginaTime(p) {
  const s =
    estatisticasPartidaHistorica(p);

  const resultado =
    resultadoPartidaTime(p);

  return `
    <div
      style="
        padding:13px 0;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          display:grid;
          grid-template-columns:1fr auto;
          gap:10px;
          align-items:center;
        "
      >
        <div>
          <div
            style="
              font-weight:950;
            "
          >
            ${
              partidaEhCasa(p)
                ? "vs"
                : "@"
            }
            ${e(
              p.adversario?.name ||
              p.adversario ||
              "Adversário"
            )}
          </div>

          <div
            style="
              margin-top:4px;
              font-size:10px;
              opacity:.55;
            "
          >
            ${e(dataCurta(p.data))}
            •
            ${e(nomeLigaHistorica(p))}
            •
            ${
              partidaEhCasa(p)
                ? "Casa"
                : partidaEhFora(p)
                  ? "Fora"
                  : "Geral"
            }
          </div>
        </div>

        <div
          style="
            display:flex;
            gap:7px;
            align-items:center;
          "
        >
          <strong
            style="
              font-size:16px;
            "
          >
            ${s.golsFavor}
            -
            ${s.golsContra}
          </strong>

          <span
            style="
              width:28px;
              height:28px;
              border-radius:8px;
              display:flex;
              align-items:center;
              justify-content:center;
              background:${corResultadoTime(resultado)};
              color:#07120d;
              font-weight:950;
            "
          >
            ${resultado}
          </span>
        </div>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:6px;
          margin-top:10px;
        "
      >
        ${miniValorJogo(
          "Chutes",
          s.chutes
        )}

        ${miniValorJogo(
          "No alvo",
          s.chutesGol
        )}

        ${miniValorJogo(
          "Escanteios",
          s.escanteios
        )}

        ${miniValorJogo(
          "Faltas",
          s.faltas
        )}

        ${miniValorJogo(
          "Amarelos",
          s.amarelos
        )}

        ${miniValorJogo(
          "Vermelhos",
          s.vermelhos
        )}

        ${miniValorJogo(
          "Gols pró",
          s.golsFavor
        )}

        ${miniValorJogo(
          "Gols contra",
          s.golsContra
        )}
      </div>
    </div>
  `;
}

function jogosPaginaTime(partidas) {
  return painel(`
    ${tituloSecao(
      "Últimos jogos",
      "Dados jogo a jogo da amostra selecionada"
    )}

    ${
      partidas.length
        ? partidas
            .map(jogoPaginaTime)
            .join("")
        : `
          <div
            style="
              padding:18px;
              text-align:center;
              opacity:.65;
            "
          >
            Nenhuma partida encontrada
            com estes filtros.
          </div>
        `
    }
  `);
}

/* =========================================================
   RANKING DE JOGADORES — PÁGINA DO TIME
========================================================= */

let criterioRankingTime =
  "chutes";

function mudarCriterioRankingTime(
  criterio
) {
  if (
    CRITERIOS_RANKING[
      criterio
    ]
  ) {
    criterioRankingTime =
      criterio;
  }

  renderPaginaTime();
}

function rankingJogadoresTime(
  partidas
) {
  const jogadores =
    jogadoresDoTimeFiltrado(
      partidas
    );

  const criterio =
    CRITERIOS_RANKING[
      criterioRankingTime
    ] ||
    CRITERIOS_RANKING.chutes;

  return jogadores.sort(
    (a, b) =>
      n(
        b.medias?.[
          criterio.campo
        ]
      ) -
      n(
        a.medias?.[
          criterio.campo
        ]
      )
  );
}

function cardJogadorTime(
  jogador,
  posicao
) {
  const criterio =
    CRITERIOS_RANKING[
      criterioRankingTime
    ] ||
    CRITERIOS_RANKING.chutes;

  const campo =
    criterio.campo;

  const foto =
    fotoJogador(jogador);

  return `
    <div
      onclick="abrirJogador(${Number(jogador.id)})"
      style="
        padding:11px;
        border-radius:13px;
        background:rgba(255,255,255,.035);
        border:1px solid rgba(255,255,255,.07);
        cursor:pointer;
      "
    >
      <div
        style="
          display:grid;
          grid-template-columns:28px 45px 1fr auto;
          gap:8px;
          align-items:center;
        "
      >
        <div
          style="
            font-weight:950;
            color:#2ee58b;
            text-align:center;
          "
        >
          ${posicao}
        </div>

        ${
          foto
            ? `
              <img
                src="${e(foto)}"
                onerror="this.style.display='none'"
                style="
                  width:45px;
                  height:45px;
                  border-radius:50%;
                  object-fit:cover;
                "
              >
            `
            : `
              <div
                style="
                  width:45px;
                  height:45px;
                  border-radius:50%;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  background:rgba(255,255,255,.06);
                  font-weight:900;
                "
              >
                ${e(jogador.numero)}
              </div>
            `
        }

        <div
          style="
            min-width:0;
          "
        >
          <div
            style="
              font-weight:900;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            "
          >
            ${e(jogador.nome)}
          </div>

          <div
            style="
              margin-top:3px;
              font-size:10px;
              opacity:.55;
            "
          >
            ${jogador.partidas}
            jogo(s)
            ${
              jogador.numero !== "-"
                ? ` • #${e(jogador.numero)}`
                : ""
            }
          </div>
        </div>

        <div
          style="
            text-align:right;
          "
        >
          <strong
            style="
              color:#2ee58b;
              font-size:17px;
            "
          >
            ${n(
              jogador.medias?.[
                campo
              ]
            ).toFixed(1)}
          </strong>

          <div
            style="
              margin-top:2px;
              font-size:9px;
              opacity:.5;
            "
          >
            média
          </div>
        </div>
      </div>
    </div>
  `;
}

function jogadoresPaginaTime(
  partidas
) {
  const ranking =
    rankingJogadoresTime(
      partidas
    );

  return painel(`
    ${tituloSecao(
      "Jogadores",
      "Ranking pela média na amostra selecionada"
    )}

    <select
      onchange="mudarCriterioRankingTime(this.value)"
      style="
        width:100%;
        border:1px solid rgba(255,255,255,.12);
        border-radius:11px;
        background:#101820;
        color:#fff;
        padding:11px;
        font-weight:800;
        margin-bottom:12px;
      "
    >
      ${
        Object.entries(
          CRITERIOS_RANKING
        )
          .map(
            ([id, c]) => `
              <option
                value="${e(id)}"
                ${
                  criterioRankingTime ===
                  id
                    ? "selected"
                    : ""
                }
              >
                ${e(c.nome)}
              </option>
            `
          )
          .join("")
      }
    </select>

    <div
      style="
        display:flex;
        flex-direction:column;
        gap:7px;
      "
    >
      ${
        ranking.length
          ? ranking
              .slice(0, 25)
              .map(
                (j, i) =>
                  cardJogadorTime(
                    j,
                    i + 1
                  )
              )
              .join("")
          : `
            <div
              style="
                padding:18px;
                text-align:center;
                opacity:.65;
              "
            >
              Nenhum jogador encontrado
              nesta amostra.
            </div>
          `
      }
    </div>
  `);
}

/* =========================================================
   RENDERIZA PÁGINA COMPLETA DO TIME
========================================================= */

function renderPaginaTime() {
  if (!timeSelecionado) {
    renderPaginaPartida();
    return;
  }

  const partidas =
    partidasFiltradasTime();

  document.body.innerHTML = `
    <main
      style="
        width:min(100% - 20px,800px);
        margin:auto;
        padding:12px 0 30px;
      "
    >
      <button
        onclick="renderPaginaPartida()"
        style="
          border:0;
          padding:11px 14px;
          border-radius:11px;
          background:rgba(255,255,255,.07);
          color:#fff;
          font-weight:900;
          margin-bottom:12px;
        "
      >
        ← Voltar para partida
      </button>

      ${cabecalhoPaginaTime()}

      ${painel(`
        ${tituloSecao(
          "Filtros",
          "Escolha a amostra usada nos cálculos."
        )}

        ${controlesTime()}
      `)}

      ${resumoPaginaTime(
        partidas
      )}

      ${tendenciasPaginaTime(
        partidas
      )}

      ${jogosPaginaTime(
        partidas
      )}

      ${jogadoresPaginaTime(
        partidas
      )}

    </main>
  `;
}
  /* =========================================================
   CONTROLE DE NAVEGAÇÃO
========================================================= */

function voltarInicio() {
  partidaAtual = null;
  historicoAtual = null;
  jogadorSelecionado = null;
  timeSelecionado = null;
  abaAtual = "resumo";

  load();
}

function abrirAbaPartida(aba) {
  abaAtual = aba;
  renderPaginaPartida();
}

/* =========================================================
   TRATAMENTO GLOBAL DE ERROS
========================================================= */

window.addEventListener(
  "error",
  event => {
    console.error(
      "Erro Profianalises:",
      event.error ||
      event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  event => {
    console.error(
      "Erro assíncrono Profianalises:",
      event.reason
    );
  }
);

/* =========================================================
   EXPÕE FUNÇÕES USADAS PELO HTML
========================================================= */

window.load = load;
window.abrirJogo = abrirJogo;
window.abrirAbaPartida = abrirAbaPartida;
window.voltarInicio = voltarInicio;

window.abrirJogador = abrirJogador;
window.abrirTime = abrirTime;

window.renderPaginaPartida =
  renderPaginaPartida;

window.renderPaginaJogador =
  renderPaginaJogador;

window.renderPaginaTime =
  renderPaginaTime;

window.mudarQuantidadeHistorico =
  mudarQuantidadeHistorico;

window.mudarLocalHistorico =
  mudarLocalHistorico;

window.mudarCampeonatoHistorico =
  mudarCampeonatoHistorico;

window.mudarFiltroH2H =
  mudarFiltroH2H;

window.mudarFiltroJogadorQuantidade =
  mudarFiltroJogadorQuantidade;

window.mudarFiltroJogadorLocal =
  mudarFiltroJogadorLocal;

window.mudarFiltroJogadorCampeonato =
  mudarFiltroJogadorCampeonato;

window.mudarRankingLado =
  mudarRankingLado;

window.mudarRankingQuantidade =
  mudarRankingQuantidade;

window.mudarRankingCriterio =
  mudarRankingCriterio;

window.mudarFiltroTimeQuantidade =
  mudarFiltroTimeQuantidade;

window.mudarFiltroTimeLocal =
  mudarFiltroTimeLocal;

window.mudarFiltroTimeCampeonato =
  mudarFiltroTimeCampeonato;

window.mudarCriterioRankingTime =
  mudarCriterioRankingTime;

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      const params =
        new URLSearchParams(
          window.location.search
        );

      const jogoId =
        Number(params.get("jogo"));

      if (jogoId) {
        await abrirJogo(jogoId);
      } else {
        await load();
      }

    } catch (erro) {
      console.error(
        "Falha ao iniciar Profianalises:",
        erro
      );

      await load();
    }
  }
);
