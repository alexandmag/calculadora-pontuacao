// Cada função devolve o HTML de uma tela a partir do modelo calculado.
// Nada aqui grava dados: os botões levam data-acao e quem age é o acoes.js.
// Botões de edição só aparecem para quem pode editar (ctx.pode); quem só acompanha vê o placar.

import { ATLETICAS, FASES, MODALIDADE, MODALIDADES } from './dados.js';
import { ESPORTES, NOME_ETAPA, ORDEM_FASES, placarEfetivo, pontosPorColocacao, vencedor } from './regras.js';
import { TIPOS_PUNICAO } from './modelo.js';
import { PAPEIS, normalizarEmail } from './permissoes.js';
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

function cabecalho(titulo, sub = '', { voltar = null, acao = '' } = {}) {
  return `<header class="tela-topo">
      ${voltar ? `<a class="voltar" href="${voltar.href}">‹ ${esc(voltar.texto)}</a>` : ''}
      <div class="tela-topo-linha">
        <div><h1>${esc(titulo)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
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

export function inicio(ctx) {
  const { modelo } = ctx;
  const lista = modelo.geral.projecao;
  let topo = '';
  if (!modelo.nossa) {
    topo = escolherNossa(ctx);
  } else {
    const eu = lista.find((l) => l.id === modelo.nossa);
    const euOficial = modelo.geral.oficial.find((l) => l.id === modelo.nossa);
    topo = `<section class="placar-nos" aria-label="Nossa posição">
        <p class="rotulo">${nome(ctx, modelo.nossa)} · projeção <a class="placar-trocar" href="#/ajustes">Trocar atlética</a></p>
        <div class="placar-nos-numeros">
          <span class="placar-pos">${posicaoGeral(eu, lista)}</span>
          <span class="placar-pts">${inteiro(eu.total)}<small>pts</small></span>
        </div>
        <p class="placar-frase">${frasePosicao(ctx, lista, eu)}</p>
        <dl class="placar-extra">
          <div><dt>Contando só oficiais</dt><dd>${posicaoGeral(euOficial, modelo.geral.oficial)} · ${pts(euOficial.total)}</dd></div>
          <div><dt>Modalidades oficiais</dt><dd>${modelo.oficiais} de ${TOTAL_MODALIDADES}</dd></div>
        </dl>
      </section>`;
  }

  const nossos = modelo.nossa ? modelo.jogos.filter((j) => j.a === modelo.nossa || j.b === modelo.nossa) : [];
  const proximos = nossos.filter((j) => !temResultado(j)).sort(compararJogos).slice(0, 5);
  const ultimos = nossos.filter(temResultado).sort(compararJogos).reverse().slice(0, 5);
  const semJogos = ctx.pode.editar
    ? 'Nenhum jogo nosso marcado. Monte os grupos em Modalidades: o app cria os jogos de cada grupo.'
    : 'Nenhum jogo marcado ainda.';

  return `${topo}
    ${secao('Classificação geral', miniGeral(ctx, lista), { acao: '<a class="link" href="#/geral">Ver completa</a>' })}
    ${modelo.nossa ? secao('Próximos jogos', proximos.length ? listaJogos(ctx, proximos, { data: true }) : vazio(semJogos), { acao: '<a class="link" href="#/jogos">Todos os jogos</a>' }) : ''}
    ${
      modelo.nossa && ultimos.length
        ? secao('Últimos resultados', listaJogos(ctx, ultimos, { data: true }), {
            acao: seEditar(ctx, `<button type="button" class="link" data-acao="resumo-dia" data-data="${esc(ultimos[0].data || '')}">Resumo em PDF</button>`),
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
        const resumo = dia ? seEditar(ctx, `<button type="button" class="link" data-acao="resumo-dia" data-data="${dia}">Resumo em PDF</button>`) : '';
        const remarcar =
          aba === 'abertos' && dia ? seEditar(ctx, `<button type="button" class="link" data-acao="remarcar-dia" data-data="${dia}">Remarcar dia</button>`) : '';
        return secao(dataLonga(dia), listaJogos(ctx, lista), { acao: resumo || remarcar ? `<span class="links-secao">${resumo}${remarcar}</span>` : '' });
      })
      .join('');
  }

  const sub = ctx.pode.editar ? 'Datas mudam? Edite o jogo ou remarque o dia inteiro.' : 'Horários e locais do tabelamento da CO.';
  // Resumo em PDF e novo jogo: só para quem entrou com uma conta da equipe.
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
  return `<li><a class="mod" href="#/m/${info.m.id}">
      <span class="mod-texto"><span class="mod-nome">${esc(info.m.nome)}</span><span class="mod-sub">${resumoModalidade(info)}</span></span>
      <span class="mod-lado">${seloEstado(info)}${nossa ? `<span class="mod-nossa">Nós: ${nossa.posicao}º</span>` : ''}</span>
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
  const proxima = m.repescagem && !quantos('repescagem') ? 'repescagem' : quantos('semifinal') < 2 ? 'semifinal' : 'final';
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
  const porFase = ORDEM_FASES.filter((f) => f !== 'grupo')
    .map((f) => [f, jogos.filter((j) => j.fase === f).sort(compararJogos)])
    .filter(([, lista]) => lista.length)
    .map(([f, lista]) => `<div class="grupo"><h3>${esc(NOME_FASE[f])}</h3>${listaJogos(ctx, lista, { modalidade: false, data: true })}</div>`)
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
  else if (m.tipo === 'coletiva')
    explicacao =
      'Projeção com os jogos lançados. 3º lugar é de quem perdeu a semifinal para a campeã e 4º de quem perdeu para a vice. Depois vem quem perdeu a repescagem e, por fim, quem não passou dos grupos, pela posição no grupo e pela campanha. Quando a CO divulgar a oficial, confirme ou ajuste.';
  else if (m.tipo === 'provas') explicacao = 'Projeção pela soma dos pontos. Quando a CO divulgar a oficial, confirme ou ajuste.';
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

  const selo = oficial ? '<span class="selo selo-oficial">Oficial</span>' : lista.length ? '<span class="selo selo-projecao">Projeção</span>' : '';
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
      ${linhas ? `<ol class="painel lista-classif">${linhas}</ol>` : vazio('Nada lançado ainda.')}
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

export function modalidade(ctx, id) {
  const info = ctx.modelo.modalidades[id];
  if (!info) return naoEncontrada('Modalidade não encontrada.', '#/modalidades', 'Modalidades');
  const { m } = info;
  const topo = cabecalho(m.nome, `${esc(m.formato)} ${seloEstado(info)}`, { voltar: { href: '#/modalidades', texto: 'Modalidades' } });
  if (m.tipo === 'coletiva') {
    const avisoPeteca = info.esporte.semRegraPropria
      ? '<p class="alerta">O regulamento não define pontos de grupo nem desempate da peteca. O app usa os do vôlei até a CO definir.</p>'
      : '';
    return `${topo}${avisoPeteca}${blocoGrupos(ctx, info)}${blocoFinais(ctx, info)}${blocoClassificacao(ctx, info)}${blocoPunicoes(ctx, info)}`;
  }
  if (m.tipo === 'provas') {
    return `${topo}${blocoProvas(ctx, info)}${blocoPontosProvas(ctx, info)}${blocoClassificacao(ctx, info)}${blocoPunicoes(ctx, info)}`;
  }
  return `${topo}${blocoClassificacao(ctx, info)}${blocoPunicoes(ctx, info)}`;
}

// ---------- Geral ----------

export function geral(ctx) {
  const modo = ctx.ui.modoGeral === 'oficial' ? 'oficial' : 'projecao';
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
    modo === 'projecao'
      ? 'Soma a classificação oficial de cada modalidade e, onde ela ainda não saiu, a projeção com os resultados lançados até agora.'
      : 'Só as modalidades com classificação oficial confirmada, mais as perdas por W.O. e punições.';
  return `${cabecalho('Classificação geral', `${ctx.modelo.oficiais} de ${TOTAL_MODALIDADES} modalidades com classificação oficial`)}
    <div class="filtros">
      <div class="segmentado" role="group" aria-label="O que somar">
        <button type="button" data-acao="modo-geral" data-modo="projecao" aria-pressed="${modo === 'projecao'}">Projeção</button>
        <button type="button" data-acao="modo-geral" data-modo="oficial" aria-pressed="${modo === 'oficial'}">Só oficiais</button>
      </div>
    </div>
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
  const proj = ctx.modelo.geral.projecao.find((l) => l.id === id);
  const ofic = ctx.modelo.geral.oficial.find((l) => l.id === id);
  const porMod = MODALIDADES.map((m) => {
    const d = proj.detalhe.find((x) => x.mod === m.id);
    if (!d) return '';
    const oficial = Boolean(ctx.modelo.modalidades[m.id].oficial);
    return `<li><a class="mod" href="#/m/${m.id}">
        <span class="mod-texto"><span class="mod-nome">${esc(m.nome)}</span><span class="mod-sub">${d.posicao}º lugar${d.zerado ? ' · sem pontos (W.O. ou fraude)' : ''}</span></span>
        <span class="mod-lado">${oficial ? '<span class="selo selo-oficial">Oficial</span>' : '<span class="selo selo-projecao">Projeção</span>'}<span class="valor">${d.pontos}<small> pts</small></span></span>
      </a></li>`;
  }).join('');
  const perdas = proj.ajustes
    .map((p) => `<li class="item-punicao"><span class="nome">${esc(p.motivo)}</span><span class="valor">${comSinal(p.pontos)}</span></li>`)
    .join('');
  return `${cabecalho(ctx.modelo.nomes[id], esc(a.nome), { voltar: { href: '#/geral', texto: 'Classificação geral' } })}
    <dl class="numeros">
      <div><dt>Projeção</dt><dd>${posicaoGeral(proj, ctx.modelo.geral.projecao)} <small>${pts(proj.total)}</small></dd></div>
      <div><dt>Só oficiais</dt><dd>${posicaoGeral(ofic, ctx.modelo.geral.oficial)} <small>${pts(ofic.total)}</small></dd></div>
    </dl>
    ${secao('Por modalidade', porMod ? `<ul class="painel lista-mod">${porMod}</ul>` : vazio('Nenhuma colocação ainda.'))}
    ${perdas ? secao('Perdas', `<ul class="painel lista-punicoes">${perdas}</ul>`) : ''}`;
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
  return secao(
    'Atlética destacada',
    `<label class="campo"><span>Neste aparelho</span>
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
