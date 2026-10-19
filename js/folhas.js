// Folhas de edição: os formulários que sobem de baixo da tela para lançar e corrigir dados.

import { ATLETICAS, DIAS_DE_JOGOS, FASES, LETRAS_GRUPO, MODALIDADE, MODALIDADES } from './dados.js';
import { ESPORTES, pontosPorColocacao } from './regras.js';
import { TIPOS_PUNICAO, chaveResultado, gruposDaModalidade } from './modelo.js';
import { app, abrirFolha, aviso, gravar, salvarPreferencias } from './contexto.js';
import {
  baixarArquivo,
  carregarImagem,
  carregarJsPDF,
  compartilharArquivo,
  dadosDoResumo,
  diaPadrao,
  diasComJogos,
  escudoParaPdf,
  gerarPdf,
  nomeDoArquivo,
  podeCompartilharArquivo,
} from './resumo.js';
import { gerarImagem } from './resumo-imagem.js';
import { previsaoDoModelo } from './previsao.js';
import { estadoVazio } from './armazenamento.js';
import { temResultado } from './telas.js';
import { dataCurta, dataLonga, esc, novoId, numero } from './util.js';

const nome = (id) => esc(app.modelo.nomes[id] ?? '—');
const LIMITE_OBS = 500;

function opcoesAtleticas(selecionada = '', vaziaTexto = '—') {
  return `<option value="">${esc(vaziaTexto)}</option>${ATLETICAS.map(
    (a) => `<option value="${a.id}"${a.id === selecionada ? ' selected' : ''}>${nome(a.id)}</option>`,
  ).join('')}`;
}

// Atalhos para os sábados e domingos do campeonato; o campo de data aceita qualquer outra.
function seletorData(campo, valor) {
  const chips = DIAS_DE_JOGOS.map(
    (d) => `<button type="button" class="chip${d === valor ? ' ativo' : ''}" data-dia="${d}">${esc(dataCurta(d))}</button>`,
  ).join('');
  return `<div class="seletor-data" data-seletor-data>
      <div class="chips">${chips}<button type="button" class="chip${valor ? '' : ' ativo'}" data-dia="">Sem data</button></div>
      <label class="campo"><span>Outra data</span><input type="date" name="${campo}" value="${esc(valor || '')}"></label>
    </div>`;
}

// ---------- Jogo ----------

function campoPlacar(nomeCampo, valor, rotulo) {
  return `<label class="placar-campo"><span data-rotulo="${rotulo}">Time ${rotulo.toUpperCase()}</span>
      <input type="number" name="${nomeCampo}" min="0" step="1" inputmode="numeric" value="${valor ?? ''}" aria-label="Placar do time ${rotulo.toUpperCase()}">
    </label>`;
}

function camposResultado(j, modId) {
  const m = MODALIDADE[modId];
  if (!m) return '<legend>Resultado</legend><p class="nota">Escolha a modalidade para lançar o resultado.</p>';
  const esporte = ESPORTES[m.esporte];
  const r = j.mod === modId && j.res ? j.res : {};
  const semWO = !r.wo;
  const placar = `<div class="placar-entrada">
      ${campoPlacar('ra', semWO ? r.a : '', 'a')}<span class="placar-x" aria-hidden="true">×</span>${campoPlacar('rb', semWO ? r.b : '', 'b')}
    </div>`;
  const wo = `<div class="campos-lado">
      <label class="campo"><span>W.O.</span>
        <select name="wo">
          <option value="">Não houve</option>
          <option value="a" data-rotulo-wo="a"${r.wo === 'a' ? ' selected' : ''}>Faltou o time A</option>
          <option value="b" data-rotulo-wo="b"${r.wo === 'b' ? ' selected' : ''}>Faltou o time B</option>
        </select>
      </label>
      <label class="campo"><span>Tipo</span>
        <select name="woTipo">
          <option value="normal">W.O. (perde 12 pontos)</option>
          <option value="tecnico"${r.woTipo === 'tecnico' ? ' selected' : ''}>W.O. técnico (jogo encerrado)</option>
        </select>
      </label>
    </div>
    <p class="nota">Com W.O., o placar fica o do regulamento e quem faltou sai da modalidade (RG Art. 27).</p>`;

  if (esporte.sets) {
    const parciais = Array.isArray(r.parciais) ? r.parciais.map((s) => (Array.isArray(s) ? s : [s.a, s.b]).join('-')).join(', ') : '';
    return `<legend>Resultado em sets</legend>
      ${placar}
      <label class="campo"><span>Parciais (opcional: entram no saldo de pontos)</span>
        <input name="parciais" value="${esc(parciais)}" placeholder="25-20, 18-25, 15-12" autocomplete="off">
      </label>
      ${wo}`;
  }
  const penaltis = esporte.semEmpate
    ? ''
    : `<div class="penaltis" data-so-eliminatoria>
        <p class="nota">Empatou? Na repescagem, semifinal e final o jogo se decide nos ${esc(esporte.decisao)}.</p>
        <div class="placar-entrada pequeno">
          ${campoPlacar('pa', r.penaltis?.a, 'a')}<span class="placar-x" aria-hidden="true">×</span>${campoPlacar('pb', r.penaltis?.b, 'b')}
        </div>
      </div>`;
  const cartoes = esporte.cartoes.length
    ? `<details class="cartoes"${r.cartoes ? ' open' : ''}><summary>Cartões (opcional, usados no desempate)</summary>
        <div class="campos-lado">
          ${esporte.cartoes
            .map((tipo) => {
              const chave = tipo === 'vermelhos' ? 'v' : 'a';
              const titulo = tipo === 'vermelhos' ? 'Vermelhos' : 'Amarelos';
              return `<label class="campo"><span>${titulo} · <span data-rotulo="a">Time A</span></span><input type="number" min="0" inputmode="numeric" name="${chave}a" value="${r.cartoes?.[`${chave}a`] ?? ''}"></label>
                <label class="campo"><span>${titulo} · <span data-rotulo="b">Time B</span></span><input type="number" min="0" inputmode="numeric" name="${chave}b" value="${r.cartoes?.[`${chave}b`] ?? ''}"></label>`;
            })
            .join('')}
        </div>
      </details>`
    : '';
  return `<legend>Resultado</legend>${placar}${penaltis}${cartoes}${wo}`;
}

