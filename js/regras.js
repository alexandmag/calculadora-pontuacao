// Regras de pontuação do INTERPUC Minas 11ª Edição (2026).
// Tudo aqui é cálculo puro: recebe dados e devolve resultados, sem tocar na tela nem no banco.
// Os comentários citam o artigo: "RG" é o regulamento geral e "A1" é o Anexo 1 (regulamento específico).

// RG Art. 13 e A1 Arts. 41, 52, 66, 76, 89 e 94: pontos do 1º ao 8º lugar.
export const PONTOS_COLOCACAO = [12, 9, 7, 5, 4, 3, 2, 1];

export const PERDA_WO = -12; // RG Art. 27
export const PERDA_FRAUDE = -80; // RG Art. 23

export function pontosPorColocacao(posicao, peso = 1) {
  return (PONTOS_COLOCACAO[posicao - 1] ?? 0) * peso;
}

// Pontuação da fase de grupos e critérios de desempate de cada esporte coletivo.
export const ESPORTES = {
  futsal: {
    nome: 'Futsal',
    pontos: { vitoria: 3, empate: 1, derrota: 0 }, // A1 Art. 16
    placarWO: [1, 0], // A1 Art. 14 §5º
    desempate: ['vitorias', 'saldo', 'confronto', 'pro', 'contra', 'vermelhos', 'amarelos'],
    cartoes: ['vermelhos', 'amarelos'],
    decisao: 'pênaltis', // A1 Art. 15 §2º
  },
  futebol: {
    nome: 'Futebol de Campo',
    pontos: { vitoria: 3, empate: 1, derrota: 0 }, // A1 Art. 36
    placarWO: [3, 0], // A1 Art. 32 §5º
    desempate: ['vitorias', 'saldo', 'confronto', 'pro', 'contra', 'vermelhos', 'amarelos'],
    cartoes: ['vermelhos', 'amarelos'],
    decisao: 'pênaltis', // A1 Art. 35
  },
  handebol: {
    nome: 'Handebol',
    pontos: { vitoria: 2, empate: 1, derrota: 0 }, // A1 Art. 10
    placarWO: [15, 0], // A1 Art. 8 §5º
    desempate: ['vitorias', 'saldo', 'confronto', 'contra', 'pro', 'vermelhos'],
    cartoes: ['vermelhos'],
    decisao: 'tiros de 7 metros', // A1 Art. 9
  },
  basquete: {
    nome: 'Basquete',
    pontos: { vitoria: 1, derrota: 0 }, // A1 Art. 22
    semEmpate: true, // A1 Art. 21: prorrogação até sair um vencedor
    placarWO: [20, 0], // A1 Art. 20 §5º
    desempate: ['vitorias', 'saldo', 'confronto', 'pro', 'contra'],
    cartoes: [],
  },
  volei: {
    nome: 'Vôlei',
    sets: true,
    pontosSets: { semPerderSet: [3, 0], comSetPerdido: [2, 1] }, // A1 Art. 28
    parciaisWO: [[25, 0], [25, 0]], // A1 Art. 26 §2º
    desempate: ['vitorias', 'saldo', 'confronto', 'pro', 'contra'],
    cartoes: [],
  },
  peteca: {
    nome: 'Peteca',
    sets: true,
    // O regulamento não define pontos de grupo nem desempate da peteca: usamos os do vôlei.
    pontosSets: { semPerderSet: [3, 0], comSetPerdido: [2, 1] },
    parciaisWO: [[21, 0], [21, 0]],
    desempate: ['vitorias', 'saldo', 'confronto', 'pro', 'contra'],
    cartoes: [],
    semRegraPropria: true,
  },
};

// Fases das coletivas na ordem em que acontecem.
export const ORDEM_FASES = ['grupo', 'repescagem', 'semifinal', 'final'];

// Parciais de sets chegam do banco como [{ a, b }] (o Firestore não guarda lista dentro de lista).
function normalizarParciais(parciais) {
  if (!Array.isArray(parciais) || parciais.length === 0) return null;
  return parciais.map((s) => (Array.isArray(s) ? s : [s.a, s.b]));
}

