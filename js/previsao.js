// Previsão das coletivas: simula o resto do campeonato milhares de vezes a partir dos resultados lançados
// e conta quantas vezes cada atlética passou de fase, foi campeã e quantos pontos levou na geral.
//
// Como funciona:
// - Em cada modalidade, cada atlética tem uma "força", estimada pelos saldos dos jogos já feitos. Com
//   poucos jogos a estimativa fica perto da média e com muita incerteza (e cada simulação sorteia uma
//   força diferente dentro dessa incerteza).
// - Os jogos que faltam são sorteados com essas forças, no formato da CO: grupos → repescagem (onde
//   houver: os 2º colocados, todos contra todos) → semifinal → final. Na semifinal, com repescagem, o
//   melhor 1º colocado pega o vencedor da repescagem e os outros dois 1º colocados se enfrentam; sem
//   repescagem, é 1º de um grupo contra 2º do outro.
// - Colocação final como no app: final, semifinal (3º perdeu para a campeã), repescagem e, por fim,
//   posição no grupo e campanha.
// Jogos e fases já lançados entram como aconteceram. Puro (sem DOM): testado em tests/previsao.test.mjs.

import { MODALIDADES } from './dados.js';
import { placarEfetivo, pontosPorColocacao, vencedor } from './regras.js';

// forca: quanto as atléticas costumam diferir; ruido: quanto um jogo foge do esperado; pontos: média de
// gols ou pontos de cada time por jogo (só para montar placares plausíveis). Unidades: gols (futsal,
// futebol, handebol), pontos (basquete) e pontos somados dos sets (vôlei e peteca).
export const PARAMETROS = {
  futsal: { forca: 2.5, ruido: 2.5, pontos: 3 },
  futebol: { forca: 2, ruido: 2, pontos: 2 },
  handebol: { forca: 6, ruido: 5, pontos: 13 },
  basquete: { forca: 15, ruido: 12, pontos: 28 },
  volei: { forca: 10, ruido: 9, pontos: 22 },
  peteca: { forca: 8, ruido: 7, pontos: 18 },
};

// 1.000 campeonatos: a chance de 50% sai com erro de uns 1,5 ponto percentual e o cálculo leva menos de
// um segundo no celular.
export const SIMULACOES = 1000;

// ---------- números aleatórios reproduzíveis (a mesma previsão a cada vez que a tela é desenhada) ----------

function geradorAleatorio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng) {
  const u = rng() || 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

// ---------- força de cada atlética ----------

function inverter(m) {
  const n = m.length;
  const a = m.map((linha, i) => [...linha, ...Array.from({ length: n }, (_, k) => (i === k ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
    [a[c], a[p]] = [a[p], a[c]];
    const piv = a[c][c];
    for (let k = 0; k < 2 * n; k++) a[c][k] /= piv;
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const f = a[i][c];
      if (f) for (let k = 0; k < 2 * n; k++) a[i][k] -= f * a[c][k];
    }
  }
  return a.map((linha) => linha.slice(n));
}

function cholesky(m) {
  const n = m.length;
  const l = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k <= i; k++) {
      let s = m[i][k];
      for (let j = 0; j < k; j++) s -= l[i][j] * l[k][j];
      l[i][k] = i === k ? Math.sqrt(Math.max(s, 1e-12)) : s / l[k][k];
    }
  }
  return l;
}

// Saldo do jogo do ponto de vista do time A, na unidade do esporte. W.O. não mede força.
function margem(jogo, esporte) {
  if (jogo.res?.wo) return null;
  const p = placarEfetivo(jogo, esporte);
  if (!p) return null;
  if (esporte.sets) {
    if (p.parciais?.length) return p.parciais.reduce((s, [x, y]) => s + x - y, 0);
    if (p.totais) return p.totais.a - p.totais.b;
    return (p.a - p.b) * 8;
  }
  return p.a - p.b;
}

// Estimativa "regularizada": cada força começa em zero e os saldos a empurram. Devolve a média e a
// raiz da covariância, para sortear forças coerentes entre si.
export function estimarForcas(times, jogos, esporte, par) {
  const n = times.length;
  const idx = Object.fromEntries(times.map((id, i) => [id, i]));
  const precisao = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => (i === k ? 1 / par.forca ** 2 : 0)));
  const b = new Array(n).fill(0);
  const w = 1 / par.ruido ** 2;
  const teto = 2.5 * par.ruido; // goleada diz que um é forte e o outro fraco, mas não mais que isso
  for (const j of jogos) {
    const i = idx[j.a];
    const k = idx[j.b];
    if (i === undefined || k === undefined) continue;
    const m0 = margem(j, esporte);
    if (m0 === null) continue;
    const m = Math.max(-teto, Math.min(teto, m0));
    precisao[i][i] += w;
    precisao[k][k] += w;
    precisao[i][k] -= w;
    precisao[k][i] -= w;
    b[i] += m * w;
    b[k] -= m * w;
  }
  const cov = inverter(precisao);
  const media = cov.map((linha) => linha.reduce((s, x, k) => s + x * b[k], 0));
  return { idx, media, raiz: cholesky(cov) };
}

