// Cada função devolve o HTML de uma tela a partir do modelo calculado.
// Nada aqui grava dados: os botões levam data-acao e quem age é o acoes.js.
// Botões de edição só aparecem para quem pode editar (ctx.pode); quem só acompanha vê o placar.

import { ATLETICAS, FASES, LOGO, MODALIDADE, MODALIDADES } from './dados.js';
import { ESPORTES, ETAPA, NOME_ETAPA, ORDEM_FASES, placarEfetivo, pontosPorColocacao, vencedor } from './regras.js';
import { TIPOS_PUNICAO } from './modelo.js';
import { PAPEIS, normalizarEmail } from './permissoes.js';
import { EDICAO_2025, colocacao2025 } from './historico.js';
import { cenarios } from './previsao.js';
import { previsaoObjetiva, situacoesDoModelo } from './situacao.js';
import { comSinal, dataCurta, dataLonga, esc, inteiro, pts } from './util.js';

const NOME_FASE = Object.fromEntries(FASES.map((f) => [f.id, f.nome]));
const ORDEM_MOD = Object.fromEntries(MODALIDADES.map((m, i) => [m.id, i]));
const TOTAL_MODALIDADES = MODALIDADES.length;

// ---------- pedaços usados em várias telas ----------

const nome = (ctx, id) => esc(ctx.modelo.nomes[id] ?? '—');
const ehNossa = (ctx, id) => Boolean(id) && id === ctx.modelo.nossa;
const classeNossa = (ctx, id) => (ehNossa(ctx, id) ? ' nos' : '');

export function temResultado(j) {
  const m = MODALIDADE[j.mod];
  return Boolean(m && ESPORTES[m.esporte] && placarEfetivo(j, ESPORTES[m.esporte]));
}

export function compararJogos(x, y) {
  const dx = x.data || '9999-99-99';
  const dy = y.data || '9999-99-99';
  if (dx !== dy) return dx < dy ? -1 : 1;
  const hx = x.hora || '99:99';
  const hy = y.hora || '99:99';
  if (hx !== hy) return hx < hy ? -1 : 1;
  return (ORDEM_MOD[x.mod] ?? 99) - (ORDEM_MOD[y.mod] ?? 99) || ORDEM_FASES.indexOf(x.fase) - ORDEM_FASES.indexOf(y.fase);
}

function rotuloFase(j) {
  return j.fase === 'grupo' ? `Grupo ${j.grupo || '?'}` : NOME_FASE[j.fase] || j.fase;
}

function cabecalho(titulo, sub = '', { voltar = null, acao = '', logo = null } = {}) {
  return `<header class="tela-topo">
      ${voltar ? `<a class="voltar" href="${voltar.href}">‹ ${esc(voltar.texto)}</a>` : ''}
      <div class="tela-topo-linha">
        <div class="tela-titulo">
          ${logo ? `<img class="escudo escudo-titulo" src="${esc(logo)}" alt="" width="64" height="52">` : ''}
          <div><h1>${esc(titulo)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
        </div>
        ${acao}
      </div>
    </header>`;
}

function secao(titulo, conteudo, { acao = '', id = '' } = {}) {
  return `<section class="secao"${id ? ` id="${id}"` : ''}>
      <div class="secao-topo"><h2>${esc(titulo)}</h2>${acao}</div>
      ${conteudo}
    </section>`;
}

const vazio = (texto) => `<p class="vazio">${texto}</p>`;

function cartaoJogo(ctx, j, { modalidade = true, data = false } = {}) {
  const m = MODALIDADE[j.mod];
  const esporte = m && ESPORTES[m.esporte];
  if (!esporte) return '';
  const placar = placarEfetivo(j, esporte);
  const v = placar ? vencedor(j, esporte) : null;
  const nossoLado = ehNossa(ctx, j.a) ? 'a' : ehNossa(ctx, j.b) ? 'b' : null;
  let selo = '';
  if (placar && j.res.wo) selo = '<span class="selo selo-wo">W.O.</span>';
  else if (placar && nossoLado) {
    selo =
      v === 'empate'
        ? '<span class="selo selo-e" title="Empate">E</span>'
        : v === nossoLado
          ? '<span class="selo selo-v" title="Vitória">V</span>'
          : '<span class="selo selo-d" title="Derrota">D</span>';
  }
  const detalhes = [];
  if (placar?.parciais && !j.res.wo) detalhes.push(placar.parciais.map(([x, y]) => `${x}–${y}`).join('  '));
  if (placar?.penaltis && placar.a === placar.b) detalhes.push(`${esporte.decisao ?? 'desempate'}: ${placar.penaltis.a}–${placar.penaltis.b}`);
  if (j.res?.wo) detalhes.push(j.res.woTipo === 'tecnico' ? 'W.O. técnico' : 'W.O.');
  const meta = [modalidade ? m.curto : null, rotuloFase(j), j.local].filter(Boolean).map(esc).join(' · ');
  const lado = (l) => {
    const venceu = placar && v === l;
    return `<span class="time${classeNossa(ctx, j[l])}${venceu ? ' venceu' : ''}">
        <span class="time-nome">${nome(ctx, j[l])}</span><span class="time-placar">${placar ? placar[l] : ''}</span>
      </span>`;
  };
  // Para quem edita, o jogo inteiro é um botão que abre a folha; para quem só acompanha, é só leitura.
  const [abre, fecha] = ctx.pode.editar
    ? [`<button type="button" class="jogo" data-acao="editar-jogo" data-id="${esc(j.id)}">`, '</button>']
    : ['<div class="jogo">', '</div>'];
  return `<li>${abre}
      <span class="jogo-quando">${data ? `<span class="jogo-dia">${esc(dataCurta(j.data))}</span>` : ''}<span class="jogo-hora">${esc(j.hora || '--:--')}</span></span>
      <span class="jogo-centro">
        <span class="jogo-meta">${meta}</span>
        ${lado('a')}${lado('b')}
        ${detalhes.length ? `<span class="jogo-detalhe">${esc(detalhes.join(' · '))}</span>` : ''}
        ${j.obs ? `<span class="jogo-obs"><strong>Obs.:</strong> ${esc(j.obs)}</span>` : ''}
      </span>
      <span class="jogo-selo">${selo}</span>
    ${fecha}</li>`;
}

// Botão que só aparece para quem pode editar.
const seEditar = (ctx, html) => (ctx.pode.editar ? html : '');

function listaJogos(ctx, jogos, opcoes) {
  return `<ul class="painel lista-jogos">${jogos.map((j) => cartaoJogo(ctx, j, opcoes)).join('')}</ul>`;
}

function opcoesAtleticasHTML(ctx, selecionada = '', vaziaTexto = 'Escolha…') {
  return `<option value="">${esc(vaziaTexto)}</option>${ATLETICAS.map(
    (a) => `<option value="${a.id}"${a.id === selecionada ? ' selected' : ''}>${nome(ctx, a.id)}</option>`,
  ).join('')}`;
}

function escolherNossa(ctx) {
  return `<section class="painel convite">
      <h2>Qual é a sua atlética?</h2>
      <p>Ela fica destacada neste aparelho e o filtro “só nossos jogos” passa a funcionar. Dá para trocar depois em Ajustes.</p>
      <label class="campo"><span>Atlética</span>
        <select id="escolha-nossa" data-mudar="nossa-local">${opcoesAtleticasHTML(ctx)}</select>
      </label>
    </section>`;
}

function marcaEmpate(empatado, texto = 'Empatada em todos os critérios: o regulamento manda sortear') {
  return empatado ? `<span class="marca-empate" title="${texto}" aria-label="${texto}">≈</span>` : '';
}

// ---------- Início ----------

function frasePosicao(ctx, lista, eu) {
  if (!eu.detalhe.length && !eu.ajustes.length) return 'Ainda não há resultados lançados para a sua atlética.';
  if (eu.posicao === 1) {
    const segundo = lista[1];
    const dif = eu.total - segundo.total;
    return dif > 0
      ? `Vocês lideram com ${pts(dif)} de vantagem sobre ${nome(ctx, segundo.id)}.`
      : `Vocês lideram, empatados em pontos com ${nome(ctx, segundo.id)}.`;
  }
  const acima = lista[eu.posicao - 2];
  const lider = lista[0];
  const falta = acima.total - eu.total;
  const passar = falta > 0 ? `Faltam ${pts(falta)} para passar ${nome(ctx, acima.id)}.` : `Empatados em pontos com ${nome(ctx, acima.id)}.`;
  return eu.posicao === 2 ? passar : `${nome(ctx, lider.id)} lidera com ${pts(lider.total)}. ${passar}`;
}

// Antes de qualquer resultado todas estão com 0: a ordem seria só a da lista, então não mostra posição.
const semResultados = (lista) => !lista.some((l) => l.detalhe.length || l.ajustes.length);
const posicaoGeral = (l, lista) => (semResultados(lista) ? '–' : `${l.posicao}º`);

// Chance em porcentagem, sem mostrar 0% ou 100% para o que ainda pode (ou não) acontecer.
function pct(x) {
  const v = Math.round(x * 100);
  if (x > 0 && v === 0) return '<1%';
  if (x < 1 && v === 100) return '>99%';
  return `${v}%`;
}

const NOTA_GRUPOS = 'Vitória na fase de grupos não vale ponto na geral: só decide quem segue. Os pontos entram quando a modalidade termina.';

function escudoPlacar(id) {
  return LOGO[id] ? `<img class="escudo escudo-placar" src="${esc(LOGO[id])}" alt="" width="96" height="78">` : '';
}

// Rivais mais prováveis (semifinal ou final), em texto: "Direito (40%), Touros (25%)".
function rivaisProvaveis(ctx, chances, limite = 3) {
  return Object.entries(chances || {})
    .filter(([, p]) => p >= 0.05)
    .sort((x, y) => y[1] - x[1])
    .slice(0, limite)
    .map(([id, p]) => `${nome(ctx, id)} (${pct(p)})`)
    .join(', ');
}

function miniGeral(ctx, lista) {
  const nossa = lista.find((l) => ehNossa(ctx, l.id));
  const topo = lista.slice(0, 5);
  const linhas = topo.map((l) => linhaMini(ctx, l, lista));
  if (nossa && nossa.posicao > 5) linhas.push('<li class="reticencias" aria-hidden="true">⋯</li>', linhaMini(ctx, nossa, lista));
  return `<ol class="painel lista-mini">${linhas.join('')}</ol>`;
}

function linhaMini(ctx, l, lista) {
  return `<li class="${classeNossa(ctx, l.id)}"><a href="#/a/${l.id}">
      <span class="pos">${posicaoGeral(l, lista)}${marcaEmpate(l.empatado)}</span>
      <span class="nome">${nome(ctx, l.id)}</span>
      <span class="valor">${inteiro(l.total)}<small> pts</small></span>
    </a></li>`;
}

// Pontos já conquistados (colocações definidas). É o que quem só acompanha vê.
function placarConquistados(ctx) {
  const { modelo } = ctx;
  const lista = modelo.geral.conquistados;
  const eu = lista.find((l) => l.id === modelo.nossa);
  const euOficial = modelo.geral.oficial.find((l) => l.id === modelo.nossa);
  return `<section class="placar-nos" aria-label="Nossa posição">
      <p class="rotulo">${nome(ctx, modelo.nossa)} · pontos conquistados <a class="placar-trocar" href="#/ajustes">Trocar atlética</a></p>
      <div class="placar-nos-numeros">
        <span class="placar-pos">${posicaoGeral(eu, lista)}</span>
        <span class="placar-pts">${inteiro(eu.total)}<small>pts</small></span>
        ${escudoPlacar(modelo.nossa)}
      </div>
      <p class="placar-frase">${semResultados(lista) ? NOTA_GRUPOS : frasePosicao(ctx, lista, eu)}</p>
      <dl class="placar-extra">
        <div><dt>Contando só oficiais</dt><dd>${posicaoGeral(euOficial, modelo.geral.oficial)} · ${pts(euOficial.total)}</dd></div>
        <div><dt>Modalidades com pontos</dt><dd>${modelo.comPontos} de ${TOTAL_MODALIDADES}</dd></div>
      </dl>
    </section>`;
}