// Placar que vale para a tabela: o informado ou, em caso de W.O., o placar definido no Anexo 1.
export function placarEfetivo(jogo, esporte) {
  const r = jogo.res;
  if (!r) return null;
  if (r.wo === 'a' || r.wo === 'b') {
    const venceA = r.wo === 'b';
    if (esporte.sets) {
      const parciais = esporte.parciaisWO.map(([v, p]) => (venceA ? [v, p] : [p, v]));
      return { a: venceA ? 2 : 0, b: venceA ? 0 : 2, parciais };
    }
    const [v, p] = esporte.placarWO;
    return { a: venceA ? v : p, b: venceA ? p : v };
  }
  if (!Number.isFinite(r.a) || !Number.isFinite(r.b)) return null;
  // totais: pontos somados de todos os sets, quando só se sabe o total (o site oficial mostra assim).
  const totais = r.totais && Number.isFinite(r.totais.a) && Number.isFinite(r.totais.b) ? r.totais : null;
  return { a: r.a, b: r.b, parciais: normalizarParciais(r.parciais), totais, penaltis: r.penaltis || null };
}

// 'a', 'b', 'empate' ou null (jogo sem resultado). Fora dos grupos o empate se decide nos pênaltis.
export function vencedor(jogo, esporte) {
  const p = placarEfetivo(jogo, esporte);
  if (!p) return null;
  if (p.a !== p.b) return p.a > p.b ? 'a' : 'b';
  const pen = p.penaltis;
  if (pen && Number.isFinite(pen.a) && Number.isFinite(pen.b) && pen.a !== pen.b) return pen.a > pen.b ? 'a' : 'b';
  return 'empate';
}

// RG Art. 27: quem dá W.O. sai da modalidade e não soma pontos nela.
// Devolve um Map atlética → 'normal' | 'tecnico'.
export function woNaModalidade(jogos) {
  const mapa = new Map();
  for (const j of jogos) {
    const r = j.res;
    if (!r || (r.wo !== 'a' && r.wo !== 'b')) continue;
    const ausente = r.wo === 'a' ? j.a : j.b;
    const tipo = r.woTipo === 'tecnico' ? 'tecnico' : 'normal';
    if (mapa.get(ausente) !== 'normal') mapa.set(ausente, tipo);
  }
  return mapa;
}

function linhaVazia(id) {
  return { id, j: 0, v: 0, e: 0, d: 0, pts: 0, pro: 0, contra: 0, setsPro: 0, setsContra: 0, vermelhos: 0, amarelos: 0 };
}

function somarJogo(linhas, jogo, esporte) {
  const p = placarEfetivo(jogo, esporte);
  const A = linhas[jogo.a];
  const B = linhas[jogo.b];
  if (!p || !A || !B) return { semParciais: false };
  A.j++;
  B.j++;
  if (esporte.sets) {
    A.setsPro += p.a;
    A.setsContra += p.b;
    B.setsPro += p.b;
    B.setsContra += p.a;
    const temParciais = Array.isArray(p.parciais) && p.parciais.length > 0;
    if (temParciais) {
      for (const [x, y] of p.parciais) {
        A.pro += x;
        A.contra += y;
        B.pro += y;
        B.contra += x;
      }
    } else if (p.totais) {
      A.pro += p.totais.a;
      A.contra += p.totais.b;
      B.pro += p.totais.b;
      B.contra += p.totais.a;
    }
    if (p.a !== p.b) {
      const [ganha, perde] = p.a > p.b ? [A, B] : [B, A];
      const perdeuSet = Math.min(p.a, p.b) > 0;
      const [pv, pp] = perdeuSet ? esporte.pontosSets.comSetPerdido : esporte.pontosSets.semPerderSet;
      ganha.v++;
      perde.d++;
      ganha.pts += pv;
      perde.pts += pp;
    }
    return { semParciais: !temParciais && !p.totais };
  }
  A.pro += p.a;
  A.contra += p.b;
  B.pro += p.b;
  B.contra += p.a;
  if (p.a === p.b) {
    A.e++;
    B.e++;
    A.pts += esporte.pontos.empate ?? 0;
    B.pts += esporte.pontos.empate ?? 0;
  } else {
    const [ganha, perde] = p.a > p.b ? [A, B] : [B, A];
    ganha.v++;
    perde.d++;
    ganha.pts += esporte.pontos.vitoria;
    perde.pts += esporte.pontos.derrota;
  }
  const c = jogo.res?.cartoes;
  if (c && !jogo.res.wo) {
    A.vermelhos += c.va || 0;
    B.vermelhos += c.vb || 0;
    A.amarelos += c.aa || 0;
    B.amarelos += c.ab || 0;
  }
  return { semParciais: false };
}

