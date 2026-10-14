import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { calcularPermissao, hashEmail } from '../js/permissoes.js';

const equipe = { admins: ['chefe@gmail.com'], editores: ['Diretor@Gmail.com'] };

test('modo local: sem login, tudo liberado', () => {
  assert.deepEqual(calcularPermissao({ modo: 'local' }), { editar: true, administrar: true, papel: 'local' });
});

test('banco compartilhado: quem não entrou só vê', () => {
  assert.deepEqual(calcularPermissao({ modo: 'compartilhado' }), { editar: false, administrar: false, papel: 'visitante' });
});

test('editor e administrador vêm da lista da equipe, sem diferenciar maiúsculas', () => {
  const editor = calcularPermissao({ modo: 'compartilhado', usuario: { email: 'diretor@gmail.com' }, equipe });
  assert.deepEqual(editor, { editar: true, administrar: false, papel: 'editor' });
  const admin = calcularPermissao({ modo: 'compartilhado', usuario: { email: 'CHEFE@gmail.com' }, equipe });
  assert.deepEqual(admin, { editar: true, administrar: true, papel: 'admin' });
});

test('conta fora da equipe entra mas não edita', () => {
  const r = calcularPermissao({ modo: 'compartilhado', usuario: { email: 'rival@gmail.com' }, semAcesso: true });
  assert.deepEqual(r, { editar: false, administrar: false, papel: 'sem-acesso' });
});

test('o dono é sempre administrador, mesmo fora da lista', () => {
  const r = calcularPermissao({ modo: 'compartilhado', usuario: { email: 'dono@gmail.com' }, equipe: { admins: [], editores: [] }, dono: true });
  assert.equal(r.administrar, true);
});

test('o hash do e-mail é o mesmo das regras do Firestore (SHA-256 hexadecimal, minúsculo, sem espaços)', async () => {
  const esperado = createHash('sha256').update('fulano@gmail.com').digest('hex');
  assert.equal(await hashEmail('  Fulano@Gmail.com '), esperado);
});

test('o hash do dono no app e nas regras do Firestore é o mesmo', async () => {
  const { donoHash } = await import('../js/firebase-config.js');
  const regras = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(donoHash, /^[0-9a-f]{64}$/);
  assert.ok(regras.includes(`'${donoHash}'`), 'firestore.rules precisa ter o mesmo hash do dono');
});