function sortearForcas({ media, raiz }, rng) {
  const z = media.map(() => normal(rng));
  return media.map((m, i) => {
    let s = m;
    for (let k = 0; k <= i; k++) s += raiz[i][k] * z[k];
    return s;
  });
}

// ---------- jogos ----------

// Resultado no formato usado pela simulação: gols/pontos de cada lado, sets e quem venceu.
function doJogoReal(j, esporte) {
  const p = placarEfetivo(j, esporte);
  if (!p) return null;
  const v = vencedor(j, esporte);
  let pa = p.a;
  let pb = p.b;
  if (esporte.sets) {
    if (p.parciais?.length) {
      pa = p.parciais.reduce((s, [x]) => s + x, 0);
      pb = p.parciais.reduce((s, [, y]) => s + y, 0);
    } else if (p.totais) {
      pa = p.totais.a;
      pb = p.totais.b;
    }
  }
  return { a: j.a, b: j.b, sa: p.a, sb: p.b, pa, pb, v, wo: j.res.wo || null };
}

function sortearJogo(a, b, ra, rb, esporte, par, rng, mataMata) {
  const m = ra - rb + par.ruido * normal(rng);
  if (esporte.sets) {
    const folgado = Math.abs(m) > 0.6 * par.ruido;
    const vence = m >= 0 ? 'a' : 'b';
    const pv = folgado ? 50 : 65;
    const pp = Math.max(0, Math.round(pv - Math.abs(m)));
    const [sa, sb] = vence === 'a' ? [2, folgado ? 0 : 1] : [folgado ? 0 : 1, 2];
    return { a, b, sa, sb, pa: vence === 'a' ? pv : pp, pb: vence === 'a' ? pp : pv, v: vence };
  }
  const total = Math.max(0, 2 * par.pontos + 0.5 * par.pontos * normal(rng));
  let pa = Math.max(0, Math.round((total + m) / 2));
  let pb = Math.max(0, Math.round((total - m) / 2));
  if (pa === pb && esporte.semEmpate) {
    // prorrogação
    if (m >= 0) pa += 2;
    else pb += 2;
  }
  let v = pa === pb ? 'empate' : pa > pb ? 'a' : 'b';
  // Mata-mata empatado: pênaltis (ou tiros de 7 m), quase cara ou coroa.
  if (v === 'empate' && mataMata) v = rng() < 0.5 + 0.15 * Math.tanh(m / par.ruido) ? 'a' : 'b';
  return { a, b, sa: pa, sb: pb, pa, pb, v };
}

