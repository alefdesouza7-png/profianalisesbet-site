const API="https://profianalisesbet-api.alefdesouza7.workers.dev";

let mode="jogos";
let jogos=[];

async function load(m="jogos"){
  mode=m;
  const status=document.querySelector("#status");
  if(status) status.textContent="Carregando...";

  try{
    const r=await fetch(`${API}/api/${m}`);
    const d=await r.json();
    jogos=d.jogos||[];
    render(jogos);
  }catch(err){
    if(status) status.textContent="Erro ao carregar jogos.";
  }
}

function e(v){
  return String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[c]));
}

function render(lista){
  const shown=document.querySelector("#shown");
  const total=document.querySelector("#total");
  const status=document.querySelector("#status");
  const games=document.querySelector("#games");

  if(shown) shown.textContent=lista.length;
  if(total) total.textContent=jogos.length;
  if(status) status.textContent=`${lista.length} partida(s) encontrada(s).`;
  if(!games) return;

  games.innerHTML=lista.map(j=>`
    <div class="game" onclick="abrirJogo(${Number(j.id)})" style="cursor:pointer">
      <div class="league">${e(j.competition)} · ${e(j.competition_country)}</div>

      <div class="teams">
        <div class="team">
          ${j.home_logo?`<img src="${e(j.home_logo)}" alt="">`:""}
          <b>${e(j.home_team)}</b>
        </div>

        <div class="score">
          ${e(j.home_goals)} × ${e(j.away_goals)}
        </div>

        <div class="team">
          <b>${e(j.away_team)}</b>
          ${j.away_logo?`<img src="${e(j.away_logo)}" alt="">`:""}
        </div>
      </div>

      <div class="game-status">
        ${e(j.status)} · ${e(j.minute)}'
      </div>

      <div style="text-align:center;margin-top:10px;color:#2ee58b;font-weight:bold">
        Ver análise ›
      </div>
    </div>
  `).join("");
}

function abrirJogo(id){
  const j=jogos.find(x=>Number(x.id)===Number(id));
  if(!j) return;

  document.body.innerHTML=`
    <main style="padding:20px;max-width:800px;margin:auto">
      <button onclick="location.reload()" style="padding:12px 18px;margin-bottom:20px">
        ← Voltar
      </button>

      <p style="color:#2ee58b;font-weight:bold">
        ${e(j.competition)} · ${e(j.competition_country)}
      </p>

      <h1 style="text-align:center">
        ${e(j.home_team)} ${e(j.home_goals)} × ${e(j.away_goals)} ${e(j.away_team)}
      </h1>

      <p style="text-align:center;font-size:18px">
        ${e(j.status)} · ${e(j.minute)}'
      </p>

      <section class="panel" style="margin-top:25px;padding:20px">
        <h2>Análise da partida</h2>
        <p>ID do jogo: ${e(j.id)}</p>
        <p>Competição: ${e(j.competition)}</p>
        <p>País: ${e(j.competition_country)}</p>
        <p>Mandante: ${e(j.home_team)}</p>
        <p>Visitante: ${e(j.away_team)}</p>
        <p>Placar: ${e(j.home_goals)} × ${e(j.away_goals)}</p>
        <p>Status: ${e(j.status)}</p>
      </section>
    </main>
  `;
}

const q=document.querySelector("#q");

if(q){
  q.oninput=()=>{
    const s=q.value.toLowerCase();
    render(jogos.filter(j=>
      String(j.home_team||"").toLowerCase().includes(s)||
      String(j.away_team||"").toLowerCase().includes(s)||
      String(j.competition||"").toLowerCase().includes(s)
    ));
  };
}

document.querySelector("#todos").onclick=()=>load("jogos");
document.querySelector("#live").onclick=()=>load("ao-vivo");

load();
