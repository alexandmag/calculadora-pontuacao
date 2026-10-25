// Situação exata de cada atlética nas coletivas: quem já garantiu a semifinal, quem ainda pode ir à
// repescagem, quem está fora e o que cada uma precisa fazer nos jogos que faltam.
//
// Como funciona: em cada grupo, percorre todas as combinações de resultado dos jogos que faltam
// (vitória, empate ou derrota; no vôlei, 2×0 ou 2×1 para cada lado, porque perder um set vale ponto).
// Pontos e vitórias saem da combinação. Quem termina empatado nos dois depende do saldo, que muda com
// o placar: aí a conta diz "depende do saldo". Entre times que já jogaram tudo, o desempate é o do
// regulamento e sai exato. Na repescagem (todos contra todos entre os 2º colocados) a conta é a mesma,
// valendo só o 1º lugar.
// Puro (sem DOM): testado em tests/situacao.test.mjs.

import { ETAPA, desempatar, placarEfetivo, tabelaGrupo } from './regras.js';

// Destinos de quem termina a fase de grupos, do melhor para o pior.
const DESTINOS = ['semi', 'repescagem', 'fora'];
const BIT = { semi: 1, repescagem: 2, fora: 4 };
const doBit = (mascara) => DESTINOS.filter((d) => mascara & BIT[d]);

// Resultado de um jogo do ponto de vista de um time: v (vitória), e (empate), d (derrota); no vôlei,
// v20, v21, d12 e d02 (o placar em sets).
const ORDEM_RESULTADO = ['v20', 'v21', 'v', 'e', 'd12', 'd02', 'd'];
const INVERSO = { v20: 'd02', v21: 'd12', d12: 'v21', d02: 'v20', v: 'd', d: 'v', e: 'e' };

// Os resultados possíveis de um jogo que falta, do ponto de vista do time A.
function resultadosPossiveis(esporte, mataMata) {
  if (esporte.sets) {
    const [v0, p0] = esporte.pontosSets.semPerderSet;
    const [v1, p1] = esporte.pontosSets.comSetPerdido;
    return [
      { r: 'a', fino: 'v20', pa: v0, pb: p0 },
      { r: 'a', fino: 'v21', pa: v1, pb: p1 },
      { r: 'b', fino: 'd12', pa: p1, pb: v1 },
      { r: 'b', fino: 'd02', pa: p0, pb: v0 },
    ];
  }
  const { vitoria, empate = 0, derrota = 0 } = esporte.pontos;
  const lista = [{ r: 'a', fino: 'v', pa: vitoria, pb: derrota }];
  if (!esporte.semEmpate && !mataMata) lista.push({ r: 'e', fino: 'e', pa: empate, pb: empate });
  lista.push({ r: 'b', fino: 'd', pa: derrota, pb: vitoria });
  return lista;
}

// Resultado (já jogado ou sorteado) do ponto de vista de um dos times. res: { a, b, v, sa, sb }.
export function resultadoDoTime(res, id, esporte) {
  const ehA = res.a === id;
  if (esporte.sets) {
    const [meus, deles] = ehA ? [res.sa, res.sb] : [res.sb, res.sa];
    if (meus > deles) return deles ? 'v21' : 'v20';
    return meus ? 'd12' : 'd02';
  }
  if (res.v === 'empate') return 'e';
  return (res.v === 'a') === ehA ? 'v' : 'd';
}

// Chave dos resultados de um time nos jogos que faltam, igual na conta exata e na simulação:
// "med:v,psi:d" (adversários em ordem alfabética).
export function chaveDosResultados(lista) {
  return lista
    .map(({ contra, resultado }) => `${contra}:${resultado}`)
    .sort()
    .join(',');
}

// Uma combinação a mais que isso não é percorrida (grupo grande no começo): fica sem a conta exata.
const LIMITE_COMBINACOES = 300000;