function ligarFormJogo(form, j) {
  const caixa = form.querySelector('[data-resultado]');
  const atualizar = () => {
    const fase = form.elements.fase.value;
    form.querySelector('[data-so-grupo]').hidden = fase !== 'grupo';
    for (const el of form.querySelectorAll('[data-so-eliminatoria]')) el.hidden = fase === 'grupo';
    for (const lado of ['a', 'b']) {
      const id = form.elements[lado].value;
      const rotulo = id ? app.modelo.nomes[id] : `Time ${lado.toUpperCase()}`;
      for (const el of form.querySelectorAll(`[data-rotulo="${lado}"]`)) el.textContent = rotulo;
      for (const el of form.querySelectorAll(`[data-rotulo-wo="${lado}"]`)) el.textContent = `Faltou ${rotulo}`;
    }
  };
  form.elements.mod.addEventListener?.('change', () => {
    caixa.innerHTML = camposResultado(j, form.elements.mod.value);
    atualizar();
  });
  for (const campo of ['fase', 'a', 'b']) form.elements[campo].addEventListener('change', atualizar);
  atualizar();
}

function lerParciais(texto) {
  const pares = [...texto.matchAll(/(\d+)\s*[-x×:]\s*(\d+)/gi)];
  const sobra = texto.replace(/(\d+)\s*[-x×:]\s*(\d+)/gi, '').replace(/[\s,;/]+/g, '');
  if (!pares.length || sobra) return null;
  return pares.map((p) => ({ a: Number(p[1]), b: Number(p[2]) }));
}

function lerResultado(dados, esporte, fase) {
  const wo = dados.get('wo');
  if (wo === 'a' || wo === 'b') return { wo, woTipo: dados.get('woTipo') === 'tecnico' ? 'tecnico' : 'normal' };
  const ra = numero(dados.get('ra'));
  const rb = numero(dados.get('rb'));
  if (Number.isNaN(ra) || Number.isNaN(rb)) return 'Use só números inteiros no placar.';

  if (esporte.sets) {
    const texto = String(dados.get('parciais') || '').trim();
    const parciais = texto ? lerParciais(texto) : null;
    if (texto && !parciais) return 'Não entendi as parciais. Escreva assim: 25-20, 18-25, 15-12.';
    let sa = ra;
    let sb = rb;
    if (parciais && sa === null && sb === null) {
      sa = parciais.filter((s) => s.a > s.b).length;
      sb = parciais.length - sa;
    }
    if (sa === null && sb === null) return null;
    if (sa === null || sb === null) return 'Preencha os sets dos dois times.';
    if (sa === sb) return 'Em sets não há empate: confira o placar.';
    if (parciais) {
      const ganhosA = parciais.filter((s) => s.a > s.b).length;
      if (ganhosA !== sa || parciais.length - ganhosA !== sb) return 'Os sets não batem com as parciais.';
    }
    return parciais ? { a: sa, b: sb, parciais } : { a: sa, b: sb };
  }

  if (ra === null && rb === null) return null;
  if (ra === null || rb === null) return 'Preencha o placar dos dois times.';
  const res = { a: ra, b: rb };
  if (ra === rb) {
    if (esporte.semEmpate) return 'No basquete não há empate: lance o placar depois da prorrogação (A1 Art. 21).';
    if (fase !== 'grupo') {
      const pa = numero(dados.get('pa'));
      const pb = numero(dados.get('pb'));
      if (pa === null || pb === null || Number.isNaN(pa) || Number.isNaN(pb) || pa === pb) {
        return `Fora da fase de grupos não há empate: lance o resultado dos ${esporte.decisao}.`;
      }
      res.penaltis = { a: pa, b: pb };
    }
  }
  if (esporte.cartoes.length) {
    const cartoes = {};
    for (const chave of ['va', 'vb', 'aa', 'ab']) {
      const n = numero(dados.get(chave));
      if (Number.isNaN(n)) return 'Use só números inteiros nos cartões.';
      if (n) cartoes[chave] = n;
    }
    if (Object.keys(cartoes).length) res.cartoes = cartoes;
  }
  return res;
}

