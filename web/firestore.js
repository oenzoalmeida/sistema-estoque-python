/**
 * Camada de acesso ao Firestore (SDK modular via CDN).
 * Modelo de dados (documentado também no README):
 *
 *   users/{uid}/products/{id}
 *     nome: string, descricao: string, categoria: string,
 *     quantidade: int >= 0, estoqueMinimo: int >= 0, preco: number >= 0,
 *     criadoEm: Timestamp, atualizadoEm: Timestamp
 *
 *   users/{uid}/movements/{id}
 *     produtoId: string, produtoNome: string (denormalizado: histórico
 *     sobrevive à exclusão do produto), tipo: 'entrada' | 'saida',
 *     quantidade: int > 0, motivo: string, criadoEm: Timestamp
 *
 * Segurança: regras do Firestore (firestore.rules) restringem tudo a
 * request.auth.uid == uid — cada visitante anônimo da demo vê só o
 * próprio estoque.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc,
  getDocs, onSnapshot, query, orderBy, serverTimestamp, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { movimentarEmTransacao } from './movement-transaction.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBYOf5-XhZ698ZOh-JuewracA30tLWSn-g',
  authDomain: 'oenzoa-estoque.firebaseapp.com',
  projectId: 'oenzoa-estoque',
  storageBucket: 'oenzoa-estoque.firebasestorage.app',
  messagingSenderId: '134723029814',
  appId: '1:134723029814:web:0c65923463ec9f0b4d8197',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** Autentica anonimamente e devolve o uid (chamado uma vez no boot). */
export async function iniciarAutenticacao() {
  const atual = auth.currentUser;
  if (atual) return atual.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

function produtosRef(uid) {
  return collection(db, 'users', uid, 'products');
}

function movimentosRef(uid) {
  return collection(db, 'users', uid, 'movements');
}

/** Inscreve listeners em tempo real para produtos e movimentações. */
export function ouvirDados(uid, { aoReceberProdutos, aoReceberMovimentos, aoErro }) {
  const qProd = query(produtosRef(uid), orderBy('criadoEm', 'asc'));
  const qMov = query(movimentosRef(uid), orderBy('criadoEm', 'desc'));

  const unsubscribeP = onSnapshot(
    qProd,
    (snap) => aoReceberProdutos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    aoErro,
  );
  const unsubscribeM = onSnapshot(
    qMov,
    (snap) => aoReceberMovimentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    aoErro,
  );
  return () => { unsubscribeP(); unsubscribeM(); };
}

export async function criarProduto(uid, dados) {
  return addDoc(produtosRef(uid), { ...dados, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
}

export async function atualizarProduto(uid, id, dados) {
  return setDoc(doc(db, 'users', uid, 'products', id), { ...dados, atualizadoEm: serverTimestamp() }, { merge: true });
}

/** Lê o saldo no servidor e grava produto/histórico atomicamente, com retry do SDK. */
export async function registrarMovimentacao(uid, produto, tipo, quantidade, motivo) {
  const produtoRef = doc(db, 'users', uid, 'products', produto.id);
  // Gerar a referência fora do callback evita IDs diferentes em cada retry.
  const movimentoRef = doc(movimentosRef(uid));
  return runTransaction(db, (transaction) => movimentarEmTransacao(
    transaction, produtoRef, movimentoRef, { tipo, quantidade, motivo }, serverTimestamp,
  ));
}

/** Exclui o produto. O histórico permanece (produtoNome denormalizado). */
export async function excluirProduto(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'products', id));
}