// Tabela rápida: pontos, vitórias, saldo e gols/pontos pró; o resto do desempate (confronto, cartões,
// sorteio) quase nunca muda uma probabilidade e fica no sorteio.
function tabelaRapida(membros, resultados, esporte, rng) {
  const l = Object.fromEntries(membros.map((id) => [id, { id, j: 0, v: 0, pts: 0, pro: 0, contra: 0, sorte: rng() }]));
  for (const r of resultados) {
    const A = l[r.a];
    const B = l[r.b];
    if (!A && !B) continue;
    if (!A || !B) {
      // Jogo de W.O. contra quem saiu: vale só para quem compareceu.
      const presente = A || B;
      presente.j++;
      presente.v++;
      presente.pts += esporte.sets ? esporte.pontosSets.semPerderSet[0] : esporte.pontos.vitoria;
      presente.pro += A ? r.pa : r.pb;
      presente.contra += A ? r.pb : r.pa;
      continue;
    }
    A.j++;
    B.j++;
    A.pro += r.pa;
    A.contra += r.pb;
    B.pro += r.pb;
    B.contra += r.pa;
    if (r.v === 'empate') {
      A.pts += esporte.pontos?.empate ?? 0;
      B.pts += esporte.pontos?.empate ?? 0;
      continue;
    }
    const [G, P] = r.v === 'a' ? [A, B] : [B, A];
    G.v++;
    if (esporte.sets) {
      const perdeuSet = Math.min(r.sa, r.sb) > 0;
      const [pv, pp] = perdeuSet ? esporte.pontosSets.comSetPerdido : esporte.pontosSets.semPerderSet;
      G.pts += pv;
      P.pts += pp;
    } else {
      G.pts += esporte.pontos.vitoria;
      P.pts += esporte.pontos.derrota ?? 0;
    }
  }
  return Object.values(l).sort(
    (x, y) => y.pts - x.pts || y.v - x.v || y.pro - y.contra - (x.pro - x.contra) || y.pro - x.pro || x.sorte - y.sorte,
  );
}

// Melhor campanha por jogo (para comparar 1º colocados de grupos de tamanhos diferentes).
function melhorCampanha(x, y) {
  const ix = x.j ? [x.pts / x.j, (x.pro - x.contra) / x.j, x.pro / x.j] : [0, 0, 0];
  const iy = y.j ? [y.pts / y.j, (y.pro - y.contra) / y.j, y.pro / y.j] : [0, 0, 0];
  for (let i = 0; i < 3; i++) if (ix[i] !== iy[i]) return iy[i] - ix[i];
  return x.sorte - y.sorte;
}

// ---------- uma modalidade ----------

const mesmoPar = (j, x, y) => (j.a === x && j.b === y) || (j.a === y && j.b === x);

function prepararModalidade(info, zerados) {
  const esporte = info.esporte;
  const base = PARAMETROS[info.m.esporte] || PARAMETROS.futsal;
  const eliminados = new Set(info.wo.keys());
  const grupos = Object.fromEntries(
    Object.entries(info.grupos).map(([letra, membros]) => [letra, membros.filter((id) => !eliminados.has(id))]),
  );
  const times = [...new Set(Object.values(info.grupos).flat())];
  // Média de gols/pontos por time nesta modalidade, quando já há jogos (sem contar W.O.).
  const reais = info.jogos.filter((j) => !j.res?.wo).map((j) => doJogoReal(j, esporte)).filter(Boolean);
  const par = { ...base };
  if (!esporte.sets && reais.length) par.pontos = (reais.reduce((s, r) => s + r.pa + r.pb, 0) / reais.length / 2 + base.pontos) / 2;
  const porFase = (fase) => info.jogos.filter((j) => j.fase === fase && j.a && j.b);
  return {
    mod: info.m.id,
    esporte,
    par,
    repescagem: Boolean(info.m.repescagem),
    grupos,
    eliminados,
    times,
    forcas: estimarForcas(times, info.jogos, esporte, par),
    grupo: porFase('grupo'),
    jogosRepescagem: porFase('repescagem'),
    semis: porFase('semifinal'),
    final: porFase('final')[0] || null,
    zerado: (id) => zerados.has(`${info.m.id}|${id}`),
  };
}