// Um grupo (ou a repescagem). diretas: quantos vão direto à semifinal; repescagem: se o seguinte vai
// à repescagem.
export function analisarGrupo({ membros, jogos, esporte, eliminados = new Set(), fase = 'grupo', diretas = 1, repescagem = false }) {
  const { tabela } = tabelaGrupo(membros, jogos, esporte, eliminados, fase);
  const ativos = tabela.filter((l) => l.posicao).map((l) => l.id);
  const linhas = Object.fromEntries(tabela.map((l) => [l.id, l]));
  const doGrupo = jogos.filter((j) => j.fase === fase && ativos.includes(j.a) && ativos.includes(j.b));
  const feitos = doGrupo.filter((j) => placarEfetivo(j, esporte));
  // Todos contra todos: falta cada par que ainda não tem resultado.
  const faltam = [];
  for (let i = 0; i < ativos.length; i++) {
    for (let k = i + 1; k < ativos.length; k++) {
      const [x, y] = [ativos[i], ativos[k]];
      const doPar = doGrupo.filter((j) => (j.a === x && j.b === y) || (j.a === y && j.b === x));
      if (!doPar.some((j) => placarEfetivo(j, esporte))) faltam.push(doPar[0] || { a: x, b: y, fase });
    }
  }
  const destino = (pos) => (pos <= diretas ? 'semi' : repescagem && pos === diretas + 1 ? 'repescagem' : 'fora');
  const opcoes = resultadosPossiveis(esporte, fase !== 'grupo' && ativos.length === 2);
  const n = faltam.length;
  const total = opcoes.length ** n;
  const posicaoAtual = Object.fromEntries(tabela.map((l) => [l.id, l.posicao]));
  if (total > LIMITE_COMBINACOES) {
    return { faltam, completo: false, times: Object.fromEntries(ativos.map((id) => [id, { id, posicao: posicaoAtual[id], calculado: false }])) };
  }

  // Conta com índices (times 0..m-1, jogos 0..n-1): no começo do campeonato são dezenas de milhares
  // de combinações e o celular precisa dar conta.
  const m = ativos.length;
  const ia = faltam.map((j) => ativos.indexOf(j.a));
  const ib = faltam.map((j) => ativos.indexOf(j.b));
  const nOp = opcoes.length;
  const R = { a: 0, e: 1, b: 2 };
  const opR = opcoes.map((o) => R[o.r]);
  const meus = ativos.map((_, t) => faltam.map((_, g) => g).filter((g) => ia[g] === t || ib[g] === t));
  const outros = ativos.map((_, t) => faltam.map((_, g) => g).filter((g) => ia[g] !== t && ib[g] !== t));
  const restantes = meus.map((l) => l.length);
  const desempates = new Map();
  // Ordem entre times que já jogaram tudo e terminaram iguais em pontos e vitórias: é a do regulamento.
  const ordemEntre = (ids) => {
    const chave = [...ids].sort().join('|');
    if (!desempates.has(chave)) desempates.set(chave, desempatar([...ids].sort(), esporte.desempate, linhas, feitos, esporte));
    return desempates.get(chave);
  };
  // Destinos de quem pode terminar entre a posição x e a y.
  const faixa = Array.from({ length: m + 2 }, (_, x) =>
    Array.from({ length: m + 2 }, (_, y) => {
      let mascara = 0;
      for (let pos = x; pos <= y; pos++) mascara |= BIT[destino(pos)];
      return mascara;
    }),
  );

  const conta = ativos.map(() => ({ mascara: 0, melhor: Infinity, pior: 0, padroes: new Map() }));
  const escolha = new Int32Array(n);
  const pts = new Float64Array(m);
  const vit = new Int32Array(m);
  const basePts = ativos.map((id) => linhas[id].pts);
  const baseVit = ativos.map((id) => linhas[id].v);
  for (let c = 0; c < total; c++) {
    if (c > 0) {
      // Próxima combinação, como um hodômetro.
      for (let g = 0; g < n; g++) {
        if (++escolha[g] < nOp) break;
        escolha[g] = 0;
      }
    }
    for (let t = 0; t < m; t++) {
      pts[t] = basePts[t];
      vit[t] = baseVit[t];
    }
    for (let g = 0; g < n; g++) {
      const o = opcoes[escolha[g]];
      pts[ia[g]] += o.pa;
      pts[ib[g]] += o.pb;
      if (o.r === 'a') vit[ia[g]]++;
      else if (o.r === 'b') vit[ib[g]]++;
    }
    for (let t = 0; t < m; t++) {
      let acima = 0;
      let iguais = 0;
      for (let o = 0; o < m; o++) {
        if (o === t) continue;
        if (pts[o] > pts[t] || (pts[o] === pts[t] && vit[o] > vit[t])) acima++;
        else if (pts[o] === pts[t] && vit[o] === vit[t]) iguais++;
      }
      let melhor = acima + 1;
      let pior = acima + iguais + 1;
      if (iguais && !restantes[t]) {
        const empatados = [];
        for (let o = 0; o < m; o++) if (o !== t && pts[o] === pts[t] && vit[o] === vit[t]) empatados.push(o);
        const terminados = [t, ...empatados.filter((o) => !restantes[o])].map((o) => ativos[o]);
        if (terminados.length > 1) {
          const abertos = iguais + 1 - terminados.length;
          let antes = 0;
          for (const bloco of ordemEntre(terminados)) {
            if (bloco.includes(ativos[t])) {
              melhor = acima + antes + 1;
              pior = acima + antes + bloco.length + abertos;
              break;
            }
            antes += bloco.length;
          }
        }
      }
      const mascara = faixa[melhor][pior];
      const ct = conta[t];
      ct.mascara |= mascara;
      if (melhor < ct.melhor) ct.melhor = melhor;
      if (pior > ct.pior) ct.pior = pior;
      // Agrupa pelas combinações dos jogos do próprio time.
      let chave = 0;
      for (const g of meus[t]) chave = chave * nOp + escolha[g];
      let p = ct.padroes.get(chave);
      if (!p) {
        const resultados = meus[t].map((g) => (ia[g] === t ? opcoes[escolha[g]].fino : INVERSO[opcoes[escolha[g]].fino]));
        p = { resultados, mascara: 0, saldo: false, porOutro: new Uint8Array(outros[t].length * 3) };
        ct.padroes.set(chave, p);
      }
      p.mascara |= mascara;
      if (mascara & (mascara - 1)) p.saldo = true;
      const lista = outros[t];
      for (let k = 0; k < lista.length; k++) p.porOutro[k * 3 + opR[escolha[lista[k]]]] |= mascara;
    }
  }
  const times = {};
  ativos.forEach((t, i) => {
    const ct = conta[i];
    // De volta aos jogos: em cada combinação, os destinos para cada resultado dos outros jogos.
    const padroes = [...ct.padroes.values()].map((p) => ({
      ...p,
      outros: outros[i].map((g, k) => [g, Object.fromEntries(['a', 'e', 'b'].map((r, x) => [r, p.porOutro[k * 3 + x]]).filter(([, m]) => m))]),
    }));
    const possiveis = doBit(ct.mascara);
    const jogosDoTime = meus[i].map((g) => faltam[g]);
    times[t] = {
      id: t,
      calculado: true,
      posicao: posicaoAtual[t],
      pts: linhas[t].pts,
      melhor: ct.melhor,
      pior: ct.pior,
      possiveis,
      destino: possiveis.length === 1 ? possiveis[0] : null,
      faltam: jogosDoTime.map((j) => ({ jogo: j, contra: j.a === t ? j.b : j.a })),
      resumo: casos(t, padroes, jogosDoTime, faltam),
    };
  });
  return { faltam, completo: n === 0, times };
}