// Valor de cada critério: quanto maior, melhor ("menos gols sofridos" vira número negativo).
const VALOR = {
  pontos: (l) => l.pts,
  vitorias: (l) => l.v,
  saldo: (l) => l.pro - l.contra,
  pro: (l) => l.pro,
  contra: (l) => -l.contra,
  vermelhos: (l) => -l.vermelhos,
  amarelos: (l) => -l.amarelos,
};

// Separa os times critério a critério, na ordem do regulamento. Devolve blocos do melhor para o pior;
// um bloco com mais de um time segue empatado (o último critério de todos os esportes é o sorteio).
export function desempatar(ids, criterios, linhas, jogos, esporte) {
  if (ids.length < 2 || criterios.length === 0) return [ids];
  const [criterio, ...resto] = criterios;
  const valor = criterio === 'confronto' ? pontosNoConfronto(ids, jogos, esporte) : (id) => VALOR[criterio](linhas[id]);
  const blocos = new Map();
  for (const id of ids) {
    const v = valor(id);
    if (!blocos.has(v)) blocos.set(v, []);
    blocos.get(v).push(id);
  }
  return [...blocos.keys()]
    .sort((x, y) => y - x)
    .flatMap((v) => desempatar(blocos.get(v), resto, linhas, jogos, esporte));
}

// Confronto direto: pontos somados só nos jogos entre os times empatados.
function pontosNoConfronto(ids, jogos, esporte) {
  const linhas = Object.fromEntries(ids.map((id) => [id, linhaVazia(id)]));
  for (const j of jogos) if (linhas[j.a] && linhas[j.b]) somarJogo(linhas, j, esporte);
  return (id) => linhas[id].pts;
}

// RG Art. 27: os resultados de quem deu W.O. são cancelados, mas o jogo do W.O. vale para o adversário.
function valeParaTabela(jogo, eliminados) {
  const saiuA = eliminados.has(jogo.a);
  const saiuB = eliminados.has(jogo.b);
  if (!saiuA && !saiuB) return true;
  const wo = jogo.res?.wo;
  if (wo !== 'a' && wo !== 'b') return false;
  const ausenteSaiu = wo === 'a' ? saiuA : saiuB;
  const presenteSaiu = wo === 'a' ? saiuB : saiuA;
  return ausenteSaiu && !presenteSaiu;
}

// Tabela de um grupo com a pontuação e os critérios de desempate do esporte (Anexo 1).
// fase: 'grupo' ou 'repescagem' (a repescagem também é disputada em grupo, todos contra todos).
export function tabelaGrupo(membros, jogos, esporte, eliminados = new Set(), fase = 'grupo') {
  const linhas = Object.fromEntries(membros.map((id) => [id, linhaVazia(id)]));
  const validos = jogos.filter(
    (j) => j.fase === fase && linhas[j.a] && linhas[j.b] && placarEfetivo(j, esporte) && valeParaTabela(j, eliminados),
  );
  let semParciais = false;
  for (const j of validos) semParciais = somarJogo(linhas, j, esporte).semParciais || semParciais;
  const ativos = membros.filter((id) => !eliminados.has(id));
  const blocos = desempatar(ativos, ['pontos', ...esporte.desempate], linhas, validos, esporte);
  const tabela = [];
  for (const bloco of blocos) {
    const empatado = bloco.length > 1 && bloco.some((id) => linhas[id].j > 0);
    for (const id of bloco) tabela.push({ ...linhas[id], posicao: tabela.length + 1, empatado });
  }
  for (const id of membros) if (eliminados.has(id)) tabela.push({ ...linhas[id], posicao: null, eliminado: true });
  return { tabela, semParciais: Boolean(esporte.sets && semParciais) };
}

// Até onde cada time chegou. Número menor = melhor colocação. Os valores "quebrados" são de quem
// ainda está vivo naquela fase (ex.: 2,5 = está na semifinal e pode terminar entre 1º e 4º).
export const ETAPA = {
  campea: 1,
  finalista: 1.5,
  vice: 2,
  semifinalista: 2.5,
  semifinal: 3,
  naRepescagem: 4.5,
  repescagem: 5,
  grupos: 20,
  wo: 99,
};

export const NOME_ETAPA = {
  [ETAPA.campea]: 'Campeã',
  [ETAPA.finalista]: 'Na final',
  [ETAPA.vice]: 'Vice-campeã',
  [ETAPA.semifinalista]: 'Na semifinal',
  [ETAPA.semifinal]: 'Parou na semifinal',
  [ETAPA.naRepescagem]: 'Na repescagem',
  [ETAPA.repescagem]: 'Parou na repescagem',
  [ETAPA.grupos]: 'Fase de grupos',
  [ETAPA.wo]: 'Eliminada por W.O.',
};