export function folhaJogo({ id = null, mod = '', fase = 'grupo', grupo = '' } = {}) {
  const existente = id ? app.estado.jogos[id] : null;
  if (id && !existente) return;
  const j = existente
    ? { ...existente, id }
    : { mod, fase, grupo, a: app.modelo.nossa || '', b: '', data: '', hora: '', local: '', res: null };
  const coletivas = MODALIDADES.filter((m) => m.tipo === 'coletiva');
  const campoMod = existente || mod
    ? `<input type="hidden" name="mod" value="${esc(j.mod)}">`
    : `<label class="campo"><span>Modalidade</span><select name="mod">
        <option value="">Escolha…</option>
        ${coletivas.map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}
      </select></label>`;
  const confronto = `<div class="campos-lado">
      <label class="campo"><span>Fase</span><select name="fase">${FASES.map(
        (f) => `<option value="${f.id}"${f.id === j.fase ? ' selected' : ''}>${f.nome}</option>`,
      ).join('')}</select></label>
      <label class="campo" data-so-grupo><span>Grupo</span><select name="grupo">
        <option value="">—</option>${LETRAS_GRUPO.map((l) => `<option value="${l}"${l === j.grupo ? ' selected' : ''}>Grupo ${l}</option>`).join('')}
      </select></label>
    </div>
    <div class="campos-lado">
      <label class="campo"><span>Time A</span><select name="a">${opcoesAtleticas(j.a, 'Escolha…')}</select></label>
      <label class="campo"><span>Time B</span><select name="b">${opcoesAtleticas(j.b, 'Escolha…')}</select></label>
    </div>`;
  const quando = `<fieldset class="grupo-campos">
      <legend>Quando</legend>
      ${seletorData('data', j.data)}
      <div class="campos-lado">
        <label class="campo"><span>Hora</span><input type="time" name="hora" value="${esc(j.hora || '')}"></label>
        <label class="campo"><span>Local</span><input name="local" value="${esc(j.local || '')}" placeholder="Quadra 1, campo…" maxlength="40" autocomplete="off"></label>
      </div>
    </fieldset>`;
  const resultado = `<fieldset class="grupo-campos" data-resultado>${camposResultado(j, j.mod)}</fieldset>`;
  const observacao = `<label class="campo"><span>Observações (aparecem no jogo e no resumo do dia)</span>
      <textarea name="obs" id="jogo-obs" rows="3" maxlength="${LIMITE_OBS}" placeholder="Ex.: destaque da partida, quem fez os gols, recado para a próxima rodada">${esc(j.obs || '')}</textarea>
    </label>`;
  // Jogo já marcado: o mais comum é lançar o placar, então o resultado e a observação vêm primeiro.
  const corpo = existente
    ? `${campoMod}${resultado}${observacao}${confronto}${quando}`
    : `${campoMod}${confronto}${quando}${resultado}${observacao}`;
  const rodape = `${existente ? '<button type="submit" class="botao perigo" value="excluir" data-confirmar="Toque de novo para excluir">Excluir jogo</button>' : ''}
    <span class="espaco"></span>
    ${existente?.res ? '<button type="submit" class="botao secundario" value="limpar">Tirar resultado</button>' : ''}
    <button type="submit" class="botao" value="salvar">Salvar</button>`;

  abrirFolha({
    titulo: existente ? 'Jogo' : 'Novo jogo',
    contexto: j.mod ? MODALIDADE[j.mod]?.nome : '',
    corpo,
    rodape,
    aoAbrir: (form) => ligarFormJogo(form, j),
    aoEnviar: (dados, form, acao) => {
      if (acao === 'excluir') {
        gravar(app.loja.apagar('jogos', id), 'Jogo excluído');
        return;
      }
      const modId = dados.get('mod');
      const m = MODALIDADE[modId];
      if (!m) return 'Escolha a modalidade.';
      const faseEscolhida = dados.get('fase');
      const grupoEscolhido = faseEscolhida === 'grupo' ? dados.get('grupo') : null;
      const a = dados.get('a');
      const b = dados.get('b');
      if (!a || !b) return 'Escolha as duas atléticas.';
      if (a === b) return 'Escolha atléticas diferentes.';
      if (faseEscolhida === 'grupo' && !grupoEscolhido) return 'Escolha o grupo.';
      let res = null;
      if (acao !== 'limpar') {
        res = lerResultado(dados, ESPORTES[m.esporte], faseEscolhida);
        if (typeof res === 'string') return res;
      }
      const doc = {
        mod: modId,
        fase: faseEscolhida,
        grupo: grupoEscolhido,
        a,
        b,
        data: dados.get('data') || '',
        hora: dados.get('hora') || '',
        local: String(dados.get('local') || '').trim(),
        res,
        obs: String(dados.get('obs') || '').trim().slice(0, LIMITE_OBS),
        atualizadoEm: Date.now(),
      };
      gravar(app.loja.salvar('jogos', id || novoId(), doc), res ? 'Resultado salvo' : 'Jogo salvo');
    },
  });
}