// Qualidade de um destino possível: o pior caso pesa primeiro, depois o melhor.
function qualidade(mascara) {
  const d = doBit(mascara).map((x) => DESTINOS.indexOf(x));
  return [Math.max(...d), Math.min(...d)];
}

// Junta linhas com a mesma chave que só diferem no resultado de um jogo ("vence X" + "empata com X"
// vira "não perde para X"), até não dar mais.
function juntar(linhas, nJogos) {
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 0; i < nJogos; i++) {
      const grupos = new Map();
      for (const l of linhas) {
        const k = `${l.chave}#${l.conds.map((s, g) => (g === i ? '*' : [...s].sort().join('+'))).join('/')}`;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(l);
      }
      linhas = [...grupos.values()].map((lista) => {
        if (lista.length === 1) return lista[0];
        mudou = true;
        const uniao = new Set(lista.flatMap((l) => [...l.conds[i]]));
        return { ...lista[0], conds: lista[0].conds.map((s, g) => (g === i ? uniao : s)), padroes: lista.flatMap((l) => l.padroes) };
      });
    }
  }
  const nota = (l) => l.conds.reduce((s, c) => s + [...c].reduce((x, f) => x + ORDEM_RESULTADO.indexOf(f), 0) / c.size, 0);
  return linhas.sort((x, y) => nota(x) - nota(y));
}

// Em que caso cai uma combinação dos próprios jogos: semifinal garantida, pelo menos a repescagem
// garantida, fora com certeza ou depende (de outros jogos ou do saldo).
function classe(destinos) {
  if (destinos.length === 1 && destinos[0] !== 'repescagem') return destinos[0];
  if (destinos.includes('repescagem') && !destinos.includes('fora')) return 'repescagem';
  return 'depende';
}
const CLASSES = ['semi', 'repescagem', 'fora', 'depende'];