// Caminho das coletivas: grupos → repescagem (em algumas) → semifinal → final. Não há oitavas nem quartas.
function etapaNoJogo(fase, situacao) {
  const venceu = situacao === 'venceu';
  const perdeu = situacao === 'perdeu';
  switch (fase) {
    case 'final':
      return venceu ? ETAPA.campea : perdeu ? ETAPA.vice : ETAPA.finalista;
    case 'semifinal':
      return venceu ? ETAPA.finalista : perdeu ? ETAPA.semifinal : ETAPA.semifinalista;
    case 'repescagem':
      return venceu ? ETAPA.semifinalista : perdeu ? ETAPA.repescagem : ETAPA.naRepescagem;
    default:
      return ETAPA.grupos;
  }
}

// Campanha na fase de grupos, por jogo, para comparar times de grupos de tamanhos diferentes.
function indiceCampanha(l) {
  if (!l || !l.j) return [0, 0, 0];
  return [l.pts / l.j, (l.pro - l.contra) / l.j, l.pro / l.j];
}

export function compararCampanha(x, y) {
  const a = indiceCampanha(x);
  const b = indiceCampanha(y);
  for (let i = 0; i < a.length; i++) if (b[i] !== a[i]) return b[i] - a[i];
  return 0;
}

// Classificação calculada de uma modalidade coletiva (grupos → repescagem → semifinal → final, sem
// disputa de 3º lugar), seguindo a regra usada pela CO:
// - a final define campeã e vice;
// - na semifinal, quem perdeu para a campeã é 3º e quem perdeu para a vice é 4º;
// - quem não venceu a repescagem (disputada em grupo) vem logo depois, na ordem da tabela da repescagem;
// - quem não passou dos grupos é ordenado pela posição no grupo e depois pela campanha;
// - enquanto uma fase não termina, quem segue vivo é ordenado pela campanha nos grupos (projeção).
// vagasDiretas: quantos de cada grupo vão direto para a semifinal (1 com repescagem, 2 sem). Assim
// que a fase final começa, eles já contam como semifinalistas, mesmo antes de a semi ser lançada.
// O RG Art. 16 deixa a forma de disputa para o regulamento específico; é uma projeção até a CO
// divulgar a classificação oficial.
export function classificacaoColetiva({ grupos, jogos, esporte, vagasDiretas = 0 }) {
  const wo = woNaModalidade(jogos);
  const eliminados = new Set(wo.keys());
  const participantes = new Set([...Object.values(grupos).flat(), ...jogos.flatMap((j) => [j.a, j.b])]);
  participantes.delete(undefined);
  participantes.delete('');

  const tabelas = {};
  const posGrupo = {};
  const campanha = {};
  for (const [nome, membros] of Object.entries(grupos)) {
    if (!membros.length) continue;
    const t = tabelaGrupo(membros, jogos, esporte, eliminados);
    tabelas[nome] = t;
    for (const l of t.tabela) {
      posGrupo[l.id] = l.posicao ?? 99;
      campanha[l.id] = l;
    }
  }

  const etapa = {};
  const eliminadaPor = {};
  const posRepescagem = {};
  const naFase = (fase) => jogos.filter((j) => j.fase === fase && j.a && j.b);
  const repescagem = naFase('repescagem');
  const mataMata = [...naFase('semifinal'), ...naFase('final')];
  const faseFinalComecou = repescagem.length > 0 || mataMata.length > 0;
  for (const id of participantes) {
    etapa[id] = faseFinalComecou && (posGrupo[id] ?? 99) <= vagasDiretas ? ETAPA.semifinalista : ETAPA.grupos;
  }

  // Repescagem: no site da CO é uma tabela, todos contra todos entre quem chegou nela (os 2º colocados).
  // O líder vai à semifinal; os outros param ali, na ordem da tabela. Com dois times é um jogo só.
  let tabelaRepescagem = null;
  if (repescagem.length) {
    const membros = [...new Set(repescagem.flatMap((j) => [j.a, j.b]))].filter((id) => !eliminados.has(id));
    if (membros.length === 2) {
      const [x, y] = membros;
      const v = vencedor(repescagem[0], esporte);
      for (const lado of ['a', 'b']) {
        const id = repescagem[0][lado];
        const situacao = v === null || v === 'empate' ? 'pendente' : v === lado ? 'venceu' : 'perdeu';
        etapa[id] = etapaNoJogo('repescagem', situacao);
        if (situacao === 'perdeu') posRepescagem[id] = 2;
      }
      tabelaRepescagem = tabelaGrupo([x, y], jogos, esporte, eliminados, 'repescagem');
    } else {
      tabelaRepescagem = tabelaGrupo(membros, jogos, esporte, eliminados, 'repescagem');
      const jogaram = (x, y) => repescagem.some((j) => ((j.a === x && j.b === y) || (j.a === y && j.b === x)) && placarEfetivo(j, esporte));
      const completa = membros.every((x, i) => membros.slice(i + 1).every((y) => jogaram(x, y)));
      for (const l of tabelaRepescagem.tabela) {
        if (!l.posicao) continue;
        if (!completa) etapa[l.id] = ETAPA.naRepescagem;
        else if (l.posicao === 1) etapa[l.id] = ETAPA.semifinalista;
        else {
          etapa[l.id] = ETAPA.repescagem;
          posRepescagem[l.id] = l.posicao;
        }
      }
    }
  }

  for (const j of mataMata) {
    const v = vencedor(j, esporte);
    for (const lado of ['a', 'b']) {
      const situacao = v === null || v === 'empate' ? 'pendente' : v === lado ? 'venceu' : 'perdeu';
      etapa[j[lado]] = etapaNoJogo(j.fase, situacao);
      if (situacao === 'perdeu') eliminadaPor[j[lado]] = j[lado === 'a' ? 'b' : 'a'];
      else delete eliminadaPor[j[lado]];
    }
  }
  for (const id of eliminados) if (participantes.has(id)) etapa[id] = ETAPA.wo;

  // Monta a fila de cima para baixo. Quem eliminou alguém foi mais longe, então já tem lugar
  // na fila quando chega a vez de ordenar quem perdeu para ela.
  const lugar = {};
  const desempate = (x, y) => {
    if (etapa[x] === ETAPA.grupos && (posGrupo[x] ?? 99) !== (posGrupo[y] ?? 99)) return (posGrupo[x] ?? 99) - (posGrupo[y] ?? 99);
    if (etapa[x] === ETAPA.repescagem && (posRepescagem[x] ?? 99) !== (posRepescagem[y] ?? 99)) return (posRepescagem[x] ?? 99) - (posRepescagem[y] ?? 99);
    const porQuemX = lugar[eliminadaPor[x]] ?? Infinity;
    const porQuemY = lugar[eliminadaPor[y]] ?? Infinity;
    if (porQuemX !== porQuemY) return porQuemX - porQuemY;
    return compararCampanha(campanha[x], campanha[y]);
  };
  const ordenados = [];
  for (const valor of [...new Set(Object.values(etapa))].sort((x, y) => x - y)) {
    for (const id of [...participantes].filter((p) => etapa[p] === valor).sort(desempate)) {
      lugar[id] = ordenados.length;
      ordenados.push(id);
    }
  }
  // Só marca empate entre quem já jogou: no começo todo mundo está "empatado" em zero.
  const jogou = (id) => (campanha[id]?.j || 0) > 0 || etapa[id] !== ETAPA.grupos;
  const empataCom = (x, y) => y !== undefined && etapa[x] === etapa[y] && jogou(x) && jogou(y) && desempate(x, y) === 0;
  let posicao = 0;
  const ordem = ordenados.map((id, i) => {
    const saiu = etapa[id] === ETAPA.wo;
    const empatado = !saiu && (empataCom(id, ordenados[i - 1]) || empataCom(id, ordenados[i + 1]));
    return { id, posicao: saiu ? null : ++posicao, etapa: etapa[id], empatado, eliminadoWO: saiu ? wo.get(id) : null };
  });

  const final = jogos.find((j) => j.fase === 'final');
  const encerrada = Boolean(final && ['a', 'b'].includes(vencedor(final, esporte)));
  return { ordem, tabelas, tabelaRepescagem, wo, encerrada };
}