// Um campeonato sorteado: devolve a colocação de cada atlética e até onde ela chegou.
function simularModalidade(p, rng) {
  const r = sortearForcas(p.forcas, rng);
  const forca = (id) => r[p.forcas.idx[id]] ?? 0;
  const { esporte, par } = p;
  const jogar = (lista, x, y, mataMata) => {
    const real = lista.find((j) => mesmoPar(j, x, y));
    const feito = real && doJogoReal(real, esporte);
    if (feito && !(mataMata && feito.v === 'empate')) return feito;
    return sortearJogo(x, y, forca(x), forca(y), esporte, par, rng, mataMata);
  };
  const venceu = (res) => (res.v === 'a' ? res.a : res.b);
  const perdeu = (res) => (res.v === 'a' ? res.b : res.a);

  // Grupos.
  const tabelas = {};
  for (const [letra, membros] of Object.entries(p.grupos)) {
    const resultados = [];
    for (let i = 0; i < membros.length; i++) for (let k = i + 1; k < membros.length; k++) resultados.push(jogar(p.grupo, membros[i], membros[k], false));
    // Jogos de W.O. contra quem saiu continuam valendo para quem compareceu.
    for (const j of p.grupo) {
      const contraQuemSaiu = j.res?.wo && membros.includes(j.a) !== membros.includes(j.b) && (membros.includes(j.a) || membros.includes(j.b));
      if (contraQuemSaiu) resultados.push(doJogoReal(j, esporte));
    }
    tabelas[letra] = tabelaRapida(membros, resultados, esporte, rng);
  }
  const letras = Object.keys(tabelas).filter((l) => tabelas[l].length);
  const lideres = letras.map((l) => tabelas[l][0]).sort(melhorCampanha);

  // Repescagem.
  let repescagem = [];
  let daRepescagem = null;
  let paresSemi;
  if (p.repescagem && letras.length >= 3) {
    const segundos = letras.map((l) => tabelas[l][1]?.id).filter(Boolean);
    const membros = p.jogosRepescagem.length
      ? [...new Set(p.jogosRepescagem.flatMap((j) => [j.a, j.b]))].filter((id) => !p.eliminados.has(id))
      : segundos;
    if (membros.length === 2) {
      const res = jogar(p.jogosRepescagem, membros[0], membros[1], true);
      daRepescagem = venceu(res);
      repescagem = [venceu(res), perdeu(res)];
    } else if (membros.length > 2) {
      const resultados = [];
      for (let i = 0; i < membros.length; i++) for (let k = i + 1; k < membros.length; k++) resultados.push(jogar(p.jogosRepescagem, membros[i], membros[k], false));
      repescagem = tabelaRapida(membros, resultados, esporte, rng).map((l) => l.id);
      daRepescagem = repescagem[0];
    }
    const [s1, s2, s3] = lideres.map((l) => l.id);
    paresSemi = [
      [s1, daRepescagem],
      [s2, s3],
    ];
  } else if (letras.length === 2) {
    const [A, B] = letras.map((l) => tabelas[l]);
    paresSemi = [
      [A[0]?.id, B[1]?.id],
      [B[0]?.id, A[1]?.id],
    ];
  } else {
    // Formato diferente (um grupo só, por exemplo): os quatro melhores, 1º x 4º e 2º x 3º.
    const todos = letras.flatMap((l) => tabelas[l]).sort(melhorCampanha);
    paresSemi = [
      [todos[0]?.id, todos[3]?.id],
      [todos[1]?.id, todos[2]?.id],
    ];
  }
  // Semifinais já lançadas valem como estão; a outra sai de quem sobrou.
  const semisReais = p.semis.map((j) => [j.a, j.b]);
  if (semisReais.length >= 2) paresSemi = semisReais.slice(0, 2);
  else if (semisReais.length === 1) {
    const ocupados = new Set(semisReais[0]);
    const sobra = paresSemi.flat().filter((id) => id && !ocupados.has(id));
    paresSemi = [semisReais[0], sobra.slice(0, 2)];
  }
  paresSemi = paresSemi.filter(([x, y]) => x && y);

  // Semifinal e final.
  const semis = paresSemi.map(([x, y]) => jogar(p.semis, x, y, true));
  let campea = null;
  let vice = null;
  if (semis.length === 2) {
    const [f1, f2] = semis.map(venceu);
    const real = p.final && mesmoPar(p.final, f1, f2) ? [p.final] : [];
    const fin = jogar(real, f1, f2, true);
    campea = venceu(fin);
    vice = perdeu(fin);
  } else if (semis.length === 1) {
    campea = venceu(semis[0]);
    vice = perdeu(semis[0]);
  }

  // Colocação final.
  const ordem = [];
  const ja = new Set();
  const por = (id) => {
    if (id && !ja.has(id)) {
      ja.add(id);
      ordem.push(id);
    }
  };
  por(campea);
  por(vice);
  const perdedores = semis.filter((s) => perdeu(s) !== vice && perdeu(s) !== campea).map(perdeu);
  const derrotadoPelaCampea = semis.find((s) => venceu(s) === campea);
  if (derrotadoPelaCampea) por(perdeu(derrotadoPelaCampea));
  perdedores.forEach(por);
  repescagem.forEach(por);
  // Quem parou nos grupos: pela posição no grupo e depois pela campanha.
  const resto = letras.flatMap((l) => tabelas[l].map((linha, i) => ({ ...linha, pos: i + 1 }))).filter((l) => !ja.has(l.id));
  resto.sort((x, y) => x.pos - y.pos || melhorCampanha(x, y)).forEach((l) => por(l.id));

  return {
    ordem,
    lideres: new Set(letras.map((l) => tabelas[l][0]?.id)),
    repescagem: new Set(repescagem),
    semi: new Set(paresSemi.flat()),
    final: new Set([campea, vice].filter(Boolean)),
    paresSemi,
    parFinal: campea && vice ? [campea, vice] : null,
  };
}