// ---------- Grupos ----------

const chavePar = (x, y) => [x, y].sort().join('|');

export function folhaGrupos(modId) {
  const info = app.modelo.modalidades[modId];
  const { m, doc } = info;
  const linhas = ATLETICAS.map((a) => {
    const atual = doc.grupoDe?.[a.id] || '';
    const opcoes = ['', ...LETRAS_GRUPO]
      .map(
        (l) => `<label class="opcao-grupo"><input type="radio" name="g_${a.id}" value="${l}"${l === atual ? ' checked' : ''}><span>${l || '—'}</span></label>`,
      )
      .join('');
    return `<div class="linha-grupo"><span class="nome">${nome(a.id)}</span><div class="opcoes-grupo" role="radiogroup" aria-label="Grupo de ${nome(a.id)}">${opcoes}</div></div>`;
  }).join('');
  const corpo = `<p class="nota">Formato: ${esc(m.formato)}. Marque o grupo de cada atlética; “—” é quem não disputa.</p>
    <div class="lista-grupos">${linhas}</div>
    <p class="nota">Ao salvar, o app cria os jogos que faltam dentro de cada grupo. Jogos ainda sem resultado entre atléticas que deixaram de estar no mesmo grupo são apagados.</p>`;

  abrirFolha({
    titulo: 'Grupos',
    contexto: m.nome,
    corpo,
    rodape: '<span class="espaco"></span><button type="submit" class="botao" value="salvar">Salvar grupos</button>',
    aoEnviar: (dados) => {
      const grupoDe = {};
      for (const a of ATLETICAS) {
        const letra = dados.get(`g_${a.id}`);
        if (letra) grupoDe[a.id] = letra;
      }
      const grupos = gruposDaModalidade({ grupoDe });
      if (Object.values(grupos).some((membros) => membros.length === 1)) return 'Cada grupo precisa de pelo menos duas atléticas.';

      const nossa = app.modelo.nossa;
      const desejados = new Map();
      for (const [letra, membros] of Object.entries(grupos)) {
        for (let i = 0; i < membros.length; i++) {
          for (let k = i + 1; k < membros.length; k++) {
            let [a, b] = [membros[i], membros[k]];
            if (b === nossa) [a, b] = [b, a];
            desejados.set(chavePar(a, b), { a, b, grupo: letra });
          }
        }
      }
      const operacoes = [app.loja.salvar('modalidades', modId, { ...doc, grupoDe })];
      const existentes = new Map();
      for (const j of info.jogos.filter((x) => x.fase === 'grupo')) existentes.set(chavePar(j.a, j.b), j);
      let criados = 0;
      for (const [par, alvo] of desejados) {
        const atual = existentes.get(par);
        if (!atual) {
          criados++;
          const [x, y] = par.split('|');
          operacoes.push(
            app.loja.salvar('jogos', `${modId}__${x}__${y}`, {
              mod: modId,
              fase: 'grupo',
              grupo: alvo.grupo,
              a: alvo.a,
              b: alvo.b,
              data: '',
              hora: '',
              local: '',
              res: null,
              atualizadoEm: Date.now(),
            }),
          );
        } else if (atual.grupo !== alvo.grupo) {
          const { id: idAtual, ...resto } = atual;
          operacoes.push(app.loja.salvar('jogos', idAtual, { ...resto, grupo: alvo.grupo }));
        }
      }
      for (const [par, j] of existentes) {
        if (!desejados.has(par) && !temResultado(j)) operacoes.push(app.loja.apagar('jogos', j.id));
      }
      gravar(Promise.all(operacoes), criados ? `Grupos salvos · ${criados} jogos criados` : 'Grupos salvos');
    },
  });
}