// Para a equipe: onde a simulação do resto do campeonato coloca a atlética na geral.
function placarPrevisao(ctx) {
  const { modelo, previsao } = ctx;
  if (previsao && !previsao.simuladas.length) return placarConquistados(ctx);
  const rotulo = `<p class="rotulo">${nome(ctx, modelo.nossa)} · previsão <a class="placar-trocar" href="#/ajustes">Trocar atlética</a></p>`;
  if (!previsao) {
    return `<section class="placar-nos" aria-label="Nossa posição">${rotulo}
        <div class="placar-nos-numeros"><span class="placar-pos">…</span>${escudoPlacar(modelo.nossa)}</div>
        <p class="placar-frase">Calculando a previsão…</p>
      </section>`;
  }
  const eu = previsao.geral.find((l) => l.id === modelo.nossa);
  const conquistados = modelo.geral.conquistados;
  const euHoje = conquistados.find((l) => l.id === modelo.nossa);
  const rivais = previsao.geral
    .filter((l) => l.id !== modelo.nossa && l.titulo >= 0.05)
    .slice(0, 3)
    .map((l) => `${nome(ctx, l.id)} (${pct(l.titulo)})`);
  return `<section class="placar-nos" aria-label="Nossa posição">${rotulo}
      <div class="placar-nos-numeros">
        <span class="placar-pos">${eu.posicao}º</span>
        <span class="placar-pts">${Math.round(eu.esperados)}<small>pts</small></span>
        ${escudoPlacar(modelo.nossa)}
      </div>
      <p class="placar-frase">Chance de título geral: <strong>${pct(eu.titulo)}</strong>.${rivais.length ? ` Na briga: ${rivais.join(', ')}.` : ''}</p>
      <dl class="placar-extra">
        <div><dt>Faixa provável</dt><dd>${eu.faixa[0]} a ${eu.faixa[1]} pts</dd></div>
        <div><dt>Conquistados até agora</dt><dd>${posicaoGeral(euHoje, conquistados)} · ${pts(euHoje.total)}</dd></div>
      </dl>
    </section>`;
}

function miniPrevisao(ctx) {
  const { previsao } = ctx;
  if (!previsao) return vazio('Calculando a previsão…');
  const lista = previsao.geral;
  const linha = (l) => `<li class="${classeNossa(ctx, l.id)}"><a href="#/a/${l.id}">
      <span class="pos">${l.posicao}º</span>
      <span class="nome">${nome(ctx, l.id)}<small>título ${pct(l.titulo)}</small></span>
      <span class="valor">${Math.round(l.esperados)}<small> pts</small></span>
    </a></li>`;
  const nossa = lista.find((l) => ehNossa(ctx, l.id));
  const linhas = lista.slice(0, 5).map(linha);
  if (nossa && nossa.posicao > 5) linhas.push('<li class="reticencias" aria-hidden="true">⋯</li>', linha(nossa));
  return `<ol class="painel lista-mini">${linhas.join('')}</ol>`;
}

function relatorios(ctx) {
  return Object.entries(ctx.analises || {})
    .filter(([, d]) => d?.tipo === 'relatorio')
    .map(([id, d]) => ({ id, ...d }))
    .sort((x, y) => String(y.data || '').localeCompare(String(x.data || '')));
}

export function inicio(ctx) {
  const { modelo } = ctx;
  const equipe = ctx.pode.editar;
  const lista = modelo.geral.conquistados;
  let topo = '';
  if (!modelo.nossa) topo = escolherNossa(ctx);
  else topo = equipe ? placarPrevisao(ctx) : placarConquistados(ctx);

  // A equipe vê a previsão e a análise; quem só acompanha vê os pontos já conquistados.
  let classificacao;
  if (equipe && (!ctx.previsao || ctx.previsao.simuladas.length)) {
    classificacao = secao('Previsão da geral', miniPrevisao(ctx), { acao: '<button type="button" class="link" data-acao="ver-previsao">Ver completa</button>' });
  } else {
    classificacao = secao('Classificação geral', semResultados(lista) ? vazio(`Ninguém pontuou ainda. ${NOTA_GRUPOS}`) : miniGeral(ctx, lista), {
      acao: '<a class="link" href="#/geral">Ver completa</a>',
    });
  }
  const ultimoRelatorio = relatorios(ctx)[0];
  const cartaoAnalise = equipe
    ? secao(
        'Análise da equipe',
        `${resumoObjetivo(ctx)}<a class="painel cartao-analise" href="#/analise">
          <span class="cartao-analise-titulo">${esc(ultimoRelatorio?.titulo || 'Chances por modalidade e destaques')}</span>
          <span class="cartao-analise-sub">${esc(ultimoRelatorio?.resumo || 'Quem tende a passar de fase, contra quem devemos jogar e os atletas que mais pontuam.')}</span>
        </a>`,
      )
    : '';

  const nossos = modelo.nossa ? modelo.jogos.filter((j) => j.a === modelo.nossa || j.b === modelo.nossa) : [];
  const proximos = nossos.filter((j) => !temResultado(j)).sort(compararJogos).slice(0, 5);
  const ultimos = nossos.filter(temResultado).sort(compararJogos).reverse().slice(0, 5);
  const semJogos = ctx.pode.editar
    ? 'Nenhum jogo nosso marcado. Monte os grupos em Modalidades: o app cria os jogos de cada grupo.'
    : 'Nenhum jogo marcado ainda.';

  return `${topo}
    ${cartaoAnalise}
    ${classificacao}
    ${modelo.nossa ? secao('Próximos jogos', proximos.length ? listaJogos(ctx, proximos, { data: true }) : vazio(semJogos), { acao: '<a class="link" href="#/jogos">Todos os jogos</a>' }) : ''}
    ${
      modelo.nossa && ultimos.length
        ? secao('Últimos resultados', listaJogos(ctx, ultimos, { data: true }), {
            acao: seEditar(ctx, `<button type="button" class="link" data-acao="resumo-dia" data-data="${esc(ultimos[0].data || '')}">Resumo do dia</button>`),
          })
        : ''
    }`;
}

// ---------- Jogos ----------