function compararPorColocacoes(x, y) {
  if (y.pts !== x.pts) return y.pts - x.pts;
  for (let i = 0; i < 8; i++) if (y.colocacoes[i] !== x.colocacoes[i]) return y.colocacoes[i] - x.colocacoes[i];
  return 0;
}

// Atletismo, natação, tênis e lutas: cada prova (ou chave, ou categoria de peso) dá 12, 9, 7... do 1º ao
// 8º lugar, e os revezamentos valem em dobro (A1 Arts. 43 e 54). A soma por atlética define a
// classificação da modalidade; o empate se resolve pelo maior número de 1º lugares, depois de 2º, e
// assim por diante (A1 Arts. 42, 53, 67, 77, 90 e 95).
// Quem passa do limite de atletas numa prova fica com zero nela (A1 Arts. 38 e 49).
export function pontuacaoProvas(provas, resultados) {
  const linhas = {};
  const avisos = [];
  const linha = (id) => (linhas[id] ??= { id, pts: 0, colocacoes: [0, 0, 0, 0, 0, 0, 0, 0], porProva: {} });
  for (const prova of provas) {
    const entradas = (resultados[prova.id] || []).filter((e) => e.at && e.pos >= 1);
    const quantas = {};
    for (const e of entradas) quantas[e.at] = (quantas[e.at] || 0) + 1;
    const limite = prova.max ?? 2;
    for (const e of entradas) {
      const l = linha(e.at);
      if (quantas[e.at] > limite) continue;
      const pts = pontosPorColocacao(e.pos, prova.peso ?? 1);
      l.pts += pts;
      l.porProva[prova.id] = (l.porProva[prova.id] || 0) + pts;
      if (e.pos <= 8) l.colocacoes[e.pos - 1]++;
    }
    for (const [at, n] of Object.entries(quantas)) if (n > limite) avisos.push({ prova: prova.id, at, limite });
  }
  const pontuaram = Object.values(linhas)
    .filter((l) => l.pts > 0)
    .sort(compararPorColocacoes);
  const ordem = pontuaram.map((l, i) => ({
    ...l,
    posicao: i + 1,
    empatado:
      (i > 0 && compararPorColocacoes(pontuaram[i - 1], l) === 0) ||
      (i < pontuaram.length - 1 && compararPorColocacoes(l, pontuaram[i + 1]) === 0),
  }));
  const semPontos = Object.values(linhas).filter((l) => l.pts === 0);
  return { ordem, semPontos, avisos };
}

