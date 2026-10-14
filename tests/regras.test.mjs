import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESPORTES,
  ETAPA,
  classificacaoColetiva,
  classificacaoGeral,
  placarEfetivo,
  pontosPorColocacao,
  pontuacaoProvas,
  tabelaGrupo,
  woNaModalidade,
} from '../js/regras.js';

let seq = 0;
const jogo = (a, b, res, fase = 'grupo') => ({ id: `j${++seq}`, fase, a, b, res });
const placar = (a, b, extra = {}) => ({ a, b, ...extra });
const ordemDe = (tabela) => tabela.map((l) => l.id);

test('RG Art. 13: 12, 9, 7, 5, 4, 3, 2, 1 do 1º ao 8º e nada depois', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 13].map((p) => pontosPorColocacao(p)), [12, 9, 7, 5, 4, 3, 2, 1, 0, 0]);
  assert.equal(pontosPorColocacao(1, 2), 24, 'revezamento vale em dobro');
});

test('W.O. usa o placar do Anexo 1 de cada esporte', () => {
  assert.deepEqual(placarEfetivo(jogo('x', 'y', { wo: 'b' }), ESPORTES.handebol), { a: 15, b: 0 });
  assert.deepEqual(placarEfetivo(jogo('x', 'y', { wo: 'a' }), ESPORTES.basquete), { a: 0, b: 20 });
  assert.deepEqual(placarEfetivo(jogo('x', 'y', { wo: 'a' }), ESPORTES.volei), {
    a: 0,
    b: 2,
    parciais: [
      [0, 25],
      [0, 25],
    ],
  });
});

test('futsal: 3 por vitória, 1 por empate; confronto direto desempata depois do saldo', () => {
  const jogos = [
    jogo('A', 'B', placar(2, 1)),
    jogo('C', 'D', placar(0, 0)),
    jogo('A', 'C', placar(1, 1)),
    jogo('B', 'D', placar(3, 0)),
    jogo('A', 'D', placar(0, 2)),
    jogo('B', 'C', placar(1, 0)),
  ];
  const { tabela } = tabelaGrupo(['A', 'B', 'C', 'D'], jogos, ESPORTES.futsal);
  // A e D: 4 pontos, 1 vitória e saldo -1; D venceu o confronto direto.
  assert.deepEqual(ordemDe(tabela), ['B', 'D', 'A', 'C']);
  assert.deepEqual(
    tabela.map((l) => l.pts),
    [6, 4, 4, 2],
  );
  assert.ok(tabela.every((l) => !l.empatado));
});

test('basquete: vitória vale 1 e derrota 0', () => {
  const { tabela } = tabelaGrupo(['A', 'B'], [jogo('A', 'B', placar(70, 64))], ESPORTES.basquete);
  assert.deepEqual(
    tabela.map((l) => [l.id, l.pts]),
    [
      ['A', 1],
      ['B', 0],
    ],
  );
});

test('vôlei: 2x0 vale 3 a 0 e 2x1 vale 2 a 1; saldo usa os pontos das parciais', () => {
  const jogos = [
    jogo('A', 'B', placar(2, 0, { parciais: [[25, 20], [25, 18]] })),
    jogo('B', 'C', placar(2, 1, { parciais: [[25, 20], [20, 25], [15, 10]] })),
    jogo('C', 'A', placar(2, 1, { parciais: [[25, 23], [23, 25], [15, 13]] })),
  ];
  const { tabela, semParciais } = tabelaGrupo(['A', 'B', 'C'], jogos, ESPORTES.volei);
  assert.deepEqual(
    tabela.map((l) => [l.id, l.pts]),
    [
      ['A', 4],
      ['C', 3],
      ['B', 2],
    ],
  );
  const a = tabela.find((l) => l.id === 'A');
  assert.equal(a.pro, 111);
  assert.equal(a.contra, 101);
  assert.equal(semParciais, false);
});

test('vôlei: parciais no formato gravado no banco ({ a, b }) contam igual', () => {
  const jogos = [jogo('A', 'B', placar(2, 1, { parciais: [{ a: 25, b: 20 }, { a: 18, b: 25 }, { a: 15, b: 12 }] }))];
  const { tabela } = tabelaGrupo(['A', 'B'], jogos, ESPORTES.volei);
  assert.deepEqual(
    tabela.map((l) => [l.id, l.pts, l.pro - l.contra]),
    [
      ['A', 2, 1],
      ['B', 1, -1],
    ],
  );
});