export function jogos(ctx) {
  const { modelo, ui } = ctx;
  const soNossos = Boolean(ui.soNossos && modelo.nossa);
  let lista = modelo.jogos;
  if (soNossos) lista = lista.filter((j) => j.a === modelo.nossa || j.b === modelo.nossa);
  if (ui.modJogos) lista = lista.filter((j) => j.mod === ui.modJogos);
  const abertos = lista.filter((j) => !temResultado(j)).sort(compararJogos);
  const encerrados = lista.filter(temResultado).sort(compararJogos).reverse();
  const aba = ui.abaJogos === 'encerrados' ? 'encerrados' : 'abertos';
  const mostrados = aba === 'abertos' ? abertos : encerrados;

  const porDia = new Map();
  for (const j of mostrados) {
    const dia = j.data || '';
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(j);
  }
  if (porDia.has('')) {
    const semData = porDia.get('');
    porDia.delete('');
    porDia.set('', semData); // jogos sem data vão para o fim
  }

  const coletivas = MODALIDADES.filter((m) => m.tipo === 'coletiva');
  const filtros = `<div class="filtros">
      <div class="segmentado" role="group" aria-label="Situação dos jogos">
        <button type="button" data-acao="aba-jogos" data-aba="abertos" aria-pressed="${aba === 'abertos'}">A jogar <span class="contagem">${abertos.length}</span></button>
        <button type="button" data-acao="aba-jogos" data-aba="encerrados" aria-pressed="${aba === 'encerrados'}">Encerrados <span class="contagem">${encerrados.length}</span></button>
      </div>
      <div class="filtros-linha">
        <label class="chave"><input type="checkbox" id="filtro-nossos" data-mudar="so-nossos"${soNossos ? ' checked' : ''}${modelo.nossa ? '' : ' disabled'}> Só nossos jogos</label>
        <select id="filtro-modalidade" data-mudar="mod-jogos" aria-label="Modalidade">
          <option value="">Todas as modalidades</option>
          ${coletivas.map((m) => `<option value="${m.id}"${m.id === ui.modJogos ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}
        </select>
      </div>
    </div>`;

  let conteudo;
  if (!mostrados.length) {
    let texto = 'Ainda não há jogos marcados.';
    if (modelo.jogos.length) texto = 'Nenhum jogo com esses filtros.';
    else if (ctx.pode.editar) texto = 'Ainda não há jogos. Monte os grupos de cada modalidade coletiva (o app cria os jogos do grupo) ou use “Novo jogo”.';
    conteudo = vazio(texto);
  } else {
    conteudo = [...porDia.entries()]
      .map(([dia, lista]) => {
        const resumo = dia ? seEditar(ctx, `<button type="button" class="link" data-acao="resumo-dia" data-data="${dia}">Resumo</button>`) : '';
        const remarcar =
          aba === 'abertos' && dia ? seEditar(ctx, `<button type="button" class="link" data-acao="remarcar-dia" data-data="${dia}">Remarcar dia</button>`) : '';
        return secao(dataLonga(dia), listaJogos(ctx, lista), { acao: resumo || remarcar ? `<span class="links-secao">${resumo}${remarcar}</span>` : '' });
      })
      .join('');
  }

  const sub = ctx.pode.editar ? 'Datas mudam? Edite o jogo ou remarque o dia inteiro.' : 'Horários e locais do tabelamento da CO.';
  // Resumo do dia (imagem ou PDF) e novo jogo: só para quem entrou com uma conta da equipe.
  return `${cabecalho('Jogos', sub, {
    acao: seEditar(
      ctx,
      `<div class="acoes">
        <button type="button" class="botao secundario" data-acao="resumo-dia">Resumo do dia</button>
        <button type="button" class="botao" data-acao="novo-jogo" data-mod="${esc(ui.modJogos || '')}">Novo jogo</button>
      </div>`,
    ),
  })}
    ${filtros}
    ${conteudo}`;
}

// ---------- Modalidades ----------

function seloEstado(info) {
  if (info.estado === 'oficial') return '<span class="selo selo-oficial">Oficial</span>';
  if (info.estado === 'encerrada') return '<span class="selo selo-encerrada">Encerrada</span>';
  if (info.estado === 'andamento') return '<span class="selo selo-andamento">Em andamento</span>';
  return '<span class="selo selo-aguardando">Aguardando</span>';
}

function resumoModalidade(info) {
  const { m } = info;
  if (m.tipo === 'coletiva') {
    if (!Object.keys(info.grupos).length) return esc(m.formato);
    const feitos = info.jogos.filter((j) => temResultado(j)).length;
    return `${info.participantes} atléticas · ${feitos} de ${info.jogos.length} jogos com resultado`;
  }
  if (m.tipo === 'provas') {
    const lancadas = m.provas.filter((p) => info.resultados[p.id].length).length;
    if (m.provas.length === 1) return lancadas ? 'Resultado lançado' : esc(m.formato);
    return `${lancadas} de ${m.provas.length} ${m.provas[0].id === 'leve' ? 'categorias' : 'provas'} lançadas`;
  }
  return esc(m.formato);
}

function itemModalidade(ctx, info) {
  const nossa = info.vigente.find((l) => ehNossa(ctx, l.id) && l.posicao);
  // Para a equipe, enquanto não há colocação, a chance de chegar à semifinal.
  const chance = !nossa && ctx.pode.editar && ctx.modelo.nossa ? ctx.previsao?.modalidades[info.m.id]?.[ctx.modelo.nossa] : null;
  let lado = nossa ? `<span class="mod-nossa">Nós: ${nossa.posicao}º</span>` : '';
  if (!lado && chance && !chance.eliminada) lado = `<span class="mod-nossa">${chance.tipo === 'jogos' ? `Semi: ${pct(chance.semi)}` : `Pódio: ${pct(chance.podio)}`}</span>`;
  return `<li><a class="mod" href="#/m/${info.m.id}">
      <span class="mod-texto"><span class="mod-nome">${esc(info.m.nome)}</span><span class="mod-sub">${resumoModalidade(info)}</span></span>
      <span class="mod-lado">${seloEstado(info)}${lado}</span>
    </a></li>`;
}

export function modalidades(ctx) {
  const grupo = (tipo) =>
    `<ul class="painel lista-mod">${MODALIDADES.filter((m) => m.tipo === tipo)
      .map((m) => itemModalidade(ctx, ctx.modelo.modalidades[m.id]))
      .join('')}</ul>`;
  return `${cabecalho('Modalidades', `${ctx.modelo.oficiais} de ${TOTAL_MODALIDADES} com classificação oficial`)}
    ${secao('Coletivas', grupo('coletiva'))}
    ${secao('Provas, chaves e lutas', grupo('provas'))}
    ${secao('Xadrez', grupo('classificacao'))}`;
}

// ---------- Uma modalidade ----------

function tabelaDoGrupo(ctx, info, t) {
  const { esporte } = info;
  let colunas;
  if (esporte.sets) colunas = ['P', 'J', 'V', 'D', 'Sets', 'Saldo'];
  else if (esporte.semEmpate) colunas = ['P', 'J', 'V', 'D', 'Pró', 'Contra', 'Saldo'];
  else colunas = ['P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG'];
  const celulas = (l) => {
    const saldo = comSinal(l.pro - l.contra);
    if (esporte.sets) return [l.pts, l.j, l.v, l.d, `${l.setsPro}–${l.setsContra}`, saldo];
    if (esporte.semEmpate) return [l.pts, l.j, l.v, l.d, l.pro, l.contra, saldo];
    return [l.pts, l.j, l.v, l.e, l.d, l.pro, l.contra, saldo];
  };
  const linhas = t.tabela
    .map(
      (l) => `<tr class="${classeNossa(ctx, l.id).trim()}${l.eliminado ? ' eliminada' : ''}">
        <td class="pos">${l.posicao ? `${l.posicao}º` : '—'}${marcaEmpate(l.empatado, 'Empatada até o último critério calculado: o próximo é o sorteio')}</td>
        <td class="nome">${nome(ctx, l.id)}${l.eliminado ? ' <span class="selo selo-wo">W.O.</span>' : ''}</td>
        ${celulas(l)
          .map((c, i) => `<td${i === 0 ? ' class="destaque"' : ''}>${c}</td>`)
          .join('')}
      </tr>`,
    )
    .join('');
  return `<div class="tabela-rolagem painel"><table class="tabela">
      <thead><tr><th class="pos" scope="col">#</th><th class="nome" scope="col">Atlética</th>${colunas.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>
    ${t.semParciais ? '<p class="nota">Falta lançar as parciais de algum jogo: sem elas o saldo de pontos fica incompleto.</p>' : ''}`;
}

function blocoGrupos(ctx, info) {
  const letras = Object.keys(info.grupos);
  const botao = seEditar(
    ctx,
    `<button type="button" class="botao secundario pequeno" data-acao="editar-grupos" data-mod="${info.m.id}">${letras.length ? 'Editar grupos' : 'Montar grupos'}</button>`,
  );
  if (!letras.length) {
    const texto = ctx.pode.editar
      ? `Formato: ${esc(info.m.formato)}. Monte os grupos do chaveamento e o app cria todos os jogos de cada grupo.`
      : `Formato: ${esc(info.m.formato)}. Os grupos ainda não foram lançados.`;
    return secao('Grupos', vazio(texto), { acao: botao });
  }
  const grupos = letras
    .map((letra) => {
      const membros = info.grupos[letra];
      const jogosGrupo = info.jogos.filter((j) => j.fase === 'grupo' && membros.includes(j.a) && membros.includes(j.b)).sort(compararJogos);
      return `<div class="grupo">
          <h3>Grupo ${letra}</h3>
          ${tabelaDoGrupo(ctx, info, info.tabelas[letra])}
          ${jogosGrupo.length ? listaJogos(ctx, jogosGrupo, { modalidade: false, data: true }) : ''}
        </div>`;
    })
    .join('');
  return secao('Grupos', grupos, { acao: botao });
}

// Repescagem (só em algumas modalidades), semifinais e final. O botão já sugere a próxima fase que falta.
function blocoFinais(ctx, info) {
  const { m } = info;
  const jogos = info.jogos.filter((j) => j.fase !== 'grupo');
  const quantos = (fase) => jogos.filter((j) => j.fase === fase).length;
  // A repescagem é um triangular (3 jogos) entre os 2º colocados.
  const proxima = m.repescagem && quantos('repescagem') < 3 && !quantos('semifinal') ? 'repescagem' : quantos('semifinal') < 2 ? 'semifinal' : 'final';
  const titulo = m.repescagem ? 'Repescagem, semifinal e final' : 'Semifinal e final';
  const botao = seEditar(
    ctx,
    `<button type="button" class="botao secundario pequeno" data-acao="novo-jogo" data-mod="${m.id}" data-fase="${proxima}">Adicionar jogo</button>`,
  );
  if (!jogos.length) {
    const fases = m.repescagem ? 'a repescagem, as semifinais e a final' : 'as semifinais e a final';
    const texto = ctx.pode.editar ? `Quando acabarem os grupos, adicione aqui ${fases}.` : `${fases.charAt(0).toUpperCase()}${fases.slice(1)} aparecem aqui quando acabarem os grupos.`;
    return secao(titulo, vazio(texto), { acao: botao });
  }
  const tabelaRep = info.tabelaRepescagem && info.tabelaRepescagem.tabela.length > 2 ? tabelaDoGrupo(ctx, info, info.tabelaRepescagem) : '';
  const porFase = ORDEM_FASES.filter((f) => f !== 'grupo')
    .map((f) => [f, jogos.filter((j) => j.fase === f).sort(compararJogos)])
    .filter(([, lista]) => lista.length)
    .map(
      ([f, lista]) =>
        `<div class="grupo"><h3>${esc(NOME_FASE[f])}</h3>${f === 'repescagem' ? tabelaRep : ''}${listaJogos(ctx, lista, { modalidade: false, data: true })}</div>`,
    )
    .join('');
  return secao(titulo, porFase, { acao: botao });
}

function blocoProvas(ctx, info) {
  const { m } = info;
  const provas = m.provas
    .map((prova) => {
      const linhas = [...info.resultados[prova.id]].sort((x, y) => x.pos - y.pos);
      const avisos = info.pontuacao.avisos.filter((a) => a.prova === prova.id);
      const excedeu = new Set(avisos.map((a) => a.at));
      const lista = linhas.length
        ? `<ol class="lista-prova">${linhas
            .map(
              (l) => `<li class="${classeNossa(ctx, l.at).trim()}">
                <span class="pos">${l.pos}º</span>
                <span class="nome">${nome(ctx, l.at)}${l.nome ? `<small>${esc(l.nome)}</small>` : ''}</span>
                <span class="valor${excedeu.has(l.at) ? ' anulado' : ''}">${excedeu.has(l.at) ? 0 : pontosPorColocacao(l.pos, prova.peso)}</span>
              </li>`,
            )
            .join('')}</ol>`
        : vazio('Sem resultado ainda.');
      const alertas = avisos
        .map(
          (a) =>
            `<p class="alerta">${nome(ctx, a.at)} aparece mais de ${a.limite} ${a.limite === 1 ? 'vez' : 'vezes'} e fica com zero nesta prova (A1 Arts. 38 e 49).</p>`,
        )
        .join('');
      return `<article class="painel prova">
          <div class="prova-topo">
            <h3>${esc(prova.nome)}${prova.peso > 1 ? ' <span class="selo selo-dobro">vale em dobro</span>' : ''}</h3>
            ${seEditar(ctx, `<button type="button" class="botao secundario pequeno" data-acao="editar-prova" data-mod="${m.id}" data-prova="${prova.id}">${linhas.length ? 'Editar' : 'Lançar'}</button>`)}
          </div>
          ${lista}${alertas}
        </article>`;
    })
    .join('');
  const titulo = m.provas.length === 1 ? 'Chave' : m.provas[0].id === 'leve' || m.provas[0].id === 'absoluto' ? 'Categorias' : 'Provas';
  return secao(titulo, `<div class="provas">${provas}</div>`);
}

function blocoPontosProvas(ctx, info) {
  const { ordem, semPontos } = info.pontuacao;
  if (!ordem.length && !semPontos.length) return '';
  const linhas = ordem
    .map(
      (l) => `<tr class="${classeNossa(ctx, l.id).trim()}">
        <td class="pos">${l.posicao}º${marcaEmpate(l.empatado)}</td>
        <td class="nome">${nome(ctx, l.id)}</td>
        <td class="destaque">${l.pts}</td><td>${l.colocacoes[0]}</td><td>${l.colocacoes[1]}</td><td>${l.colocacoes[2]}</td>
      </tr>`,
    )
    .join('');
  const zerados = semPontos.length ? `<p class="nota">Sem pontos: ${semPontos.map((l) => nome(ctx, l.id)).join(', ')}.</p>` : '';
  return secao(
    'Pontos na modalidade',
    `<div class="tabela-rolagem painel"><table class="tabela">
        <thead><tr><th class="pos" scope="col">#</th><th class="nome" scope="col">Atlética</th><th scope="col">Pts</th><th scope="col">1º</th><th scope="col">2º</th><th scope="col">3º</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
      <p class="nota">Empate se resolve pelo maior número de 1º lugares, depois de 2º, e assim por diante.</p>${zerados}`,
  );
}

function blocoClassificacao(ctx, info) {
  const { m } = info;
  const oficial = Boolean(info.oficial);
  const lista = oficial ? info.oficial : info.calculada.filter((l) => l.posicao);
  const foraPorWO = oficial ? [] : info.calculada.filter((l) => !l.posicao);
  const temEmpate = !oficial && lista.some((l) => l.empatado);
  let explicacao;
  if (oficial) explicacao = 'Classificação oficial divulgada pela CO: é esta que vale na classificação geral.';
  else if (m.tipo === 'coletiva' && lista.length)
    explicacao =
      'Calculada com todos os jogos: a final define campeã e vice; 3º é quem perdeu a semifinal para a campeã e 4º quem perdeu para a vice. Depois vem quem não venceu a repescagem e, por fim, quem não passou dos grupos, pela posição no grupo e pela campanha. Quando a CO divulgar a oficial, confirme ou ajuste.';
  else if (m.tipo === 'coletiva') explicacao = `A colocação e os pontos saem quando a final tiver resultado. ${NOTA_GRUPOS}`;
  else if (m.tipo === 'provas') explicacao = 'Soma dos pontos das provas já lançadas. Quando a CO divulgar a oficial, confirme ou ajuste.';
  else explicacao = 'Lance a classificação final quando a CO divulgar.';

  const linhas = lista
    .map((l) => {
      const zerado = ctx.modelo.zerados.has(`${m.id}|${l.id}`);
      const etapa = !oficial && m.tipo === 'coletiva' ? NOME_ETAPA[l.etapa] : '';
      return `<li class="${classeNossa(ctx, l.id).trim()}">
          <span class="pos">${l.posicao}º${marcaEmpate(!oficial && l.empatado)}</span>
          <span class="nome">${nome(ctx, l.id)}${etapa ? `<small>${esc(etapa)}</small>` : ''}${zerado ? '<small class="texto-alerta">Sem pontos: W.O. ou fraude</small>' : ''}</span>
          <span class="valor">${zerado ? 0 : pontosPorColocacao(l.posicao)}<small> pts</small></span>
        </li>`;
    })
    .concat(
      foraPorWO.map(
        (l) => `<li class="${classeNossa(ctx, l.id).trim()} eliminada">
          <span class="pos">—</span><span class="nome">${nome(ctx, l.id)}<small>${l.eliminadoWO === 'tecnico' ? 'W.O. técnico' : 'W.O.'}: fora da modalidade</small></span><span class="valor">0<small> pts</small></span>
        </li>`,
      ),
    )
    .join('');

  const selo = oficial ? '<span class="selo selo-oficial">Oficial</span>' : lista.length ? '<span class="selo selo-encerrada">Calculada</span>' : '';
  const botoes = ctx.pode.editar
    ? [
        !oficial && lista.length ? `<button type="button" class="botao" data-acao="confirmar-oficial" data-mod="${m.id}">Confirmar como oficial</button>` : '',
        `<button type="button" class="botao secundario" data-acao="editar-oficial" data-mod="${m.id}">${oficial ? 'Editar' : 'Lançar à mão'}</button>`,
        oficial && m.tipo !== 'classificacao' ? `<button type="button" class="link" data-acao="remover-oficial" data-mod="${m.id}">Voltar para a projeção</button>` : '',
        oficial && m.tipo === 'classificacao' ? `<button type="button" class="link" data-acao="remover-oficial" data-mod="${m.id}">Apagar classificação</button>` : '',
      ].join('')
    : '';

  return `<section class="secao" id="classificacao">
      <div class="secao-topo"><h2>Classificação</h2>${selo}</div>
      <p class="nota">${explicacao}</p>
      ${linhas ? `<ol class="painel lista-classif">${linhas}</ol>` : m.tipo === 'coletiva' ? '' : vazio('Nada lançado ainda.')}
      ${temEmpate ? '<p class="alerta">Há empates em todos os critérios (≈). O regulamento manda sortear: ajuste à mão quando sair o sorteio.</p>' : ''}
      ${botoes ? `<div class="acoes">${botoes}</div>` : ''}
    </section>`;
}

function blocoPunicoes(ctx, info) {
  const { m } = info;
  const itens = [];
  for (const [at, tipo] of info.wo) {
    const perde12 = tipo === 'normal' || ctx.modelo.config.woTecnicoPerde12;
    itens.push(`<li class="item-punicao${classeNossa(ctx, at)}">
        <span class="nome">${nome(ctx, at)}<small>${tipo === 'tecnico' ? 'W.O. técnico' : 'W.O.'} lançado num jogo · fora da modalidade</small></span>
        <span class="valor">${perde12 ? '−12' : '0'}</span>
      </li>`);
  }
  for (const p of ctx.modelo.punicoes.filter((p) => p.mod === m.id)) itens.push(itemPunicao(ctx, p, p.motivo || TIPOS_PUNICAO[p.tipo]?.nome || ''));
  const nota =
    m.tipo === 'coletiva'
      ? '<p class="nota">W.O. marcado no jogo já tira a atlética da modalidade e desconta 12 pontos sozinho (RG Art. 27).</p>'
      : '<p class="nota">Atlética inscrita que não participa de nenhuma prova leva W.O. (A1 Arts. 44 e 55).</p>';
  return secao('W.O. e punições', `${itens.length ? `<ul class="painel lista-punicoes">${itens.join('')}</ul>` : ''}${nota}`, {
    acao: seEditar(ctx, `<button type="button" class="link" data-acao="nova-punicao" data-mod="${m.id}">Registrar</button>`),
  });
}

// Punição lançada à mão: quem edita toca para corrigir; quem só acompanha vê.
function itemPunicao(ctx, p, descricao) {
  const conteudo = `<span class="nome">${nome(ctx, p.at)}<small>${esc(descricao)}</small></span>
      <span class="valor">${p.pontos ? comSinal(p.pontos) : '0'}</span>`;
  return ctx.pode.editar
    ? `<li><button type="button" class="item-punicao${classeNossa(ctx, p.at)}" data-acao="editar-punicao" data-id="${esc(p.id)}">${conteudo}</button></li>`
    : `<li class="item-punicao${classeNossa(ctx, p.at)}">${conteudo}</li>`;
}

// Previsão da modalidade (só a equipe): chance de cada atlética em cada fase e pontos esperados na geral.
function blocoPrevisao(ctx, info) {
  if (!ctx.pode.editar || info.vigente.length) return '';
  if (!ctx.previsao) return secao('Previsão', '<p class="nota">Calculando a previsão…</p>');
  const dados = ctx.previsao.modalidades[info.m.id];
  if (!dados) return '';
  if (Object.values(dados)[0]?.tipo === 'historico') return blocoPrevisaoHistorico(ctx, info, dados);
  const grupoDe = Object.fromEntries(Object.entries(info.grupos).flatMap(([letra, membros]) => membros.map((id) => [id, letra])));
  const comRepescagem = Boolean(info.m.repescagem);
  const linhas = Object.entries(dados)
    .sort((x, y) => y[1].pontos - x[1].pontos || y[1].titulo - x[1].titulo)
    .map(
      ([id, c]) => `<tr class="${classeNossa(ctx, id).trim()}${c.eliminada ? ' eliminada' : ''}">
        <td class="nome">${nome(ctx, id)}<small>Grupo ${esc(grupoDe[id] || '?')}${colocacao2025(id, info.m.id) ? ` · 2025: ${colocacao2025(id, info.m.id)}º` : ''}</small></td>
        <td>${pct(c.lider)}</td>
        ${comRepescagem ? `<td>${pct(c.repescagem)}</td>` : ''}
        <td>${pct(c.semi)}</td><td>${pct(c.final)}</td><td class="destaque">${pct(c.titulo)}</td>
        <td>${c.pontos.toFixed(1).replace('.', ',')}</td>
      </tr>`,
    )
    .join('');
  const nossa = ctx.modelo.nossa && dados[ctx.modelo.nossa];
  const situacao = blocoSituacao(ctx, info);
  let caminho = '';
  // O cartão da nossa situação já traz os adversários prováveis; sem ele, fica a frase do caminho.
  const temCartao = Boolean(situacoesDoModelo(ctx.modelo)[info.m.id]?.times[ctx.modelo.nossa]);
  if (nossa && !nossa.eliminada && !temCartao) {
    const semi = rivaisProvaveis(ctx, nossa.rivalSemi);
    const fin = rivaisProvaveis(ctx, nossa.rivalFinal);
    const partes = [semi ? `semifinal contra ${semi}` : '', fin ? `final contra ${fin}` : ''].filter(Boolean);
    if (partes.length) caminho = `<p class="caminho"><strong>Nosso caminho mais provável:</strong> ${partes.join('; ')}. A porcentagem é a chance de o jogo acontecer.</p>`;
  }
  return secao(
    'Previsão',
    `${situacao}${caminho}
    <div class="tabela-rolagem painel"><table class="tabela tabela-previsao">
      <thead><tr><th class="nome" scope="col">Atlética</th><th scope="col" title="Terminar em 1º no grupo">Líder</th>${comRepescagem ? '<th scope="col" title="Ir para a repescagem">Rep.</th>' : ''}<th scope="col">Semi</th><th scope="col">Final</th><th scope="col">Título</th><th scope="col" title="Pontos esperados na geral">Pts</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>
    <p class="nota">Simulação de ${ctx.previsao.simulacoes.toLocaleString('pt-BR')} campeonatos com os resultados até agora: a força de cada atlética parte do resultado de 2025 e é corrigida pelos placares (saldo), com muita incerteza enquanto há poucos jogos. Pts são os pontos esperados na geral. Só a equipe vê esta parte.</p>`,
  );
}

// Modalidade ainda sem resultado: previsão pela edição de 2025 (só a equipe).
function blocoPrevisaoHistorico(ctx, info, dados) {
  const linhas = Object.entries(dados)
    .sort((x, y) => y[1].pontos - x[1].pontos || y[1].titulo - x[1].titulo)
    .map(([id, c]) => {
      const em2025 = colocacao2025(id, info.m.id);
      return `<tr class="${classeNossa(ctx, id).trim()}">
        <td class="nome">${nome(ctx, id)}</td>
        <td>${em2025 ? `${em2025}º` : '—'}</td>
        <td class="destaque">${pct(c.titulo)}</td><td>${pct(c.podio)}</td>
        <td>${c.pontos.toFixed(1).replace('.', ',')}</td>
      </tr>`;
    })
    .join('');
  return secao(
    'Previsão',
    `<div class="tabela-rolagem painel"><table class="tabela tabela-previsao">
      <thead><tr><th class="nome" scope="col">Atlética</th><th scope="col" title="Colocação em 2025">2025</th><th scope="col">Título</th><th scope="col" title="Terminar entre as 3 primeiras">Pódio</th><th scope="col" title="Pontos esperados na geral">Pts</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>
    <p class="nota">Ainda sem resultado em 2026: a previsão parte da classificação de 2025 nesta modalidade e da força de cada atlética no conjunto das individuais, com bastante incerteza (muita gente entrou e saiu). Quando os resultados forem lançados, valem eles. Só a equipe vê esta parte.</p>`,
  );
}

export function modalidade(ctx, id) {
  const info = ctx.modelo.modalidades[id];
  if (!info) return naoEncontrada('Modalidade não encontrada.', '#/modalidades', 'Modalidades');
  const { m } = info;
  const topo = cabecalho(m.nome, `${esc(m.formato)} ${seloEstado(info)}`, { voltar: { href: '#/modalidades', texto: 'Modalidades' } });
  if (m.tipo === 'coletiva') {
    const avisoPeteca = info.esporte.semRegraPropria
      ? '<p class="alerta">O regulamento não define pontos de grupo nem desempate da peteca. O app usa os do vôlei até a CO definir.</p>'
      : '';
    return `${topo}${avisoPeteca}${blocoPrevisao(ctx, info)}${blocoGrupos(ctx, info)}${blocoFinais(ctx, info)}${blocoClassificacao(ctx, info)}${blocoPunicoes(ctx, info)}`;
  }
  if (m.tipo === 'provas') {
    return `${topo}${blocoPrevisao(ctx, info)}${blocoProvas(ctx, info)}${blocoPontosProvas(ctx, info)}${blocoClassificacao(ctx, info)}${blocoPunicoes(ctx, info)}`;
  }
  return `${topo}${blocoPrevisao(ctx, info)}${blocoClassificacao(ctx, info)}${blocoPunicoes(ctx, info)}`;
}

// ---------- Geral ----------

function tabelaPrevisaoGeral(ctx) {
  const { previsao } = ctx;
  if (!previsao) return vazio('Calculando a previsão…');
  if (!previsao.simuladas.length) return vazio('Todas as modalidades já têm colocação: a classificação é a dos pontos conquistados.');
  const linhas = previsao.geral
    .map(
      (l) => `<tr class="${classeNossa(ctx, l.id).trim()}">
        <td class="pos">${l.posicao}º</td>
        <td class="nome"><a href="#/a/${l.id}">${nome(ctx, l.id)}</a></td>
        <td class="destaque">${Math.round(l.esperados)}</td>
        <td>${l.faixa[0]}–${l.faixa[1]}</td>
        <td>${pct(l.titulo)}</td><td>${pct(l.podio)}</td>
      </tr>`,
    )
    .join('');

  return `<div class="tabela-rolagem painel"><table class="tabela tabela-geral tabela-previsao">
      <thead><tr>
        <th class="pos" scope="col">#</th><th class="nome" scope="col">Atlética</th><th scope="col" title="Pontos esperados">Pts</th>
        <th scope="col" title="8 em cada 10 simulações terminam nesta faixa">Faixa</th><th scope="col">Título</th><th scope="col" title="Terminar entre as 3 primeiras">Pódio</th>
      </tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>
    <p class="nota">Pontos já conquistados mais a média de ${previsao.simulacoes.toLocaleString('pt-BR')} simulações de tudo o que falta: ${previsao.porJogos.length} coletivas jogo a jogo e ${previsao.porHistorico.length} modalidades ainda sem resultado (provas, lutas, raquetes, xadrez, peteca) pelo histórico de 2025. Faixa: 8 em cada 10 simulações terminam dentro dela. Só a equipe vê a previsão.</p>`;
}

export function geral(ctx) {
  const equipe = ctx.pode.editar;
  let modo = ['conquistados', 'oficial', 'previsao'].includes(ctx.ui.modoGeral) ? ctx.ui.modoGeral : 'conquistados';
  if (modo === 'previsao' && !equipe) modo = 'conquistados';
  const botoes = `<div class="filtros">
      <div class="segmentado" role="group" aria-label="O que somar">
        <button type="button" data-acao="modo-geral" data-modo="conquistados" aria-pressed="${modo === 'conquistados'}">Conquistados</button>
        <button type="button" data-acao="modo-geral" data-modo="oficial" aria-pressed="${modo === 'oficial'}">Só oficiais</button>
        ${equipe ? `<button type="button" data-acao="modo-geral" data-modo="previsao" aria-pressed="${modo === 'previsao'}">Previsão</button>` : ''}
      </div>
    </div>`;
  const sub = `${ctx.modelo.comPontos} de ${TOTAL_MODALIDADES} modalidades com pontos · ${ctx.modelo.oficiais} oficiais`;
  if (modo === 'previsao') return `${cabecalho('Classificação geral', sub)}${botoes}${blocoCenarios(ctx)}${secao('Média das simulações', tabelaPrevisaoGeral(ctx))}`;
  const lista = ctx.modelo.geral[modo];
  const temPerdas = lista.some((l) => l.perdas);
  const linhas = lista
    .map(
      (l) => `<tr class="${classeNossa(ctx, l.id).trim()}">
        <td class="pos">${posicaoGeral(l, lista)}${marcaEmpate(l.empatado)}</td>
        <td class="nome"><a href="#/a/${l.id}">${nome(ctx, l.id)}</a></td>
        <td class="destaque">${inteiro(l.total)}</td>
        <td>${l.colocacoes[0]}</td><td>${l.colocacoes[1]}</td><td>${l.colocacoes[2]}</td>
        ${temPerdas ? `<td class="${l.perdas ? 'texto-alerta' : ''}">${l.perdas ? comSinal(l.perdas) : ''}</td>` : ''}
      </tr>`,
    )
    .join('');
  const nota =
    modo === 'conquistados'
      ? `Soma só colocações já definidas: coletivas com a final jogada, provas já disputadas e classificações oficiais, mais as perdas por W.O. e punições. ${NOTA_GRUPOS}`
      : 'Só as modalidades com classificação oficial confirmada, mais as perdas por W.O. e punições.';
  return `${cabecalho('Classificação geral', sub)}
    ${botoes}
    <p class="nota">${nota}</p>
    <div class="tabela-rolagem painel"><table class="tabela tabela-geral">
      <thead><tr>
        <th class="pos" scope="col">#</th><th class="nome" scope="col">Atlética</th><th scope="col">Pts</th>
        <th scope="col" title="Primeiros lugares">1º</th><th scope="col" title="Segundos lugares">2º</th><th scope="col" title="Terceiros lugares">3º</th>
        ${temPerdas ? '<th scope="col">Perdas</th>' : ''}
      </tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>
    <p class="nota">Pontos por modalidade: 12, 9, 7, 5, 4, 3, 2 e 1 do 1º ao 8º lugar. Empate em pontos: vence quem tem mais 1º lugares, depois mais 2º, e assim até o 11º (RG Art. 15). ≈ marca empate em todos os critérios, que vai a sorteio.</p>`;
}

// ---------- Uma atlética ----------

export function atletica(ctx, id) {
  const a = ATLETICAS.find((x) => x.id === id);
  if (!a) return naoEncontrada('Atlética não encontrada.', '#/geral', 'Classificação geral');
  const conq = ctx.modelo.geral.conquistados.find((l) => l.id === id);
  const ofic = ctx.modelo.geral.oficial.find((l) => l.id === id);
  const porMod = MODALIDADES.map((m) => {
    const d = conq.detalhe.find((x) => x.mod === m.id);
    if (!d) return '';
    const oficial = Boolean(ctx.modelo.modalidades[m.id].oficial);
    return `<li><a class="mod" href="#/m/${m.id}">
        <span class="mod-texto"><span class="mod-nome">${esc(m.nome)}</span><span class="mod-sub">${d.posicao}º lugar${d.zerado ? ' · sem pontos (W.O. ou fraude)' : ''}</span></span>
        <span class="mod-lado">${oficial ? '<span class="selo selo-oficial">Oficial</span>' : '<span class="selo selo-encerrada">Calculada</span>'}<span class="valor">${d.pontos}<small> pts</small></span></span>
      </a></li>`;
  }).join('');
  const perdas = conq.ajustes
    .map((p) => `<li class="item-punicao"><span class="nome">${esc(p.motivo)}</span><span class="valor">${comSinal(p.pontos)}</span></li>`)
    .join('');
  // Só a equipe: a previsão na geral e em cada coletiva em andamento.
  const prev = ctx.pode.editar ? ctx.previsao : null;
  const naGeral = prev?.simuladas.length ? prev.geral.find((l) => l.id === id) : null;
  const previsaoMods = prev
    ? prev.simuladas
        .filter((mod) => prev.modalidades[mod][id])
        .map((mod) => {
          const c = prev.modalidades[mod][id];
          let texto = c.eliminada ? 'Fora por W.O.' : `semi ${pct(c.semi)} · final ${pct(c.final)} · título ${pct(c.titulo)}`;
          if (c.tipo === 'historico') texto = `título ${pct(c.titulo)} · pódio ${pct(c.podio)} · pelo histórico de 2025`;
          return `<li><a class="mod" href="#/m/${mod}">
              <span class="mod-texto"><span class="mod-nome">${esc(MODALIDADE[mod].nome)}</span><span class="mod-sub">${texto}</span></span>
              <span class="mod-lado"><span class="valor">${c.pontos.toFixed(1).replace('.', ',')}<small> pts</small></span></span>
            </a></li>`;
        })
        .join('')
    : '';
  return `${cabecalho(ctx.modelo.nomes[id], esc(a.nome), { voltar: { href: '#/geral', texto: 'Classificação geral' }, logo: LOGO[id] })}
    <dl class="numeros">
      <div><dt>Conquistados</dt><dd>${posicaoGeral(conq, ctx.modelo.geral.conquistados)} <small>${pts(conq.total)}</small></dd></div>
      ${naGeral ? `<div><dt>Previsão</dt><dd>${naGeral.posicao}º <small>${Math.round(naGeral.esperados)} pts</small></dd></div>` : `<div><dt>Só oficiais</dt><dd>${posicaoGeral(ofic, ctx.modelo.geral.oficial)} <small>${pts(ofic.total)}</small></dd></div>`}
    </dl>
    ${secao('Pontos por modalidade', porMod ? `<ul class="painel lista-mod">${porMod}</ul>` : vazio(`Nenhuma colocação definida ainda. ${NOTA_GRUPOS}`))}
    ${previsaoMods ? secao('Previsão por modalidade', `<ul class="painel lista-mod">${previsaoMods}</ul><p class="nota">Pontos esperados na geral em cada modalidade que ainda não terminou. Só a equipe vê.</p>`) : ''}
    ${perdas ? secao('Perdas', `<ul class="painel lista-punicoes">${perdas}</ul>`) : ''}`;
}

// ---------- Análise (só a equipe) ----------

function blocoRelatorio(r, aberto) {
  const secoes = (r.secoes || [])
    .map(
      (s) => `<div class="relatorio-secao">
          ${s.titulo ? `<h3>${esc(s.titulo)}</h3>` : ''}
          ${(s.paragrafos || []).map((p) => `<p>${esc(p)}</p>`).join('')}
          ${s.itens?.length ? `<ul>${s.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
        </div>`,
    )
    .join('');
  return `<details class="painel relatorio"${aberto ? ' open' : ''}>
      <summary><span class="relatorio-titulo">${esc(r.titulo || 'Relatório')}</span>${r.resumo ? `<span class="relatorio-resumo">${esc(r.resumo)}</span>` : ''}</summary>
      <div class="relatorio-corpo">${secoes}</div>
    </details>`;
}