// ---------- Classificação oficial ----------

export function folhaClassificacao(modId) {
  const info = app.modelo.modalidades[modId];
  const { m, doc } = info;
  // Sem classificação ainda, sugere a ordem de até onde cada uma chegou (fica fácil ajustar).
  const base = info.oficial || [info.calculada, info.andamento || []].find((lista) => lista.length)?.filter((l) => l.posicao) || [];
  const porPosicao = Object.fromEntries(base.map((l) => [l.posicao, l.id]));
  const visiveis = Math.min(ATLETICAS.length, Math.max(8, info.participantes || 0, base.length));
  const linhas = ATLETICAS.map((_, i) => {
    const pos = i + 1;
    const pontos = pontosPorColocacao(pos);
    return `<label class="linha-posicao"${pos > visiveis ? ' data-extra hidden' : ''}>
        <span class="pos">${pos}º</span>
        <select name="p${pos}" aria-label="${pos}º lugar">${opcoesAtleticas(porPosicao[pos] || '')}</select>
        <span class="valor">${pontos ? `${pontos} pts` : '—'}</span>
      </label>`;
  }).join('');
  const corpo = `<p class="nota">Lance a classificação final como a CO divulgar. Do 9º em diante não soma pontos, mas conta no desempate da geral (RG Art. 15).</p>
    <div class="lista-posicoes">${linhas}</div>
    ${visiveis < ATLETICAS.length ? '<button type="button" class="link" data-mostrar-extras>Mostrar mais posições</button>' : ''}`;

  abrirFolha({
    titulo: 'Classificação oficial',
    contexto: m.nome,
    corpo,
    rodape: '<span class="espaco"></span><button type="submit" class="botao" value="salvar">Salvar como oficial</button>',
    aoAbrir: (form) => {
      form.querySelector('[data-mostrar-extras]')?.addEventListener('click', (e) => {
        for (const el of form.querySelectorAll('[data-extra]')) el.hidden = false;
        e.currentTarget.remove();
      });
    },
    aoEnviar: (dados) => {
      const oficial = ATLETICAS.map((_, i) => dados.get(`p${i + 1}`) || null);
      while (oficial.length && !oficial[oficial.length - 1]) oficial.pop();
      if (!oficial.length) return 'Escolha ao menos a atlética campeã.';
      const repetidas = oficial.filter((id, i) => id && oficial.indexOf(id) !== i);
      if (repetidas.length) return `${[...new Set(repetidas)].map((id) => app.modelo.nomes[id]).join(', ')} aparece em mais de uma posição.`;
      gravar(app.loja.salvar('modalidades', modId, { ...doc, oficial }), 'Classificação oficial salva');
    },
  });
}

// ---------- Resultado de uma prova, chave ou categoria ----------

function linhaProva(i, linha, prova) {
  const posicoes = [1, 2, 3, 4, 5, 6, 7, 8]
    .map((p) => `<option value="${p}"${p === linha.pos ? ' selected' : ''}>${p}º</option>`)
    .join('');
  const equipe = prova.peso > 1;
  return `<div class="linha-prova">
      <select name="pos_${i}" aria-label="Colocação">${posicoes}</select>
      <select name="at_${i}" aria-label="Atlética">${opcoesAtleticas(linha.at || '')}</select>
      <input name="nome_${i}" value="${esc(linha.nome || '')}" placeholder="${equipe ? 'Equipe' : 'Atleta'} (opcional)" maxlength="40" autocomplete="off" aria-label="${equipe ? 'Equipe' : 'Atleta'}">
    </div>`;
}