test('coletiva: quem ainda não jogou não aparece como empatado', () => {
  const grupos = { A: ['a1', 'a2'], B: ['b1', 'b2'] };
  const r = classificacaoColetiva({ grupos, jogos: [jogo('a1', 'a2', placar(1, 0))], esporte: ESPORTES.futsal });
  assert.ok(r.ordem.every((l) => !l.empatado));
});

test('RG Art. 27: quem dá W.O. sai da tabela, seus jogos são cancelados e o W.O. vale para o adversário', () => {
  const jogos = [
    jogo('A', 'B', placar(3, 0)),
    jogo('C', 'B', { wo: 'b' }),
    jogo('A', 'D', placar(1, 1)),
  ];
  const eliminados = new Set(woNaModalidade(jogos).keys());
  const { tabela } = tabelaGrupo(['A', 'B', 'C', 'D'], jogos, ESPORTES.futsal, eliminados);
  assert.deepEqual(ordemDe(tabela), ['C', 'A', 'D', 'B']);
  assert.equal(tabela[0].pts, 3, 'C ganha o jogo do W.O.');
  assert.equal(tabela[1].pts, 1, 'a vitória de A sobre B foi cancelada');
  assert.ok(tabela[1].empatado && tabela[2].empatado, 'A e D seguem empatados até o sorteio');
  assert.equal(tabela[3].eliminado, true);
  assert.equal(tabela[3].posicao, null);
});

test('W.O. técnico também tira a atlética da modalidade', () => {
  const mapa = woNaModalidade([jogo('A', 'B', { wo: 'a', woTipo: 'tecnico' }), jogo('C', 'D', { wo: 'b' })]);
  assert.equal(mapa.get('A'), 'tecnico');
  assert.equal(mapa.get('D'), 'normal');
});