// O que dá cada combinação dos próprios jogos, juntando as que caem no mesmo caso (semifinal
// garantida, repescagem garantida, fora ou depende): é o que a tela mostra, como "semifinal garantida
// se vencer X e não perder para Y". Cada caso traz as combinações (opcoes), se depende do saldo, de
// quais outros jogos (com o resultado que ajuda) e as chaves para achar a chance na simulação.
function casos(t, padroes, jogosDoTime, faltam) {
  const contra = (g) => (jogosDoTime[g].a === t ? jogosDoTime[g].b : jogosDoTime[g].a);
  const chaves = (lista) => lista.map((rs) => chaveDosResultados(rs.map((r, g) => ({ contra: contra(g), resultado: r }))));
  // Resultados possíveis em cada jogo: quando a condição aceita todos, o jogo não importa e sai do texto.
  const possiveis = jogosDoTime.map((_, g) => new Set(padroes.map((p) => p.resultados[g])));
  const condicoes = (conds) =>
    conds
      .map((c, g) => ({ jogo: jogosDoTime[g], contra: contra(g), resultados: ORDEM_RESULTADO.filter((f) => c.has(f)) }))
      .filter((c, g) => c.resultados.length < possiveis[g].size);

  const base = padroes.map((p) => {
    const depende = [];
    for (const [g, porResultado] of p.outros) {
      const mascaras = Object.values(porResultado);
      if (mascaras.every((m) => m === mascaras[0])) continue;
      const notas = Object.entries(porResultado).map(([r, m]) => [r, qualidade(m)]);
      const melhor = notas.reduce((a, [, q]) => (q[0] < a[0] || (q[0] === a[0] && q[1] < a[1]) ? q : a), [9, 9]);
      const torcer = notas.filter(([, q]) => q[0] === melhor[0] && q[1] === melhor[1]).map(([r]) => r);
      depende.push({ jogo: faltam[g], torcer: torcer.length < notas.length ? torcer : [] });
    }
    const destinos = doBit(p.mascara);
    return { conds: p.resultados.map((r) => new Set([r])), chave: classe(destinos), destinos, saldo: p.saldo, depende, padroes: [p.resultados] };
  });

  const juntadas = juntar(base, jogosDoTime.length);
  return CLASSES.map((c) => {
    const linhas = juntadas.filter((l) => l.chave === c);
    if (!linhas.length) return null;
    const dela = base.filter((l) => l.chave === c);
    // De quais outros jogos depende (e o que ajuda, quando é sempre o mesmo resultado).
    const depende = new Map();
    for (const l of dela) {
      for (const d of l.depende) {
        const k = `${d.jogo.a}-${d.jogo.b}`;
        const atual = depende.get(k);
        if (!atual) depende.set(k, { jogo: d.jogo, torcer: d.torcer });
        else if (atual.torcer.join('') !== d.torcer.join('')) atual.torcer = [];
      }
    }
    return {
      classe: c,
      exato: c === 'repescagem' ? dela.every((l) => l.destinos.length === 1) : true,
      opcoes: linhas.map((l) => condicoes(l.conds)),
      saldo: dela.some((l) => l.saldo),
      depende: [...depende.values()],
      chaves: chaves(dela.flatMap((l) => l.padroes)),
    };
  }).filter(Boolean);
}

// ---------- uma modalidade ----------

// info: a modalidade como o modelo monta (grupos, jogos, esporte, wo, andamento).
export function situacaoModalidade(info) {
  if (info.m.tipo !== 'coletiva' || !Object.keys(info.grupos || {}).length) return null;
  const { esporte } = info;
  const eliminados = new Set(info.wo.keys());
  const comRepescagem = Boolean(info.m.repescagem);
  const grupos = {};
  const times = {};
  for (const [letra, membros] of Object.entries(info.grupos)) {
    const g = analisarGrupo({ membros, jogos: info.jogos, esporte, eliminados, diretas: comRepescagem ? 1 : 2, repescagem: comRepescagem });
    grupos[letra] = { faltam: g.faltam, completo: g.completo };
    for (const t of Object.values(g.times)) times[t.id] = { ...t, grupo: letra };
    for (const id of membros) if (eliminados.has(id)) times[id] = { id, grupo: letra, wo: true, calculado: true, possiveis: ['fora'], destino: 'fora', faltam: [], resumo: [] };
  }
  // Depois dos grupos: até onde cada uma chegou (repescagem, semifinal, final).
  const mataMata = info.jogos.filter((j) => j.fase !== 'grupo' && j.a && j.b);
  if (mataMata.length) {
    for (const l of info.andamento || []) if (times[l.id]) times[l.id].etapa = l.etapa;
    const rep = mataMata.filter((j) => j.fase === 'repescagem');
    if (rep.length) {
      const membros = [...new Set(rep.flatMap((j) => [j.a, j.b]))].filter((id) => !eliminados.has(id));
      const r = analisarGrupo({ membros, jogos: info.jogos, esporte, eliminados, fase: 'repescagem', diretas: 1 });
      for (const t of Object.values(r.times)) if (times[t.id]) times[t.id].naRepescagem = t;
    }
    const adversario = (fase, id) => {
      const j = mataMata.find((x) => x.fase === fase && (x.a === id || x.b === id));
      return j ? (j.a === id ? j.b : j.a) : null;
    };
    for (const t of Object.values(times)) {
      t.rivalSemi = adversario('semifinal', t.id);
      t.rivalFinal = adversario('final', t.id);
    }
  }
  return { mod: info.m.id, repescagem: comRepescagem, grupos, times, mataMata: mataMata.length > 0 };
}