function compararGeral(x, y) {
  if (y.total !== x.total) return y.total - x.total;
  // RG Art. 15: maior número de 1º lugares, depois 2º, ... até o 11º. O 12º critério é sorteio.
  for (let i = 0; i < 11; i++) if (y.colocacoes[i] !== x.colocacoes[i]) return y.colocacoes[i] - x.colocacoes[i];
  return 0;
}

// RG Arts. 13 a 15: soma os pontos de colocação de todas as modalidades, aplica as perdas
// (W.O., fraude e outras punições) e ordena com os critérios de desempate.
// classificacoes: [{ mod, ordem: [{ id, posicao }] }]
// zerados: Set com `${mod}|${atlética}` de quem não soma pontos na modalidade (W.O. ou fraude)
// ajustes: [{ id, pontos, motivo, mod }] com os pontos perdidos (números negativos)
export function classificacaoGeral({ atleticas, classificacoes, zerados = new Set(), ajustes = [] }) {
  const linhas = Object.fromEntries(
    atleticas.map((id) => [id, { id, pontosModalidades: 0, perdas: 0, colocacoes: Array(13).fill(0), detalhe: [], ajustes: [] }]),
  );
  for (const { mod, ordem } of classificacoes) {
    for (const { id, posicao } of ordem) {
      const l = linhas[id];
      if (!l || !posicao) continue;
      const zerado = zerados.has(`${mod}|${id}`);
      const pontos = zerado ? 0 : pontosPorColocacao(posicao);
      l.detalhe.push({ mod, posicao, pontos, zerado });
      if (zerado) continue;
      l.pontosModalidades += pontos;
      if (posicao <= 13) l.colocacoes[posicao - 1]++;
    }
  }
  for (const a of ajustes) {
    const l = linhas[a.id];
    if (!l) continue;
    l.perdas += a.pontos;
    l.ajustes.push(a);
  }
  const lista = Object.values(linhas).map((l) => ({ ...l, total: l.pontosModalidades + l.perdas }));
  lista.sort(compararGeral);
  const temDados = (l) => l.detalhe.length > 0 || l.ajustes.length > 0;
  return lista.map((l, i) => ({
    ...l,
    posicao: i + 1,
    empatado:
      temDados(l) &&
      ((i > 0 && compararGeral(lista[i - 1], l) === 0) || (i < lista.length - 1 && compararGeral(l, lista[i + 1]) === 0)),
  }));
}
