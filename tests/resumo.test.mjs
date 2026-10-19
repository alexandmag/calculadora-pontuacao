import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarModelo } from '../js/modelo.js';
import { dadosDoResumo, diaPadrao, diasComJogos, linhaDaGeral, nomeDoArquivo, textoParaPdf } from '../js/resumo.js';

const DIA = '2026-10-17';
const jogo = (mod, a, b, hora, res = null, extra = {}) => ({ mod, fase: 'grupo', grupo: 'A', a, b, data: DIA, hora, local: 'Quadra 1', res, ...extra });

function estadoDeTeste() {
  const estado = { config: { geral: { nossa: 'eng', nomes: { eng: 'Capetas', psi: 'Alfa' } } }, modalidades: {}, jogos: {}, resultados: {}, penalidades: {} };
  estado.modalidades['futebol-m'] = { grupoDe: { eng: 'C', med: 'C', icei: 'C' } };
  estado.jogos.f1 = jogo('futebol-m', 'eng', 'med', '13:00', { a: 2, b: 1 }, { grupo: 'C', obs: 'Gols do João e do Pedro 💪' });
  estado.jogos.v1 = jogo('volei-m', 'psi', 'eng', '09:00', { a: 1, b: 2, parciais: [{ a: 25, b: 20 }, { a: 18, b: 25 }, { a: 10, b: 15 }] }, { grupo: 'C' });
  estado.jogos.s1 = jogo('futsal-m', 'ger', 'eng', '10:00');
  estado.jogos.h1 = jogo('handebol-m', 'eng', 'psi', '10:30', { wo: 'b', woTipo: 'normal' }, { grupo: 'B' });
  estado.jogos.p1 = jogo('futsal-f', 'dir', 'eng', '16:00', { a: 1, b: 1, penaltis: { a: 3, b: 4 } }, { fase: 'semifinal', grupo: null });
  estado.jogos.outroDia = { ...jogo('volei-f', 'vet', 'eng', '12:45'), data: '2026-10-18' };
  estado.jogos.semNos = jogo('volei-f', 'dir', 'com', '10:15');
  return estado;
}

test('resumo traz só os jogos da atlética naquele dia, na ordem do horário', () => {
  const r = dadosDoResumo(montarModelo(estadoDeTeste()), 'eng', DIA);
  assert.equal(r.atletica, 'Capetas');
  assert.equal(r.diaTexto, 'Sábado, 17 de outubro');
  assert.deepEqual(
    r.itens.map((i) => [i.hora, i.modalidade, i.resultado]),
    [
      ['09:00', 'Vôlei Masculino', 'vitoria'],
      ['10:00', 'Futsal Masculino', 'pendente'],
      ['10:30', 'Handebol Masculino', 'wo-favor'],
      ['13:00', 'Futebol de Campo', 'vitoria'],
      ['16:00', 'Futsal Feminino', 'vitoria'],
    ],
  );
  assert.deepEqual(r.totais, { jogos: 5, vitorias: 4, empates: 0, derrotas: 0, pendentes: 1 });
});

test('placar, parciais e pênaltis vêm do ponto de vista da atlética do resumo', () => {
  const r = dadosDoResumo(montarModelo(estadoDeTeste()), 'eng', DIA);
  const volei = r.itens.find((i) => i.modalidade === 'Vôlei Masculino');
  assert.deepEqual(volei.placar, [2, 1]);
  assert.deepEqual(volei.parciais, [
    [20, 25],
    [25, 18],
    [15, 10],
  ]);
  assert.equal(volei.adversario, 'Alfa');
  const semi = r.itens.find((i) => i.fase === 'Semifinal');
  assert.deepEqual(semi.penaltis, [4, 3]);
});

test('resumo leva a observação e a situação no grupo', () => {
  const r = dadosDoResumo(montarModelo(estadoDeTeste()), 'eng', DIA);
  const futebol = r.itens.find((i) => i.modalidade === 'Futebol de Campo');
  assert.equal(futebol.obs, 'Gols do João e do Pedro 💪');
  assert.deepEqual(futebol.grupo, { letra: 'C', posicao: 1, pts: 3, jogos: 1, eliminado: false });
});

test('dias com jogo e dia padrão (hoje, senão o último que passou, senão o próximo)', () => {
  const modelo = montarModelo(estadoDeTeste());
  const dias = diasComJogos(modelo, 'eng');
  assert.deepEqual(dias, ['2026-10-17', '2026-10-18']);
  assert.equal(diaPadrao(dias, '2026-10-18'), '2026-10-18');
  assert.equal(diaPadrao(dias, '2026-10-20'), '2026-10-18');
  assert.equal(diaPadrao(dias, '2026-10-14'), '2026-10-17');
  assert.equal(diaPadrao([], '2026-10-14'), '');
});

test('texto do PDF: mantém acentos, troca sinais que a fonte não tem e tira emojis', () => {
  assert.equal(textoParaPdf('Ação: vitória −3 “ótima” … 💪'), 'Ação: vitória -3 "ótima" ... ');
  assert.equal(textoParaPdf('1º lugar · Grupo ç'), '1º lugar · Grupo ç');
});

test('nome do arquivo sem acentos nem espaços, em PDF ou imagem', () => {
  assert.equal(nomeDoArquivo({ atletica: 'Vikings ICS', dia: DIA }), 'resumo-vikings-ics-2026-10-17.pdf');
  assert.equal(nomeDoArquivo({ atletica: 'Veterinária', dia: DIA }, 'png'), 'resumo-veterinaria-2026-10-17.png');
});

test('o resumo leva o escudo da atlética, quando ela tem um', () => {
  const modelo = montarModelo(estadoDeTeste());
  assert.equal(dadosDoResumo(modelo, 'eng', DIA).logo, 'img/atleticas/eng.webp');
  assert.equal(dadosDoResumo(modelo, 'psi', DIA).logo, null);
});

test('com a previsão (só a equipe), o resumo leva a posição prevista na geral', () => {
  const modelo = montarModelo(estadoDeTeste());
  const previsao = { simuladas: ['futsal-m'], geral: [{ id: 'eng', posicao: 2, esperados: 47.6 }] };
  assert.deepEqual(dadosDoResumo(modelo, 'eng', DIA, { previsao }).geral, { previsao: true, posicao: 2, total: 48 });
  assert.equal(linhaDaGeral({ previsao: true, posicao: 2, total: 48 }), 'Previsão: 2º lugar na geral · 48 pontos esperados');
  assert.equal(dadosDoResumo(modelo, 'eng', DIA).geral.previsao, undefined, 'sem previsão, vale a geral dos pontos conquistados');
});