export function folhaProva(modId, provaId) {
  const info = app.modelo.modalidades[modId];
  const prova = info.m.provas.find((p) => p.id === provaId);
  if (!prova) return;
  const atuais = [...(info.resultados[provaId] || [])].sort((x, y) => x.pos - y.pos);
  const linhas = [...atuais];
  for (let p = linhas.length + 1; p <= 8; p++) linhas.push({ pos: p });
  const limite =
    prova.peso > 1
      ? 'Uma equipe por atlética; os pontos valem em dobro.'
      : prova.max === 1
        ? 'Um atleta por atlética nesta categoria.'
        : 'Até 2 atletas por atlética.';
  const corpo = `<p class="nota">Lance quem ficou do 1º ao 8º (${limite}) Linhas sem atlética são ignoradas.</p>
    <div class="cabecalho-prova" aria-hidden="true"><span>Lugar</span><span>Atlética</span><span>${prova.peso > 1 ? 'Equipe' : 'Atleta'}</span></div>
    <div class="lista-prova-edicao">${linhas.map((l, i) => linhaProva(i, l, prova)).join('')}</div>
    <button type="button" class="link" data-mais-linha>Adicionar linha</button>`;

  abrirFolha({
    titulo: prova.nome,
    contexto: info.m.nome,
    corpo,
    rodape: `${atuais.length ? '<button type="submit" class="botao perigo" value="limpar" data-confirmar="Toque de novo para limpar">Limpar</button>' : ''}
      <span class="espaco"></span><button type="submit" class="botao" value="salvar">Salvar</button>`,
    aoAbrir: (form) => {
      form.querySelector('[data-mais-linha]').addEventListener('click', () => {
        const lista = form.querySelector('.lista-prova-edicao');
        lista.insertAdjacentHTML('beforeend', linhaProva(lista.children.length, { pos: 8 }, prova));
      });
    },
    aoEnviar: (dados, form, acao) => {
      const chave = chaveResultado(modId, provaId);
      if (acao === 'limpar') {
        gravar(app.loja.apagar('resultados', chave), 'Resultado apagado');
        return;
      }
      const total = form.querySelectorAll('.linha-prova').length;
      const novas = [];
      for (let i = 0; i < total; i++) {
        const at = dados.get(`at_${i}`);
        if (!at) continue;
        novas.push({ pos: Number(dados.get(`pos_${i}`)), at, nome: String(dados.get(`nome_${i}`) || '').trim() });
      }
      novas.sort((x, y) => x.pos - y.pos);
      if (!novas.length) {
        if (atuais.length) gravar(app.loja.apagar('resultados', chave), 'Resultado apagado');
        return;
      }
      gravar(app.loja.salvar('resultados', chave, { mod: modId, prova: provaId, linhas: novas, atualizadoEm: Date.now() }), 'Resultado salvo');
    },
  });
}

// ---------- Punição ----------