test('coletiva: 3º é quem perdeu a semifinal para a campeã e 4º quem perdeu para a vice', () => {
  const grupos = { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'] };
  const jogos = [
    jogo('a1', 'a2', placar(2, 0)),
    jogo('a1', 'a3', placar(1, 0)),
    jogo('a2', 'a3', placar(3, 1)),
    jogo('b1', 'b2', placar(1, 0)),
    jogo('b1', 'b3', placar(2, 2)),
    jogo('b3', 'b2', placar(2, 0)),
    jogo('a1', 'b1', placar(2, 1), 'semifinal'),
    jogo('b3', 'a2', placar(1, 1, { penaltis: { a: 4, b: 3 } }), 'semifinal'),
    jogo('a1', 'b3', placar(0, 2), 'final'),
  ];
  const r = classificacaoColetiva({ grupos, jogos, esporte: ESPORTES.futsal });
  // b1 fez campanha melhor nos grupos que a2, mas a2 perdeu para a campeã (b3) e b1 para a vice (a1).
  assert.deepEqual(
    r.ordem.map((l) => [l.id, l.posicao]),
    [
      ['b3', 1],
      ['a1', 2],
      ['a2', 3],
      ['b1', 4],
      ['a3', 5],
      ['b2', 6],
    ],
  );
  assert.equal(r.encerrada, true);
  assert.equal(r.ordem[0].etapa, ETAPA.campea);
  assert.ok(r.ordem.every((l) => !l.empatado));
});

test('coletiva com repescagem: grupos → repescagem → semifinal → final', () => {
  // 3 grupos de 3, como o handebol masculino: os líderes e o vencedor da repescagem vão à semifinal.
  const grupos = { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'], C: ['c1', 'c2', 'c3'] };
  const jogos = [
    jogo('a1', 'a2', placar(1, 0)),
    jogo('a1', 'a3', placar(1, 0)),
    jogo('a2', 'a3', placar(2, 1)),
    jogo('b1', 'b2', placar(1, 0)),
    jogo('b1', 'b3', placar(1, 0)),
    jogo('b2', 'b3', placar(2, 0)),
    jogo('c1', 'c2', placar(1, 0)),
    jogo('c1', 'c3', placar(3, 0)),
    jogo('c2', 'c3', placar(1, 0)),
    jogo('a2', 'b2', placar(0, 1), 'repescagem'),
    jogo('a1', 'b2', placar(2, 0), 'semifinal'),
    jogo('b1', 'c1', placar(0, 1), 'semifinal'),
    jogo('a1', 'c1', placar(0, 2), 'final'),
  ];
  const r = classificacaoColetiva({ grupos, jogos, esporte: ESPORTES.handebol, vagasDiretas: 1 });
  // b1 perdeu a semi para a campeã (3º) e b2 para a vice (4º); a2 perdeu a repescagem (5º);
  // depois quem parou nos grupos: o 2º do grupo C e os terceiros pela campanha.
  assert.deepEqual(
    r.ordem.map((l) => l.id),
    ['c1', 'a1', 'b1', 'b2', 'a2', 'c2', 'a3', 'b3', 'c3'],
  );
  assert.equal(r.ordem.find((l) => l.id === 'a2').etapa, ETAPA.repescagem);
});

test('coletiva: depois da repescagem, os líderes e quem venceu a repescagem são os semifinalistas', () => {
  const grupos = { A: ['a1', 'a2'], B: ['b1', 'b2'], C: ['c1', 'c2'] };
  const jogos = [jogo('a1', 'a2', placar(1, 0)), jogo('b1', 'b2', placar(1, 0)), jogo('c1', 'c2', placar(1, 0)), jogo('a2', 'b2', placar(3, 0), 'repescagem')];
  const r = classificacaoColetiva({ grupos, jogos, esporte: ESPORTES.futsal, vagasDiretas: 1 });
  assert.deepEqual(
    r.ordem.slice(0, 4).map((l) => [l.id, l.etapa]).sort(),
    [
      ['a1', ETAPA.semifinalista],
      ['a2', ETAPA.semifinalista],
      ['b1', ETAPA.semifinalista],
      ['c1', ETAPA.semifinalista],
    ],
  );
  assert.deepEqual(
    r.ordem.slice(4).map((l) => [l.id, l.posicao]),
    [
      ['b2', 5],
      ['c2', 6],
    ],
  );
});

test('coletiva sem repescagem: com a semifinal lançada, os dois primeiros de cada grupo são semifinalistas', () => {
  const grupos = { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'] };
  const jogos = [
    jogo('a1', 'a2', placar(1, 0)),
    jogo('a2', 'a3', placar(1, 0)),
    jogo('b1', 'b2', placar(1, 0)),
    jogo('b2', 'b3', placar(1, 0)),
    jogo('a1', 'b2', null, 'semifinal'), // só um confronto lançado até agora
  ];
  const r = classificacaoColetiva({ grupos, jogos, esporte: ESPORTES.basquete, vagasDiretas: 2 });
  assert.deepEqual(
    r.ordem.slice(0, 4).map((l) => l.etapa),
    [ETAPA.semifinalista, ETAPA.semifinalista, ETAPA.semifinalista, ETAPA.semifinalista],
  );
  assert.deepEqual(
    r.ordem.slice(4).map((l) => l.id).sort(),
    ['a3', 'b3'],
  );
});

test('coletiva: antes da final, quem perdeu a semifinal fica entre 3º e 4º pela ordem dos finalistas', () => {
  const grupos = { A: ['a1', 'a2'], B: ['b1', 'b2'] };
  const jogos = [
    jogo('a1', 'a2', placar(5, 0)),
    jogo('b1', 'b2', placar(1, 0)),
    jogo('a1', 'b2', placar(3, 0), 'semifinal'),
    jogo('b1', 'a2', placar(2, 1), 'semifinal'),
    jogo('a1', 'b1', null, 'final'),
  ];
  const r = classificacaoColetiva({ grupos, jogos, esporte: ESPORTES.futsal });
  // a1 tem campanha melhor que b1 e é projetada campeã; por isso b2 (que perdeu para a1) vem antes de a2.
  assert.deepEqual(
    r.ordem.map((l) => [l.id, l.etapa]),
    [
      ['a1', ETAPA.finalista],
      ['b1', ETAPA.finalista],
      ['b2', ETAPA.semifinal],
      ['a2', ETAPA.semifinal],
    ],
  );
  assert.equal(r.encerrada, false);
});

test('coletiva: durante os grupos a projeção ordena pela posição no grupo e depois pela campanha', () => {
  const grupos = { A: ['a1', 'a2'], B: ['b1', 'b2'] };
  const jogos = [jogo('a1', 'a2', placar(5, 0)), jogo('b1', 'b2', placar(1, 0))];
  let r = classificacaoColetiva({ grupos, jogos, esporte: ESPORTES.futsal });
  // Os dois líderes vêm antes; entre os segundos, b2 (perdeu de 1) tem campanha melhor que a2 (perdeu de 5).
  assert.deepEqual(
    r.ordem.map((l) => l.id),
    ['a1', 'b1', 'b2', 'a2'],
  );

  r = classificacaoColetiva({ grupos, jogos: [...jogos, jogo('a1', 'b1', null, 'final')], esporte: ESPORTES.futsal });
  assert.equal(r.ordem[0].etapa, ETAPA.finalista, 'final marcada e ainda sem resultado');
  assert.equal(r.encerrada, false);
});

test('coletiva: atlética que deu W.O. fica sem colocação', () => {
  const grupos = { A: ['a1', 'a2', 'a3'] };
  const jogos = [jogo('a1', 'a2', placar(2, 0)), jogo('a3', 'a1', { wo: 'a' })];
  const r = classificacaoColetiva({ grupos, jogos, esporte: ESPORTES.handebol });
  const a3 = r.ordem.find((l) => l.id === 'a3');
  assert.equal(a3.posicao, null);
  assert.equal(a3.eliminadoWO, 'normal');
  assert.deepEqual(
    r.ordem.filter((l) => l.posicao).map((l) => l.id),
    ['a1', 'a2'],
  );
});

test('provas: revezamento em dobro e desempate pelo número de 1º, depois 2º lugares', () => {
  const provas = [{ id: '100' }, { id: '4x100', peso: 2, max: 1 }];
  const resultados = {
    100: [
      { pos: 1, at: 'X' },
      { pos: 2, at: 'Y' },
      { pos: 3, at: 'X' },
      { pos: 4, at: 'Z' },
    ],
    '4x100': [
      { pos: 1, at: 'Y' },
      { pos: 2, at: 'Z' },
      { pos: 3, at: 'X' },
    ],
  };
  const { ordem } = pontuacaoProvas(provas, resultados);
  // X: 12 + 7 + 14 = 33; Y: 9 + 24 = 33 (um 1º e um 2º lugar, vence X); Z: 5 + 18 = 23.
  assert.deepEqual(
    ordem.map((l) => [l.id, l.pts, l.posicao]),
    [
      ['Y', 33, 1],
      ['X', 33, 2],
      ['Z', 23, 3],
    ],
  );
});

test('provas: mais atletas que o permitido zera a atlética na prova (A1 Arts. 38 e 49)', () => {
  const provas = [{ id: '100' }];
  const resultados = {
    100: [
      { pos: 1, at: 'X' },
      { pos: 2, at: 'X' },
      { pos: 3, at: 'X' },
      { pos: 4, at: 'Y' },
    ],
  };
  const { ordem, avisos, semPontos } = pontuacaoProvas(provas, resultados);
  assert.deepEqual(
    ordem.map((l) => l.id),
    ['Y'],
  );
  assert.deepEqual(
    semPontos.map((l) => l.id),
    ['X'],
  );
  assert.deepEqual(avisos, [{ prova: '100', at: 'X', limite: 2 }]);
});

test('geral: soma colocações, aplica perdas e desempata pelo número de 1º lugares (RG Art. 15)', () => {
  const classificacoes = [
    { mod: 'm1', ordem: [{ id: 'p', posicao: 1 }, { id: 'q', posicao: 2 }, { id: 'r', posicao: 3 }] },
    { mod: 'm2', ordem: [{ id: 'q', posicao: 5 }, { id: 'p', posicao: 8 }] },
  ];
  // p: 12 + 1 = 13; q: 9 + 4 = 13; p tem mais 1º lugares.
  let geral = classificacaoGeral({ atleticas: ['p', 'q', 'r'], classificacoes });
  assert.deepEqual(
    geral.map((l) => [l.id, l.total]),
    [
      ['p', 13],
      ['q', 13],
      ['r', 7],
    ],
  );
  assert.equal(geral[0].empatado, false);

  geral = classificacaoGeral({
    atleticas: ['p', 'q', 'r'],
    classificacoes,
    zerados: new Set(['m1|p']),
    ajustes: [{ id: 'q', pontos: -12, motivo: 'W.O.' }],
  });
  // p perde o 1º lugar zerado e fica com 1; q perde 12 e fica com 1, mas tem um 2º lugar.
  assert.deepEqual(
    geral.map((l) => [l.id, l.total]),
    [
      ['r', 7],
      ['q', 1],
      ['p', 1],
    ],
  );
});

test('geral: empate total fica marcado para sorteio', () => {
  const classificacoes = [
    { mod: 'm1', ordem: [{ id: 'p', posicao: 1 }, { id: 'q', posicao: 2 }] },
    { mod: 'm2', ordem: [{ id: 'q', posicao: 1 }, { id: 'p', posicao: 2 }] },
  ];
  const geral = classificacaoGeral({ atleticas: ['p', 'q', 'r'], classificacoes });
  assert.equal(geral[0].empatado, true);
  assert.equal(geral[1].empatado, true);
  assert.equal(geral[2].empatado, false, 'quem não pontuou não aparece como empatado');
});