// ---------- previsão objetiva de uma atlética ----------

// Em que grupo cada modalidade coletiva coloca a atlética: vai à semifinal, briga pela repescagem,
// briga pela vaga (sem repescagem) ou está fora. Junta a conta exata (garantida ou eliminada) com a
// simulação (provável). chances: a previsão da modalidade para a atlética (pode faltar).
const PROVAVEL = 0.6; // chance de vaga direta a partir da qual a semifinal conta como "provável"
const REMOTA = 0.03; // abaixo disso, "praticamente fora"

export function veredito(sit, t, chances) {
  if (!t) return null;
  if (t.wo) return { categoria: 'fora', motivo: 'wo' };
  if (sit.mataMata && t.etapa !== undefined) {
    if (t.etapa === ETAPA.campea || t.etapa === ETAPA.vice) return { categoria: 'semi', motivo: 'final-jogada' };
    if (t.etapa === ETAPA.finalista) return { categoria: 'semi', motivo: 'na-final' };
    if (t.etapa === ETAPA.semifinalista) return { categoria: 'semi', motivo: 'na-semi' };
    if (t.etapa === ETAPA.semifinal) return { categoria: 'semi', motivo: 'parou-semi' };
    if (t.etapa === ETAPA.naRepescagem) return { categoria: 'repescagem', motivo: 'na-repescagem' };
    if (t.etapa === ETAPA.repescagem) return { categoria: 'fora', motivo: 'perdeu-repescagem' };
    if (t.etapa === ETAPA.wo) return { categoria: 'fora', motivo: 'wo' };
    return { categoria: 'fora', motivo: 'eliminada' };
  }
  if (t.destino === 'semi') return { categoria: 'semi', motivo: 'garantida' };
  if (t.destino === 'fora') return { categoria: 'fora', motivo: 'eliminada' };
  const direta = chances ? (sit.repescagem ? chances.lider : chances.semi) : null;
  if (direta !== null && direta >= PROVAVEL) return { categoria: 'semi', motivo: 'provavel' };
  if (chances && chances.semi < REMOTA && (!sit.repescagem || chances.repescagem < REMOTA)) return { categoria: 'fora', motivo: 'praticamente' };
  if (sit.repescagem && (t.possiveis || []).includes('repescagem')) return { categoria: 'repescagem', motivo: t.destino === 'repescagem' ? 'garantida' : 'briga' };
  return { categoria: 'briga', motivo: 'briga' };
}

// Situação de todas as coletivas do modelo (calculada uma vez por modelo).
const cache = new WeakMap();
export function situacoesDoModelo(modelo) {
  if (!cache.has(modelo)) {
    const todas = {};
    for (const [id, info] of Object.entries(modelo.modalidades)) {
      if (info.m.tipo !== 'coletiva' || info.vigente.length) continue;
      const s = situacaoModalidade(info);
      if (s) todas[id] = s;
    }
    cache.set(modelo, todas);
  }
  return cache.get(modelo);
}

// As coletivas em andamento de uma atlética, com o veredito de cada uma.
export function previsaoObjetiva(modelo, previsao, id) {
  const situacoes = situacoesDoModelo(modelo);
  return Object.entries(situacoes)
    .map(([mod, sit]) => {
      const t = sit.times[id];
      if (!t) return null;
      const chances = previsao?.modalidades?.[mod]?.[id] || null;
      return { mod, sit, t, chances, ...veredito(sit, t, chances) };
    })
    .filter(Boolean);
}