// ---------- o campeonato todo ----------

const nomeDaChance = ['lider', 'repescagem', 'semi', 'final', 'titulo'];

// Modalidades que entram na simulação: coletivas com grupos montados que ainda não têm colocação.
export function modalidadesPrevisiveis(modelo) {
  return MODALIDADES.filter((m) => {
    const info = modelo.modalidades[m.id];
    return m.tipo === 'coletiva' && !info.vigente.length && Object.keys(info.grupos || {}).length > 0;
  }).map((m) => m.id);
}

export function preverCompeticao(modelo, { simulacoes = SIMULACOES, semente = 20261017 } = {}) {
  const rng = geradorAleatorio(semente);
  const ids = modelo.geral.conquistados.map((l) => l.id);
  const atuais = Object.fromEntries(modelo.geral.conquistados.map((l) => [l.id, l.total]));
  const mods = modalidadesPrevisiveis(modelo).map((id) => prepararModalidade(modelo.modalidades[id], modelo.zerados));

  const porMod = {};
  for (const p of mods) {
    porMod[p.mod] = Object.fromEntries(
      p.times.map((id) => [id, { pontos: 0, colocacoes: [], lider: 0, repescagem: 0, semi: 0, final: 0, titulo: 0, rivalSemi: {}, rivalFinal: {} }]),
    );
  }
  const somaTotal = Object.fromEntries(ids.map((id) => [id, 0]));
  const amostras = Object.fromEntries(ids.map((id) => [id, new Float64Array(simulacoes)]));
  const primeiroGeral = Object.fromEntries(ids.map((id) => [id, 0]));
  const podioGeral = Object.fromEntries(ids.map((id) => [id, 0]));
  const posicaoGeral = Object.fromEntries(ids.map((id) => [id, 0]));

  for (let s = 0; s < simulacoes; s++) {
    const total = { ...atuais };
    for (const p of mods) {
      const r = simularModalidade(p, rng);
      const conta = porMod[p.mod];
      r.ordem.forEach((id, i) => {
        const c = conta[id];
        if (!c) return;
        const pts = p.zerado(id) ? 0 : pontosPorColocacao(i + 1);
        c.pontos += pts;
        c.colocacoes[i] = (c.colocacoes[i] || 0) + 1;
        total[id] += pts;
      });
      for (const id of r.lideres) if (conta[id]) conta[id].lider++;
      for (const id of r.repescagem) if (conta[id]) conta[id].repescagem++;
      for (const id of r.semi) if (conta[id]) conta[id].semi++;
      for (const id of r.final) if (conta[id]) conta[id].final++;
      if (r.ordem[0] && conta[r.ordem[0]]) conta[r.ordem[0]].titulo++;
      // Contra quem cada uma jogou a semifinal e a final nesta simulação.
      const anotar = (par, campo) => {
        const [x, y] = par;
        if (conta[x]) conta[x][campo][y] = (conta[x][campo][y] || 0) + 1;
        if (conta[y]) conta[y][campo][x] = (conta[y][campo][x] || 0) + 1;
      };
      r.paresSemi.forEach((par) => anotar(par, 'rivalSemi'));
      if (r.parFinal) anotar(r.parFinal, 'rivalFinal');
    }
    // Posição na geral desta simulação (empate em pontos: sorteio, aproximando o desempate do Art. 15).
    const fila = ids.map((id) => ({ id, t: total[id], sorte: rng() })).sort((x, y) => y.t - x.t || x.sorte - y.sorte);
    fila.forEach((l, i) => {
      posicaoGeral[l.id] += i + 1;
      if (i === 0) primeiroGeral[l.id]++;
      if (i < 3) podioGeral[l.id]++;
    });
    for (const id of ids) {
      somaTotal[id] += total[id];
      amostras[id][s] = total[id];
    }
  }

  const modalidades = {};
  for (const p of mods) {
    modalidades[p.mod] = Object.fromEntries(
      Object.entries(porMod[p.mod]).map(([id, c]) => [
        id,
        {
          pontos: c.pontos / simulacoes,
          colocacoes: Array.from({ length: p.times.length }, (_, i) => (c.colocacoes[i] || 0) / simulacoes),
          ...Object.fromEntries(nomeDaChance.map((k) => [k, c[k] / simulacoes])),
          // Adversários mais prováveis: chance de a semifinal (ou a final) ser contra cada uma.
          rivalSemi: Object.fromEntries(Object.entries(c.rivalSemi).map(([r, n]) => [r, n / simulacoes])),
          rivalFinal: Object.fromEntries(Object.entries(c.rivalFinal).map(([r, n]) => [r, n / simulacoes])),
          eliminada: p.eliminados.has(id),
        },
      ]),
    );
  }
  const percentil = (lista, q) => lista[Math.min(lista.length - 1, Math.floor(q * lista.length))];
  const geral = ids
    .map((id) => {
      const ordenadas = Array.from(amostras[id]).sort((x, y) => x - y);
      return {
        id,
        atuais: atuais[id],
        esperados: somaTotal[id] / simulacoes,
        faixa: simulacoes ? [percentil(ordenadas, 0.1), percentil(ordenadas, 0.9)] : [atuais[id], atuais[id]],
        titulo: primeiroGeral[id] / simulacoes,
        podio: podioGeral[id] / simulacoes,
        posicaoMedia: posicaoGeral[id] / simulacoes,
      };
    })
    .sort((x, y) => y.esperados - x.esperados || x.posicaoMedia - y.posicaoMedia)
    .map((l, i) => ({ ...l, posicao: i + 1 }));

  return { simulacoes, modalidades, geral, simuladas: mods.map((p) => p.mod) };
}

// O modelo é refeito a cada mudança; a previsão de um mesmo modelo é calculada uma vez só.
const cache = new WeakMap();
export function previsaoDoModelo(modelo) {
  if (!cache.has(modelo)) cache.set(modelo, preverCompeticao(modelo));
  return cache.get(modelo);
}

// A que já foi calculada para este modelo, sem calcular (undefined se ainda não há).
export function previsaoGuardada(modelo) {
  return cache.get(modelo);
}
