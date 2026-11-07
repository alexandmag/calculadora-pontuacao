import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marcaObjetivo } from '../js/telas.js';

test('resumo da análise: quem já está na semifinal leva ✓, não a % de ir direto', () => {
  const sit = { repescagem: true };
  // Venceu a repescagem: a % de ter sido 1º do grupo é 0, mas a vaga já é dela.
  assert.equal(marcaObjetivo({ categoria: 'semi', motivo: 'na-semi', sit, chances: { lider: 0, semi: 1 } }), ' ✓');
  assert.equal(marcaObjetivo({ categoria: 'semi', motivo: 'na-final', sit, chances: { lider: 0, semi: 1 } }), ' ✓');
  assert.equal(marcaObjetivo({ categoria: 'semi', motivo: 'garantida', sit, chances: { lider: 1, semi: 1 } }), ' ✓');
  assert.equal(marcaObjetivo({ categoria: 'semi', motivo: 'parou-semi', sit, chances: { lider: 0, semi: 1 } }), '');
  // Na fase de grupos continua a % de ir direto (com repescagem) ou de chegar à semifinal.
  assert.match(marcaObjetivo({ categoria: 'semi', motivo: 'provavel', sit, chances: { lider: 0.7, semi: 0.9 } }), /70/);
  assert.match(marcaObjetivo({ categoria: 'repescagem', motivo: 'briga', sit, chances: { lider: 0.1, semi: 0.4 } }), /40/);
  assert.equal(marcaObjetivo({ categoria: 'fora', motivo: 'eliminada', sit, chances: { lider: 0, semi: 0 } }), '');
});