// Rankings do site oficial (artilheiros, cestinhas...), com o time de cada atleta.
function blocoAtletas(ctx, doc) {
  const mods = MODALIDADES.filter((m) => doc.modalidades?.[m.id]);
  if (!mods.length) return '';
  const nossa = ctx.modelo.nossa;
  const blocos = mods
    .map((m) => {
      const rankings = Object.entries(doc.modalidades[m.id]).filter(([, lista]) => lista?.length);
      if (!rankings.length) return '';
      const listas = rankings
        .map(([titulo, lista]) => {
          const nossos = lista.filter((l) => l.at === nossa);
          const topo = lista.slice(0, 5);
          const extra = nossos.filter((l) => !topo.includes(l)).slice(0, 2);
          const item = (l) => `<li class="${classeNossa(ctx, l.at).trim()}">
              <span class="pos">${l.pos ?? ''}${l.pos ? 'º' : ''}</span>
              <span class="nome">${esc(l.nome)}<small>${nome(ctx, l.at)}</small></span>
              <span class="valor">${esc(l.total)}</span>
            </li>`;
          return `<div class="ranking"><h4>${esc(titulo)}</h4><ol class="lista-ranking">${topo.map(item).join('')}${extra.length ? `<li class="reticencias" aria-hidden="true">⋯</li>${extra.map(item).join('')}` : ''}</ol></div>`;
        })
        .join('');
      return `<details class="painel atletas-mod"><summary>${esc(m.nome)}</summary><div class="rankings">${listas}</div></details>`;
    })
    .join('');
  const quando = doc.atualizadoEm ? ` Atualizado em ${esc(dataCurta(String(doc.atualizadoEm).slice(0, 10)))}.` : '';
  return secao('Destaques individuais', `${blocos}<p class="nota">Rankings do site oficial da competição, só das coletivas.${quando}</p>`);
}

