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
  const jogador =
    typeof p === "object"
      ? p
      : { id: p };

  return (
    jogador.foto ||
    jogador.photo ||
    (jogador.id
      ? `${API}/logo/player/${jogador.id}`
      : "")
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
function isStatusAoVivo(status = {}) {
  const short =
    String(
      status?.short ||
      status ||
      ""
    ).toUpperCase();

  return [
    "1H",
    "HT",
    "2H",
    "ET",
    "BT",
    "P",
    "LIVE",
    "SUSP",
    "INT"
  ].includes(short);
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

    else if (Array.isArray(d?.jogos)) {
      lista = d.jogos;
    }

    else if (Array.isArray(d?.dados)) {
      lista = d.dados;
    }

    else if (Array.isArray(d?.response)) {
      lista = d.response;
    }

    else if (Array.isArray(d?.fixtures)) {
      lista = d.fixtures;
    }

    else if (Array.isArray(d?.data?.response)) {
      lista = d.data.response;
    }

    else if (Array.isArray(d?.data?.jogos)) {
      lista = d.data.jogos;
    }

    else if (Array.isArray(d?.data)) {
      lista = d.data;
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

function render(lista = jogos) {
  const el =
    document.querySelector("#games");

  if (!el) return;

  const busca =
    String(
      document.querySelector("#q")
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  let filtrados =
    safeArray(lista);

  if (busca) {
    filtrados =
      filtrados.filter(j => {
        const texto = [
          j.league?.name,
          j.league?.country,
          j.teams?.home?.name,
          j.teams?.away?.name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return texto.includes(busca);
      });
  }

  filtrados.sort((a, b) => {
    const prioridade =
      prioridadeLiga(a) -
      prioridadeLiga(b);

    if (prioridade !== 0) {
      return prioridade;
    }

    return (
      new Date(
        a.date ||
        a.fixture?.date ||
        0
      ) -
      new Date(
        b.date ||
        b.fixture?.date ||
        0
      )
    );
  });

  const shown =
    document.querySelector("#shown");

  if (shown) {
    shown.textContent =
      filtrados.length;
  }

  if (!filtrados.length) {
    el.innerHTML = `
      <div
        style="
          padding:28px 15px;
          text-align:center;
          opacity:.7;
        "
      >
        <div
          style="
            font-size:16px;
            font-weight:900;
          "
        >
          Nenhuma partida encontrada
        </div>

        <div
          style="
            margin-top:6px;
            font-size:12px;
          "
        >
          Tente alterar a busca ou o filtro.
        </div>
      </div>
    `;

    return;
  }

  const grupos =
    new Map();

  filtrados.forEach(j => {
    const ligaId =
      j.league?.id || 0;

    const nome =
      j.league?.name ||
      "Outras competições";

    const pais =
      j.league?.country || "";

    const chave =
      `${ligaId}:${nome}:${pais}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        ligaId,
        nome,
        pais,
        logo:
          j.league?.logo || "",
        prioridade:
          prioridadeLiga(j),
        jogos: []
      });
    }

    grupos.get(chave)
      .jogos
      .push(j);
  });

  const principais = [];
  const outras = [];

  grupos.forEach(g => {
    if (g.prioridade < 999) {
      principais.push(g);
    } else {
      outras.push(g);
    }
  });

  principais.sort(
    (a, b) =>
      a.prioridade -
      b.prioridade
  );

  outras.sort(
    (a, b) =>
      String(a.nome)
        .localeCompare(
          String(b.nome),
          "pt-BR"
        )
  );

  function blocoLiga(g) {
    return `
      <section
        style="
          margin-bottom:13px;
          overflow:hidden;
          border:1px solid rgba(255,255,255,.08);
          border-radius:16px;
          background:rgba(255,255,255,.025);
        "
      >
        <div
          style="
            display:flex;
            align-items:center;
            gap:9px;
            padding:12px 14px;
            background:rgba(255,255,255,.035);
          "
        >
          ${
            g.logo
              ? `
                <img
                  src="${e(g.logo)}"
                  onerror="this.style.display='none'"
                  style="
                    width:27px;
                    height:27px;
                    object-fit:contain;
                  "
                >
              `
              : ""
          }

          <div
            style="
              min-width:0;
              flex:1;
            "
          >
            <div
              style="
                font-size:13px;
                font-weight:950;
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
              "
            >
              ${e(g.nome)}
            </div>

            <div
              style="
                margin-top:2px;
                font-size:10px;
                opacity:.55;
              "
            >
              ${e(g.pais)}
            </div>
          </div>

          <div
            style="
              font-size:10px;
              opacity:.55;
              font-weight:800;
            "
          >
            ${g.jogos.length}
            jogo(s)
          </div>
        </div>

        ${
          g.jogos
            .map(cardJogo)
            .join("")
        }
      </section>
    `;
  }

  el.innerHTML = `
    ${
      principais.length
        ? `
          <div
            style="
              margin:4px 2px 10px;
              font-size:11px;
              font-weight:950;
              color:#2ee58b;
              letter-spacing:.06em;
            "
          >
            PRINCIPAIS COMPETIÇÕES
          </div>

          ${
            principais
              .map(blocoLiga)
              .join("")
          }
        `
        : ""
    }

    ${
      outras.length
        ? `
          <div
            style="
              margin:20px 2px 10px;
              font-size:11px;
              font-weight:950;
              opacity:.6;
              letter-spacing:.06em;
            "
          >
            OUTRAS COMPETIÇÕES
          </div>

          ${
            outras
              .map(blocoLiga)
              .join("")
          }
        `
        : ""
    }
  `;
}

/* =========================================================
   BUSCA DA HOME
========================================================= */

function configurarBuscaHome() {
  const q =
    document.querySelector("#q");

  if (!q) return;

  q.addEventListener(
    "input",
    () => render(jogos)
  );
}

/* =========================================================
   FETCH
========================================================= */

async function fetchJson(url) {
  const r = await fetch(
    url,
    {
      cache: "no-store"
    }
  );

  if (!r.ok) {
    throw new Error(
      `HTTP ${r.status} em ${url}`
    );
  }

  const d =
    await r.json();

  if (d?.ok === false) {
    throw new Error(
      d.error ||
      d.erro ||
      "Erro retornado pela API"
    );
  }

  return d;
}

async function fetchOpcional(url) {
  try {
    return await fetchJson(url);
  } catch (err) {
    console.warn(
      "Recurso opcional indisponível:",
      url,
      err?.message
    );

    return null;
  }
}

/* =========================================================
   NORMALIZAÇÃO DAS ESTATÍSTICAS DA PARTIDA
========================================================= */

function normalizarEstatisticas(
  dados
) {
  const lista =
    safeArray(dados);

  return lista.map(item => {
    const time =
      item.team || {};

    const stats =
      safeArray(
        item.statistics ||
        item.stats
      );

    const mapa = {};

    stats.forEach(s => {
      const chave =
        String(
          s.type ||
          s.name ||
          ""
        ).trim();

      if (!chave) return;

      mapa[chave] =
        s.value;
    });

    return {
      team: time,
      statistics: stats,
      mapa
    };
  });
}

/* =========================================================
   VOLTAR PARA HOME
========================================================= */

function voltarParaHome() {
  const url =
    new URL(
      window.location.href
    );

  url.searchParams.delete(
    "jogo"
  );

  window.history.replaceState(
    {},
    "",
    url.pathname +
    url.search
  );

  partidaAtual = null;
  historicoAtual = null;
  jogadoresAtuais = [];
  abaAtual = "resumo";

  window.location.reload();
}

/* =========================================================
   ABRIR PARTIDA
========================================================= */

async function abrirJogo(id) {
  id = Number(id);

  if (!id) return;

  const url =
    new URL(
      window.location.href
    );

  url.searchParams.set(
    "jogo",
    String(id)
  );

  window.history.replaceState(
    {},
    "",
    url.pathname +
    url.search
  );

  const containerPartida =
  document.getElementById("games") ||
  document.getElementById("list") ||
  document.getElementById("app");

if (!containerPartida) return;

containerPartida.innerHTML = `
    <main
      style="
        width:min(100% - 20px,900px);
        margin:auto;
        padding:18px 0 40px;
      "
    >
      <button
        onclick="voltarParaHome()"
        style="
          border:0;
          padding:10px 14px;
          border-radius:10px;
          background:rgba(255,255,255,.07);
          color:#fff;
          font-weight:900;
          margin-bottom:14px;
        "
      >
        ← Voltar
      </button>

      ${painel(`
        <div
          style="
            text-align:center;
            padding:24px 10px;
          "
        >
          <div
            style="
              font-size:17px;
              font-weight:950;
            "
          >
            Carregando partida...
          </div>

          <div
            style="
              margin-top:7px;
              opacity:.6;
              font-size:12px;
            "
          >
            Estatísticas, histórico, H2H e jogadores
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
      fixtureData?.dados?.[0] ||
      fixtureData?.fixture ||
      fixtureData?.response?.[0] ||
      fixtureData?.jogo ||
      fixtureData?.dados ||
      fixtureData;

    if (!fixture) {
      throw new Error(
        "Partida não encontrada."
      );
    }

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
      homeIdH2H &&
      awayIdH2H
        ? await fetchOpcional(
            `${API}/h2h?home=${encodeURIComponent(homeIdH2H)}&away=${encodeURIComponent(awayIdH2H)}&last=10`
          )
        : null;

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
      id:
        fixture.fixture?.id ||
        fixture.id ||
        id,

      fixture,

      h2h:
        h2hData?.jogos ||
        h2hData?.partidas ||
        h2hData?.response ||
        [],

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

    historicoAtual =
      historicoData ||
      null;

    jogadoresAtuais =
      jogadores;

    abaAtual =
      "resumo";

    renderPaginaPartida();

  } catch (err) {
    console.error(err);

    containerPartida.innerHTML = `
      <main
        style="
          max-width:850px;
          margin:auto;
          padding:20px;
        "
      >
        <button
          onclick="voltarParaHome()"
          style="
            padding:11px 15px;
            margin-bottom:15px;
            border:0;
            border-radius:10px;
            background:rgba(255,255,255,.08);
            color:#fff;
            font-weight:900;
          "
        >
          ← Voltar
        </button>

        ${painel(`
          <div
            style="
              text-align:center;
              padding:20px;
            "
          >
            <h2>
              Não foi possível carregar a partida
            </h2>

            <p
              style="
                opacity:.7;
              "
            >
              ${e(
                err?.message ||
                "Erro desconhecido"
              )}
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
    String(
      s.short || ""
    ).toUpperCase();

  const elapsed =
    s.elapsed;

  if (
    [
      "1H",
      "2H",
      "ET",
      "BT",
      "P",
      "LIVE"
    ].includes(short)
  ) {
    return elapsed != null
      ? `${elapsed}' • AO VIVO`
      : "AO VIVO";
  }

  if (short === "HT") {
    return "INTERVALO";
  }

  if (
    [
      "FT",
      "AET",
      "PEN"
    ].includes(short)
  ) {
    return "ENCERRADO";
  }

  if (short === "PST") {
    return "ADIADO";
  }

  if (short === "CANC") {
    return "CANCELADO";
  }

  return "PRÉ-JOGO";
}

function cabecalhoPartida() {
  if (!partidaAtual) return "";

  const aoVivo =
    jogoEstaAoVivo(
      partidaAtual.fixture
    );

  const terminou =
    [
      "FT",
      "AET",
      "PEN"
    ].includes(
      String(
        partidaAtual.status?.short ||
        ""
      ).toUpperCase()
    );

  const placar =
    aoVivo || terminou
      ? `
        ${n(
          partidaAtual.home.goals
        )}
        <span style="opacity:.45">
          ×
        </span>
        ${n(
          partidaAtual.away.goals
        )}
      `
      : horaCurta(
          partidaAtual.date
        );

  return painel(`
    <div
      style="
        text-align:center;
      "
    >

      <div
        style="
          font-size:10px;
          font-weight:900;
          opacity:.6;
          text-transform:uppercase;
          letter-spacing:.05em;
        "
      >
        ${e(
          partidaAtual.competition ||
          "Competição"
        )}
      </div>

      <div
        style="
          margin-top:5px;
          font-size:10px;
          opacity:.45;
        "
      >
        ${e(
          partidaAtual.round || ""
        )}
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr);
          gap:10px;
          align-items:center;
          margin-top:20px;
        "
      >

        <div>
          ${
            partidaAtual.home.logo
              ? `
                <img
                  src="${e(
                    partidaAtual.home.logo
                  )}"
                  onerror="this.style.display='none'"
                  style="
                    width:60px;
                    height:60px;
                    object-fit:contain;
                  "
                >
              `
              : ""
          }

          <div
            style="
              margin-top:8px;
              font-size:14px;
              font-weight:950;
            "
          >
            ${e(
              partidaAtual.home.name
            )}
          </div>
        </div>

        <div>
          <div
            style="
              font-size:25px;
              font-weight:950;
            "
          >
            ${placar}
          </div>

          <div
            style="
              margin-top:6px;
              font-size:10px;
              font-weight:950;
              color:${
                aoVivo
                  ? "#2ee58b"
                  : "rgba(255,255,255,.55)"
              };
            "
          >
            ${e(
              statusPartidaAtual()
            )}
          </div>
        </div>

        <div>
          ${
            partidaAtual.away.logo
              ? `
                <img
                  src="${e(
                    partidaAtual.away.logo
                  )}"
                  onerror="this.style.display='none'"
                  style="
                    width:60px;
                    height:60px;
                    object-fit:contain;
                  "
                >
              `
              : ""
          }

          <div
            style="
              margin-top:8px;
              font-size:14px;
              font-weight:950;
            "
          >
            ${e(
              partidaAtual.away.name
            )}
          </div>
        </div>

      </div>

      <div
        style="
          margin-top:16px;
          font-size:11px;
          opacity:.55;
        "
      >
        ${e(
          dataCurta(
            partidaAtual.date
          )
        )}
        •
        ${e(
          partidaAtual.country ||
          ""
        )}
      </div>

    </div>
  `);
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
        max-width:100%;
min-width:0;
overscroll-behavior-x:contain;
        padding:2px 0 12px;
        margin-bottom:4px;
        scrollbar-width:none;
      "
    >
      ${
        ABAS_PARTIDA
          .map(
            ([id, nome]) =>
              botao(
                nome,
                `mudarAbaPartida('${id}')`,
                abaAtual === id
              )
          )
          .join("")
      }
    </div>
  `;
}

function mudarAbaPartida(aba) {
  const scrollAntes =
    window.scrollY ||
    document.documentElement.scrollTop ||
    0;

  abaAtual = aba;

  renderPaginaPartida();

  requestAnimationFrame(() => {
    window.scrollTo({
      top: scrollAntes,
      left: 0,
      behavior: "instant"
    });
  });
}

/* =========================================================
   SCORE PROFIANALISES
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

  if (
    !casa.length ||
    !fora.length
  ) {
    return {
  score: null,
  matchup: "-"
};
  }

  const saldoCasa =
    soma(
      casa,
      "golsFavor"
    ) -
    soma(
      casa,
      "golsContra"
    );

  const saldoFora =
    soma(
      fora,
      "golsFavor"
    ) -
    soma(
      fora,
      "golsContra"
    );

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
        (
          saldoCasa -
          saldoFora
        ) * 2
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

  if (score >= 85) {
    matchup = "A";
  } else if (score >= 70) {
    matchup = "B";
  } else if (score >= 55) {
    matchup = "C";
  } else {
    matchup = "D";
  }

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
      "Score Profianalises",
      "Indicador estatístico do matchup — não representa probabilidade."
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
          padding:17px;
          border-radius:14px;
          background:rgba(46,229,139,.07);
          border:1px solid rgba(46,229,139,.16);
        "
      >
        <div
          style="
            font-size:10px;
            opacity:.6;
            font-weight:900;
          "
        >
          SCORE
        </div>

        <div
          style="
            margin-top:5px;
            font-size:29px;
            font-weight:950;
            color:#2ee58b;
          "
        >
          ${
            r.score === null
              ? "-"
              : r.score
          }
        </div>

        <div
          style="
            margin-top:3px;
            font-size:10px;
            opacity:.55;
          "
        >
          escala 0–100
        </div>
      </div>

      <div
        style="
          padding:17px;
          border-radius:14px;
          background:rgba(255,255,255,.035);
          border:1px solid rgba(255,255,255,.08);
        "
      >
        <div
          style="
            font-size:10px;
            opacity:.6;
            font-weight:900;
          "
        >
          MATCHUP
        </div>

        <div
          style="
            margin-top:5px;
            font-size:29px;
            font-weight:950;
          "
        >
          ${e(r.matchup)}
        </div>

        <div
          style="
            margin-top:3px;
            font-size:10px;
            opacity:.55;
          "
        >
          leitura estatística
        </div>
      </div>

    </div>
  `);
}
/* =========================================================
   OPORTUNIDADES PROFIANALISES
========================================================= */

function cardOportunidade(op = {}) {
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
        ${e(op.titulo || op.mercado || "Mercado")}
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
          <strong>${formatarOdd(op.odd)}</strong>
        </div>

        <div>
          L10:
          <strong>${e(op.l10 || "-")}</strong>
        </div>

        <div>
          Casa/Fora:
          <strong>${e(op.casaFora || "-")}</strong>
        </div>

        <div>
          Média:
          <strong>${e(op.media || "-")}</strong>
        </div>

        <div>
          Projeção:
          <strong>${e(op.projecao || "-")}</strong>
        </div>

        <div>
          Score:
          <strong>${e(op.score || "-")}</strong>
        </div>
      </div>

      ${
        safeArray(op.motivos).length
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
                safeArray(op.motivos)
                  .map(m => `✓ ${e(m)}`)
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
  const fontes = [
    partidaAtual?.oportunidades,
    partidaAtual?.analise?.oportunidades,
    partidaAtual?.odds?.oportunidades
  ];

  for (const fonte of fontes) {
    if (Array.isArray(fonte)) {
      return fonte.filter(op => {
        const odd = Number(op?.odd);

        return (
          !Number.isFinite(odd) ||
          odd >= CONFIG.oddMinima
        );
      });
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
        "Somente mercados que passarem pelos filtros aparecem aqui."
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
          O sistema não força uma indicação quando os critérios
          estatísticos e de odd não são atingidos.
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

  for (const fonte of fontes) {
    if (Array.isArray(fonte)) {
      return fonte;
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
      "Combinações apenas com seleções previamente qualificadas."
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
          .map(x => `
            <span
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
            </span>
          `)
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
                  Alvo ~${e(m.alvo || "-")}
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
                          `• ${e(s.titulo || s.mercado || "-")} ${
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
                font-size:11px;
                opacity:.55;
              "
            >
              Não criamos odds ou seleções fictícias para atingir
              artificialmente os alvos.
            </div>
          </div>
        `
    }
  `);
}

/* =========================================================
   RESUMO DE FORMA DAS EQUIPES
========================================================= */

function partidasHistoricoLado(lado, quantidade = 10) {
  const bloco =
    lado === "casa"
      ? historicoAtual?.casa
      : historicoAtual?.fora;

  if (!bloco) return [];

  const chave =
    Number(quantidade) === 5
      ? "ultimas5"
      : "ultimas10";

  return safeArray(
    bloco?.[chave]?.partidas
  ).slice(
    0,
    Number(quantidade) === 5
      ? 5
      : 10
  );
}

function resumoFormaTime(lado, nome) {
  const partidas =
    partidasHistoricoLado(lado, 10);

  if (!partidas.length) {
    return `
      <div
        style="
          padding:13px;
          border-radius:12px;
          background:rgba(255,255,255,.035);
        "
      >
        <strong>${e(nome)}</strong>

        <div
          style="
            margin-top:5px;
            font-size:11px;
            opacity:.55;
          "
        >
          Histórico indisponível.
        </div>
      </div>
    `;
  }

  const gf = soma(partidas, "golsFavor");
  const gc = soma(partidas, "golsContra");

  let vitorias = 0;
  let empates = 0;
  let derrotas = 0;

  partidas.forEach(p => {
    const favor = n(p.golsFavor);
    const contra = n(p.golsContra);

    if (favor > contra) {
      vitorias++;
    } else if (favor === contra) {
      empates++;
    } else {
      derrotas++;
    }
  });

  return `
    <div
      style="
        padding:13px;
        border-radius:12px;
        background:rgba(255,255,255,.035);
        border:1px solid rgba(255,255,255,.06);
      "
    >
      <div
        style="
          font-weight:950;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        "
      >
        ${e(nome)}
      </div>

      <div
        style="
          margin-top:9px;
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:5px;
          text-align:center;
        "
      >
        <div>
          <strong style="color:#2ee58b">${vitorias}</strong>
          <div style="font-size:9px;opacity:.5">VIT</div>
        </div>

        <div>
          <strong>${empates}</strong>
          <div style="font-size:9px;opacity:.5">EMP</div>
        </div>

        <div>
          <strong>${derrotas}</strong>
          <div style="font-size:9px;opacity:.5">DER</div>
        </div>
      </div>

      <div
        style="
          margin-top:10px;
          padding-top:9px;
          border-top:1px solid rgba(255,255,255,.06);
          font-size:11px;
          line-height:1.7;
        "
      >
        Gols marcados:
        <strong>${gf}</strong>
        <br>

        Média:
        <strong>${media(gf, partidas.length)}</strong>
        <br>

        Gols sofridos:
        <strong>${gc}</strong>
        <br>

        Média sofrida:
        <strong>${media(gc, partidas.length)}</strong>
      </div>
    </div>
  `;
}

function resumoFormaTimes() {
  if (!historicoAtual) {
    return painel(`
      ${tituloSecao(
        "Forma recente",
        "Últimos jogos das equipes"
      )}

      <div
        style="
          padding:16px;
          text-align:center;
          opacity:.6;
        "
      >
        Histórico ainda não disponível para esta partida.
      </div>
    `);
  }

  return painel(`
    ${tituloSecao(
      "Forma recente",
      "Resumo dos últimos 10 jogos disponíveis"
    )}

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
      "
    >
      ${resumoFormaTime(
        "casa",
        partidaAtual?.home?.name
      )}

      ${resumoFormaTime(
        "fora",
        partidaAtual?.away?.name
      )}
    </div>
  `);
}

/* =========================================================
   RESUMO DA PARTIDA
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
          onclick="abrirTime(${Number(
            partidaAtual?.home?.id || 0
          )})"
          style="
            padding:14px 8px;
            border-radius:12px;
            border:1px solid rgba(255,255,255,.1);
            background:rgba(255,255,255,.04);
            color:#fff;
            font-weight:900;
          "
        >
          ${e(partidaAtual?.home?.name || "Casa")}
        </button>

        <button
          onclick="abrirTime(${Number(
            partidaAtual?.away?.id || 0
          )})"
          style="
            padding:14px 8px;
            border-radius:12px;
            border:1px solid rgba(255,255,255,.1);
            background:rgba(255,255,255,.04);
            color:#fff;
            font-weight:900;
          "
        >
          ${e(partidaAtual?.away?.name || "Fora")}
        </button>
      </div>
    `)}
  `;
}

/* =========================================================
   H2H
========================================================= */

let filtroH2H = 5;

function mudarFiltroH2H(qtd) {
  filtroH2H =
    Number(qtd) === 10
      ? 10
      : 5;

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

    if (Array.isArray(fonte?.jogos)) {
      return fonte.jogos;
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

function dadosJogoH2H(j = {}) {
  const fixture = j.fixture || {};
  const teams = j.teams || {};
  const goals = j.goals || {};

  return {
    id:
      j.id ||
      fixture.id,

    data:
      j.data ||
      j.date ||
      fixture.date,

    liga:
      j.liga?.name ||
      j.league?.name ||
      j.liga ||
      "",

    casa:
      j.casa?.name ||
      j.home?.name ||
      teams.home?.name ||
      j.timeCasa ||
      "Casa",

    fora:
      j.fora?.name ||
      j.away?.name ||
      teams.away?.name ||
      j.timeFora ||
      "Fora",

    golsCasa:
      j.golsCasa ??
      j.homeGoals ??
      j.casa?.goals ??
      goals.home ??
      "-",

    golsFora:
      j.golsFora ??
      j.awayGoals ??
      j.fora?.goals ??
      goals.away ??
      "-"
  };
}

function cardJogoH2H(j) {
  const d = dadosJogoH2H(j);

  return `
    <div
      style="
        padding:12px 4px;
        border-bottom:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          font-size:10px;
          opacity:.5;
        "
      >
        <span>${e(dataCurta(d.data))}</span>
        <span>${e(d.liga)}</span>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:1fr auto;
          gap:10px;
          margin-top:8px;
          align-items:center;
        "
      >
        <div>
          <div style="font-weight:850">
            ${e(d.casa)}
          </div>

          <div
            style="
              margin-top:7px;
              font-weight:850;
            "
          >
            ${e(d.fora)}
          </div>
        </div>

        <div
          style="
            font-size:15px;
            font-weight:950;
            text-align:center;
            line-height:1.8;
          "
        >
          <div>${e(d.golsCasa)}</div>
          <div>${e(d.golsFora)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderH2H() {
  const todos =
    extrairH2HExistente();

  const jogosH2H =
    todos.slice(
      0,
      filtroH2H
    );

  const partidasCasa =
    partidasHistoricoLado(
      "casa",
      filtroH2H
    );

  const partidasFora =
    partidasHistoricoLado(
      "fora",
      filtroH2H
    );

  function cardUltimoJogo(p) {
    const local =
      String(
        p?.local ||
        ""
      ).toLowerCase();

    const adversario =
      p?.adversario?.name ||
      p?.adversario?.nome ||
      p?.adversario ||
      "-";

    const liga =
      p?.liga?.name ||
      p?.liga?.nome ||
      p?.competition ||
      p?.campeonato ||
      "-";

    const gf =
      p?.golsFavor ??
      "-";

    const gc =
      p?.golsContra ??
      "-";

    const resultado =
      n(gf) > n(gc)
        ? "V"
        : n(gf) < n(gc)
          ? "D"
          : "E";

    return `
      <div
        style="
          padding:12px 0;
          border-bottom:1px solid rgba(255,255,255,.07);
          min-width:0;
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:8px;
            font-size:10px;
            opacity:.55;
          "
        >
          <span>
            ${e(dataCurta(p?.data))}
          </span>

          <span
            style="
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
              text-align:right;
            "
          >
            ${e(liga)}
          </span>
        </div>

        <div
          style="
            display:grid;
            grid-template-columns:minmax(0,1fr) auto;
            gap:10px;
            align-items:center;
            margin-top:8px;
          "
        >
          <div
            style="
              min-width:0;
            "
          >
            <div
              style="
                font-size:12px;
                font-weight:900;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              "
            >
              ${local === "casa" ? "Casa" : local === "fora" ? "Fora" : "Jogo"}
              • ${e(adversario)}
            </div>
          </div>

          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              white-space:nowrap;
            "
          >
            <strong
              style="
                font-size:15px;
              "
            >
              ${e(gf)} × ${e(gc)}
            </strong>

            <span
              style="
                min-width:25px;
                text-align:center;
                padding:4px 6px;
                border-radius:7px;
                font-size:10px;
                font-weight:950;
                background:rgba(255,255,255,.07);
              "
            >
              ${resultado}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  function blocoUltimos(
    titulo,
    partidas
  ) {
    return painel(`
      ${tituloSecao(
        titulo,
        `Últimos ${Math.min(
          filtroH2H,
          partidas.length
        )} jogos disponíveis`
      )}

      ${
        partidas.length
          ? partidas
              .map(cardUltimoJogo)
              .join("")
          : `
            <div
              style="
                padding:16px;
                text-align:center;
                opacity:.6;
                font-size:12px;
              "
            >
              Histórico não disponível.
            </div>
          `
      }
    `);
  }

  return `
    ${painel(`
      ${tituloSecao(
        "Confrontos diretos",
        "Histórico entre as duas equipes"
      )}

      <div
        style="
          display:flex;
          gap:8px;
          margin-bottom:13px;
          overflow-x:auto;
          max-width:100%;
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
        jogosH2H.length
          ? jogosH2H
              .map(cardJogoH2H)
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
              <strong>
                Nenhum confronto direto encontrado.
              </strong>
            </div>
          `
      }
    `)}

    ${blocoUltimos(
      `Últimas partidas — ${
        partidaAtual?.home?.name ||
        "Mandante"
      }`,
      partidasCasa
    )}

    ${blocoUltimos(
      `Últimas partidas — ${
        partidaAtual?.away?.name ||
        "Visitante"
      }`,
      partidasFora
    )}
  `;
}
/* =========================================================
   ANÁLISE AUTOMÁTICA
========================================================= */

let filtroHistorico = {
  quantidade: 10,
  local: "geral",
  campeonato: "todos"
};

function mudarQuantidadeHistorico(qtd) {
  filtroHistorico.quantidade =
    Number(qtd) === 5
      ? 5
      : 10;

  renderPaginaPartida();
}

function mudarLocalHistorico(local) {
  if (
    ["geral", "casa", "fora"]
      .includes(local)
  ) {
    filtroHistorico.local =
      local;
  }

  renderPaginaPartida();
}

function mudarCampeonatoHistorico(id) {
  filtroHistorico.campeonato =
    String(id || "todos");

  renderPaginaPartida();
}

/* =========================================================
   IDENTIFICAÇÃO DO CAMPEONATO
========================================================= */

function idLigaPartidaHistorica(p = {}) {
  return String(
    p.liga?.id ??
    p.league?.id ??
    p.ligaId ??
    p.leagueId ??
    ""
  );
}

function nomeLigaPartidaHistorica(p = {}) {
  return (
    p.liga?.name ||
    p.league?.name ||
    p.nomeLiga ||
    p.competicao ||
    "Competição"
  );
}

function campeonatosHistorico() {
  const mapa =
    new Map();

  [
    ...partidasHistoricoLado(
      "casa",
      10
    ),
    ...partidasHistoricoLado(
      "fora",
      10
    )
  ].forEach(p => {
    const id =
      idLigaPartidaHistorica(p);

    const nome =
      nomeLigaPartidaHistorica(p);

    if (!id && !nome) {
      return;
    }

    const chave =
      id || nome;

    if (!mapa.has(chave)) {
      mapa.set(
        chave,
        {
          id: chave,
          nome
        }
      );
    }
  });

  return [
    ...mapa.values()
  ].sort(
    (a, b) =>
      String(a.nome)
        .localeCompare(
          String(b.nome),
          "pt-BR"
        )
  );
}

/* =========================================================
   FILTRO DAS PARTIDAS HISTÓRICAS
========================================================= */

function localPartidaHistorica(
  p,
  lado
) {
  const local =
    String(
      p.local ||
      p.mando ||
      ""
    ).toLowerCase();

  if (
    local === "casa" ||
    local === "home"
  ) {
    return "casa";
  }

  if (
    local === "fora" ||
    local === "away"
  ) {
    return "fora";
  }

  /*
    No histórico do backend, "local"
    normalmente informa se o time analisado
    atuou em casa ou fora.
  */

  return lado;
}

function filtrarPartidasHistoricas(
  lado
) {
  const quantidade =
    filtroHistorico.quantidade;

  /*
    Usamos até 10 partidas como base.
    Depois aplicamos campeonato/local e
    finalmente limitamos a 5 ou 10.
  */

  let partidas =
    partidasHistoricoLado(
      lado,
      10
    );

  const campeonato =
    String(
      filtroHistorico.campeonato ||
      "todos"
    );

  if (
    campeonato !== "todos"
  ) {
    partidas =
      partidas.filter(p => {
        const id =
          idLigaPartidaHistorica(p);

        const nome =
          nomeLigaPartidaHistorica(p);

        return (
          id === campeonato ||
          nome === campeonato
        );
      });
  }

  if (
    filtroHistorico.local !==
    "geral"
  ) {
    partidas =
      partidas.filter(
        p =>
          localPartidaHistorica(
            p,
            lado
          ) ===
          filtroHistorico.local
      );
  }

  return partidas.slice(
    0,
    quantidade
  );
}

/* =========================================================
   EXTRAÇÃO DE ESTATÍSTICAS HISTÓRICAS
========================================================= */

function numeroCampo(
  objeto,
  campos = []
) {
  for (const campo of campos) {
    const v =
      objeto?.[campo];

    if (
      v !== null &&
      v !== undefined &&
      v !== ""
    ) {
      const numero =
        Number(
          String(v)
            .replace("%", "")
            .replace(",", ".")
        );

      if (
        Number.isFinite(numero)
      ) {
        return numero;
      }
    }
  }

  return 0;
}

function estatisticasPartidaHistorica(
  p = {}
) {
  const stats =
    p.estatisticas ||
    p.stats ||
    p.statistics ||
    {};

  return {
    gols:
      numeroCampo(
        p,
        [
          "golsFavor",
          "gols",
          "goalsFor"
        ]
      ),

    golsSofridos:
      numeroCampo(
        p,
        [
          "golsContra",
          "goalsAgainst"
        ]
      ),

    chutes:
      numeroCampo(
        stats,
        [
          "chutes",
          "totalShots",
          "shots",
          "total_shots"
        ]
      ) ||
      numeroCampo(
        p,
        [
          "chutes",
          "totalShots"
        ]
      ),

    chutesGol:
      numeroCampo(
        stats,
        [
          "chutesGol",
          "shotsOnGoal",
          "shots_on_goal",
          "noAlvo"
        ]
      ) ||
      numeroCampo(
        p,
        [
          "chutesGol",
          "shotsOnGoal"
        ]
      ),

    escanteios:
      numeroCampo(
        stats,
        [
          "escanteios",
          "corners",
          "cornerKicks"
        ]
      ) ||
      numeroCampo(
        p,
        [
          "escanteios",
          "corners"
        ]
      ),

    faltas:
      numeroCampo(
        stats,
        [
          "faltas",
          "fouls",
          "foulsCommitted"
        ]
      ) ||
      numeroCampo(
        p,
        [
          "faltas",
          "fouls"
        ]
      ),

    amarelos:
      numeroCampo(
        stats,
        [
          "amarelos",
          "yellowCards",
          "yellow_cards"
        ]
      ) ||
      numeroCampo(
        p,
        [
          "amarelos",
          "yellowCards"
        ]
      ),

    vermelhos:
      numeroCampo(
        stats,
        [
          "vermelhos",
          "redCards",
          "red_cards"
        ]
      ) ||
      numeroCampo(
        p,
        [
          "vermelhos",
          "redCards"
        ]
      )
  };
}

/* =========================================================
   RESUMO DA AMOSTRA
========================================================= */

function resumoAmostraHistorica(
  partidas
) {
  const lista =
    safeArray(partidas);

  const quantidade =
    lista.length;

  const totais = {
    gols: 0,
    golsSofridos: 0,
    chutes: 0,
    chutesGol: 0,
    escanteios: 0,
    faltas: 0,
    amarelos: 0,
    vermelhos: 0
  };

  lista.forEach(p => {
    const s =
      estatisticasPartidaHistorica(
        p
      );

    Object.keys(totais)
      .forEach(campo => {
        totais[campo] +=
          n(s[campo]);
      });
  });

  const medias = {};

  Object.keys(totais)
    .forEach(campo => {
      medias[campo] =
        quantidade
          ? totais[campo] /
            quantidade
          : 0;
    });

  return {
    quantidade,
    totais,
    medias
  };
}

/* =========================================================
   FREQUÊNCIA HISTÓRICA
========================================================= */

function frequenciaLinha(
  partidas,
  extrator,
  linha,
  comparador = ">="
) {
  const lista =
    safeArray(partidas);

  if (!lista.length) {
    return {
      acertos: 0,
      total: 0,
      percentual: 0
    };
  }

  let acertos = 0;

  lista.forEach(p => {
    const valor =
      n(
        extrator(
          estatisticasPartidaHistorica(
            p
          )
        )
      );

    let bateu = false;

    if (comparador === ">") {
      bateu =
        valor > linha;
    }

    else if (
      comparador === "<="
    ) {
      bateu =
        valor <= linha;
    }

    else if (
      comparador === "<"
    ) {
      bateu =
        valor < linha;
    }

    else {
      bateu =
        valor >= linha;
    }

    if (bateu) {
      acertos++;
    }
  });

  return {
    acertos,
    total: lista.length,
    percentual:
      pct(
        acertos,
        lista.length
      )
  };
}

/* =========================================================
   TENDÊNCIAS
========================================================= */

function gerarTendenciasHistoricas(
  partidas
) {
  if (!partidas.length) {
    return [];
  }

  const mercados = [
    {
      titulo: "1+ gol marcado",
      linha: 1,
      campo: s => s.gols
    },

    {
      titulo: "2+ gols marcados",
      linha: 2,
      campo: s => s.gols
    },

    {
      titulo: "3+ chutes no alvo",
      linha: 3,
      campo: s => s.chutesGol
    },

    {
      titulo: "4+ chutes no alvo",
      linha: 4,
      campo: s => s.chutesGol
    },

    {
      titulo: "8+ chutes",
      linha: 8,
      campo: s => s.chutes
    },

    {
      titulo: "10+ chutes",
      linha: 10,
      campo: s => s.chutes
    },

    {
      titulo: "3+ escanteios",
      linha: 3,
      campo: s => s.escanteios
    },

    {
      titulo: "4+ escanteios",
      linha: 4,
      campo: s => s.escanteios
    },

    {
      titulo: "5+ escanteios",
      linha: 5,
      campo: s => s.escanteios
    },

    {
      titulo: "8+ faltas",
      linha: 8,
      campo: s => s.faltas
    },

    {
      titulo: "10+ faltas",
      linha: 10,
      campo: s => s.faltas
    },

    {
      titulo: "1+ cartão amarelo",
      linha: 1,
      campo: s => s.amarelos
    },

    {
      titulo: "2+ cartões amarelos",
      linha: 2,
      campo: s => s.amarelos
    }
  ];

  return mercados
    .map(m => {
      const f =
        frequenciaLinha(
          partidas,
          m.campo,
          m.linha
        );

      return {
        ...m,
        ...f
      };
    })
    .sort(
      (a, b) =>
        b.percentual -
        a.percentual
    );
}

/* =========================================================
   CARD DE TENDÊNCIA
========================================================= */

function cardTendenciaHistorica(
  t
) {
  const qualificada =
    t.percentual >=
    CONFIG.frequenciaMinima;

  return `
    <div
      style="
        padding:12px;
        border-radius:12px;
        border:1px solid ${
          qualificada
            ? "rgba(46,229,139,.22)"
            : "rgba(255,255,255,.07)"
        };
        background:${
          qualificada
            ? "rgba(46,229,139,.045)"
            : "rgba(255,255,255,.025)"
        };
        margin-top:8px;
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
        <div
          style="
            font-size:13px;
            font-weight:900;
          "
        >
          ${e(t.titulo)}
        </div>

        <div
          style="
            color:${
              qualificada
                ? "#2ee58b"
                : "#fff"
            };
            font-size:17px;
            font-weight:950;
          "
        >
          ${t.percentual}%
        </div>
      </div>

      <div
        style="
          margin-top:5px;
          font-size:10px;
          opacity:.55;
        "
      >
        ${t.acertos}/${t.total}
        partidas

        ${
          qualificada
            ? " • frequência ≥ 80%"
            : ""
        }
      </div>
    </div>
  `;
}

/* =========================================================
   CARD DE EQUIPE NA ANÁLISE
========================================================= */

function cardAnaliseTime(
  lado,
  nome
) {
  const partidas =
    filtrarPartidasHistoricas(
      lado
    );

  const resumo =
    resumoAmostraHistorica(
      partidas
    );

  const tendencias =
    gerarTendenciasHistoricas(
      partidas
    );

  return `
    <div
      style="
        padding:14px;
        border-radius:15px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.025);
        margin-bottom:12px;
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
        <div
          style="
            font-size:16px;
            font-weight:950;
          "
        >
          ${e(nome)}
        </div>

        <div
          style="
            font-size:10px;
            opacity:.55;
            font-weight:900;
          "
        >
          ${resumo.quantidade}
          JOGO(S)
        </div>
      </div>

      ${
        resumo.quantidade
          ? `
            <div
              style="
                margin-top:12px;
                display:grid;
                grid-template-columns:repeat(2,1fr);
                gap:7px;
              "
            >
              ${miniResumoAnalise(
                "Gols",
                resumo.totais.gols,
                resumo.medias.gols
              )}

              ${miniResumoAnalise(
                "Chutes",
                resumo.totais.chutes,
                resumo.medias.chutes
              )}

              ${miniResumoAnalise(
                "No alvo",
                resumo.totais.chutesGol,
                resumo.medias.chutesGol
              )}

              ${miniResumoAnalise(
                "Escanteios",
                resumo.totais.escanteios,
                resumo.medias.escanteios
              )}

              ${miniResumoAnalise(
                "Faltas",
                resumo.totais.faltas,
                resumo.medias.faltas
              )}

              ${miniResumoAnalise(
                "Amarelos",
                resumo.totais.amarelos,
                resumo.medias.amarelos
              )}
            </div>

            <div
              style="
                margin-top:15px;
                font-size:11px;
                font-weight:950;
                color:#2ee58b;
              "
            >
              FREQUÊNCIA HISTÓRICA
            </div>

            ${
              tendencias
                .slice(0, 8)
                .map(
                  cardTendenciaHistorica
                )
                .join("")
            }
          `
          : `
            <div
              style="
                padding:18px 5px;
                text-align:center;
                opacity:.6;
                font-size:12px;
              "
            >
              Nenhuma partida encontrada
              com estes filtros.
            </div>
          `
      }
    </div>
  `;
}

function miniResumoAnalise(
  titulo,
  total,
  mediaValor
) {
  return `
    <div
      style="
        padding:10px;
        border-radius:11px;
        background:rgba(255,255,255,.035);
      "
    >
      <div
        style="
          font-size:9px;
          opacity:.5;
          font-weight:900;
          text-transform:uppercase;
        "
      >
        ${e(titulo)}
      </div>

      <div
        style="
          margin-top:5px;
          display:flex;
          justify-content:space-between;
          gap:7px;
          align-items:end;
        "
      >
        <div>
          <strong
            style="
              font-size:17px;
            "
          >
            ${n(total).toFixed(0)}
          </strong>

          <div
            style="
              font-size:8px;
              opacity:.45;
            "
          >
            TOTAL
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
            "
          >
            ${n(mediaValor).toFixed(1)}
          </strong>

          <div
            style="
              font-size:8px;
              opacity:.45;
            "
          >
            MÉDIA
          </div>
        </div>
      </div>
    </div>
  `;
}

/* =========================================================
   CONTROLES DA ANÁLISE
========================================================= */

function controlesAnaliseHistorica() {
  const campeonatos =
    campeonatosHistorico();

  return `
    <div
      style="
        display:flex;
        gap:7px;
        overflow-x:auto;
        margin-bottom:9px;
      "
    >
      ${botao(
        "Últimas 5",
        "mudarQuantidadeHistorico(5)",
        filtroHistorico.quantidade === 5
      )}

      ${botao(
        "Últimas 10",
        "mudarQuantidadeHistorico(10)",
        filtroHistorico.quantidade === 10
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
        "Geral",
        "mudarLocalHistorico('geral')",
        filtroHistorico.local ===
          "geral"
      )}

      ${botao(
        "Casa",
        "mudarLocalHistorico('casa')",
        filtroHistorico.local ===
          "casa"
      )}

      ${botao(
        "Fora",
        "mudarLocalHistorico('fora')",
        filtroHistorico.local ===
          "fora"
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
          filtroHistorico.campeonato ===
          "todos"
            ? "selected"
            : ""
        }
      >
        Todos os campeonatos
      </option>

      ${
        campeonatos
          .map(c => `
            <option
              value="${e(c.id)}"
              ${
                String(
                  filtroHistorico.campeonato
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
  `;
}

/* =========================================================
   RENDER DA ANÁLISE
========================================================= */

function renderAnaliseAutomatica() {
  return `
    ${painel(`
      ${tituloSecao(
        "Análise Profianalises",
        "Filtros aplicados ao histórico real disponível."
      )}

      ${controlesAnaliseHistorica()}

      <div
        style="
          margin-top:12px;
          padding:10px;
          border-radius:10px;
          background:rgba(46,229,139,.045);
          border:1px solid rgba(46,229,139,.12);
          font-size:10px;
          line-height:1.6;
          opacity:.8;
        "
      >
        Frequência histórica mostra
        quantas vezes uma linha ocorreu
        na amostra selecionada.
        Ela não representa garantia
        nem probabilidade futura.
      </div>
    `)}

    ${cardAnaliseTime(
      "casa",
      partidaAtual?.home?.name ||
      "Casa"
    )}

    ${cardAnaliseTime(
      "fora",
      partidaAtual?.away?.name ||
      "Fora"
    )}
  `;
      }
/* =========================================================
   ESCALAÇÕES
========================================================= */

function extrairEscalacoes() {
  const fonte =
    partidaAtual?.lineups;

  if (Array.isArray(fonte)) {
    return fonte;
  }

  if (Array.isArray(fonte?.response)) {
    return fonte.response;
  }

  if (Array.isArray(fonte?.lineups)) {
    return fonte.lineups;
  }

  return [];
}

function encontrarEscalacaoTime(
  teamId
) {
  return extrairEscalacoes()
    .find(item => {
      const id =
        item?.team?.id ||
        item?.time?.id ||
        item?.teamId;

      return (
        Number(id) ===
        Number(teamId)
      );
    }) || null;
}

function extrairTitulares(
  lineup
) {
  if (!lineup) return [];

  const fontes = [
    lineup.startXI,
    lineup.startingXI,
    lineup.titulares,
    lineup.players
  ];

  for (const fonte of fontes) {
    if (Array.isArray(fonte)) {
      return fonte.map(item => {
        const p =
          item.player ||
          item.jogador ||
          item;

        return {
          id:
            p?.id ||
            item?.id,

          nome:
            p?.name ||
            p?.nome ||
            item?.name ||
            item?.nome ||
            "Jogador",

          numero:
            p?.number ??
            p?.numero ??
            item?.number ??
            item?.numero ??
            null,

          posicao:
            p?.pos ||
            p?.position ||
            p?.posicao ||
            item?.pos ||
            item?.position ||
            "",

          grid:
            p?.grid ||
            item?.grid ||
            "",

          foto:
            p?.photo ||
            p?.foto ||
            ""
        };
      });
    }
  }

  return [];
}

function extrairReservas(
  lineup
) {
  if (!lineup) return [];

  const fontes = [
    lineup.substitutes,
    lineup.reservas,
    lineup.bench
  ];

  for (const fonte of fontes) {
    if (Array.isArray(fonte)) {
      return fonte.map(item => {
        const p =
          item.player ||
          item.jogador ||
          item;

        return {
          id:
            p?.id ||
            item?.id,

          nome:
            p?.name ||
            p?.nome ||
            item?.name ||
            item?.nome ||
            "Jogador",

          numero:
            p?.number ??
            p?.numero ??
            item?.number ??
            item?.numero ??
            null,

          posicao:
            p?.pos ||
            p?.position ||
            p?.posicao ||
            item?.pos ||
            item?.position ||
            "",

          foto:
            p?.photo ||
            p?.foto ||
            ""
        };
      });
    }
  }

  return [];
}

/* =========================================================
   POSIÇÃO NO CAMPO
========================================================= */

function posicaoGridJogador(
  jogador,
  indice,
  total
) {
  const grid =
    String(
      jogador?.grid || ""
    );

  const partes =
    grid.split(":");

  if (
    partes.length === 2 &&
    Number(partes[0]) &&
    Number(partes[1])
  ) {
    const linha =
      Number(partes[0]);

    const coluna =
      Number(partes[1]);

    const linhas = 5;

    const top =
      Math.min(
        88,
        Math.max(
          8,
          8 +
          ((linha - 1) /
            Math.max(
              1,
              linhas - 1
            )) *
            78
        )
      );

    let quantidadeLinha = 1;

    const mesmaLinha =
      total.filter
        ? total.filter(
            p =>
              String(p.grid || "")
                .split(":")[0] ===
              String(linha)
          )
        : [];

    if (mesmaLinha.length) {
      quantidadeLinha =
        mesmaLinha.length;
    }

    const left =
      quantidadeLinha === 1
        ? 50
        : Math.min(
            88,
            Math.max(
              12,
              (
                coluna /
                (quantidadeLinha + 1)
              ) *
                100
            )
          );

    return {
      top,
      left
    };
  }

  const colunas = 4;

  const linha =
    Math.floor(
      indice / colunas
    );

  const coluna =
    indice % colunas;

  return {
    top:
      15 +
      linha * 29,

    left:
      15 +
      coluna * 23
  };
}

/* =========================================================
   CAMPO VISUAL
========================================================= */

function campoEscalacao(
  jogadores,
  lado = "casa"
) {
  const lista =
    safeArray(jogadores);

  if (!lista.length) {
    return `
      <div
        style="
          padding:22px;
          text-align:center;
          opacity:.6;
        "
      >
        Escalação ainda não disponível.
      </div>
    `;
  }

  return `
    <div
      style="
        position:relative;
        height:500px;
        overflow:hidden;
        border-radius:18px;
        border:1px solid rgba(255,255,255,.12);
        background:
          linear-gradient(
            rgba(0,0,0,.10),
            rgba(0,0,0,.10)
          ),
          repeating-linear-gradient(
            0deg,
            rgba(46,229,139,.10) 0,
            rgba(46,229,139,.10) 62px,
            rgba(46,229,139,.06) 62px,
            rgba(46,229,139,.06) 124px
          );
      "
    >

      <div
        style="
          position:absolute;
          left:50%;
          top:0;
          bottom:0;
          width:1px;
          background:rgba(255,255,255,.18);
        "
      ></div>

      <div
        style="
          position:absolute;
          width:110px;
          height:110px;
          border:1px solid rgba(255,255,255,.18);
          border-radius:50%;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
        "
      ></div>

      <div
        style="
          position:absolute;
          left:50%;
          top:50%;
          width:5px;
          height:5px;
          background:rgba(255,255,255,.4);
          border-radius:50%;
          transform:translate(-50%,-50%);
        "
      ></div>

      ${
        lista
          .map((p, i) => {
            const pos =
              posicaoGridJogador(
                p,
                i,
                lista
              );

            const foto =
              fotoJogador(p);

            return `
              <button
                type="button"
                onclick="abrirJogador(${Number(
                  p.id || 0
                )})"
                style="
                  position:absolute;
                  top:${pos.top}%;
                  left:${pos.left}%;
                  transform:translate(-50%,-50%);
                  width:72px;
                  border:0;
                  background:transparent;
                  color:#fff;
                  text-align:center;
                  cursor:pointer;
                "
              >
                <div
                  style="
                    position:relative;
                    width:42px;
                    height:42px;
                    margin:auto;
                    border-radius:50%;
                    background:#101820;
                    border:2px solid ${
                      lado === "casa"
                        ? "#2ee58b"
                        : "rgba(255,255,255,.7)"
                    };
                    overflow:hidden;
                  "
                >
                  ${
                    foto
                      ? `
                        <img
                          src="${e(foto)}"
                          onerror="this.style.display='none'"
                          style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                          "
                        >
                      `
                      : ""
                  }

                  ${
                    p.numero != null
                      ? `
                        <div
                          style="
                            position:absolute;
                            right:-1px;
                            bottom:-1px;
                            min-width:15px;
                            height:15px;
                            border-radius:8px;
                            padding:0 3px;
                            background:#050b10;
                            color:#2ee58b;
                            font-size:8px;
                            font-weight:950;
                            line-height:15px;
                          "
                        >
                          ${e(p.numero)}
                        </div>
                      `
                      : ""
                  }
                </div>

                <div
                  style="
                    margin-top:4px;
                    font-size:9px;
                    line-height:1.15;
                    font-weight:950;
                    text-shadow:0 1px 3px #000;
                  "
                >
                  ${e(
                    String(p.nome)
                      .split(" ")
                      .slice(-1)[0]
                  )}
                </div>
              </button>
            `;
          })
          .join("")
      }
    </div>
  `;
}

/* =========================================================
   LISTA DE RESERVAS
========================================================= */

function listaReservas(
  reservas
) {
  if (!reservas.length) {
    return `
      <div
        style="
          padding:12px;
          text-align:center;
          opacity:.55;
          font-size:11px;
        "
      >
        Reservas não disponíveis.
      </div>
    `;
  }

  return `
    <div
      style="
        display:grid;
        gap:7px;
      "
    >
      ${
        reservas
          .map(p => `
            <button
              onclick="abrirJogador(${Number(
                p.id || 0
              )})"
              style="
                display:flex;
                align-items:center;
                gap:9px;
                width:100%;
                padding:9px;
                border:1px solid rgba(255,255,255,.07);
                border-radius:10px;
                background:rgba(255,255,255,.025);
                color:#fff;
                text-align:left;
              "
            >
              <div
                style="
                  width:27px;
                  text-align:center;
                  color:#2ee58b;
                  font-weight:950;
                "
              >
                ${e(p.numero ?? "-")}
              </div>

              <div style="flex:1">
                <div style="font-weight:850">
                  ${e(p.nome)}
                </div>

                <div
                  style="
                    margin-top:2px;
                    font-size:9px;
                    opacity:.5;
                  "
                >
                  ${e(p.posicao || "")}
                </div>
              </div>
            </button>
          `)
          .join("")
      }
    </div>
  `;
}

/* =========================================================
   RENDER ESCALAÇÕES
========================================================= */

function renderEscalacoes() {
  const casa =
    encontrarEscalacaoTime(
      partidaAtual?.home?.id
    );

  const fora =
    encontrarEscalacaoTime(
      partidaAtual?.away?.id
    );

  if (!casa && !fora) {
    return painel(`
      ${tituloSecao(
        "Escalações",
        "As escalações dependem da publicação oficial e da cobertura da competição."
      )}

      <div
        style="
          padding:20px;
          text-align:center;
          background:rgba(255,255,255,.03);
          border-radius:13px;
        "
      >
        <strong>
          Escalações ainda não disponíveis
        </strong>

        <div
          style="
            margin-top:7px;
            font-size:11px;
            opacity:.55;
            line-height:1.5;
          "
        >
          Quando fornecidas pela API, normalmente aparecem
          próximo do início da partida.
        </div>
      </div>
    `);
  }

  const titularesCasa =
    extrairTitulares(casa);

  const titularesFora =
    extrairTitulares(fora);

  const reservasCasa =
    extrairReservas(casa);

  const reservasFora =
    extrairReservas(fora);

  return `
    ${painel(`
      ${tituloSecao(
        "Escalações",
        "Formação e jogadores disponíveis para a partida."
      )}

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-bottom:12px;
        "
      >
        <div
          style="
            padding:11px;
            border-radius:11px;
            background:rgba(46,229,139,.06);
          "
        >
          <strong>
            ${e(partidaAtual?.home?.name)}
          </strong>

          <div
            style="
              margin-top:3px;
              font-size:10px;
              opacity:.55;
            "
          >
            ${e(
              casa?.formation ||
              casa?.formacao ||
              "-"
            )}
          </div>
        </div>

        <div
          style="
            padding:11px;
            border-radius:11px;
            background:rgba(255,255,255,.035);
          "
        >
          <strong>
            ${e(partidaAtual?.away?.name)}
          </strong>

          <div
            style="
              margin-top:3px;
              font-size:10px;
              opacity:.55;
            "
          >
            ${e(
              fora?.formation ||
              fora?.formacao ||
              "-"
            )}
          </div>
        </div>
      </div>
    `)}

    ${painel(`
      ${tituloSecao(
        partidaAtual?.home?.name ||
        "Casa",
        casa?.formation
          ? `Formação ${casa.formation}`
          : "Titulares"
      )}

      ${campoEscalacao(
        titularesCasa,
        "casa"
      )}
    `)}

    ${painel(`
      ${tituloSecao(
        partidaAtual?.away?.name ||
        "Fora",
        fora?.formation
          ? `Formação ${fora.formation}`
          : "Titulares"
      )}

      ${campoEscalacao(
        titularesFora,
        "fora"
      )}
    `)}

    ${painel(`
      ${tituloSecao(
        "Banco de reservas",
        "Jogadores relacionados"
      )}

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        "
      >
        <div>
          <div
            style="
              margin-bottom:8px;
              font-size:11px;
              font-weight:950;
              color:#2ee58b;
            "
          >
            ${e(partidaAtual?.home?.name)}
          </div>

          ${listaReservas(reservasCasa)}
        </div>

        <div>
          <div
            style="
              margin-bottom:8px;
              font-size:11px;
              font-weight:950;
            "
          >
            ${e(partidaAtual?.away?.name)}
          </div>

          ${listaReservas(reservasFora)}
        </div>
      </div>
    `)}
  `;
}

/* =========================================================
   JOGADORES DA PARTIDA
========================================================= */

function normalizarJogadorPartida(
  p = {},
  team = {}
) {
  const jogador =
    p.player ||
    p.jogador ||
    p;

  const stats =
    Array.isArray(p.statistics)
      ? p.statistics[0] || {}
      : p.statistics ||
        p.stats ||
        {};

  return {
    id:
      jogador.id ||
      p.id,

    nome:
      jogador.name ||
      jogador.nome ||
      p.name ||
      p.nome ||
      "Jogador",

    foto:
      jogador.photo ||
      jogador.foto ||
      p.photo ||
      p.foto ||
      "",

    teamId:
      team.id ||
      p.teamId,

    teamName:
      team.name ||
      p.teamName ||
      "",

    numero:
      stats.games?.number ??
      stats.numero ??
      p.numero ??
      null,

    posicao:
      stats.games?.position ||
      stats.games?.pos ||
      stats.posicao ||
      p.posicao ||
      "",

    minutos:
      n(
        stats.games?.minutes ??
        stats.minutos ??
        p.minutos
      ),

    nota:
      Number(
        stats.games?.rating ??
        stats.nota ??
        p.nota ??
        0
      ),

    chutes:
      n(
        stats.shots?.total ??
        stats.chutes ??
        p.chutes
      ),

    chutesGol:
      n(
        stats.shots?.on ??
        stats.chutesGol ??
        p.chutesGol
      ),

    gols:
      n(
        stats.goals?.total ??
        stats.gols ??
        p.gols
      ),

    assistencias:
      n(
        stats.goals?.assists ??
        stats.assistencias ??
        p.assistencias
      ),

    passes:
      n(
        stats.passes?.total ??
        stats.passes ??
        p.passes
      ),

    passesChave:
      n(
        stats.passes?.key ??
        stats.passesChave ??
        p.passesChave
      ),

    desarmes:
      n(
        stats.tackles?.total ??
        stats.desarmes ??
        p.desarmes
      ),

    faltasCometidas:
      n(
        stats.fouls?.committed ??
        stats.faltasCometidas ??
        p.faltasCometidas
      ),

    faltasSofridas:
      n(
        stats.fouls?.drawn ??
        stats.faltasSofridas ??
        p.faltasSofridas
      ),

    amarelos:
      n(
        stats.cards?.yellow ??
        stats.amarelos ??
        p.amarelos
      ),

    vermelhos:
      n(
        stats.cards?.red ??
        stats.vermelhos ??
        p.vermelhos
      )
  };
}

function extrairJogadoresPartida() {
  const resultado = [];

  safeArray(
    partidaAtual?.jogadores
  ).forEach(bloco => {
    const team =
      bloco.team ||
      bloco.time ||
      {};

    const players =
      bloco.players ||
      bloco.jogadores;

    if (Array.isArray(players)) {
      players.forEach(p => {
        resultado.push(
          normalizarJogadorPartida(
            p,
            team
          )
        );
      });
    } else {
      resultado.push(
        normalizarJogadorPartida(
          bloco,
          team
        )
      );
    }
  });

  return resultado.filter(
    p => p.id || p.nome
  );
}

/* =========================================================
   CARD JOGADOR
========================================================= */

function cardJogadorPartida(
  p
) {
  const foto =
    fotoJogador(p);

  return `
    <button
      onclick="abrirJogador(${Number(
        p.id || 0
      )})"
      style="
        width:100%;
        padding:11px;
        border:1px solid rgba(255,255,255,.07);
        border-radius:12px;
        background:rgba(255,255,255,.025);
        color:#fff;
        text-align:left;
        margin-bottom:7px;
      "
    >
      <div
        style="
          display:flex;
          align-items:center;
          gap:10px;
        "
      >
        <div
          style="
            width:42px;
            height:42px;
            border-radius:50%;
            overflow:hidden;
            background:rgba(255,255,255,.07);
            flex:0 0 auto;
          "
        >
          ${
            foto
              ? `
                <img
                  src="${e(foto)}"
                  onerror="this.style.display='none'"
                  style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                  "
                >
              `
              : ""
          }
        </div>

        <div
          style="
            min-width:0;
            flex:1;
          "
        >
          <div
            style="
              font-size:13px;
              font-weight:950;
              overflow:hidden;
              white-space:nowrap;
                              
                    text-overflow:ellipsis;
            "
          >
            ${
              p.numero != null
                ? `${e(p.numero)}. `
                : ""
            }
            ${e(p.nome)}
          </div>

          <div
            style="
              margin-top:3px;
              font-size:9px;
              opacity:.5;
            "
          >
            ${e(p.posicao || "-")}
            • ${p.minutos || 0} min
          </div>
        </div>

        ${
          p.nota
            ? `
              <div
                style="
                  min-width:34px;
                  padding:6px;
                  border-radius:8px;
                  background:rgba(46,229,139,.09);
                  color:#2ee58b;
                  text-align:center;
                  font-size:12px;
                  font-weight:950;
                "
              >
                ${p.nota.toFixed(1)}
              </div>
            `
            : ""
        }
      </div>

      <div
        style="
          margin-top:10px;
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:5px;
          text-align:center;
        "
      >
        <div>
          <strong>${p.chutes}</strong>
          <div style="font-size:8px;opacity:.45">
            CHUTES
          </div>
        </div>

        <div>
          <strong>${p.chutesGol}</strong>
          <div style="font-size:8px;opacity:.45">
            NO ALVO
          </div>
        </div>

        <div>
          <strong>${p.faltasCometidas}</strong>
          <div style="font-size:8px;opacity:.45">
            FALTAS
          </div>
        </div>

        <div>
          <strong>${p.desarmes}</strong>
          <div style="font-size:8px;opacity:.45">
            DESARMES
          </div>
        </div>
      </div>
    </button>
  `;
}

/* =========================================================
   RANKING DE JOGADORES
========================================================= */

let rankingJogadoresCampo =
  "chutes";

function mudarRankingJogadores(
  campo
) {
  const permitidos = [
    "chutes",
    "chutesGol",
    "faltasCometidas",
    "faltasSofridas",
    "desarmes",
    "passes",
    "passesChave"
  ];

  if (
    permitidos.includes(campo)
  ) {
    rankingJogadoresCampo =
      campo;
  }

  renderPaginaPartida();
}

function nomeCampoRanking(
  campo
) {
  const mapa = {
    chutes: "Chutes",
    chutesGol: "No alvo",
    faltasCometidas: "Faltas",
    faltasSofridas: "Faltas sofridas",
    desarmes: "Desarmes",
    passes: "Passes",
    passesChave: "Passes-chave"
  };

  return mapa[campo] || campo;
}

function rankingTime(
  jogadores,
  teamId
) {
  return jogadores
    .filter(
      p =>
        Number(p.teamId) ===
        Number(teamId)
    )
    .sort(
      (a, b) =>
        n(
          b[
            rankingJogadoresCampo
          ]
        ) -
        n(
          a[
            rankingJogadoresCampo
          ]
        )
    )
    .slice(0, 8);
}

function colunaRanking(
  jogadores,
  team
) {
  const ranking =
    rankingTime(
      jogadores,
      team?.id
    );

  return `
    <div>
      <div
        style="
          margin-bottom:8px;
          font-size:11px;
          font-weight:950;
        "
      >
        ${e(team?.name || "-")}
      </div>

      ${
        ranking.length
          ? ranking
              .map((p, i) => `
                <button
                  onclick="abrirJogador(${Number(
                    p.id || 0
                  )})"
                  style="
                    width:100%;
                    display:grid;
                    grid-template-columns:22px 1fr auto;
                    gap:7px;
                    align-items:center;
                    padding:8px 5px;
                    border:0;
                    border-bottom:1px solid rgba(255,255,255,.06);
                    background:transparent;
                    color:#fff;
                    text-align:left;
                  "
                >
                  <span
                    style="
                      color:${
                        i === 0
                          ? "#2ee58b"
                          : "rgba(255,255,255,.4)"
                      };
                      font-weight:950;
                    "
                  >
                    ${i + 1}
                  </span>

                  <span
                    style="
                      overflow:hidden;
                      white-space:nowrap;
                      text-overflow:ellipsis;
                      font-size:11px;
                      font-weight:800;
                    "
                  >
                    ${e(p.nome)}
                  </span>

                  <strong
                    style="
                      color:#2ee58b;
                    "
                  >
                    ${n(
  p[
    rankingJogadoresCampo
  ]
).toLocaleString(
  "pt-BR",
  {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }
)}
                  </strong>
                </button>
              `)
              .join("")
          : `
            <div
              style="
                padding:15px 0;
                opacity:.5;
                font-size:11px;
              "
            >
              Sem dados.
            </div>
          `
      }
    </div>
  `;
}

/* =========================================================
   RENDER JOGADORES
========================================================= */

let filtroRankingHistorico = {
  quantidade: 5,
  local: "geral"
};

function mudarRankingHistoricoQuantidade(qtd) {
  filtroRankingHistorico.quantidade =
    Number(qtd) === 10 ? 10 : 5;

  const scrollAntes = window.scrollY;

renderPaginaPartida();

requestAnimationFrame(() => {
  window.scrollTo(0, scrollAntes);
});
}

function mudarRankingHistoricoLocal(local) {
  if (
    ["geral", "casa", "fora"].includes(local)
  ) {
    filtroRankingHistorico.local = local;
  }

  const scrollAntes = window.scrollY;

renderPaginaPartida();

requestAnimationFrame(() => {
  window.scrollTo(0, scrollAntes);
});
}
function jogadoresHistoricosRanking(lado) {
  const quantidade =
    filtroRankingHistorico.quantidade;

  let partidas =
    partidasHistoricoLado(
      lado,
      quantidade
    );

  if (
    filtroRankingHistorico.local === "casa"
  ) {
    partidas =
      partidas.filter(
        p =>
          String(p?.local || "")
            .toLowerCase() === "casa"
      );
  }

  if (
    filtroRankingHistorico.local === "fora"
  ) {
    partidas =
      partidas.filter(
        p =>
          String(p?.local || "")
            .toLowerCase() === "fora"
      );
  }

  const mapa = new Map();

  partidas.forEach(partida => {
    safeArray(
      partida?.jogadores
    ).forEach(j => {
      const id =
        Number(j?.id || 0);

      if (!id) return;

      if (!mapa.has(id)) {
        mapa.set(id, {
          id,
          nome:
            j?.nome ||
            j?.name ||
            "Jogador",

          foto:
            j?.foto ||
            j?.photo ||
            `${API}/logo/player/${id}`,

          chutes: 0,
          chutesGol: 0,
          faltasCometidas: 0,
          desarmes: 0,
          passes: 0,
          partidas: 0
        });
      }

      const item =
        mapa.get(id);

      item.partidas++;

      item.chutes +=
        n(j?.chutes);

      item.chutesGol +=
        n(j?.chutesGol);

      item.faltasCometidas +=
        n(j?.faltasCometidas);

      item.desarmes +=
        n(j?.desarmes);

      item.passes +=
        n(j?.passes);
    });
  });

  return [...mapa.values()]
    .map(j => {
      const qtd =
        Math.max(
          1,
          j.partidas
        );

      return {
        ...j,

        chutes:
          j.chutes / qtd,

        chutesGol:
          j.chutesGol / qtd,

        faltasCometidas:
          j.faltasCometidas / qtd,

        desarmes:
          j.desarmes / qtd,

        passes:
          j.passes / qtd
      };
    });
}
function renderJogadores() {
  const jogadores =
    extrairJogadoresPartida();
  const rankingCasaHistorico =
    jogadoresHistoricosRanking("casa");

  const rankingForaHistorico =
    jogadoresHistoricosRanking("fora");
  
  const casa =
    jogadores.filter(
      p =>
        Number(p.teamId) ===
        Number(
          partidaAtual?.home?.id
        )
    );

  const fora =
    jogadores.filter(
      p =>
        Number(p.teamId) ===
        Number(
          partidaAtual?.away?.id
        )
    );
  
  return `
    ${painel(`
      ${tituloSecao(
        "Ranking de jogadores",
        "Compare os líderes de cada equipe na partida."
      )}

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
          max-width:100%;
          min-width:0;
          margin-bottom:10px;
        "
      >
        ${botao(
          "Últimos 5",
          "mudarRankingHistoricoQuantidade(5)",
          filtroRankingHistorico.quantidade === 5
        )}

        ${botao(
          "Últimos 10",
          "mudarRankingHistoricoQuantidade(10)",
          filtroRankingHistorico.quantidade === 10
        )}
      </div>

      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
          max-width:100%;
          min-width:0;
          margin-bottom:15px;
        "
      >
        ${botao(
          "Geral",
          "mudarRankingHistoricoLocal('geral')",
          filtroRankingHistorico.local === "geral"
        )}

        ${botao(
          "Casa",
          "mudarRankingHistoricoLocal('casa')",
          filtroRankingHistorico.local === "casa"
        )}

        ${botao(
          "Fora",
          "mudarRankingHistoricoLocal('fora')",
          filtroRankingHistorico.local === "fora"
        )}
      </div>
      <div
        style="
          display:flex;
          gap:7px;
          overflow-x:auto;
          margin-bottom:15px;
        "
      >
        ${botao(
          "Chutes",
          "mudarRankingJogadores('chutes')",
          rankingJogadoresCampo ===
            "chutes"
        )}

        ${botao(
          "No alvo",
          "mudarRankingJogadores('chutesGol')",
          rankingJogadoresCampo ===
            "chutesGol"
        )}

        ${botao(
          "Faltas",
          "mudarRankingJogadores('faltasCometidas')",
          rankingJogadoresCampo ===
            "faltasCometidas"
        )}

        ${botao(
          "Desarmes",
          "mudarRankingJogadores('desarmes')",
          rankingJogadoresCampo ===
            "desarmes"
        )}

        ${botao(
          "Passes",
          "mudarRankingJogadores('passes')",
          rankingJogadoresCampo ===
            "passes"
        )}
      </div>

      <div
        style="
          padding:9px 10px;
          border-radius:10px;
          background:rgba(46,229,139,.045);
          font-size:10px;
          margin-bottom:12px;
        "
      >
        Ordenado por:
        <strong style="color:#2ee58b">
          ${e(
            nomeCampoRanking(
              rankingJogadoresCampo
            )
          )}
        </strong>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:12px;
        "
      >
      ${colunaRanking(
  rankingCasaHistorico.map(p => ({
    ...p,
    teamId: partidaAtual?.home?.id
  })),
  partidaAtual?.home
)}

${colunaRanking(
  rankingForaHistorico.map(p => ({
    ...p,
    teamId: partidaAtual?.away?.id
  })),
  partidaAtual?.away
)}
      </div>
    `)}
    
    ${painel(`
      ${tituloSecao(
        "Jogadores da partida",
        "Estatísticas disponíveis no jogo atual."
      )}

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:12px;
        "
      >
        <div>
          <div
            style="
              margin-bottom:10px;
              font-size:12px;
              font-weight:950;
              color:#2ee58b;
            "
          >
            ${e(
              partidaAtual?.home?.name
            )}
          </div>

          ${
            casa.length
              ? casa
                  .map(
                    cardJogadorPartida
                  )
                  .join("")
              : `
                <div
                  style="
                    opacity:.5;
                    font-size:11px;
                  "
                >
                  Sem estatísticas individuais.
                </div>
              `
          }
        </div>

        <div>
          <div
            style="
              margin-bottom:10px;
              font-size:12px;
              font-weight:950;
            "
          >
            ${e(
              partidaAtual?.away?.name
            )}
          </div>

          ${
            fora.length
              ? fora
                  .map(
                    cardJogadorPartida
                  )
                  .join("")
              : `
                <div
                  style="
                    opacity:.5;
                    font-size:11px;
                  "
                >
                  Sem estatísticas individuais.
                </div>
              `
          }
        </div>
      </div>
    `)}
  `;
}
/* =========================================================
   ESTATÍSTICAS DETALHADAS DA PARTIDA
========================================================= */

function extrairBlocosEstatisticas() {
  const fonte =
    partidaAtual?.estatisticas;

  if (Array.isArray(fonte)) {
    return fonte;
  }

  if (Array.isArray(fonte?.response)) {
    return fonte.response;
  }

  if (Array.isArray(fonte?.statistics)) {
    return fonte.statistics;
  }

  return [];
}

function blocoEstatisticaTime(
  teamId
) {
  return extrairBlocosEstatisticas()
    .find(bloco => {
      const id =
        bloco?.team?.id ||
        bloco?.time?.id ||
        bloco?.teamId;

      return (
        Number(id) ===
        Number(teamId)
      );
    }) || null;
}

function listaEstatisticasTime(
  teamId
) {
  const bloco =
    blocoEstatisticaTime(
      teamId
    );

  if (!bloco) {
    return [];
  }

  if (
    Array.isArray(
      bloco.statistics
    )
  ) {
    return bloco.statistics;
  }

  if (
    Array.isArray(
      bloco.estatisticas
    )
  ) {
    return bloco.estatisticas;
  }

  return [];
}

function mapaEstatisticasTime(
  teamId
) {
  const mapa = {};

  listaEstatisticasTime(
    teamId
  ).forEach(item => {
    const tipo =
      String(
        item?.type ||
        item?.nome ||
        ""
      ).trim();

    if (!tipo) {
      return;
    }

    mapa[tipo] =
      item?.value ??
      item?.valor ??
      0;
  });

  return mapa;
}

function encontrarStat(
  mapa,
  nomes = []
) {
  for (const nome of nomes) {
    if (
      mapa[nome] !==
      undefined
    ) {
      return mapa[nome];
    }
  }

  return 0;
}

function numeroStat(
  valorStat
) {
  if (
    valorStat === null ||
    valorStat === undefined
  ) {
    return 0;
  }

  const numero =
    Number(
      String(valorStat)
        .replace("%", "")
        .replace(",", ".")
    );

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function linhaComparacaoStat(
  titulo,
  casa,
  fora,
  percentual = false
) {
  const numeroCasa =
    numeroStat(casa);

  const numeroFora =
    numeroStat(fora);

  const total =
    numeroCasa +
    numeroFora;

  const larguraCasa =
    total > 0
      ? (
          numeroCasa /
          total
        ) * 100
      : 50;

  const larguraFora =
    total > 0
      ? (
          numeroFora /
          total
        ) * 100
      : 50;

  const mostrarCasa =
    percentual
      ? `${numeroCasa}%`
      : String(
          casa ?? 0
        );

  const mostrarFora =
    percentual
      ? `${numeroFora}%`
      : String(
          fora ?? 0
        );

  return `
    <div
      style="
        padding:11px 0;
        border-bottom:1px solid rgba(255,255,255,.06);
      "
    >
      <div
        style="
          display:grid;
          grid-template-columns:45px 1fr 45px;
          align-items:center;
          gap:8px;
        "
      >
        <strong
          style="
            text-align:left;
            font-size:13px;
          "
        >
          ${e(mostrarCasa)}
        </strong>

        <div
          style="
            text-align:center;
            font-size:10px;
            opacity:.65;
            font-weight:800;
          "
        >
          ${e(titulo)}
        </div>

        <strong
          style="
            text-align:right;
            font-size:13px;
          "
        >
          ${e(mostrarFora)}
        </strong>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:4px;
          margin-top:7px;
        "
      >
        <div
          style="
            height:5px;
            background:rgba(255,255,255,.06);
            border-radius:5px;
            overflow:hidden;
            display:flex;
            justify-content:flex-end;
          "
        >
          <div
            style="
              height:100%;
              width:${larguraCasa}%;
              background:#2ee58b;
              border-radius:5px;
            "
          ></div>
        </div>

        <div
          style="
            height:5px;
            background:rgba(255,255,255,.06);
            border-radius:5px;
            overflow:hidden;
          "
        >
          <div
            style="
              height:100%;
              width:${larguraFora}%;
              background:rgba(255,255,255,.65);
              border-radius:5px;
            "
          ></div>
        </div>
      </div>
    </div>
  `;
}

function renderEstatisticasPartida() {
  const casa =
    mapaEstatisticasTime(
      partidaAtual?.home?.id
    );

  const fora =
    mapaEstatisticasTime(
      partidaAtual?.away?.id
    );

  const temDados =
    Object.keys(casa).length ||
    Object.keys(fora).length;

  if (!temDados) {
    return painel(`
      ${tituloSecao(
        "Estatísticas",
        "Dados detalhados da partida"
      )}

      <div
        style="
          padding:20px;
          text-align:center;
          opacity:.6;
        "
      >
        Estatísticas ainda não disponíveis.
      </div>
    `);
  }

  const linhas = [
    {
      titulo: "Chutes",
      casa: encontrarStat(
        casa,
        [
          "Total Shots",
          "Shots"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Total Shots",
          "Shots"
        ]
      )
    },

    {
      titulo: "Chutes no alvo",
      casa: encontrarStat(
        casa,
        [
          "Shots on Goal"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Shots on Goal"
        ]
      )
    },

    {
      titulo: "Chutes para fora",
      casa: encontrarStat(
        casa,
        [
          "Shots off Goal"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Shots off Goal"
        ]
      )
    },

    {
      titulo: "Chutes bloqueados",
      casa: encontrarStat(
        casa,
        [
          "Blocked Shots"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Blocked Shots"
        ]
      )
    },

    {
      titulo: "Escanteios",
      casa: encontrarStat(
        casa,
        [
          "Corner Kicks"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Corner Kicks"
        ]
      )
    },

    {
      titulo: "Posse de bola",
      casa: encontrarStat(
        casa,
        [
          "Ball Possession"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Ball Possession"
        ]
      ),
      percentual: true
    },

    {
      titulo: "Faltas",
      casa: encontrarStat(
        casa,
        [
          "Fouls"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Fouls"
        ]
      )
    },

    {
      titulo: "Impedimentos",
      casa: encontrarStat(
        casa,
        [
          "Offsides"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Offsides"
        ]
      )
    },

    {
      titulo: "Cartões amarelos",
      casa: encontrarStat(
        casa,
        [
          "Yellow Cards"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Yellow Cards"
        ]
      )
    },

    {
      titulo: "Cartões vermelhos",
      casa: encontrarStat(
        casa,
        [
          "Red Cards"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Red Cards"
        ]
      )
    },

    {
      titulo: "Defesas do goleiro",
      casa: encontrarStat(
        casa,
        [
          "Goalkeeper Saves"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Goalkeeper Saves"
        ]
      )
    },

    {
      titulo: "Passes",
      casa: encontrarStat(
        casa,
        [
          "Total passes",
          "Total Passes"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Total passes",
          "Total Passes"
        ]
      )
    },

    {
      titulo: "Passes certos",
      casa: encontrarStat(
        casa,
        [
          "Passes accurate",
          "Passes Accurate"
        ]
      ),
      fora: encontrarStat(
        fora,
        [
          "Passes accurate",
          "Passes Accurate"
        ]
      )
    }
  ];

  return painel(`
    ${tituloSecao(
      "Estatísticas da partida",
      "Comparação em tempo real quando disponível"
    )}

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-bottom:8px;
      "
    >
      <div
        style="
          font-size:11px;
          font-weight:950;
          color:#2ee58b;
        "
      >
        ${e(
          partidaAtual?.home?.name
        )}
      </div>

      <div
        style="
          text-align:right;
          font-size:11px;
          font-weight:950;
        "
      >
        ${e(
          partidaAtual?.away?.name
        )}
      </div>
    </div>

    ${
      linhas
        .map(item =>
          linhaComparacaoStat(
            item.titulo,
            item.casa,
            item.fora,
            item.percentual
          )
        )
        .join("")
    }
  `);
}
/* =========================================================
   EVENTOS DA PARTIDA
========================================================= */

function extrairEventosPartida() {
  const fonte =
    partidaAtual?.eventos;

  if (Array.isArray(fonte)) {
    return fonte;
  }

  if (Array.isArray(fonte?.response)) {
    return fonte.response;
  }

  if (Array.isArray(fonte?.events)) {
    return fonte.events;
  }

  return [];
}

function minutoEvento(ev = {}) {
  const tempo =
    ev.time ||
    ev.tempo ||
    {};

  const minuto =
    tempo.elapsed ??
    ev.minute ??
    ev.minuto ??
    "";

  const extra =
    tempo.extra ??
    ev.extra ??
    null;

  if (
    minuto === "" ||
    minuto === null
  ) {
    return "-";
  }

  return extra
    ? `${minuto}+${extra}'`
    : `${minuto}'`;
}

function tipoEvento(ev = {}) {
  return String(
    ev.type ||
    ev.tipo ||
    ""
  ).toLowerCase();
}

function detalheEvento(ev = {}) {
  return String(
    ev.detail ||
    ev.detalhe ||
    ""
  ).toLowerCase();
}

function iconeEvento(ev = {}) {
  const tipo =
    tipoEvento(ev);

  const detalhe =
    detalheEvento(ev);

  if (
    tipo.includes("goal") ||
    tipo.includes("gol")
  ) {
    return "⚽";
  }

  if (
    tipo.includes("card") ||
    tipo.includes("cart")
  ) {
    if (
      detalhe.includes("red") ||
      detalhe.includes("vermel")
    ) {
      return "🟥";
    }

    return "🟨";
  }

  if (
    tipo.includes("subst") ||
    tipo.includes("substit")
  ) {
    return "↔";
  }

  if (
    tipo.includes("var")
  ) {
    return "VAR";
  }

  return "•";
}

function nomeEvento(ev = {}) {
  const tipo =
    tipoEvento(ev);

  const detalheOriginal =
    ev.detail ||
    ev.detalhe ||
    "";

  if (
    tipo.includes("goal") ||
    tipo.includes("gol")
  ) {
    return "Gol";
  }

  if (
    tipo.includes("card") ||
    tipo.includes("cart")
  ) {
    return detalheOriginal ||
      "Cartão";
  }

  if (
    tipo.includes("subst") ||
    tipo.includes("substit")
  ) {
    return "Substituição";
  }

  if (
    tipo.includes("var")
  ) {
    return "VAR";
  }

  return (
    ev.type ||
    ev.tipo ||
    "Evento"
  );
}

function dadosEvento(ev = {}) {
  const team =
    ev.team ||
    ev.time ||
    {};

  const player =
    ev.player ||
    ev.jogador ||
    {};

  const assist =
    ev.assist ||
    ev.assistencia ||
    {};

  return {
    minuto:
      minutoEvento(ev),

    icone:
      iconeEvento(ev),

    titulo:
      nomeEvento(ev),

    teamId:
      team.id ||
      ev.teamId,

    time:
      team.name ||
      team.nome ||
      ev.teamName ||
      "",

    jogador:
      player.name ||
      player.nome ||
      ev.playerName ||
      "",

    jogadorId:
      player.id ||
      ev.playerId ||
      null,

    assistencia:
      assist.name ||
      assist.nome ||
      "",

    detalhe:
      ev.detail ||
      ev.detalhe ||
      "",

    comentarios:
      ev.comments ||
      ev.comentarios ||
      ""
  };
}

function cardEventoPartida(ev) {
  const d =
    dadosEvento(ev);

  const casa =
    Number(d.teamId) ===
    Number(
      partidaAtual?.home?.id
    );

  const fora =
    Number(d.teamId) ===
    Number(
      partidaAtual?.away?.id
    );

  return `
    <div
      style="
        display:grid;
        grid-template-columns:48px 1fr;
        gap:10px;
        padding:12px 0;
        border-bottom:1px solid rgba(255,255,255,.06);
      "
    >
      <div
        style="
          font-size:12px;
          font-weight:950;
          color:#2ee58b;
          text-align:center;
          padding-top:4px;
        "
      >
        ${e(d.minuto)}
      </div>

      <div>
        <div
          style="
            display:flex;
            align-items:center;
            gap:8px;
          "
        >
          <div
            style="
              min-width:26px;
              font-size:17px;
              font-weight:950;
              text-align:center;
            "
          >
            ${e(d.icone)}
          </div>

          <div style="min-width:0">
            <div
              style="
                font-size:12px;
                font-weight:950;
              "
            >
              ${e(d.titulo)}
            </div>

            <div
              style="
                margin-top:2px;
                font-size:9px;
                opacity:.5;
              "
            >
              ${e(
                d.time ||
                (
                  casa
                    ? partidaAtual?.home?.name
                    : fora
                      ? partidaAtual?.away?.name
                      : ""
                )
              )}
            </div>
          </div>
        </div>

        ${
          d.jogador
            ? `
              <button
                ${
                  d.jogadorId
                    ? `onclick="abrirJogador(${Number(
                        d.jogadorId
                      )})"`
                    : ""
                }
                style="
                  display:block;
                  margin-top:8px;
                  padding:0;
                  border:0;
                  background:transparent;
                  color:#fff;
                  font-size:12px;
                  font-weight:850;
                  text-align:left;
                "
              >
                ${e(d.jogador)}
              </button>
            `
            : ""
        }

        ${
          d.assistencia
            ? `
              <div
                style="
                  margin-top:3px;
                  font-size:10px;
                  opacity:.6;
                "
              >
                Assistência:
                ${e(d.assistencia)}
              </div>
            `
            : ""
        }

        ${
          d.detalhe &&
          String(d.detalhe)
            .toLowerCase() !==
            String(d.titulo)
              .toLowerCase()
            ? `
              <div
                style="
                  margin-top:3px;
                  font-size:10px;
                  opacity:.55;
                "
              >
                ${e(d.detalhe)}
              </div>
            `
            : ""
        }

        ${
          d.comentarios
            ? `
              <div
                style="
                  margin-top:4px;
                  font-size:9px;
                  opacity:.45;
                "
              >
                ${e(d.comentarios)}
              </div>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function renderEventosPartida() {
  const eventos =
    extrairEventosPartida();

  return painel(`
    ${tituloSecao(
      "Eventos",
      "Gols, cartões, substituições e VAR"
    )}

    ${
      eventos.length
        ? eventos
            .map(
              cardEventoPartida
            )
            .join("")
        : `
          <div
            style="
              padding:20px;
              text-align:center;
              opacity:.6;
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
   PRESSÃO AO VIVO
========================================================= */

function statsPressaoTime(
  teamId
) {
  const mapa =
    mapaEstatisticasTime(
      teamId
    );

  return {
    chutes:
      numeroStat(
        encontrarStat(
          mapa,
          ["Total Shots", "Shots"]
        )
      ),

    noAlvo:
      numeroStat(
        encontrarStat(
          mapa,
          ["Shots on Goal"]
        )
      ),

    bloqueados:
      numeroStat(
        encontrarStat(
          mapa,
          ["Blocked Shots"]
        )
      ),

    escanteios:
      numeroStat(
        encontrarStat(
          mapa,
          ["Corner Kicks"]
        )
      ),

    posse:
      numeroStat(
        encontrarStat(
          mapa,
          ["Ball Possession"]
        )
      )
  };
}

function calcularIndicePressao(
  stats
) {
  const s =
    stats || {};

  const indice =
    n(s.noAlvo) * 4 +
    n(s.chutes) * 1.5 +
    n(s.bloqueados) * 1.5 +
    n(s.escanteios) * 2 +
    Math.max(
      0,
      n(s.posse) - 50
    ) * 0.15;

  return Math.max(
    0,
    Math.round(
      indice * 10
    ) / 10
  );
}

function nivelPressao(
  indice
) {
  if (indice >= 35) {
    return "Pressão muito forte";
  }

  if (indice >= 24) {
    return "Pressão forte";
  }

  if (indice >= 15) {
    return "Pressão moderada";
  }

  return "Pressão baixa";
}

function barraPressao(
  nome,
  indice,
  maximo
) {
  const largura =
    maximo > 0
      ? Math.min(
          100,
          (
            indice /
            maximo
          ) * 100
        )
      : 0;

  return `
    <div
      style="
        margin-top:12px;
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          font-size:11px;
        "
      >
        <strong>
          ${e(nome)}
        </strong>

        <strong
          style="
            color:#2ee58b;
          "
        >
          ${indice.toFixed(1)}
        </strong>
      </div>

      <div
        style="
          margin-top:6px;
          height:8px;
          border-radius:8px;
          background:rgba(255,255,255,.06);
          overflow:hidden;
        "
      >
        <div
          style="
            width:${largura}%;
            height:100%;
            border-radius:8px;
            background:#2ee58b;
          "
        ></div>
      </div>

      <div
        style="
          margin-top:4px;
          font-size:9px;
          opacity:.5;
        "
      >
        ${e(
          nivelPressao(indice)
        )}
      </div>
    </div>
  `;
}

function renderPressaoAoVivo() {
  const casa =
    statsPressaoTime(
      partidaAtual?.home?.id
    );

  const fora =
    statsPressaoTime(
      partidaAtual?.away?.id
    );

  const indiceCasa =
    calcularIndicePressao(
      casa
    );

  const indiceFora =
    calcularIndicePressao(
      fora
    );

  const maximo =
    Math.max(
      40,
      indiceCasa,
      indiceFora
    );

  const aoVivo =
    isStatusAoVivo(
      partidaAtual?.status
    );

  return painel(`
    ${tituloSecao(
      "Índice de Pressão Profianalises",
      aoVivo
        ? "Leitura do estado atual da partida"
        : "Disponível principalmente durante partidas ao vivo"
    )}

    ${barraPressao(
      partidaAtual?.home?.name ||
      "Casa",
      indiceCasa,
      maximo
    )}

    ${barraPressao(
      partidaAtual?.away?.name ||
      "Fora",
      indiceFora,
      maximo
    )}

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
        margin-top:16px;
      "
    >
      <div
        style="
          padding:11px;
          border-radius:11px;
          background:rgba(46,229,139,.045);
        "
      >
        <div
          style="
            font-size:10px;
            font-weight:950;
            color:#2ee58b;
          "
        >
          ${e(
            partidaAtual?.home?.name
          )}
        </div>

        <div
          style="
            margin-top:8px;
            font-size:10px;
            line-height:1.7;
          "
        >
          Chutes:
          <strong>${casa.chutes}</strong>
          <br>

          No alvo:
          <strong>${casa.noAlvo}</strong>
          <br>

          Bloqueados:
          <strong>${casa.bloqueados}</strong>
          <br>

          Escanteios:
          <strong>${casa.escanteios}</strong>
          <br>

          Posse:
          <strong>${casa.posse}%</strong>
        </div>
      </div>

      <div
        style="
          padding:11px;
          border-radius:11px;
          background:rgba(255,255,255,.03);
        "
      >
        <div
          style="
            font-size:10px;
            font-weight:950;
          "
        >
          ${e(
            partidaAtual?.away?.name
          )}
        </div>

        <div
          style="
            margin-top:8px;
            font-size:10px;
            line-height:1.7;
          "
        >
          Chutes:
          <strong>${fora.chutes}</strong>
          <br>

          No alvo:
          <strong>${fora.noAlvo}</strong>
          <br>

          Bloqueados:
          <strong>${fora.bloqueados}</strong>
          <br>

          Escanteios:
          <strong>${fora.escanteios}</strong>
          <br>

          Posse:
          <strong>${fora.posse}%</strong>
        </div>
      </div>
    </div>

    <div
      style="
        margin-top:13px;
        padding:10px;
        border-radius:10px;
        background:rgba(255,255,255,.025);
        font-size:9px;
        line-height:1.6;
        opacity:.55;
      "
    >
      O índice combina chutes,
      chutes no alvo, bloqueios,
      escanteios e posse.
      É um indicador próprio de pressão,
      não uma probabilidade de gol.
    </div>
  `);
}
/* =========================================================
   ODDS DA PARTIDA
========================================================= */

function extrairOddsPartida() {
  const fonte =
    partidaAtual?.odds;

  if (!fonte) {
    return [];
  }

  if (Array.isArray(fonte)) {
    return fonte;
  }

  if (Array.isArray(fonte.response)) {
    return fonte.response;
  }

  if (Array.isArray(fonte.odds)) {
    return fonte.odds;
  }

  if (Array.isArray(fonte.bookmakers)) {
    return [
      {
        bookmakers:
          fonte.bookmakers
      }
    ];
  }

  return [];
}

function extrairBookmakers() {
  const resultado = [];

  extrairOddsPartida()
    .forEach(bloco => {
      if (
        Array.isArray(
          bloco?.bookmakers
        )
      ) {
        bloco.bookmakers
          .forEach(book => {
            resultado.push(book);
          });

        return;
      }

      if (
        bloco?.bets ||
        bloco?.markets
      ) {
        resultado.push(bloco);
      }
    });

  return resultado;
}

function extrairMercadosBookmaker(
  bookmaker
) {
  if (
    Array.isArray(
      bookmaker?.bets
    )
  ) {
    return bookmaker.bets;
  }

  if (
    Array.isArray(
      bookmaker?.markets
    )
  ) {
    return bookmaker.markets;
  }

  return [];
}

function nomeMercadoOdd(
  mercado
) {
  return (
    mercado?.name ||
    mercado?.nome ||
    mercado?.market ||
    "Mercado"
  );
}

function valoresMercadoOdd(
  mercado
) {
  const fonte =
    mercado?.values ||
    mercado?.valores ||
    mercado?.odds ||
    [];

  return Array.isArray(fonte)
    ? fonte
    : [];
}

function dadosValorOdd(
  item
) {
  return {
    nome:
      item?.value ||
      item?.name ||
      item?.nome ||
      item?.label ||
      "-",

    odd:
      item?.odd ??
      item?.price ??
      item?.valor ??
      null
  };
}

function mercadoOddPermitido(
  nome
) {
  const texto =
    String(nome)
      .toLowerCase();

  const permitidos = [
    "match winner",
    "winner",
    "1x2",
    "goals over/under",
    "over/under",
    "total goals",
    "corners",
    "corner",
    "cards",
    "shots",
    "shots on goal",
    "both teams score",
    "both teams to score"
  ];

  return permitidos.some(
    termo =>
      texto.includes(termo)
  );
}

function cardMercadoOdds(
  mercado
) {
  const valores =
    valoresMercadoOdd(
      mercado
    )
      .map(dadosValorOdd)
      .filter(v => {
        const odd =
          Number(v.odd);

        return (
          Number.isFinite(odd) &&
          odd > 1
        );
      });

  if (!valores.length) {
    return "";
  }

  return `
    <div
      style="
        margin-top:11px;
        padding:12px;
        border-radius:12px;
        background:rgba(255,255,255,.025);
        border:1px solid rgba(255,255,255,.07);
      "
    >
      <div
        style="
          font-size:11px;
          font-weight:950;
          margin-bottom:9px;
        "
      >
        ${e(
          nomeMercadoOdd(
            mercado
          )
        )}
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:7px;
        "
      >
        ${
          valores
            .map(v => `
              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:7px;
                  padding:9px;
                  border-radius:9px;
                  background:rgba(255,255,255,.035);
                "
              >
                <span
                  style="
                    font-size:10px;
                    overflow:hidden;
                    text-overflow:ellipsis;
                    white-space:nowrap;
                  "
                >
                  ${e(v.nome)}
                </span>

                <strong
                  style="
                    color:${
                      Number(v.odd) >=
                      CONFIG.oddMinima
                        ? "#2ee58b"
                        : "#fff"
                    };
                    font-size:12px;
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
  const bookmakers =
    extrairBookmakers();

  if (!bookmakers.length) {
    return painel(`
      ${tituloSecao(
        "Odds",
        "Cotações disponíveis para a partida"
      )}

      <div
        style="
          padding:20px;
          border-radius:12px;
          background:rgba(255,255,255,.025);
          text-align:center;
        "
      >
        <strong>
          Odds não disponíveis no momento
        </strong>

        <div
          style="
            margin-top:7px;
            font-size:10px;
            line-height:1.5;
            opacity:.55;
          "
        >
          O Profianalises não cria
          cotações quando a API
          não fornece esse mercado.
        </div>
      </div>
    `);
  }

  const bookmaker =
    bookmakers[0];

  const mercados =
    extrairMercadosBookmaker(
      bookmaker
    );

  const prioritarios =
    mercados.filter(m =>
      mercadoOddPermitido(
        nomeMercadoOdd(m)
      )
    );

  const exibidos =
    prioritarios.length
      ? prioritarios
      : mercados.slice(0, 12);

  return painel(`
    ${tituloSecao(
      "Odds",
      bookmaker?.name
        ? `Fonte: ${bookmaker.name}`
        : "Cotações fornecidas pela API"
    )}

    <div
      style="
        padding:9px 10px;
        border-radius:10px;
        background:rgba(46,229,139,.045);
        border:1px solid rgba(46,229,139,.1);
        font-size:10px;
        line-height:1.5;
      "
    >
      Odds a partir de
      <strong style="color:#2ee58b">
        ${formatarOdd(
          CONFIG.oddMinima
        )}
      </strong>
      recebem destaque visual.
    </div>

    ${
      exibidos
        .map(cardMercadoOdds)
        .filter(Boolean)
        .join("") ||
      `
        <div
          style="
            padding:20px;
            text-align:center;
            opacity:.6;
          "
        >
          Nenhum mercado com
          cotação válida disponível.
        </div>
      `
    }
  `);
}
/* =========================================================
   CONTEÚDO DAS ABAS DA PARTIDA
========================================================= */

function conteudoAbaPartida() {
  switch (
    abaAtual
  ) {
    case "analise":
      return renderAnaliseAutomatica();

    case "estatisticas":
      return renderEstatisticasPartida();

    case "eventos":
      return renderEventosPartida();

    case "jogadores":
      return renderJogadores();

    case "escalacoes":
      return renderEscalacoes();

    case "h2h":
      return renderH2H();

    case "odds":
      return renderOddsPartida();

    case "pressao":
      return `
        ${renderPressaoAoVivo()}
        ${renderEstatisticasPartida()}
      `;

    case "resumo":
    default:
      return renderResumoPartida();
  }
}

/* =========================================================
   PÁGINA DA PARTIDA
========================================================= */

function renderPaginaPartida() {
  const container =
    document.getElementById(
      "games"
    ) ||
    document.getElementById(
      "list"
    ) ||
    document.getElementById(
      "app"
    );

  if (!container) {
    return;
  }

  if (!partidaAtual) {
    container.innerHTML = `
      <div
        style="
          padding:30px 15px;
          text-align:center;
        "
      >
        <strong>
          Partida não carregada.
        </strong>
      </div>
    `;

    return;
  }

  container.innerHTML = `
  <div
    style="
      width:100%;
      max-width:760px;
      min-width:0;
      margin:0 auto;
      padding:0 10px 40px;
      box-sizing:border-box;
      overflow-x:hidden;
    "
  >
      ${cabecalhoPartida()}

      ${barraAbasPartida()}

      <div
        id="conteudo-aba-partida"
      >
        ${conteudoAbaPartida()}
      </div>
    </div>
  `;

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });
}

/* =========================================================
   ATUALIZAÇÃO DA PARTIDA AO VIVO
========================================================= */

let timerPartidaAoVivo =
  null;

function pararAtualizacaoPartida() {
  if (
    timerPartidaAoVivo
  ) {
    clearInterval(
      timerPartidaAoVivo
    );

    timerPartidaAoVivo =
      null;
  }
}

function iniciarAtualizacaoPartida() {
  pararAtualizacaoPartida();

  if (
    !partidaAtual?.id ||
    !isStatusAoVivo(
      partidaAtual?.status
    )
  ) {
    return;
  }

  timerPartidaAoVivo =
    setInterval(
      async () => {
        try {
          const id =
            partidaAtual?.id;

          if (!id) {
            return;
          }

          const [
            fixtureData,
            statsData,
            eventsData,
            playersData
          ] =
            await Promise.all([
  fetchOpcional(
    `${API}/fixture?id=${id}`
  ),

  fetchOpcional(
    `${API}/fixture/statistics?id=${id}`
  ),

  fetchOpcional(
    `${API}/fixture/events?id=${id}`
  ),

  fetchOpcional(
    `${API}/fixture/players?id=${id}`
  )
]);

          const fixture =
            fixtureData?.response?.[0] ||
            fixtureData?.fixture ||
            fixtureData?.jogo ||
            fixtureData ||
            {};

          if (
            fixture?.fixture ||
            fixture?.teams ||
            fixture?.goals
          ) {
            partidaAtual.fixture =
              fixture;

            partidaAtual.home =
              fixture?.teams?.home ||
              partidaAtual.home;

            partidaAtual.away =
              fixture?.teams?.away ||
              partidaAtual.away;

            partidaAtual.goals =
              fixture?.goals ||
              partidaAtual.goals;

            partidaAtual.status =
              fixture?.fixture?.status ||
              partidaAtual.status;
          }

          if (statsData) {
            partidaAtual.estatisticas =
              statsData?.response ||
              statsData?.statistics ||
              statsData;
          }

          if (eventsData) {
            partidaAtual.eventos =
              eventsData?.response ||
              eventsData?.events ||
              eventsData;
          }

          if (playersData) {
            partidaAtual.jogadores =
              playersData?.response ||
              playersData?.players ||
              playersData;
          }

          renderPaginaPartida();

          if (
            !isStatusAoVivo(
              partidaAtual?.status
            )
          ) {
            pararAtualizacaoPartida();
          }
        } catch (erro) {
          console.error(
            "Erro atualização ao vivo:",
            erro
          );
        }
      },
      CONFIG.intervaloAtualizacaoAoVivo ||
        60000
    );
}

/* =========================================================
   VOLTAR PARA HOME SEM RECARREGAMENTO FORÇADO
========================================================= */

function mostrarHome() {
  pararAtualizacaoPartida();

  partidaAtual = null;
  historicoAtual = null;
  abaAtual = "resumo";

  const url =
    new URL(
      window.location.href
    );

  url.searchParams.delete(
    "jogo"
  );

  url.searchParams.delete(
    "time"
  );

  url.searchParams.delete(
    "jogador"
  );

  window.history.pushState(
    {},
    "",
    url.pathname +
      url.search
  );

  render(jogos);
}
/* =========================================================
   PÁGINA INDIVIDUAL DO TIME
========================================================= */

let timeAtual = null;
let historicoTimeAtual = null;

async function abrirTime(
  teamId
) {
  const id =
    Number(teamId);

  if (!id) {
    return;
  }

  pararAtualizacaoPartida();

  const container =
    document.getElementById(
      "games"
    ) ||
    document.getElementById(
      "list"
    ) ||
    document.getElementById(
      "app"
    );

  if (container) {
    container.innerHTML = `
      <div
        style="
          padding:35px 15px;
          text-align:center;
        "
      >
        <strong>
          Carregando equipe...
        </strong>
      </div>
    `;
  }

  try {
    const dados =
      await fetchJson(
        `${API}/historico/team/${id}`
      );

    historicoTimeAtual =
      dados || null;

    timeAtual =
      dados?.team ||
      dados?.time ||
      {
        id,
        name:
          dados?.nome ||
          `Time ${id}`
      };

    const url =
      new URL(
        window.location.href
      );

    url.searchParams.delete(
      "jogo"
    );

    url.searchParams.delete(
      "jogador"
    );

    url.searchParams.set(
      "time",
      id
    );

    window.history.pushState(
      {},
      "",
      url.pathname +
        url.search
    );

    renderPaginaTime();
  } catch (erro) {
    console.error(
      "Erro ao abrir time:",
      erro
    );

    if (container) {
      container.innerHTML = `
        <div
          style="
            padding:30px 15px;
            text-align:center;
          "
        >
          <strong>
            Não foi possível carregar a equipe.
          </strong>

          <div style="margin-top:15px">
            ${botao(
              "Voltar",
              "mostrarHome()",
              true
            )}
          </div>
        </div>
      `;
    }
  }
}

/* =========================================================
   PARTIDAS DO TIME
========================================================= */

function partidasDoTime(
  quantidade = 10
) {
  const h =
    historicoTimeAtual;

  const chave =
    Number(quantidade) === 5
      ? "ultimas5"
      : "ultimas10";

  const fontes = [
    h?.[chave]?.partidas,
    h?.historico?.[chave]?.partidas,
    h?.partidas,
    h?.jogos
  ];

  for (const fonte of fontes) {
    if (
      Array.isArray(fonte)
    ) {
      return fonte.slice(
        0,
        quantidade
      );
    }
  }

  return [];
}

function nomeTimeAtual() {
  return (
    timeAtual?.name ||
    timeAtual?.nome ||
    historicoTimeAtual?.team?.name ||
    historicoTimeAtual?.time?.name ||
    historicoTimeAtual?.nome ||
    "Equipe"
  );
}

function logoTimeAtual() {
  return (
    timeAtual?.logo ||
    historicoTimeAtual?.team?.logo ||
    historicoTimeAtual?.time?.logo ||
    ""
  );
}

/* =========================================================
   CABEÇALHO DO TIME
========================================================= */

function cabecalhoTime() {
  const nome =
    nomeTimeAtual();

  const logo =
    logoTimeAtual();

  return painel(`
    <div
      style="
        display:flex;
        align-items:center;
        gap:12px;
      "
    >
      <button
        onclick="mostrarHome()"
        style="
          width:38px;
          height:38px;
          border-radius:11px;
          border:1px solid rgba(255,255,255,.09);
          background:rgba(255,255,255,.035);
          color:#fff;
          font-size:18px;
        "
      >
        ←
      </button>

      <div
        style="
          width:56px;
          height:56px;
          display:flex;
          align-items:center;
          justify-content:center;
        "
      >
        ${
          logo
            ? `
              <img
                src="${e(logo)}"
                onerror="this.style.display='none'"
                style="
                  max-width:100%;
                  max-height:100%;
                  object-fit:contain;
                "
              >
            `
            : ""
        }
      </div>

      <div
        style="
          min-width:0;
          flex:1;
        "
      >
        <div
          style="
            font-size:20px;
            font-weight:950;
            overflow:hidden;
            white-space:nowrap;
            text-overflow:ellipsis;
          "
        >
          ${e(nome)}
        </div>

        <div
          style="
            margin-top:4px;
            font-size:10px;
            opacity:.55;
          "
        >
          Estatísticas e histórico
        </div>
      </div>
    </div>
  `);
}

/* =========================================================
   RESUMO DA FORMA
========================================================= */

function resumoTimeAtual() {
  const partidas =
    partidasDoTime(10);

  if (!partidas.length) {
    return painel(`
      ${tituloSecao(
        "Forma recente",
        "Últimos jogos disponíveis"
      )}

      <div
        style="
          padding:18px;
          text-align:center;
          opacity:.6;
        "
      >
        Histórico não disponível.
      </div>
    `);
  }

  let vitorias = 0;
  let empates = 0;
  let derrotas = 0;
  let golsFavor = 0;
  let golsContra = 0;

  partidas.forEach(p => {
    const gf =
      n(p.golsFavor);

    const gc =
      n(p.golsContra);

    golsFavor += gf;
    golsContra += gc;

    if (gf > gc) {
      vitorias++;
    } else if (gf === gc) {
      empates++;
    } else {
      derrotas++;
    }
  });

  return painel(`
    ${tituloSecao(
      "Forma recente",
      `Últimos ${partidas.length} jogos`
    )}

    <div
      style="
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
        text-align:center;
      "
    >
      <div
        style="
          padding:13px;
          border-radius:12px;
          background:rgba(46,229,139,.06);
        "
      >
        <strong
          style="
            font-size:22px;
            color:#2ee58b;
          "
        >
          ${vitorias}
        </strong>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:.5;
          "
        >
          VITÓRIAS
        </div>
      </div>

      <div
        style="
          padding:13px;
          border-radius:12px;
          background:rgba(255,255,255,.035);
        "
      >
        <strong
          style="
            font-size:22px;
          "
        >
          ${empates}
        </strong>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:.5;
          "
        >
          EMPATES
        </div>
      </div>

      <div
        style="
          padding:13px;
          border-radius:12px;
          background:rgba(255,255,255,.035);
        "
      >
        <strong
          style="
            font-size:22px;
          "
        >
          ${derrotas}
        </strong>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:.5;
          "
        >
          DERROTAS
        </div>
      </div>
    </div>

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:9px;
      "
    >
      <div
        style="
          padding:12px;
          border-radius:11px;
          background:rgba(255,255,255,.025);
        "
      >
        <div
          style="
            font-size:9px;
            opacity:.5;
          "
        >
          GOLS MARCADOS
        </div>

        <strong>
          ${golsFavor}
        </strong>

        <span
          style="
            font-size:10px;
            opacity:.5;
          "
        >
          • média
          ${media(
            golsFavor,
            partidas.length
          )}
        </span>
      </div>

      <div
        style="
          padding:12px;
          border-radius:11px;
          background:rgba(255,255,255,.025);
        "
      >
        <div
          style="
            font-size:9px;
            opacity:.5;
          "
        >
          GOLS SOFRIDOS
        </div>

        <strong>
          ${golsContra}
        </strong>

        <span
          style="
            font-size:10px;
            opacity:.5;
          "
        >
          • média
          ${media(
            golsContra,
            partidas.length
          )}
        </span>
      </div>
    </div>
  `);
}
/* =========================================================
   COMPETIÇÕES DO TIME
========================================================= */

function agruparPartidasTimePorLiga() {
  const partidas =
    partidasDoTime(10);

  const mapa =
    new Map();

  partidas.forEach(p => {
    const id =
      idLigaPartidaHistorica(p);

    const nome =
      nomeLigaPartidaHistorica(p);

    const chave =
      id ||
      nome ||
      "outras";

    if (!mapa.has(chave)) {
      mapa.set(
        chave,
        {
          id: chave,
          nome:
            nome ||
            "Outras competições",
          partidas: []
        }
      );
    }

    mapa
      .get(chave)
      .partidas
      .push(p);
  });

  return [
    ...mapa.values()
  ];
}

/* =========================================================
   MÉDIAS POR COMPETIÇÃO
========================================================= */

function cardCompeticaoTime(
  grupo
) {
  const partidas =
    safeArray(
      grupo?.partidas
    );

  let golsFavor = 0;
  let golsContra = 0;
  let vitorias = 0;
  let empates = 0;
  let derrotas = 0;

  partidas.forEach(p => {
    const gf =
      n(p.golsFavor);

    const gc =
      n(p.golsContra);

    golsFavor += gf;
    golsContra += gc;

    if (gf > gc) {
      vitorias++;
    } else if (gf === gc) {
      empates++;
    } else {
      derrotas++;
    }
  });

  return `
    <div
      style="
        padding:13px;
        border-radius:13px;
        background:rgba(255,255,255,.025);
        border:1px solid rgba(255,255,255,.07);
        margin-top:9px;
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
        <strong
          style="
            font-size:13px;
          "
        >
          ${e(
            grupo?.nome ||
            "Competição"
          )}
        </strong>

        <span
          style="
            font-size:9px;
            opacity:.5;
          "
        >
          ${partidas.length}
          JOGO(S)
        </span>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:6px;
          margin-top:11px;
          text-align:center;
        "
      >
        <div>
          <strong
            style="
              color:#2ee58b;
            "
          >
            ${vitorias}
          </strong>

          <div
            style="
              font-size:8px;
              opacity:.45;
            "
          >
            VIT
          </div>
        </div>

        <div>
          <strong>
            ${empates}
          </strong>

          <div
            style="
              font-size:8px;
              opacity:.45;
            "
          >
            EMP
          </div>
        </div>

        <div>
          <strong>
            ${derrotas}
          </strong>

          <div
            style="
              font-size:8px;
              opacity:.45;
            "
          >
            DER
          </div>
        </div>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:7px;
          margin-top:11px;
        "
      >
        <div
          style="
            padding:9px;
            border-radius:9px;
            background:rgba(46,229,139,.045);
          "
        >
          <div
            style="
              font-size:8px;
              opacity:.5;
            "
          >
            GOLS / JOGO
          </div>

          <strong
            style="
              color:#2ee58b;
            "
          >
            ${media(
              golsFavor,
              partidas.length
            )}
          </strong>
        </div>

        <div
          style="
            padding:9px;
            border-radius:9px;
            background:rgba(255,255,255,.03);
          "
        >
          <div
            style="
              font-size:8px;
              opacity:.5;
            "
          >
            SOFRIDOS / JOGO
          </div>

          <strong>
            ${media(
              golsContra,
              partidas.length
            )}
          </strong>
        </div>
      </div>
    </div>
  `;
}

function renderCompeticoesTime() {
  const grupos =
    agruparPartidasTimePorLiga();

  return painel(`
    ${tituloSecao(
      "Por competição",
      "Desempenho separado pelos campeonatos presentes na amostra"
    )}

    ${
      grupos.length
        ? grupos
            .map(
              cardCompeticaoTime
            )
            .join("")
        : `
          <div
            style="
              padding:18px;
              text-align:center;
              opacity:.6;
            "
          >
            Nenhuma competição encontrada.
          </div>
        `
    }
  `);
}

/* =========================================================
   ÚLTIMOS JOGOS DO TIME
========================================================= */

function cardPartidaTime(
  p
) {
  const adversario =
    p.adversario?.name ||
    p.adversario?.nome ||
    p.adversario ||
    "Adversário";

  const gf =
    n(p.golsFavor);

  const gc =
    n(p.golsContra);

  let resultado = "E";

  if (gf > gc) {
    resultado = "V";
  } else if (gf < gc) {
    resultado = "D";
  }

  const corResultado =
    resultado === "V"
      ? "#2ee58b"
      : resultado === "D"
        ? "#ff6b6b"
        : "#d7d7d7";

  return `
    <button
      ${
        p.fixtureId
          ? `onclick="abrirJogo(${Number(
              p.fixtureId
            )})"`
          : ""
      }
      style="
        width:100%;
        display:grid;
        grid-template-columns:35px 1fr auto;
        gap:9px;
        align-items:center;
        padding:11px 4px;
        border:0;
        border-bottom:1px solid rgba(255,255,255,.06);
        background:transparent;
        color:#fff;
        text-align:left;
      "
    >
      <div
        style="
          width:28px;
          height:28px;
          border-radius:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:${corResultado}18;
          color:${corResultado};
          font-size:11px;
          font-weight:950;
        "
      >
        ${resultado}
      </div>

      <div
        style="
          min-width:0;
        "
      >
        <div
          style="
            font-size:12px;
            font-weight:850;
            overflow:hidden;
            white-space:nowrap;
            text-overflow:ellipsis;
          "
        >
          ${e(adversario)}
        </div>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:.45;
          "
        >
          ${e(
            dataCurta(p.data)
          )}
          •
          ${e(
            nomeLigaPartidaHistorica(
              p
            )
          )}
          •
          ${e(
            p.local ||
            ""
          )}
        </div>
      </div>

      <div
        style="
          font-size:15px;
          font-weight:950;
        "
      >
        ${gf} - ${gc}
      </div>
    </button>
  `;
}

function renderUltimosJogosTime() {
  const partidas =
    partidasDoTime(10);

  return painel(`
    ${tituloSecao(
      "Últimos jogos",
      "Partidas mais recentes disponíveis"
    )}

    ${
      partidas.length
        ? partidas
            .map(
              cardPartidaTime
            )
            .join("")
        : `
          <div
            style="
              padding:18px;
              text-align:center;
              opacity:.6;
            "
          >
            Nenhuma partida encontrada.
          </div>
        `
    }
  `);
}

/* =========================================================
   RENDER PÁGINA DO TIME
========================================================= */

function renderPaginaTime() {
  const container =
    document.getElementById(
      "games"
    ) ||
    document.getElementById(
      "list"
    ) ||
    document.getElementById(
      "app"
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div
      style="
        max-width:760px;
        margin:0 auto;
        padding-bottom:40px;
      "
    >
      ${cabecalhoTime()}
      ${resumoTimeAtual()}
      ${renderCompeticoesTime()}
      ${renderUltimosJogosTime()}
    </div>
  `;

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });
}
/* =========================================================
   PÁGINA INDIVIDUAL DO JOGADOR
========================================================= */

let jogadorAtual = null;
let historicoJogadorAtual = [];
let filtroJogadorQuantidade = 5;

function localizarJogadorHistorico(
  jogadorId
) {
  const id =
    Number(jogadorId);

  const lados = [
    historicoAtual?.casa,
    historicoAtual?.fora
  ];

  for (const lado of lados) {
    for (
      const quantidade of [
        "ultimas5",
        "ultimas10"
      ]
    ) {
      const jogadores =
        safeArray(
          lado?.[quantidade]
            ?.jogadores
        );

      const encontrado =
        jogadores.find(j =>
          Number(j.id) === id
        );

      if (encontrado) {
        return encontrado;
      }
    }
  }

  return null;
}

function localizarJogadorPartida(
  jogadorId
) {
  const id =
    Number(jogadorId);

  const jogadores =
    extrairJogadoresPartida();

  for (const bloco of jogadores) {
    const lista =
      safeArray(
        bloco?.players ||
        bloco?.jogadores
      );

    const encontrado =
      lista.find(item => {
        const player =
          item?.player ||
          item?.jogador ||
          item;

        return (
          Number(player?.id) ===
          id
        );
      });

    if (encontrado) {
      return normalizarJogadorPartida(
        encontrado
      );
    }
  }

  return null;
}

function montarHistoricoJogador(
  jogadorId
) {
  const id =
    Number(jogadorId);

  const resultado = [];

  const lados = [
    historicoAtual?.casa,
    historicoAtual?.fora,
    historicoTimeAtual
  ];

  lados.forEach(lado => {
    const partidas =
      safeArray(
        lado?.ultimas10
          ?.partidas ||
        lado?.historico
          ?.ultimas10
          ?.partidas ||
        lado?.partidas
      );

    partidas.forEach(p => {
      const jogadores =
        safeArray(
          p?.jogadores
        );

      const j =
        jogadores.find(item =>
          Number(
            item?.id ||
            item?.player?.id
          ) === id
        );

      if (!j) {
        return;
      }

      resultado.push({
        fixtureId:
          p.fixtureId ||
          p.id,

        data:
          p.data ||
          p.date,

        adversario:
          p.adversario,

        liga:
          p.liga,

        local:
          p.local,

        golsFavor:
          p.golsFavor,

        golsContra:
          p.golsContra,

        jogador:
          j
      });
    });
  });

  const unicos =
    new Map();

  resultado.forEach(item => {
    const chave =
      item.fixtureId ||
      `${item.data}-${item.adversario}`;

    if (!unicos.has(chave)) {
      unicos.set(
        chave,
        item
      );
    }
  });

  return [
    ...unicos.values()
  ];
}

function abrirJogador(
  jogadorId
) {
  const id =
    Number(jogadorId);

  if (!id) {
    return;
  }

  const partida =
    localizarJogadorPartida(
      id
    );

  const historico =
    localizarJogadorHistorico(
      id
    );

  jogadorAtual =
    partida ||
    historico ||
    {
      id,
      nome:
        `Jogador ${id}`,
      foto:
        fotoJogador(id)
    };

  jogadorAtual.id =
    jogadorAtual.id ||
    id;

  jogadorAtual.foto =
    jogadorAtual.foto ||
    fotoJogador(id);

  historicoJogadorAtual =
    montarHistoricoJogador(
      id
    );

  filtroJogadorQuantidade =
    5;

  const url =
    new URL(
      window.location.href
    );

  url.searchParams.delete(
    "jogo"
  );

  url.searchParams.delete(
    "time"
  );

  url.searchParams.set(
    "jogador",
    id
  );

  window.history.pushState(
    {},
    "",
    url.pathname +
      url.search
  );

  renderPaginaJogador();
}

/* =========================================================
   FILTRO L5 / L10
========================================================= */

function mudarFiltroJogador(
  quantidade
) {
  filtroJogadorQuantidade =
    Number(quantidade) === 10
      ? 10
      : 5;

  renderPaginaJogador();
}

function partidasJogadorFiltradas() {
  return safeArray(
    historicoJogadorAtual
  ).slice(
    0,
    filtroJogadorQuantidade
  );
}

/* =========================================================
   CABEÇALHO DO JOGADOR
========================================================= */

function cabecalhoJogador() {
  const nome =
    jogadorAtual?.nome ||
    jogadorAtual?.name ||
    "Jogador";

  const foto =
    jogadorAtual?.foto ||
    fotoJogador(
      jogadorAtual?.id
    );

  const posicao =
    jogadorAtual?.posicao ||
    jogadorAtual?.position ||
    "-";

  const numero =
    jogadorAtual?.numero ??
    jogadorAtual?.number ??
    null;

  return painel(`
    <div
      style="
        display:flex;
        align-items:center;
        gap:13px;
      "
    >
      <button
        onclick="voltarDoJogador()"
        style="
          width:38px;
          height:38px;
          flex:0 0 38px;
          border-radius:11px;
          border:1px solid rgba(255,255,255,.09);
          background:rgba(255,255,255,.035);
          color:#fff;
          font-size:18px;
        "
      >
        ←
      </button>

      <div
        style="
          width:68px;
          height:68px;
          flex:0 0 68px;
          border-radius:50%;
          overflow:hidden;
          background:rgba(255,255,255,.04);
        "
      >
        <img
          src="${e(foto)}"
          onerror="this.style.display='none'"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
          "
        >
      </div>

      <div
        style="
          min-width:0;
          flex:1;
        "
      >
        <div
          style="
            font-size:19px;
            font-weight:950;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
          "
        >
          ${e(nome)}
        </div>

        <div
          style="
            margin-top:5px;
            font-size:10px;
            opacity:.55;
          "
        >
          ${
            numero != null
              ? `#${e(numero)} • `
              : ""
          }
          ${e(posicao)}
        </div>
      </div>
    </div>
  `);
}

function voltarDoJogador() {
  const url =
    new URL(
      window.location.href
    );

  url.searchParams.delete(
    "jogador"
  );

  window.history.pushState(
    {},
    "",
    url.pathname +
      url.search
  );

  if (partidaAtual) {
    renderPaginaPartida();
    return;
  }

  if (timeAtual) {
    renderPaginaTime();
    return;
  }

  mostrarHome();
}
/* =========================================================
   ESTATÍSTICAS DO JOGADOR
========================================================= */

function statsJogadorItem(
  item
) {
  return (
    item?.jogador ||
    item ||
    {}
  );
}

function somarCampoJogador(
  partidas,
  campo
) {
  return safeArray(partidas)
    .reduce(
      (total, item) => {
        const j =
          statsJogadorItem(
            item
          );

        return (
          total +
          n(j?.[campo])
        );
      },
      0
    );
}

function mediaCampoJogador(
  partidas,
  campo
) {
  const lista =
    safeArray(partidas);

  if (!lista.length) {
    return "0.00";
  }

  return (
    somarCampoJogador(
      lista,
      campo
    ) /
    lista.length
  ).toFixed(2);
}

function cardMediaJogador(
  titulo,
  valor,
  destaque = false
) {
  return `
    <div
      style="
        padding:11px 8px;
        border-radius:11px;
        background:${
          destaque
            ? "rgba(46,229,139,.055)"
            : "rgba(255,255,255,.03)"
        };
        text-align:center;
      "
    >
      <strong
        style="
          display:block;
          font-size:17px;
          color:${
            destaque
              ? "#2ee58b"
              : "#fff"
          };
        "
      >
        ${e(valor)}
      </strong>

      <div
        style="
          margin-top:4px;
          font-size:8px;
          opacity:.5;
        "
      >
        ${e(titulo)}
      </div>
    </div>
  `;
}

function renderMediasJogador() {
  const partidas =
    partidasJogadorFiltradas();

  return painel(`
    ${tituloSecao(
      "Médias do jogador",
      `Base: últimos ${partidas.length} jogos disponíveis`
    )}

    <div
      style="
        display:flex;
        gap:7px;
        margin-bottom:12px;
      "
    >
      ${botao(
        "Últimos 5",
        "mudarFiltroJogador(5)",
        filtroJogadorQuantidade === 5
      )}

      ${botao(
        "Últimos 10",
        "mudarFiltroJogador(10)",
        filtroJogadorQuantidade === 10
      )}
    </div>

    ${
      partidas.length
        ? `
          <div
            style="
              display:grid;
              grid-template-columns:repeat(3,1fr);
              gap:7px;
            "
          >
            ${cardMediaJogador(
              "CHUTES",
              mediaCampoJogador(
                partidas,
                "chutes"
              ),
              true
            )}

            ${cardMediaJogador(
              "NO ALVO",
              mediaCampoJogador(
                partidas,
                "chutesGol"
              ),
              true
            )}

            ${cardMediaJogador(
              "GOLS",
              mediaCampoJogador(
                partidas,
                "gols"
              )
            )}

            ${cardMediaJogador(
              "ASSIST.",
              mediaCampoJogador(
                partidas,
                "assistencias"
              )
            )}

            ${cardMediaJogador(
              "FALTAS",
              mediaCampoJogador(
                partidas,
                "faltasCometidas"
              )
            )}

            ${cardMediaJogador(
              "SOFREU FALTA",
              mediaCampoJogador(
                partidas,
                "faltasSofridas"
              )
            )}

            ${cardMediaJogador(
              "DESARMES",
              mediaCampoJogador(
                partidas,
                "desarmes"
              )
            )}

            ${cardMediaJogador(
              "PASSES",
              mediaCampoJogador(
                partidas,
                "passes"
              )
            )}

            ${cardMediaJogador(
              "MINUTOS",
              mediaCampoJogador(
                partidas,
                "minutos"
              )
            )}
          </div>
        `
        : `
          <div
            style="
              padding:20px;
              text-align:center;
              opacity:.6;
            "
          >
            Histórico individual
            não disponível.
          </div>
        `
    }
  `);
}

/* =========================================================
   HISTÓRICO JOGO A JOGO
========================================================= */

function cardHistoricoJogador(
  item
) {
  const j =
    statsJogadorItem(
      item
    );

  const adversario =
    item?.adversario?.name ||
    item?.adversario?.nome ||
    item?.adversario ||
    "Adversário";

  return `
    <div
      style="
        padding:12px 0;
        border-bottom:1px solid rgba(255,255,255,.06);
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
        <div
          style="
            min-width:0;
          "
        >
          <strong
            style="
              display:block;
              font-size:12px;
              overflow:hidden;
              white-space:nowrap;
              text-overflow:ellipsis;
            "
          >
            ${e(adversario)}
          </strong>

          <div
            style="
              margin-top:3px;
              font-size:8px;
              opacity:.45;
            "
          >
            ${e(
              dataCurta(
                item?.data
              )
            )}
            •
            ${e(
              item?.liga?.name ||
              item?.liga?.nome ||
              item?.liga ||
              ""
            )}
            •
            ${e(
              item?.local ||
              ""
            )}
          </div>
        </div>

        ${
          item?.golsFavor != null
            ? `
              <strong
                style="
                  font-size:13px;
                "
              >
                ${n(item.golsFavor)}
                -
                ${n(item.golsContra)}
              </strong>
            `
            : ""
        }
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:5px;
          margin-top:10px;
          text-align:center;
        "
      >
        <div>
          <strong>
            ${n(j.chutes)}
          </strong>
          <div
            style="
              font-size:7px;
              opacity:.45;
            "
          >
            CHUTES
          </div>
        </div>

        <div>
          <strong
            style="
              color:#2ee58b;
            "
          >
            ${n(j.chutesGol)}
          </strong>
          <div
            style="
              font-size:7px;
              opacity:.45;
            "
          >
            NO ALVO
          </div>
        </div>

        <div>
          <strong>
            ${n(j.faltasCometidas)}
          </strong>
          <div
            style="
              font-size:7px;
              opacity:.45;
            "
          >
            FALTAS
          </div>
        </div>

        <div>
          <strong>
            ${n(j.desarmes)}
          </strong>
          <div
            style="
              font-size:7px;
              opacity:.45;
            "
          >
            DESARMES
          </div>
        </div>
      </div>

      <div
        style="
          margin-top:7px;
          font-size:9px;
          opacity:.55;
        "
      >
        ${n(j.gols)} gol(s)
        •
        ${n(j.assistencias)} assistência(s)
        •
        ${n(j.minutos)} min
      </div>
    </div>
  `;
}

function renderHistoricoJogador() {
  const partidas =
    partidasJogadorFiltradas();

  return painel(`
    ${tituloSecao(
      "Últimas partidas",
      "Desempenho individual jogo a jogo"
    )}

    ${
      partidas.length
        ? partidas
            .map(
              cardHistoricoJogador
            )
            .join("")
        : `
          <div
            style="
              padding:20px;
              text-align:center;
              opacity:.6;
            "
          >
            Nenhuma partida individual
            encontrada na amostra.
          </div>
        `
    }
  `);
}

/* =========================================================
   RENDER PÁGINA DO JOGADOR
========================================================= */

function renderPaginaJogador() {
  const container =
    document.getElementById(
      "games"
    ) ||
    document.getElementById(
      "list"
    ) ||
    document.getElementById(
      "app"
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div
      style="
        max-width:760px;
        margin:0 auto;
        padding-bottom:40px;
      "
    >
      ${cabecalhoJogador()}
      ${renderMediasJogador()}
      ${renderHistoricoJogador()}
    </div>
  `;

  window.scrollTo({
    top:0,
    behavior:"instant"
  });
}
/* =========================================================
   NAVEGAÇÃO DO NAVEGADOR
========================================================= */

window.addEventListener(
  "popstate",
  () => {
    iniciarAplicacao();
  }
);

/* =========================================================
   ROTA INICIAL
========================================================= */

async function iniciarAplicacao() {
  pararAtualizacaoPartida();

  const params =
    new URLSearchParams(
      window.location.search
    );

  const jogoId =
    Number(
      params.get("jogo")
    );

  const timeId =
    Number(
      params.get("time")
    );

  const jogadorId =
    Number(
      params.get("jogador")
    );

  /*
    PRIORIDADE:
    1. PARTIDA
    2. TIME
    3. JOGADOR
    4. HOME
  */

  if (jogoId) {
    await abrirJogo(
      jogoId,
      false
    );

    iniciarAtualizacaoPartida();
    return;
  }

  if (timeId) {
    await abrirTime(
      timeId
    );

    return;
  }

  if (jogadorId) {
    /*
      Jogador depende de dados
      previamente carregados.

      Se houver contexto disponível,
      abre normalmente.
    */

    const encontrado =
      localizarJogadorPartida(
        jogadorId
      ) ||
      localizarJogadorHistorico(
        jogadorId
      );

    if (encontrado) {
      abrirJogador(
        jogadorId
      );

      return;
    }
  }

  await carregarHome();
}

/* =========================================================
   CARREGAMENTO DA HOME
========================================================= */

async function carregarHome() {
  const container =
    document.getElementById(
      "games"
    ) ||
    document.getElementById(
      "list"
    ) ||
    document.getElementById(
      "app"
    );

  if (container) {
    container.innerHTML = `
      <div
        style="
          padding:35px 15px;
          text-align:center;
          opacity:.7;
        "
      >
        Carregando jogos...
      </div>
    `;
  }

  try {
    await load();

    render(jogos);

    configurarBuscaHome();
  } catch (erro) {
    console.error(
      "Erro ao carregar home:",
      erro
    );

    if (container) {
      container.innerHTML = `
        <div
          style="
            padding:30px 15px;
            text-align:center;
          "
        >
          <strong>
            Não foi possível carregar
            os jogos.
          </strong>

          <div
            style="
              margin-top:8px;
              font-size:10px;
              opacity:.55;
            "
          >
            Verifique a conexão com
            a API e tente novamente.
          </div>

          <div
            style="
              margin-top:15px;
            "
          >
            <button
              onclick="carregarHome()"
              style="
                padding:10px 15px;
                border:0;
                border-radius:10px;
                background:#2ee58b;
                color:#07130d;
                font-weight:950;
              "
            >
              Tentar novamente
            </button>
          </div>
        </div>
      `;
    }
  }
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    iniciarAplicacao();
  }
);