export function folhaPunicao({ id = null, mod = '' } = {}) {
  const existente = id ? app.estado.penalidades[id] : null;
  if (id && !existente) return;
  const p = existente || { at: '', mod, tipo: 'wo', pontos: -12, motivo: '' };
  const pontosPadrao = (tipo) => (tipo === 'wo_tecnico' && app.modelo.config.woTecnicoPerde12 ? 12 : Math.abs(TIPOS_PUNICAO[tipo].pontos));
  const corpo = `<label class="campo"><span>Atlética</span><select name="at">${opcoesAtleticas(p.at, 'Escolha…')}</select></label>
    <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS_PUNICAO)
      .map(([chave, t]) => `<option value="${chave}"${chave === p.tipo ? ' selected' : ''}>${t.nome}</option>`)
      .join('')}</select></label>
    <label class="campo"><span>Modalidade</span><select name="mod">
      <option value="">Nenhuma (só na geral)</option>
      ${MODALIDADES.map((m) => `<option value="${m.id}"${m.id === p.mod ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}
    </select></label>
    <label class="campo"><span>Pontos perdidos na geral</span><input type="number" name="pontos" min="0" step="1" inputmode="numeric" value="${Math.abs(p.pontos || 0)}"></label>
    <label class="campo"><span>Motivo (opcional)</span><input name="motivo" value="${esc(p.motivo || '')}" maxlength="80" autocomplete="off"></label>
    <p class="nota">W.O. e fraude também zeram a atlética na modalidade escolhida (RG Arts. 23 e 27).</p>`;

  abrirFolha({
    titulo: existente ? 'Punição' : 'Registrar punição',
    corpo,
    rodape: `${existente ? '<button type="submit" class="botao perigo" value="excluir" data-confirmar="Toque de novo para excluir">Excluir</button>' : ''}
      <span class="espaco"></span><button type="submit" class="botao" value="salvar">Salvar</button>`,
    aoAbrir: (form) => {
      form.elements.tipo.addEventListener('change', () => {
        form.elements.pontos.value = pontosPadrao(form.elements.tipo.value);
      });
    },
    aoEnviar: (dados, form, acao) => {
      if (acao === 'excluir') {
        gravar(app.loja.apagar('penalidades', id), 'Punição excluída');
        return;
      }
      const at = dados.get('at');
      const tipo = dados.get('tipo');
      const modId = dados.get('mod');
      const pontos = numero(dados.get('pontos'));
      if (!at) return 'Escolha a atlética.';
      if (TIPOS_PUNICAO[tipo]?.zera && !modId) return 'W.O. e fraude precisam da modalidade.';
      if (Number.isNaN(pontos)) return 'Use um número inteiro de pontos.';
      const doc = { at, tipo, mod: modId || null, pontos: -(pontos || 0), motivo: String(dados.get('motivo') || '').trim(), atualizadoEm: Date.now() };
      gravar(app.loja.salvar('penalidades', id || novoId(), doc), 'Punição salva');
    },
  });
}

// ---------- Remarcar um dia inteiro (chuva) ----------

export function folhaRemarcar(data) {
  const pendentes = app.modelo.jogos.filter((j) => j.data === data && !temResultado(j));
  const um = pendentes.length === 1;
  const corpo = `<p>${um ? 'O jogo sem resultado' : `Os ${pendentes.length} jogos sem resultado`} de <strong>${esc(dataLonga(data).toLowerCase())}</strong> ${um ? 'vai' : 'vão'} para:</p>
    ${seletorData('nova', '')}
    <p class="nota">Os horários continuam os mesmos; ajuste jogo a jogo se mudarem.</p>`;
  abrirFolha({
    titulo: 'Remarcar dia',
    corpo,
    rodape: `<span class="espaco"></span><button type="submit" class="botao" value="salvar">Remarcar ${um ? 'jogo' : `${pendentes.length} jogos`}</button>`,
    aoEnviar: (dados) => {
      const nova = dados.get('nova') || '';
      if (nova === data) return 'Escolha uma data diferente.';
      const operacoes = pendentes.map(({ id, ...j }) => app.loja.salvar('jogos', id, { ...j, data: nova, atualizadoEm: Date.now() }));
      const destino = nova ? dataCurta(nova) : 'data a definir';
      gravar(Promise.all(operacoes), um ? `Jogo remarcado para ${destino}` : `${pendentes.length} jogos remarcados para ${destino}`);
    },
  });
}

// ---------- Resumo do dia (imagem ou PDF) ----------

function opcoesDosDias(at, escolhido) {
  const dias = at ? diasComJogos(app.modelo, at) : [];
  if (!dias.length) return '<option value="">Sem jogos com data</option>';
  const dia = dias.includes(escolhido) ? escolhido : diaPadrao(dias);
  return dias.map((d) => `<option value="${d}"${d === dia ? ' selected' : ''}>${esc(dataLonga(d))}</option>`).join('');
}

function previaDoResumo(at, dia) {
  if (!at || !dia) return 'Escolha a atlética e o dia.';
  const { totais } = dadosDoResumo(app.modelo, at, dia);
  const lancados = totais.jogos - totais.pendentes;
  return `${totais.jogos} ${totais.jogos === 1 ? 'jogo' : 'jogos'} nesse dia, ${lancados} com resultado lançado.`;
}

// Imagem PNG (aparece direto na conversa do WhatsApp) ou PDF (bom para guardar ou imprimir).
async function arquivoDoResumo(resumo, formato) {
  const logo = await carregarImagem(resumo.logo);
  if (formato === 'pdf') {
    const JsPDF = await carregarJsPDF();
    return { blob: gerarPdf(JsPDF, resumo, { logo: logo ? escudoParaPdf(logo) : null }).output('blob'), extensao: 'pdf' };
  }
  return { blob: await gerarImagem(resumo, { logo }), extensao: 'png' };
}

export function folhaResumo({ dia = '' } = {}) {
  const at = app.modelo.nossa || '';
  const compartilhar = podeCompartilharArquivo();
  const formato = app.ui.formatoResumo === 'pdf' ? 'pdf' : 'imagem';
  const opcaoFormato = (valor, rotulo) =>
    `<label class="opcao-formato"><input type="radio" name="formato" value="${valor}"${valor === formato ? ' checked' : ''}><span>${rotulo}</span></label>`;
  const corpo = `<label class="campo"><span>Atlética</span><select name="at" id="resumo-atletica">${opcoesAtleticas(at, 'Escolha…')}</select></label>
    <label class="campo"><span>Dia</span><select name="dia" id="resumo-dia">${opcoesDosDias(at, dia)}</select></label>
    <div class="campo"><span>Formato</span>
      <div class="opcoes-formato" role="radiogroup" aria-label="Formato">${opcaoFormato('imagem', 'Imagem')}${opcaoFormato('pdf', 'PDF')}</div>
    </div>
    <p class="nota" data-previa></p>
    <p class="nota">Traz o escudo, a posição na geral e os jogos do dia com placar, parciais, situação no grupo e observações. A imagem aparece direto na conversa do WhatsApp; o PDF é melhor para guardar ou imprimir.</p>`;
  const rodape = compartilhar
    ? '<span class="espaco"></span><button type="submit" class="botao secundario" value="baixar">Baixar</button><button type="submit" class="botao" value="compartilhar">Compartilhar</button>'
    : '<span class="espaco"></span><button type="submit" class="botao" value="baixar">Baixar</button>';

  // O celular só abre o "compartilhar" se o arquivo sair no mesmo toque. Por isso ele é preparado antes:
  // quando a folha abre e a cada mudança de atlética, dia ou formato.
  let preparado = null; // { chave, estado, promessa, arquivo }
  const preparar = (form) => {
    const chave = [form.elements.at.value, form.elements.dia.value, form.elements.formato.value].join('|');
    if (preparado?.chave === chave && preparado.estado === app.estado) return preparado;
    const [atEscolhida, diaEscolhido, formatoEscolhido] = chave.split('|');
    if (!atEscolhida || !diaEscolhido) return (preparado = null);
    const resumo = dadosDoResumo(app.modelo, atEscolhida, diaEscolhido, { previsao: previsaoDoModelo(app.modelo) });
    const atual = { chave, estado: app.estado, arquivo: null };
    atual.promessa = arquivoDoResumo(resumo, formatoEscolhido).then((arquivo) => (atual.arquivo = { ...arquivo, resumo }));
    atual.promessa.catch(() => {});
    preparado = atual;
    return atual;
  };
  const entregar = ({ blob, extensao, resumo }, acao) => {
    const nome = nomeDoArquivo(resumo, extensao);
    if (acao === 'compartilhar') return compartilharArquivo(blob, nome, `Resumo do dia · ${resumo.atletica}`);
    baixarArquivo(blob, nome);
    return Promise.resolve('baixado');
  };

  abrirFolha({
    titulo: 'Resumo do dia',
    corpo,
    rodape,
    aoAbrir: (form) => {
      const atualizar = () => {
        form.querySelector('[data-previa]').textContent = previaDoResumo(form.elements.at.value, form.elements.dia.value);
        preparar(form);
      };
      form.elements.at.addEventListener('change', () => {
        form.elements.dia.innerHTML = opcoesDosDias(form.elements.at.value, form.elements.dia.value);
        atualizar();
      });
      form.elements.dia.addEventListener('change', atualizar);
      for (const opcao of form.querySelectorAll('[name="formato"]')) {
        opcao.addEventListener('change', () => {
          app.ui.formatoResumo = form.elements.formato.value;
          salvarPreferencias();
          atualizar();
        });
      }
      atualizar();
    },
    aoEnviar: (dados, form, acao) => {
      if (!dados.get('at')) return 'Escolha a atlética.';
      if (!dados.get('dia')) return 'Essa atlética ainda não tem jogos com data marcada.';
      const pronto = preparar(form);
      const avisar = (r) => {
        if (r === 'baixado') aviso('Arquivo baixado');
        if (r === 'compartilhado') aviso('Resumo compartilhado');
      };
      const falhou = (erro) => aviso(erro?.message || 'Não deu para gerar o resumo.', 'erro');
      // Arquivo já pronto: sai no mesmo toque. Senão espera; se o celular recusar o compartilhar, baixa.
      if (pronto.arquivo) entregar(pronto.arquivo, acao).then(avisar).catch(falhou);
      else pronto.promessa.then((arquivo) => entregar(arquivo, acao)).then(avisar).catch(falhou);
    },
  });
}

// ---------- Backup ----------

export function folhaRestaurar(backup) {
  const dados = backup.dados;
  const contagem = (col) => Object.keys(dados[col] || {}).length;
  abrirFolha({
    titulo: 'Restaurar backup',
    corpo: `<p>O backup de ${esc(new Date(backup.exportadoEm).toLocaleString('pt-BR'))} tem ${contagem('jogos')} jogos, ${contagem('resultados')} resultados de provas e ${contagem('penalidades')} punições.</p>
      <p class="alerta">Isto substitui todos os dados atuais, para todo mundo que usa o app.</p>`,
    rodape: '<span class="espaco"></span><button type="submit" class="botao perigo" value="salvar" data-confirmar="Toque de novo para substituir">Substituir dados</button>',
    aoEnviar: () => {
      gravar(app.loja.substituirTudo({ ...estadoVazio(), ...dados }), 'Backup restaurado');
    },
  });
}

export function folhaApagarTudo() {
  abrirFolha({
    titulo: 'Apagar resultados',
    corpo: `<p>Apaga jogos, grupos, resultados de provas, classificações oficiais e punições, para todo mundo que usa o app.</p>
      <p class="nota">A atlética escolhida e os nomes continuam. Baixe um backup antes, por segurança.</p>`,
    rodape: '<span class="espaco"></span><button type="submit" class="botao perigo" value="salvar" data-confirmar="Toque de novo para apagar tudo">Apagar tudo</button>',
    aoEnviar: () => {
      gravar(app.loja.substituirTudo({ ...estadoVazio(), config: app.estado.config }), 'Resultados apagados');
    },
  });
}