function blocoNossasChances(ctx) {
  const { previsao, modelo } = ctx;
  if (!modelo.nossa) return '';
  if (!previsao) return secao('Nossas chances', vazio('Calculando a previsão…'));
  const minha = (lista) =>
    lista
      .map((mod) => [mod, previsao.modalidades[mod][modelo.nossa]])
      .filter(([, c]) => c)
      .sort((x, y) => y[1].pontos - x[1].pontos);
  const ptsTd = (c) => `<td>${c.pontos.toFixed(1).replace('.', ',')}</td>`;
  const soma = (lista) => lista.reduce((s, [, c]) => s + c.pontos, 0).toFixed(0);
  const coletivas = minha(previsao.porJogos);
  const individuais = minha(previsao.porHistorico);
  const tabelaColetivas = coletivas.length
    ? `<h3>Coletivas · ${soma(coletivas)} pts esperados</h3>
      <div class="tabela-rolagem painel"><table class="tabela tabela-previsao">
        <thead><tr><th class="nome" scope="col">Modalidade</th><th scope="col">Semi</th><th scope="col">Final</th><th scope="col">Título</th><th scope="col" title="Pontos esperados na geral">Pts</th></tr></thead>
        <tbody>${coletivas
          .map(
            ([mod, c]) => `<tr>
              <td class="nome"><a href="#/m/${mod}">${esc(MODALIDADE[mod].curto)}</a></td>
              <td>${c.eliminada ? '—' : pct(c.semi)}</td><td>${c.eliminada ? '—' : pct(c.final)}</td><td class="destaque">${c.eliminada ? '—' : pct(c.titulo)}</td>${ptsTd(c)}
            </tr>`,
          )
          .join('')}</tbody>
      </table></div>`
    : '';
  const tabelaIndividuais = individuais.length
    ? `<h3>Sem resultado ainda (pelo histórico de 2025) · ${soma(individuais)} pts esperados</h3>
      <div class="tabela-rolagem painel"><table class="tabela tabela-previsao">
        <thead><tr><th class="nome" scope="col">Modalidade</th><th scope="col" title="Colocação em 2025">2025</th><th scope="col">Título</th><th scope="col">Pódio</th><th scope="col" title="Pontos esperados na geral">Pts</th></tr></thead>
        <tbody>${individuais
          .map(([mod, c]) => {
            const em2025 = colocacao2025(modelo.nossa, mod);
            return `<tr>
              <td class="nome"><a href="#/m/${mod}">${esc(MODALIDADE[mod].curto)}</a></td>
              <td>${em2025 ? `${em2025}º` : '—'}</td><td class="destaque">${pct(c.titulo)}</td><td>${pct(c.podio)}</td>${ptsTd(c)}
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>`
    : '';
  if (!tabelaColetivas && !tabelaIndividuais) return '';
  return secao(
    `Chances de ${modelo.nomes[modelo.nossa]}`,
    `<div class="blocos-chances">${tabelaColetivas}${tabelaIndividuais}</div>
    <p class="nota">Toque numa modalidade para ver todas as atléticas e, nas coletivas, os adversários mais prováveis.</p>`,
  );
}

// ---------- Previsão objetiva (só a equipe) ----------
// Para cada coletiva em andamento: vai à semifinal, briga pela repescagem, briga pela vaga ou está
// fora; o que precisa nos jogos que faltam (conta exata, em situacao.js) e quem deve enfrentar.

const CATEGORIAS = [
  ['semi', 'Vão à semifinal'],
  ['repescagem', 'Na briga pela repescagem'],
  ['briga', 'Na briga pela vaga'],
  ['fora', 'Fora'],
];

function juntarE(partes) {
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : partes[0] || '';
}

// "vencer Touros", "não perder para Manada", "vencer Alfa por 2×0"...
const FRASES = {
  v: (x) => `vencer ${x}`,
  e: (x) => `empatar com ${x}`,
  d: (x) => `perder para ${x}`,
  'v,e': (x) => `não perder para ${x}`,
  'e,d': (x) => `não vencer ${x}`,
  'v,d': (x) => `não empatar com ${x}`,
  'v20,v21': (x) => `vencer ${x}`,
  v20: (x) => `vencer ${x} por 2×0`,
  v21: (x) => `vencer ${x} por 2×1`,
  'd12,d02': (x) => `perder para ${x}`,
  d12: (x) => `perder para ${x} por 1×2`,
  d02: (x) => `perder para ${x} por 0×2`,
  'v20,v21,d12': (x) => `ganhar pelo menos um set de ${x}`,
  'v21,d12': (x) => `ir ao 3º set contra ${x}`,
  'v20,d02': (x) => `não ir ao 3º set contra ${x}`,
  'v21,d12,d02': (x) => `não vencer ${x} por 2×0`,
};

// Jogos com a mesma exigência viram uma frase só: "vencer Vikings ICS, AJAC e Alfa", "não vencer
// Touros nem Raptors".
function textoCondicoes(ctx, condicoes) {
  if (!condicoes.length) return 'qualquer resultado';
  const grupos = new Map();
  for (const c of condicoes) {
    const k = FRASES[c.resultados.join(',')] ? c.resultados.join(',') : `${c.resultados.join(',')}|${c.contra}`;
    if (!grupos.has(k)) grupos.set(k, { resultados: c.resultados, ids: [] });
    grupos.get(k).ids.push(c.contra);
  }
  const frases = [...grupos.values()].map(({ resultados, ids }) => {
    const frase = FRASES[resultados.join(',')];
    const nomes = ids.map((id) => nome(ctx, id));
    if (!frase) return resultados.map((r) => FRASES[r](nomes[0])).join(' ou ');
    return frase(frase('').startsWith('não') ? nomes.join(' nem ') : juntarE(nomes));
  });
  return juntarE(frases);
}

// Até duas combinações por caso; o resto vira "ou outras N combinações".
function textoOpcoes(ctx, opcoes) {
  const mostradas = opcoes.slice(0, 2).map((o) => textoCondicoes(ctx, o));
  const resto = opcoes.length - mostradas.length;
  return `${mostradas.join('; ou ')}${resto ? `; ou outra${resto > 1 ? 's' : ''} ${resto} combinaç${resto > 1 ? 'ões' : 'ão'}` : ''}`;
}

const textoJogo = (ctx, j) => `${nome(ctx, j.a)} × ${nome(ctx, j.b)}`;

// O resultado de outro jogo que ajuda: "Touros não vencer Vinkão".
function textoTorcida(ctx, d) {
  const a = nome(ctx, d.jogo.a);
  const b = nome(ctx, d.jogo.b);
  return (
    { a: `${a} vencer ${b}`, b: `${b} vencer ${a}`, e: `${a} e ${b} empatarem`, ae: `${b} não vencer ${a}`, eb: `${a} não vencer ${b}`, ab: `não dar empate em ${a} × ${b}` }[
      d.torcer.join('')
    ] || ''
  );
}

// "depende de Touros × Vinkão (ajuda: Touros não vencer Vinkão) e do saldo"
function textoDepende(ctx, caso) {
  const jogos = caso.depende.slice(0, 3).map((d) => {
    const torcida = textoTorcida(ctx, d);
    return torcida ? `${textoJogo(ctx, d.jogo)} (ajuda: ${torcida})` : textoJogo(ctx, d.jogo);
  });
  if (caso.depende.length > 3) jogos.push('outros jogos');
  if (!jogos.length) return caso.saldo ? 'do saldo' : 'de outros resultados';
  return `de ${juntarE(jogos)}${caso.saldo ? ' e do saldo' : ''}`;
}

// Quando a repescagem está garantida mas a semifinal direta ainda pode vir: "se Touros não vencer
// Vinkão (ou pelo saldo)" ou "conforme Touros × Vinkão e o saldo".
function textoSobe(ctx, caso) {
  const torcidas = caso.depende.map((d) => textoTorcida(ctx, d));
  if (caso.depende.length && torcidas.every(Boolean) && caso.depende.length <= 2) return `se ${juntarE(torcidas)}${caso.saldo ? ' (ou pelo saldo)' : ''}`;
  if (!caso.depende.length) return caso.saldo ? 'pelo saldo' : 'conforme os outros jogos';
  return `conforme ${juntarE(caso.depende.slice(0, 3).map((d) => textoJogo(ctx, d.jogo)))}${caso.saldo ? ' e o saldo' : ''}`;
}

// Chance de cair num caso e, nele, de ir à semifinal (das simulações, pelas mesmas combinações).
function chanceDoCaso(chances, caso) {
  if (!chances?.padroes) return null;
  let n = 0;
  let semi = 0;
  for (const k of caso.chaves) {
    n += chances.padroes[k]?.n || 0;
    semi += chances.padroes[k]?.semi || 0;
  }
  return { p: n, semi: n ? semi / n : null };
}

function linhaCaso(ctx, o, caso, simulacoes) {
  const ch = chanceDoCaso(o.chances, caso);
  const prob = ch && simulacoes ? ` <small>chance ${pct(ch.p / simulacoes)}</small>` : '';
  const semiDentro = ch?.semi !== null && ch?.semi !== undefined ? ` <small>semifinal em ${pct(ch.semi)} desses casos</small>` : '';
  const se = textoOpcoes(ctx, caso.opcoes);
  const semFaltar = !o.t.faltam.length;
  if (caso.classe === 'semi') return `<li class="caso caso-semi"><strong>Semifinal garantida</strong>${semFaltar ? '' : ` se ${se}`}.${prob}</li>`;
  if (caso.classe === 'fora') return `<li class="caso caso-fora"><strong>Fora</strong>${semFaltar ? '' : ` se ${se}`}.${prob}</li>`;
  if (caso.classe === 'repescagem') {
    const titulo = caso.exato ? 'Repescagem garantida' : 'Pelo menos a repescagem';
    const extra = caso.exato ? '' : `; vai direto à semifinal ${textoSobe(ctx, caso)}`;
    return `<li class="caso caso-repescagem"><strong>${titulo}</strong>${semFaltar ? '' : ` se ${se}`}${extra}.${prob}${caso.exato ? '' : semiDentro}</li>`;
  }
  const outros = o.t.resumo.length > 1 ? 'Nos outros casos' : semFaltar ? 'Já jogou tudo' : 'Em qualquer resultado';
  return `<li class="caso caso-depende"><strong>${outros}</strong>, depende ${textoDepende(ctx, caso)}.${o.t.resumo.length > 1 ? prob : ''}${semiDentro}</li>`;
}

// Selo do veredito: "Classificada", "Provável · 81%", "Repescagem 40%", "Eliminada"...
function seloVeredito(o) {
  const c = o.chances;
  const direta = c ? (o.sit.repescagem ? c.lider : c.semi) : null;
  const textos = {
    garantida: o.categoria === 'repescagem' ? 'Repescagem garantida' : 'Classificada',
    provavel: `Provável · ${pct(direta || 0)}`,
    'na-semi': 'Na semifinal',
    'na-final': 'Na final',
    'parou-semi': 'Parou na semifinal',
    'final-jogada': 'Final jogada',
    'na-repescagem': 'Na repescagem',
    briga: o.categoria === 'repescagem' ? `Repescagem ${pct(c?.repescagem || 0)}` : `Semi ${pct(c?.semi || 0)}`,
    eliminada: 'Eliminada',
    praticamente: `Praticamente fora · ${pct(c?.semi || 0)}`,
    wo: 'W.O.',
    'perdeu-repescagem': 'Caiu na repescagem',
  };
  const classe = { semi: 'selo-v', repescagem: 'selo-andamento', briga: 'selo-e', fora: 'selo-d' }[o.categoria];
  return `<span class="selo ${classe}">${textos[o.motivo] || ''}</span>`;
}

// Quem deve enfrentar: adversário já definido ou os mais prováveis da simulação.
function textoRivais(ctx, o) {
  const partes = [];
  if (o.t.rivalFinal) partes.push(`final contra ${nome(ctx, o.t.rivalFinal)}`);
  else if (o.t.rivalSemi) partes.push(`semifinal contra ${nome(ctx, o.t.rivalSemi)}`);
  else if (o.chances && o.categoria !== 'fora') {
    if (o.categoria === 'repescagem') {
      const rep = rivaisProvaveis(ctx, o.chances.rivalRepescagem);
      if (rep) partes.push(`na repescagem, ${rep}`);
    }
    const semi = rivaisProvaveis(ctx, o.chances.rivalSemi);
    if (semi) partes.push(`na semifinal, ${semi}`);
  }
  return partes.length ? `<p class="objetivo-rivais"><strong>Deve enfrentar:</strong> ${partes.join('; ')}.</p>` : '';
}

// Jogos que faltam no grupo, com data e a chance de vitória.
function textoFaltam(ctx, o) {
  if (!o.t.faltam?.length) return '';
  const itens = o.t.faltam.map(({ jogo, contra }) => {
    const r = o.chances?.jogos?.[contra];
    const soma = (ks) => ks.reduce((s, k) => s + (r?.[k] || 0), 0);
    const total = soma(['v20', 'v21', 'v', 'e', 'd12', 'd02', 'd']);
    const detalhes = [
      jogo.data ? `${esc(dataCurta(jogo.data))}${jogo.hora ? `, ${esc(jogo.hora)}` : ''}` : '',
      total ? `vitória ${pct(soma(['v20', 'v21', 'v']) / total)}` : '',
    ].filter(Boolean);
    return `<strong>${nome(ctx, contra)}</strong>${detalhes.length ? ` (${detalhes.join(' · ')})` : ''}`;
  });
  return `<p class="objetivo-faltam">Falta${itens.length > 1 ? 'm' : ''}: ${itens.join(' · ')}</p>`;
}

function cartaoObjetivo(ctx, o, { titulo = true } = {}) {
  const { t, chances: c } = o;
  const m = MODALIDADE[o.mod];
  const pos = t.posicao ? `${t.posicao}º no grupo ${esc(t.grupo)}${t.pts !== undefined ? ` com ${pts(t.pts)}` : ''}` : `Grupo ${esc(t.grupo)}`;
  const numeros = c && !c.eliminada && o.categoria !== 'fora'
    ? `<p class="objetivo-numeros">${o.sit.repescagem ? `Liderar ${pct(c.lider)} · Repescagem ${pct(c.repescagem)} · ` : ''}Semifinal ${pct(c.semi)} · Final ${pct(c.final)} · Título ${pct(c.titulo)}</p>`
    : '';
  const naFase = ['na-semi', 'na-final', 'parou-semi', 'final-jogada', 'na-repescagem', 'perdeu-repescagem'].includes(o.motivo);
  const casos = !naFase && o.motivo !== 'wo' && o.motivo !== 'eliminada' && t.resumo?.length
    ? `<ul class="objetivo-casos">${t.resumo.map((caso) => linhaCaso(ctx, o, caso, ctx.previsao?.simulacoes)).join('')}</ul>`
    : '';
  const motivoFora = o.motivo === 'eliminada' && !naFase ? `<p class="objetivo-numeros">Não alcança mais ${o.sit.repescagem ? 'o 2º lugar do grupo' : 'os dois primeiros do grupo'}.</p>` : '';
  const repescagem = t.naRepescagem && o.motivo === 'na-repescagem'
    ? `<p class="objetivo-numeros">${t.naRepescagem.posicao}º na repescagem${t.naRepescagem.resumo?.length ? `: ${t.naRepescagem.resumo.map((caso) => `${caso.classe === 'semi' ? 'semifinal' : caso.classe === 'fora' ? 'fora' : 'depende'} se ${textoOpcoes(ctx, caso.opcoes)}`).join('; ')}` : ''}.</p>`
    : '';
  return `<article class="painel objetivo objetivo-${o.categoria}${classeNossa(ctx, t.id)}">
      <header>
        ${titulo ? `<h4><a href="#/m/${o.mod}">${esc(m.curto)}</a></h4>` : `<h4>${nome(ctx, t.id)}</h4>`}
        ${seloVeredito(o)}
      </header>
      ${naFase ? '' : `<p class="objetivo-pos">${pos}</p>`}
      ${numeros}${motivoFora}${repescagem}
      ${naFase || o.categoria === 'fora' ? '' : textoFaltam(ctx, o)}
      ${casos}
      ${textoRivais(ctx, o)}
    </article>`;
}

function objetivoDaNossa(ctx) {
  const { modelo, previsao } = ctx;
  if (!modelo.nossa || !previsao) return null;
  return previsaoObjetiva(modelo, previsao, modelo.nossa);
}

function blocoObjetivo(ctx) {
  const { modelo } = ctx;
  if (!modelo.nossa) return '';
  if (!ctx.previsao) return secao('Previsão objetiva', vazio('Calculando a previsão…'));
  const lista = objetivoDaNossa(ctx);
  if (!lista.length) return '';
  const grupos = CATEGORIAS.map(([cat, titulo]) => {
    const dela = lista.filter((o) => o.categoria === cat).sort((x, y) => (y.chances?.semi ?? 0) - (x.chances?.semi ?? 0));
    if (!dela.length) return '';
    return `<div class="objetivo-grupo"><h3>${titulo} <small>${dela.length}</small></h3><div class="objetivos">${dela.map((o) => cartaoObjetivo(ctx, o)).join('')}</div></div>`;
  }).join('');
  return secao(
    `Previsão objetiva · ${modelo.nomes[modelo.nossa]}`,
    `${grupos}
    <p class="nota">"Garantida" e "Fora" são conta exata: todas as combinações de resultado dos jogos que faltam (vitória, empate ou derrota; no vôlei, 2×0 ou 2×1). Empate em pontos e vitórias vai para o saldo, que depende do placar. "Provável" é semifinal direta em pelo menos 60% das ${ctx.previsao.simulacoes.toLocaleString('pt-BR')} simulações; "praticamente fora", menos de 3%. As chances de cada caso e os adversários também vêm das simulações (a porcentagem do adversário é a chance de o jogo acontecer).</p>`,
  );
}

// Início: uma linha por caso, com as modalidades.
function resumoObjetivo(ctx) {
  const lista = objetivoDaNossa(ctx);
  if (!lista?.length) return '';
  const linhas = CATEGORIAS.map(([cat, titulo]) => {
    const dela = lista.filter((o) => o.categoria === cat);
    if (!dela.length) return '';
    const mods = dela
      .map((o) => {
        const c = o.chances;
        const extra = o.motivo === 'garantida' ? ' ✓' : cat === 'semi' && c ? ` ${pct(o.sit.repescagem ? c.lider : c.semi)}` : cat === 'repescagem' && c ? ` ${pct(c.semi)}` : cat === 'briga' && c ? ` ${pct(c.semi)}` : '';
        return `${esc(MODALIDADE[o.mod].curto)}<small>${extra}</small>`;
      })
      .join(', ');
    return `<li class="obj-${cat}"><span class="obj-rotulo">${titulo}</span><span class="obj-mods">${mods}</span></li>`;
  }).join('');
  return `<a class="painel resumo-objetivo" href="#/analise"><ul>${linhas}</ul><span class="nota">Semifinal: % de ir direto; repescagem e briga: % de chegar à semifinal. ✓ = garantida. Toque para ver o que cada uma precisa.</span></a>`;
}

// Modalidade: a nossa situação e quem já está dentro ou fora.
function blocoSituacao(ctx, info) {
  const sit = situacoesDoModelo(ctx.modelo)[info.m.id];
  if (!sit) return '';
  const nossa = ctx.modelo.nossa ? previsaoObjetiva(ctx.modelo, ctx.previsao, ctx.modelo.nossa).find((o) => o.mod === info.m.id) : null;
  const times = Object.values(sit.times);
  const nomes = (lista) => lista.map((t) => nome(ctx, t.id)).join(', ');
  const classificadas = times.filter((t) => t.destino === 'semi' || [ETAPA.semifinalista, ETAPA.finalista].includes(t.etapa));
  const naRepescagem = sit.repescagem ? times.filter((t) => t.destino === 'repescagem' || t.etapa === ETAPA.naRepescagem) : [];
  const pelomenos = sit.repescagem ? times.filter((t) => !t.destino && t.possiveis?.length === 2 && !t.possiveis.includes('fora')) : [];
  const fora = times.filter((t) => t.destino === 'fora' || (sit.mataMata && [ETAPA.grupos, ETAPA.repescagem, ETAPA.wo].includes(t.etapa)));
  const itens = [
    classificadas.length ? `<li><span class="selo selo-v">Na semifinal</span> ${nomes(classificadas)}</li>` : '',
    naRepescagem.length ? `<li><span class="selo selo-andamento">Repescagem garantida</span> ${nomes(naRepescagem)}</li>` : '',
    pelomenos.length ? `<li><span class="selo selo-andamento">Pelo menos a repescagem</span> ${nomes(pelomenos)}</li>` : '',
    fora.length ? `<li><span class="selo selo-d">Fora</span> ${nomes(fora)}</li>` : '',
  ].join('');
  return `${nossa ? cartaoObjetivo(ctx, nossa, { titulo: false }) : ''}
    ${itens ? `<ul class="painel lista-situacao">${itens}</ul>` : '<p class="nota">Ninguém garantiu vaga nem foi eliminado ainda.</p>'}`;
}

// Cenários (só a equipe): pessimista, realista e otimista para a atlética destacada.
const CENARIOS = [
  ['pessimista', 'Pessimista', '20% piores simulações para nós'],
  ['realista', 'Realista', '20% do meio: o mais provável'],
  ['otimista', 'Otimista', '20% melhores simulações para nós'],
];

function blocoCenarios(ctx) {
  const { previsao, modelo } = ctx;
  if (!modelo.nossa || !ctx.pode.editar) return '';
  if (!previsao) return secao('Cenários', vazio('Calculando a previsão…'));
  const c = cenarios(previsao, modelo.nossa);
  if (!c || !previsao.simuladas.length) return '';
  const realista = Object.fromEntries(c.realista.porMod.map((x) => [x.mod, x.pontos]));
  const um = (x) => (Math.abs(x) >= 10 ? String(Math.round(x)) : x.toFixed(1).replace('.', ','));
  const cartao = ([chave, titulo, explicacao]) => {
    const cen = c[chave];
    const topo = cen.tabela.slice(0, 4);
    if (!topo.some((l) => l.id === modelo.nossa)) topo.push(cen.tabela.find((l) => l.id === modelo.nossa));
    let muda = '';
    if (chave !== 'realista') {
      const sinal = chave === 'otimista' ? 1 : -1;
      const diferencas = cen.porMod
        .map((x) => ({ mod: x.mod, d: x.pontos - realista[x.mod] }))
        .filter((x) => x.d * sinal >= 1)
        .sort((x, y) => (y.d - x.d) * sinal)
        .slice(0, 4)
        .map((x) => `${esc(MODALIDADE[x.mod].curto)} ${x.d > 0 ? '+' : '−'}${um(Math.abs(x.d))}`);
      if (diferencas.length) muda = `<p class="cenario-muda"><strong>Onde muda:</strong> ${diferencas.join(', ')}</p>`;
    }
    return `<article class="painel cenario cenario-${chave}">
        <header><h3>${titulo}</h3><span>${explicacao}</span></header>
        <p class="cenario-numeros"><strong>${cen.tabela.findIndex((l) => l.id === modelo.nossa) + 1}º</strong> <span>${Math.round(cen.pontos)} pts</span></p>
        <p class="cenario-titulo">Título geral: <strong>${pct(cen.titulo)}</strong></p>
        <ol class="cenario-geral">${topo.map((l) => `<li class="${classeNossa(ctx, l.id).trim()}"><span>${nome(ctx, l.id)}</span><span>${Math.round(l.pontos)}</span></li>`).join('')}</ol>
        ${muda}
      </article>`;
  };
  return secao(
    `Cenários de ${modelo.nomes[modelo.nossa]}`,
    `<div class="cenarios">${CENARIOS.map(cartao).join('')}</div>
    <p class="nota">Cada cenário é a média de um quinto das simulações, separadas pelos pontos que fazemos nelas. A posição e a lista são a geral pela média de pontos nesse grupo de simulações. "Onde muda" compara com o realista.</p>`,
  );
}

// Edição passada (só a equipe): a classificação final de 2025, separando coletivas e individuais.
function blocoEdicao2025(ctx) {
  const ids = new Set(ATLETICAS.map((a) => a.id));
  const linhas = EDICAO_2025.linhas
    .map((l, i) => {
      const nomes2026 = l.ids.filter((id) => ids.has(id)).map((id) => nome(ctx, id)).join(' e ');
      const nossa = l.ids.includes(ctx.modelo.nossa);
      return `<tr class="${nossa ? 'nos' : ''}">
        <td class="pos">${i + 1}º</td>
        <td class="nome">${esc(l.nome)}${nomes2026 && nomes2026.toLowerCase() !== esc(l.nome).toLowerCase() ? `<small>hoje: ${nomes2026}</small>` : ''}</td>
        <td class="destaque">${inteiro(l.total)}</td><td>${l.coletivas}</td><td>${l.individuais}</td>${l.perdas ? `<td class="texto-alerta">${comSinal(l.perdas)}</td>` : '<td></td>'}
      </tr>`;
    })
    .join('');
  return secao(
    'Edição 2025',
    `<div class="tabela-rolagem painel"><table class="tabela tabela-previsao">
      <thead><tr><th class="pos" scope="col">#</th><th class="nome" scope="col">Atlética</th><th scope="col">Total</th><th scope="col" title="Futsal, futebol, handebol, basquete e vôlei">Colet.</th><th scope="col" title="Provas, lutas, raquetes, xadrez e peteca">Indiv.</th><th scope="col" title="Perdas por W.O.">W.O.</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>
    <p class="nota">Classificação final de 2025 (${esc(EDICAO_2025.fonte)}). "Vetich" era Veterinária e Ursal juntas; em 2026 cada uma recebe o histórico da Vetich. A previsão usa esses números como ponto de partida, com cautela: muita gente entrou e saiu.</p>`,
  );
}

export function analise(ctx) {
  if (!ctx.pode.editar) {
    return `${cabecalho('Análise', 'Só para a equipe', { voltar: { href: '#/inicio', texto: 'Início' } })}
      <div class="painel formulario">
        <p>A análise e a previsão são só para quem entrou com uma conta da equipe.</p>
        ${ctx.usuario ? '' : '<div class="acoes"><button type="button" class="botao" data-acao="entrar">Entrar com Google</button></div>'}
      </div>`;
  }
  const lista = relatorios(ctx);
  const atletas = Object.values(ctx.analises || {}).find((d) => d?.tipo === 'atletas');
  const textos = lista.length ? secao('Relatórios', lista.map((r, i) => blocoRelatorio(r, i === 0)).join('')) : '';
  return `${cabecalho('Análise', 'Só a equipe vê esta página', { voltar: { href: '#/inicio', texto: 'Início' } })}
    ${blocoObjetivo(ctx)}
    ${blocoCenarios(ctx)}
    ${blocoNossasChances(ctx)}
    ${textos}
    ${atletas ? blocoAtletas(ctx, atletas) : ''}
    ${blocoEdicao2025(ctx)}`;
}

// ---------- Ajustes ----------

function blocoConta(ctx) {
  if (!ctx.usuario) {
    return secao(
      'Conta',
      `<div class="painel formulario">
        <p>Para acompanhar o placar não precisa entrar. Para lançar resultados, entre com a conta Google que a equipe cadastrou.</p>
        <div class="acoes"><button type="button" class="botao" data-acao="entrar">Entrar com Google</button></div>
        <p class="nota">No celular, abra o link no Chrome ou no Safari: o navegador de dentro do WhatsApp e do Instagram não deixa entrar com Google.</p>
      </div>`,
      { id: 'conta' },
    );
  }
  const papel = ctx.dono ? 'Administrador · dono do placar' : PAPEIS[ctx.pode.papel];
  const pedido =
    ctx.pode.papel === 'sem-acesso'
      ? '<p class="alerta">Esta conta ainda não está na equipe. Peça a um administrador para adicionar este e-mail em Ajustes → Equipe e depois recarregue a página.</p>'
      : '';
  return secao(
    'Conta',
    `<div class="painel formulario">
      <p class="nome">${esc(ctx.usuario.email)}<small>${esc(papel)}</small></p>
      ${pedido}
      <div class="acoes"><button type="button" class="botao secundario" data-acao="sair">Sair</button></div>
    </div>`,
    { id: 'conta' },
  );
}

function blocoDestaque(ctx) {
  const padrao = ctx.modelo.nossaPadrao ? `Padrão: ${ctx.modelo.nomes[ctx.modelo.nossaPadrao]}` : 'Nenhuma';
  const nossa = ctx.modelo.nossa;
  const escudo = nossa && LOGO[nossa]
    ? `<div class="destaque-escudo"><img class="escudo escudo-mini" src="${esc(LOGO[nossa])}" alt="" width="56" height="46"><span>${nome(ctx, nossa)}</span></div>`
    : '';
  return secao(
    'Atlética destacada',
    `${escudo}<label class="campo"><span>Neste aparelho</span>
      <select id="ajuste-nossa-local" data-mudar="nossa-local">${opcoesAtleticasHTML(ctx, ctx.ui.nossaLocal || '', padrao)}</select>
    </label>
    <p class="nota">Vale só para este celular ou computador: é a atlética em destaque e a do filtro “só nossos jogos”. Quem torce para outra atlética pode escolher a sua.</p>`,
  );
}

function blocoEquipe(ctx) {
  const equipe = ctx.equipe || {};
  const admins = (equipe.admins || []).map(normalizarEmail);
  const editores = (equipe.editores || []).map(normalizarEmail);
  const eu = normalizarEmail(ctx.usuario?.email);
  const linha = (email, papel) => `<li class="item-equipe">
      <span class="nome">${esc(email)}<small>${papel}${email === eu ? ' · você' : ''}</small></span>
      <button type="button" class="link link-perigo" data-acao="remover-membro" data-email="${esc(email)}">Remover</button>
    </li>`;
  const dono = ctx.dono && !admins.includes(eu) ? `<li class="item-equipe"><span class="nome">${esc(eu)}<small>Dono do placar · sempre administrador · você</small></span></li>` : '';
  return secao(
    'Equipe',
    `<div class="painel formulario">
      <p class="nota">Quem pode lançar e editar. Administradores também cuidam desta lista. Cada pessoa entra com a conta Google do e-mail cadastrado.</p>
      <ul class="lista-equipe">${dono}${admins.map((e) => linha(e, 'Administrador')).join('')}${editores.map((e) => linha(e, 'Editor')).join('')}</ul>
      <form class="adicionar-membro" data-form="equipe">
        <label class="campo"><span>E-mail da conta Google</span><input type="email" name="email" id="equipe-email" placeholder="nome@gmail.com" autocomplete="off" required></label>
        <label class="campo"><span>Papel</span><select name="papel" id="equipe-papel"><option value="editores">Editor</option><option value="admins">Administrador</option></select></label>
        <button type="submit" class="botao">Adicionar</button>
      </form>
    </div>`,
  );
}

function blocoNomes(ctx) {
  const campos = ATLETICAS.map(
    (a) => `<label class="campo campo-nome">
        <span>${esc(a.nome)}</span>
        <input name="${a.id}" value="${esc(ctx.modelo.config.nomes?.[a.id] || '')}" placeholder="${esc(a.curto)}" maxlength="24" autocomplete="off">
      </label>`,
  ).join('');
  return secao(
    'Nomes das atléticas',
    `<form class="painel formulario" data-form="nomes">
      <p class="nota">Use o nome que vocês usam no dia a dia. Em branco fica o nome sugerido.</p>
      <div class="grade-nomes">${campos}</div>
      <div class="acoes"><button type="submit" class="botao">Salvar nomes</button></div>
    </form>`,
  );
}

export function ajustes(ctx) {
  const { modelo, pode } = ctx;
  const compartilhado = ctx.modo === 'compartilhado';
  const punicoes = modelo.punicoes
    .map((p) => itemPunicao(ctx, p, [TIPOS_PUNICAO[p.tipo]?.nome, p.mod ? MODALIDADE[p.mod]?.curto : 'geral', p.motivo].filter(Boolean).join(' · ')))
    .join('');
  const secoesDeEdicao = pode.editar
    ? `${secao(
        'Atlética da equipe',
        `<label class="campo"><span>Destacada para quem abre o link pela primeira vez</span>
          <select id="ajuste-nossa" data-mudar="nossa">${opcoesAtleticasHTML(ctx, modelo.nossaPadrao || '', 'Nenhuma')}</select>
        </label>`,
      )}
      ${blocoNomes(ctx)}
      ${secao(
        'Regras',
        `<div class="painel formulario">
          <label class="chave"><input type="checkbox" id="ajuste-wo-tecnico" data-mudar="wo-tecnico"${modelo.config.woTecnicoPerde12 ? ' checked' : ''}> W.O. técnico também tira 12 pontos</label>
          <p class="nota">O RG Art. 27 §2º diz que o W.O. técnico não soma pontos na modalidade, “salvo a perda de 12 pontos”. O app lê “salvo” como “exceto”: sem a perda. Marque se a CO decidir diferente.</p>
        </div>`,
      )}`
    : '';
  const botoesDados = [
    pode.editar ? '<button type="button" class="botao secundario" data-acao="exportar">Baixar backup</button>' : '',
    pode.administrar
      ? `<label class="botao secundario" for="arquivo-backup">Restaurar backup</label>
         <input type="file" id="arquivo-backup" accept="application/json,.json" data-mudar="importar" hidden>
         <button type="button" class="botao perigo" data-acao="apagar-tudo">Apagar resultados</button>`
      : '',
  ].join('');
  return `${cabecalho('Ajustes')}
    ${compartilhado ? blocoConta(ctx) : ''}
    ${blocoDestaque(ctx)}
    ${compartilhado && pode.administrar ? blocoEquipe(ctx) : ''}
    ${secoesDeEdicao}
    ${secao('Punições', punicoes ? `<ul class="painel lista-punicoes">${punicoes}</ul>` : vazio('Nenhuma punição lançada à mão. W.O. marcado em jogo entra sozinho.'), {
      acao: seEditar(ctx, '<button type="button" class="link" data-acao="nova-punicao">Registrar</button>'),
    })}
    ${secao(
      'Dados',
      `<div class="painel formulario">
        <p><span class="status-linha" data-tipo="${compartilhado ? 'ok' : 'local'}"></span>${
          compartilhado
            ? 'Banco compartilhado: todo mundo com o link vê os mesmos dados, ao vivo. Só a equipe edita.'
            : 'Modo local: os dados ficam só neste aparelho. Para compartilhar com a diretoria, configure o Firebase (passo a passo no README).'
        }</p>
        ${botoesDados ? `<div class="acoes">${botoesDados}</div><p class="nota">Faça um backup no fim de cada dia de jogos.</p>` : ''}
      </div>`,
    )}`;
}

function naoEncontrada(texto, href, voltar) {
  return `${cabecalho(texto, '', { voltar: { href, texto: voltar } })}`;
}

export function carregando() {
  return '<p class="carregando">Carregando o placar…</p>';
}

export function erroConexao(erro) {
  return `${cabecalho('Não deu para abrir o placar')}
    <div class="painel formulario">
      <p>O app não conseguiu falar com o banco de dados. Confira a internet e tente de novo.</p>
      <p class="nota">${esc(erro?.message || '')}</p>
      <div class="acoes"><button type="button" class="botao" data-acao="recarregar">Tentar de novo</button></div>
    </div>`;
}
