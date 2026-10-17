/* Gerador de orçamentos
   Valores em centavos (inteiros) para a conta nunca errar por arredondamento.
   A marca (nome, logo, cores) vem inteira de js/dados.js — ver aplicarMarca(). */
(() => {
  'use strict';

  const { EMPRESA, CATEGORIAS, PRODUTOS, UNIDADES } = window.DADOS;

  // ---------- utilitários ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const QIN = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3, useGrouping: false });
  const DEC2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const dinheiro = (c) => BRL.format((c || 0) / 100);
  const qtdTxt = (q) => NUM.format(q);
  const dataTxt = (t) => new Date(t).toLocaleDateString('pt-BR');
  const limitar = (n, a, b) => Math.min(b, Math.max(a, n));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Aceita "3", "2,5", "1.250,00", "R$ 40"
  function lerNumero(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v ?? '').trim().replace(/R\$|\s/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "3.000" = três mil
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const lerCentavos = (v) => Math.max(0, Math.round(lerNumero(v) * 100));

  const armazem = {
    ler(k, padrao) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } },
    gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: segue em memória */ } },
  };
  const K = { rascunho: 'pn.rascunho', salvos: 'pn.salvos', extras: 'pn.extras', seq: 'pn.seq' };

  const icone = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const catNome = (id) => (CATEGORIAS.find((c) => c.id === id) || {}).nome || 'Avulso';

  // ---------- estado ----------
  let seqMemoria = 1046;
  function proximoNumero() {
    const n = (armazem.ler(K.seq, seqMemoria) || seqMemoria) + 1;
    seqMemoria = n;
    armazem.gravar(K.seq, n);
    return `${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
  }

  function novoOrcamento(numero) {
    return {
      id: uid(),
      numero: numero || proximoNumero(),
      criadoEm: Date.now(),
      cliente: { nome: '', doc: '', tel: '', endereco: '' },
      itens: [],
      descGeral: { tipo: 'pct', valor: 0 }, // pct: percentual; valor: centavos
      frete: 0,
      pagamento: 'PIX à vista',
      entrega: 'Entrega em até 48 h',
      validade: 15,
      vendedor: '',
      obs: '',
      salvoEm: null,
    };
  }

  let orc = armazem.ler(K.rascunho, null) || novoOrcamento();
  let alteradoDesdeSalvo = !orc.salvoEm;
  const filtro = { cat: 'todos', busca: '' };

  const produtosExtras = () => armazem.ler(K.extras, []);
  const todosProdutos = () => [...PRODUTOS, ...produtosExtras()];

  let tGravar;
  function gravarRascunho() {
    clearTimeout(tGravar);
    tGravar = setTimeout(() => armazem.gravar(K.rascunho, orc), 250);
  }
  function mudou() {
    alteradoDesdeSalvo = true;
    gravarRascunho();
    atualizarSelo();
  }

  // ---------- cálculo ----------
  function calcular(o) {
    let bruto = 0;
    let descItens = 0;
    const linhas = o.itens.map((it) => {
      const b = Math.round(it.qtd * it.preco);
      const d = Math.round((b * limitar(it.desc || 0, 0, 100)) / 100);
      bruto += b;
      descItens += d;
      return { bruto: b, desc: d, liquido: b - d };
    });
    const base = bruto - descItens;
    const descGeral = o.descGeral.tipo === 'pct'
      ? Math.round((base * limitar(o.descGeral.valor || 0, 0, 100)) / 100)
      : limitar(o.descGeral.valor || 0, 0, base);
    const frete = Math.max(0, o.frete || 0);
    const descTotal = descItens + descGeral;
    return {
      linhas,
      bruto,
      descItens,
      descGeral,
      descTotal,
      frete,
      total: base - descGeral + frete,
      pctDesc: bruto ? (descTotal / bruto) * 100 : 0,
      unidades: o.itens.reduce((s, it) => s + it.qtd, 0),
    };
  }


  // ---------- marca ----------
  // Tudo que identifica a empresa na tela sai de EMPRESA.marca. Cabeçalho e
  // documento usam o mesmo bloco, então não há duas cópias para desencontrar.
  const MARCA = EMPRESA.marca || {};
  const nomeMarca = MARCA.nomeCompleto || EMPRESA.nome;

  function marcaHTML(escuro) {
    const arquivo = escuro ? (MARCA.logoNegativa || MARCA.logo) : MARCA.logo;
    if (arquivo) {
      // Se a imagem não carregar (arquivo esquecido), cai para o nome em texto
      // em vez de deixar um ícone de imagem quebrada no canto de toda tela.
      return `<img class="logo__img" src="${esc(arquivo)}" alt="${esc(nomeMarca)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo__nome',textContent:this.alt}))">`;
    }
    return `<span class="logo__nome">${esc(nomeMarca)}</span>`;
  }

  // Dois hexadecimais viram a escala inteira: misturar com preto dá os tons
  // escuros, com branco os claros. Não é teoria de cor sofisticada; é o
  // suficiente para botões, foco e faixas acompanharem a marca de um cliente
  // que só sabe dizer "o azul é esse e o laranja é esse".
  function misturar(hex, alvo, t) {
    const n = (h) => h.replace('#', '').match(/.{2}/g).map((x) => parseInt(x, 16));
    const [a, b] = [n(hex), n(alvo)];
    return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * t).toString(16).padStart(2, '0')).join('');
  }
  function aplicarMarca() {
    const cores = MARCA.cores || {};
    const raiz = document.documentElement.style;
    if (cores.primaria) {
      const p = cores.primaria;
      raiz.setProperty('--primaria-950', misturar(p, '#000000', .35));
      raiz.setProperty('--primaria-900', p);
      raiz.setProperty('--primaria-800', misturar(p, '#ffffff', .12));
      raiz.setProperty('--primaria-700', misturar(p, '#ffffff', .28));
      raiz.setProperty('--primaria-100', misturar(p, '#ffffff', .86));
      raiz.setProperty('--primaria-50', misturar(p, '#ffffff', .93));
      $('meta[name="theme-color"]')?.setAttribute('content', p);
    }
    if (cores.destaque) {
      const d = cores.destaque;
      raiz.setProperty('--destaque', d);
      raiz.setProperty('--destaque-hover', misturar(d, '#ffffff', .15));
      raiz.setProperty('--destaque-escuro', misturar(d, '#000000', .18));
      raiz.setProperty('--destaque-100', misturar(d, '#ffffff', .82));
    }
    const topo = $('#marca-topo');
    if (topo) { topo.innerHTML = marcaHTML(true); topo.setAttribute('aria-label', `${nomeMarca} — início`); }
    if (MARCA.icone) $$('link[rel="icon"]').forEach((l) => { if (!l.sizes.contains('512x512')) l.href = MARCA.icone; });
    document.title = `Orçamentos · ${EMPRESA.nome}`;
  }
  aplicarMarca();

  // ---------- catálogo ----------
  const elLista = $('#lista-prod');
  const elChips = $('#chips');

  function renderChips() {
    const todos = todosProdutos();
    const contar = (id) => todos.filter((p) => p.cat === id).length;
    const chips = [{ id: 'todos', curto: 'Todos', n: todos.length }, ...CATEGORIAS.map((c) => ({ ...c, n: contar(c.id) }))];
    elChips.innerHTML = chips
      .filter((c) => c.n > 0)
      .map((c) => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${filtro.cat === c.id}">${esc(c.curto)}<span class="chip__n">${c.n}</span></button>`)
      .join('');
  }

  function filtrados() {
    const termos = normalizar(filtro.busca).split(/\s+/).filter(Boolean);
    return todosProdutos().filter((p) => {
      if (filtro.cat !== 'todos' && p.cat !== filtro.cat) return false;
      if (!termos.length) return true;
      const alvo = normalizar(`${p.nome} ${p.codigo} ${catNome(p.cat)}`);
      return termos.every((t) => alvo.includes(t));
    });
  }

  function renderCatalogo() {
    const lista = filtrados();
    const noOrc = qtdNoOrcamento();
    elLista.innerHTML = lista.map((p) => {
      const q = noOrc.get(p.id);
      return `
      <li class="prod${q ? ' tem' : ''}" data-id="${esc(p.id)}">
        <div class="prod__info">
          <span class="prod__nome">${esc(p.nome)}</span>
          <span class="prod__meta"><span class="cod">${esc(p.codigo)}</span><span>${esc(catNome(p.cat))}</span>${q ? `<span class="no-orc">${qtdTxt(q)} ${esc(p.un)} no orçamento</span>` : ''}</span>
        </div>
        <div class="prod__preco"><strong>${dinheiro(p.preco)}</strong><span>/${esc(p.un)}</span></div>
        <div class="prod__acao">
          <div class="passo">
            <button type="button" data-acao="menos" aria-label="Diminuir">${icone('menos')}</button>
            <input type="text" inputmode="decimal" value="1" aria-label="Quantidade de ${esc(p.nome)}" data-qtd-cat>
            <button type="button" data-acao="mais" aria-label="Aumentar">${icone('mais')}</button>
          </div>
          <button class="btn btn--marinho" type="button" data-acao="add">${icone('mais')}<span>Adicionar</span></button>
        </div>
      </li>`;
    }).join('');
    $('#vazio-busca').hidden = lista.length > 0;
    const total = todosProdutos().length;
    $('#nota-catalogo').textContent = lista.length === total
      ? `${total} produtos`
      : `${lista.length} de ${total} produtos`;
  }

  function qtdNoOrcamento() {
    const m = new Map();
    orc.itens.forEach((it) => m.set(it.pid, (m.get(it.pid) || 0) + it.qtd));
    return m;
  }

  function passoDe(input, delta) {
    const atual = lerNumero(input.value);
    const novo = Math.max(0, Math.round((atual + delta) * 1000) / 1000);
    return novo;
  }

  elLista.addEventListener('click', (e) => {
    const bt = e.target.closest('button[data-acao]');
    if (!bt) return;
    const li = bt.closest('.prod');
    const input = $('[data-qtd-cat]', li);
    const acao = bt.dataset.acao;
    if (acao === 'menos') input.value = QIN.format(Math.max(1, passoDe(input, -1)));
    if (acao === 'mais') input.value = QIN.format(passoDe(input, 1));
    if (acao === 'add') adicionarDoCatalogo(li);
  });
  elLista.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-qtd-cat]')) {
      e.preventDefault();
      adicionarDoCatalogo(e.target.closest('.prod'));
    }
  });
  elLista.addEventListener('focusin', (e) => { if (e.target.matches('[data-qtd-cat]')) e.target.select(); });

  function adicionarDoCatalogo(li) {
    const p = todosProdutos().find((x) => x.id === li.dataset.id);
    const input = $('[data-qtd-cat]', li);
    const qtd = lerNumero(input.value);
    if (!p) return;
    if (qtd <= 0) { input.focus(); avisar('Informe uma quantidade maior que zero.'); return; }
    adicionarItem(p, qtd);
    input.value = '1';
  }

  function adicionarItem(p, qtd) {
    let it = orc.itens.find((x) => x.pid === p.id && x.preco === p.preco);
    if (it) it.qtd = Math.round((it.qtd + qtd) * 1000) / 1000;
    else {
      it = { id: uid(), pid: p.id, codigo: p.codigo, nome: p.nome, un: p.un, preco: p.preco, qtd, desc: 0, avulso: !!p.avulso };
      orc.itens.push(it);
    }
    mudou();
    renderItens(it.id);
    atualizarTotais();
    renderCatalogo();
    avisar(`<b>${qtdTxt(qtd)} ${esc(p.un)}</b> · ${esc(p.nome)} — ${dinheiro(Math.round(qtd * p.preco))}`);
  }

  $('#busca').addEventListener('input', (e) => { filtro.busca = e.target.value; renderCatalogo(); });
  $('#busca').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; filtro.busca = ''; renderCatalogo(); }
    if (e.key === 'Enter') {
      const primeiro = $('.prod [data-qtd-cat]', elLista);
      if (primeiro) { e.preventDefault(); primeiro.focus(); }
    }
  });
  elChips.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    filtro.cat = c.dataset.cat;
    $$('.chip', elChips).forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    renderCatalogo();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest('input, textarea, select') && !$('dialog[open]')) {
      e.preventDefault();
      $('#busca').focus();
    }
  });

  // ---------- itens do orçamento ----------
  const elItens = $('#itens');

  function htmlItem(it, l) {
    return `
    <li class="item" data-id="${it.id}">
      <span class="item__nome">${esc(it.nome)}${it.avulso ? '<span class="item__avulso">avulso</span>' : ''}</span>
      <div class="passo">
        <button type="button" data-acao="menos" aria-label="Diminuir">${icone('menos')}</button>
        <input type="text" inputmode="decimal" value="${QIN.format(it.qtd)}" aria-label="Quantidade" data-qtd>
        <button type="button" data-acao="mais" aria-label="Aumentar">${icone('mais')}</button>
      </div>
      <span class="item__total" data-total>${totalLinhaHTML(l)}</span>
      <div class="item__meta">
        <span><span class="cod">${esc(it.codigo)}</span> · ${dinheiro(it.preco)}/${esc(it.un)}</span>
        <label class="item__desc${it.desc ? ' ativo' : ''}">desc.
          <input type="text" inputmode="decimal" value="${it.desc ? PCT.format(it.desc) : ''}" placeholder="0" aria-label="Desconto do item em %" data-desc>%
        </label>
      </div>
      <div class="item__acoes"><button class="btn-ic" type="button" data-acao="remover" aria-label="Remover ${esc(it.nome)}">${icone('lixo')}</button></div>
    </li>`;
  }
  const totalLinhaHTML = (l) => (l.desc ? `<s>${dinheiro(l.bruto)}</s>` : '') + dinheiro(l.liquido);

  function renderItens(destacarId) {
    const c = calcular(orc);
    elItens.innerHTML = orc.itens.map((it, i) => htmlItem(it, c.linhas[i])).join('');
    $('#itens-vazio').hidden = orc.itens.length > 0;
    if (destacarId) {
      const li = $(`.item[data-id="${destacarId}"]`, elItens);
      if (li) { li.classList.add('novo'); li.scrollIntoView({ block: 'nearest' }); }
    }
  }

  function itemDe(el) {
    const li = el.closest('.item');
    return li ? orc.itens.find((x) => x.id === li.dataset.id) : null;
  }

  elItens.addEventListener('click', (e) => {
    const bt = e.target.closest('button[data-acao]');
    if (!bt) return;
    const it = itemDe(bt);
    if (!it) return;
    const li = bt.closest('.item');
    if (bt.dataset.acao === 'remover') {
      orc.itens = orc.itens.filter((x) => x !== it);
      mudou(); renderItens(); atualizarTotais(); renderCatalogo();
      avisar(`${esc(it.nome)} removido.`);
      return;
    }
    const delta = bt.dataset.acao === 'mais' ? 1 : -1;
    const novo = Math.round((it.qtd + delta) * 1000) / 1000;
    if (novo <= 0) return;
    it.qtd = novo;
    $('[data-qtd]', li).value = QIN.format(novo);
    mudou(); atualizarLinha(li, it); atualizarTotais(); renderCatalogo();
  });

  elItens.addEventListener('input', (e) => {
    const it = itemDe(e.target);
    if (!it) return;
    const li = e.target.closest('.item');
    if (e.target.matches('[data-qtd]')) {
      const q = lerNumero(e.target.value);
      if (q > 0) it.qtd = Math.round(q * 1000) / 1000;
    }
    if (e.target.matches('[data-desc]')) {
      it.desc = limitar(lerNumero(e.target.value), 0, 100);
      e.target.closest('.item__desc').classList.toggle('ativo', it.desc > 0);
    }
    mudou(); atualizarLinha(li, it); atualizarTotais();
  });
  elItens.addEventListener('focusout', (e) => {
    const it = itemDe(e.target);
    if (!it) return;
    if (e.target.matches('[data-qtd]')) { e.target.value = QIN.format(it.qtd); renderCatalogo(); }
    if (e.target.matches('[data-desc]')) e.target.value = it.desc ? PCT.format(it.desc) : '';
  });
  elItens.addEventListener('focusin', (e) => { if (e.target.matches('input')) e.target.select(); });

  function atualizarLinha(li, it) {
    const i = orc.itens.indexOf(it);
    const l = calcular(orc).linhas[i];
    $('[data-total]', li).innerHTML = totalLinhaHTML(l);
  }

  // ---------- totais ----------
  function atualizarTotais() {
    const c = calcular(orc);
    $('#t-subtotal').textContent = dinheiro(c.bruto);
    $('#linha-desc').hidden = c.descTotal === 0;
    $('#t-desc').textContent = `− ${dinheiro(c.descTotal)}`;
    $('#t-desc-pct').textContent = c.descTotal ? `(${PCT.format(c.pctDesc)}%)` : '';
    const retirada = orc.entrega === 'Retirada na loja';
    $('#linha-frete').hidden = !orc.itens.length || (retirada && !c.frete);
    $('#t-frete').textContent = c.frete ? dinheiro(c.frete) : 'Grátis';
    $('#t-total').textContent = dinheiro(c.total);

    const alerta = $('#alerta-desc');
    alerta.hidden = c.pctDesc <= EMPRESA.descontoMaximo;
    if (!alerta.hidden) alerta.textContent = `Desconto de ${PCT.format(c.pctDesc)}% passa do limite de ${EMPRESA.descontoMaximo}% e precisa de aprovação da gerência.`;

    const n = orc.itens.length;
    $('#resumo-itens').textContent = n ? `${n} ${n === 1 ? 'produto' : 'produtos'}` : '';
    $('#bm-itens').textContent = `${n} ${n === 1 ? 'item' : 'itens'}`;
    $('#bm-total').textContent = dinheiro(c.total);
    $('#bt-gerar').disabled = n === 0;
    $('#resumo-cliente').textContent = orc.cliente.nome ? `· ${orc.cliente.nome}` : '';
  }

  // ---------- campos (cliente e condições) ----------
  function caminho(obj, path, valor) {
    const partes = path.split('.');
    const ult = partes.pop();
    const alvo = partes.reduce((o, k) => o[k], obj);
    if (arguments.length === 3) alvo[ult] = valor;
    return alvo[ult];
  }

  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-campo]');
    if (!el || el.closest('dialog')) return;
    caminho(orc, el.dataset.campo, el.hasAttribute('data-num') ? Number(el.value) : el.value);
    mudou(); atualizarTotais();
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('select[data-campo]');
    if (!el || el.closest('dialog')) return;
    caminho(orc, el.dataset.campo, el.hasAttribute('data-num') ? Number(el.value) : el.value);
    mudou(); atualizarTotais();
  });

  const elDesc = $('#desc-geral');
  const elFrete = $('#frete');
  $('#seg-desc').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tipo]');
    if (!b) return;
    const tipo = b.dataset.tipo;
    orc.descGeral.tipo = tipo;
    $$('#seg-desc button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    lerDescGeral();
    elDesc.placeholder = tipo === 'pct' ? '0' : '0,00';
    elDesc.focus();
  });
  function lerDescGeral() {
    const n = lerNumero(elDesc.value);
    orc.descGeral.valor = orc.descGeral.tipo === 'pct' ? limitar(n, 0, 100) : lerCentavos(elDesc.value);
    mudou(); atualizarTotais();
  }
  elDesc.addEventListener('input', lerDescGeral);
  elDesc.addEventListener('blur', () => { elDesc.value = valorDescTxt(); });
  elFrete.addEventListener('input', () => { orc.frete = lerCentavos(elFrete.value); mudou(); atualizarTotais(); });
  elFrete.addEventListener('blur', () => { elFrete.value = orc.frete ? DEC2.format(orc.frete / 100) : ''; });
  [elDesc, elFrete].forEach((el) => el.addEventListener('focus', () => el.select()));

  function valorDescTxt() {
    const v = orc.descGeral.valor;
    if (!v) return '';
    return orc.descGeral.tipo === 'pct' ? PCT.format(v) : DEC2.format(v / 100);
  }

  function preencherCampos() {
    $$('[data-campo]').forEach((el) => {
      if (el.closest('dialog')) return;
      const v = caminho(orc, el.dataset.campo);
      el.value = v ?? '';
    });
    $$('#seg-desc button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tipo === orc.descGeral.tipo)));
    elDesc.value = valorDescTxt();
    elFrete.value = orc.frete ? DEC2.format(orc.frete / 100) : '';
    $('#orc-num').textContent = `nº ${orc.numero}`;
    $('#orc-data').textContent = `Emitido em ${dataTxt(orc.criadoEm)} · válido até ${dataTxt(validadeAte(orc))}`;
  }
  const validadeAte = (o) => o.criadoEm + (o.validade || 15) * 86400000;

  function atualizarSelo() {
    const s = $('#orc-selo');
    s.hidden = !orc.salvoEm || alteradoDesdeSalvo;
    $('#orc-data').textContent = `Emitido em ${dataTxt(orc.criadoEm)} · válido até ${dataTxt(validadeAte(orc))}`;
  }

  function renderTudo() {
    // cliente já preenchido fica recolhido para sobrar espaço aos itens
    $('#bloco-cliente').open = !orc.cliente.nome;
    preencherCampos();
    renderChips();
    renderCatalogo();
    renderItens();
    atualizarTotais();
    atualizarSelo();
    atualizarContadorSalvos();
  }

  // ---------- salvar / novo / salvos ----------
  const lerSalvos = () => armazem.ler(K.salvos, []);
  function salvar(silencioso) {
    if (!orc.itens.length) { avisar('Adicione ao menos um item antes de salvar.'); return false; }
    orc.salvoEm = Date.now();
    const lista = lerSalvos().filter((x) => x.id !== orc.id);
    lista.unshift(JSON.parse(JSON.stringify(orc)));
    armazem.gravar(K.salvos, lista.slice(0, 200));
    alteradoDesdeSalvo = false;
    armazem.gravar(K.rascunho, orc);
    atualizarSelo();
    atualizarContadorSalvos();
    if (!silencioso) avisar(`Orçamento <b>${orc.numero}</b> salvo.`);
    return true;
  }
  function atualizarContadorSalvos() {
    const n = lerSalvos().length;
    const ct = $('#ct-salvos');
    ct.hidden = n === 0;
    ct.textContent = n;
  }

  $('#bt-salvar').addEventListener('click', () => salvar());
  $('#bt-novo').addEventListener('click', () => {
    const anterior = orc;
    if (anterior.itens.length && alteradoDesdeSalvo) salvar(true);
    orc = novoOrcamento();
    alteradoDesdeSalvo = true;
    armazem.gravar(K.rascunho, orc);
    renderTudo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    avisar(anterior.itens.length
      ? `Novo orçamento <b>${orc.numero}</b>. O anterior ficou em Salvos.`
      : `Novo orçamento <b>${orc.numero}</b>.`);
  });

  const dlgSalvos = $('#dlg-salvos');
  $('#bt-salvos').addEventListener('click', () => { renderSalvos(); dlgSalvos.showModal(); });

  function renderSalvos() {
    const lista = lerSalvos();
    const alvo = $('#lista-salvos');
    if (!lista.length) {
      alvo.innerHTML = '<p class="salvos-vazio">Nenhum orçamento salvo ainda. Use <strong>Salvar</strong> ou <strong>Gerar orçamento</strong> e ele aparece aqui.</p>';
      return;
    }
    alvo.innerHTML = `
      <table class="salvos">
        <thead><tr><th>Nº</th><th>Cliente</th><th class="data">Data</th><th class="qtd dir">Itens</th><th class="dir">Total</th><th></th></tr></thead>
        <tbody>${lista.map((o) => `
          <tr data-id="${o.id}"${o.id === orc.id ? ' class="atual"' : ''}>
            <td class="num">${esc(o.numero)}</td>
            <td class="cli">${esc(o.cliente.nome || 'Cliente não informado')}</td>
            <td class="data">${dataTxt(o.salvoEm || o.criadoEm)}</td>
            <td class="qtd dir">${o.itens.length}</td>
            <td class="dir"><strong>${dinheiro(calcular(o).total)}</strong></td>
            <td><div class="acoes">
              <button class="btn btn--linha btn--p" type="button" data-acao="abrir">Abrir</button>
              <button class="btn btn--linha btn--p" type="button" data-acao="duplicar">Duplicar</button>
              <button class="btn btn--linha btn--p" type="button" data-acao="excluir">Excluir</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  dlgSalvos.addEventListener('click', (e) => {
    const bt = e.target.closest('button[data-acao]');
    if (!bt) return;
    const id = bt.closest('tr').dataset.id;
    const lista = lerSalvos();
    const o = lista.find((x) => x.id === id);
    if (!o) return;
    const acao = bt.dataset.acao;
    if (acao === 'excluir') {
      if (bt.dataset.confirmar !== '1') { bt.dataset.confirmar = '1'; bt.textContent = 'Confirmar exclusão'; return; }
      armazem.gravar(K.salvos, lista.filter((x) => x.id !== id));
      atualizarContadorSalvos();
      renderSalvos();
      if (orc.id === id) { orc.salvoEm = null; alteradoDesdeSalvo = true; atualizarSelo(); }
      return;
    }
    if (orc.itens.length && alteradoDesdeSalvo && orc.id !== id) salvar(true);
    if (acao === 'abrir') {
      orc = JSON.parse(JSON.stringify(o));
      alteradoDesdeSalvo = false;
    } else {
      orc = { ...JSON.parse(JSON.stringify(o)), id: uid(), numero: proximoNumero(), criadoEm: Date.now(), salvoEm: null };
      orc.itens.forEach((it) => { it.id = uid(); });
      alteradoDesdeSalvo = true;
    }
    armazem.gravar(K.rascunho, orc);
    dlgSalvos.close();
    renderTudo();
    avisar(acao === 'abrir' ? `Orçamento <b>${orc.numero}</b> aberto.` : `Cópia criada como <b>${orc.numero}</b>.`);
  });

  // ---------- produto avulso ----------
  const dlgAvulso = $('#dlg-avulso');
  const formAvulso = $('#form-avulso');
  $('#avulso-un').innerHTML = UNIDADES.map((u) => `<option>${u}</option>`).join('');
  $('#avulso-cat').innerHTML = CATEGORIAS.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');

  function abrirAvulso(nomeSugerido) {
    formAvulso.reset();
    $('#erro-avulso').hidden = true;
    if (nomeSugerido) formAvulso.nome.value = nomeSugerido;
    if (filtro.cat !== 'todos') formAvulso.cat.value = filtro.cat;
    dlgAvulso.showModal();
    (nomeSugerido ? formAvulso.preco : formAvulso.nome).focus();
  }
  $('#bt-avulso').addEventListener('click', () => abrirAvulso());
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-acao="avulso-da-busca"]')) abrirAvulso(filtro.busca.trim());
  });

  formAvulso.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formAvulso;
    const nome = f.nome.value.trim();
    const preco = lerCentavos(f.preco.value);
    const qtd = lerNumero(f.qtd.value) || 1;
    const erro = $('#erro-avulso');
    if (!nome) { erro.textContent = 'Informe a descrição do produto.'; erro.hidden = false; f.nome.focus(); return; }
    if (!preco) { erro.textContent = 'Informe o preço unitário.'; erro.hidden = false; f.preco.focus(); return; }
    const extras = produtosExtras();
    const usados = [...extras, ...orc.itens].map((x) => Number(/^AV(\d+)$/.exec(x.codigo || '')?.[1] || 0));
    const codigo = `AV${String(Math.max(0, ...usados) + 1).padStart(3, '0')}`;
    const p = { id: `av-${uid()}`, codigo, nome, cat: f.cat.value, un: f.un.value, preco, avulso: true };
    if (f.salvar.checked) {
      extras.push(p);
      armazem.gravar(K.extras, extras);
      renderChips();
    }
    dlgAvulso.close();
    adicionarItem(p, qtd);
  });

  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-fechar]') || e.target === d) d.close();
    });
  });

  // ---------- documento ----------
  function docHTML(o) {
    const c = calcular(o);
    const cli = o.cliente;
    const linhas = o.itens.map((it, i) => {
      const l = c.linhas[i];
      return `<tr>
        <td class="n">${i + 1}</td>
        <td class="cod">${esc(it.codigo)}</td>
        <td>${esc(it.nome)}</td>
        <td class="c">${esc(it.un)}</td>
        <td class="d">${qtdTxt(it.qtd)}</td>
        <td class="d">${dinheiro(it.preco)}</td>
        <td class="d${l.desc ? ' desc' : ''}">${l.desc ? `${PCT.format(it.desc)}%` : '—'}</td>
        <td class="d"><strong>${dinheiro(l.liquido)}</strong></td>
      </tr>`;
    }).join('');

    const retirada = o.entrega === 'Retirada na loja';
    return `
    <article class="doc">
      <header class="doc__topo">
        <span class="logo">${marcaHTML(false)}</span>
        <div class="doc__empresa">
          <strong>${esc(EMPRESA.razao)}</strong><br>
          CNPJ ${esc(EMPRESA.cnpj)}<br>
          ${esc(EMPRESA.endereco)} · ${esc(EMPRESA.cidade)}<br>
          ${esc(EMPRESA.fone)} · ${esc(EMPRESA.email)}
        </div>
      </header>
      <div class="doc__faixa"></div>
      <div class="doc__titulo"><h1>ORÇAMENTO</h1><span class="doc__num">Nº ${esc(o.numero)}</span></div>
      <div class="doc__meta">
        <div><span class="doc__rot">Emissão</span><strong>${dataTxt(o.criadoEm)}</strong></div>
        <div><span class="doc__rot">Válido até</span><strong>${dataTxt(validadeAte(o))}</strong></div>
        <div><span class="doc__rot">Pagamento</span><strong>${esc(o.pagamento)}</strong></div>
        <div><span class="doc__rot">Vendedor</span><strong>${esc(o.vendedor || 'Balcão')}</strong></div>
      </div>

      <section class="doc__cliente">
        <div class="largo"><span class="doc__rot">Cliente</span><strong>${esc(cli.nome || 'Consumidor final')}</strong></div>
        ${cli.doc ? `<div><span class="doc__rot">CPF / CNPJ</span>${esc(cli.doc)}</div>` : ''}
        ${cli.tel ? `<div><span class="doc__rot">WhatsApp</span>${esc(cli.tel)}</div>` : ''}
        ${cli.endereco ? `<div class="largo"><span class="doc__rot">${retirada ? 'Endereço' : 'Entregar em'}</span>${esc(cli.endereco)}</div>` : ''}
      </section>

      <table class="doc__tabela">
        <thead><tr><th class="n">#</th><th>Código</th><th>Descrição</th><th class="c">Un.</th><th class="d">Qtd.</th><th class="d">Unitário</th><th class="d">Desc.</th><th class="d">Total</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>

      <section class="doc__fim">
        <div class="doc__cond">
          <div><span class="doc__rot">Entrega</span><p>${esc(o.entrega)}${!retirada && c.frete === 0 ? ' · frete grátis' : ''}</p></div>
          <div><span class="doc__rot">Condições</span><p>Preços válidos até ${dataTxt(validadeAte(o))} ou enquanto durar o estoque. Após a validade, os valores podem ser revistos sem aviso.</p></div>
          ${o.obs ? `<div><span class="doc__rot">Observações</span><p>${esc(o.obs).replace(/\n/g, '<br>')}</p></div>` : ''}
        </div>
        <div>
          <dl class="doc__tot">
            <div><dt>Subtotal (${o.itens.length} ${o.itens.length === 1 ? 'item' : 'itens'})</dt><dd>${dinheiro(c.bruto)}</dd></div>
            ${c.descItens ? `<div class="verde"><dt>Desconto nos itens</dt><dd>− ${dinheiro(c.descItens)}</dd></div>` : ''}
            ${c.descGeral ? `<div class="verde"><dt>Desconto${o.descGeral.tipo === 'pct' ? ` (${PCT.format(o.descGeral.valor)}%)` : ''}</dt><dd>− ${dinheiro(c.descGeral)}</dd></div>` : ''}
            ${!retirada || c.frete ? `<div><dt>Frete</dt><dd>${c.frete ? dinheiro(c.frete) : 'Grátis'}</dd></div>` : ''}
            <div class="grande"><dt>Total</dt><dd>${dinheiro(c.total)}</dd></div>
          </dl>
          ${c.descTotal ? `<p class="doc__economia">Economia de ${dinheiro(c.descTotal)} neste orçamento</p>` : ''}
        </div>
      </section>

      <div class="doc__assin">
        <div>${esc(o.vendedor || 'Vendedor')} · ${esc(EMPRESA.nome)}</div>
        <div>De acordo — ${esc(cli.nome || 'cliente')}</div>
      </div>
      <footer class="doc__rodape">
        <span><strong>${esc(EMPRESA.nome)}</strong> · ${esc(EMPRESA.slogan)}</span>
        <span>Documento sem valor fiscal · ${esc(EMPRESA.site)}</span>
      </footer>
    </article>`;
  }

  const dlgDoc = $('#dlg-doc');
  const palco = $('#doc-palco');
  function ajustarEscalaDoc() {
    const doc = $('.doc', palco);
    if (!doc) return;
    const disponivel = palco.clientWidth - parseFloat(getComputedStyle(palco).paddingLeft) * 2;
    doc.style.zoom = String(Math.min(1, disponivel / 794));
  }
  $('#bt-gerar').addEventListener('click', () => {
    if (!orc.itens.length) return;
    salvar(true);
    palco.innerHTML = docHTML(orc);
    dlgDoc.showModal();
    palco.scrollTop = 0;
    ajustarEscalaDoc();
  });
  window.addEventListener('resize', () => { if (dlgDoc.open) ajustarEscalaDoc(); });

  window.addEventListener('beforeprint', () => { $('#print-root').innerHTML = orc.itens.length ? docHTML(orc) : ''; });
  window.addEventListener('afterprint', () => { $('#print-root').innerHTML = ''; });
  $('#bt-imprimir').addEventListener('click', () => {
    const titulo = document.title;
    document.title = `Orcamento ${orc.numero} - ${orc.cliente.nome || EMPRESA.nome}`;
    window.print();
    document.title = titulo;
  });

  function textoResumo(o) {
    const c = calcular(o);
    const l = [
      `*Orçamento ${o.numero}* — ${EMPRESA.nome}`,
      o.cliente.nome ? `Cliente: ${o.cliente.nome}` : null,
      '',
      ...o.itens.map((it, i) => `• ${qtdTxt(it.qtd)} ${it.un} — ${it.nome}: ${dinheiro(c.linhas[i].liquido)}${it.desc ? ` (−${PCT.format(it.desc)}%)` : ''}`),
      '',
      `Subtotal: ${dinheiro(c.bruto)}`,
      c.descTotal ? `Descontos: − ${dinheiro(c.descTotal)}` : null,
      o.entrega !== 'Retirada na loja' || c.frete ? `Frete: ${c.frete ? dinheiro(c.frete) : 'grátis'}` : null,
      `*Total: ${dinheiro(c.total)}*`,
      '',
      `Pagamento: ${o.pagamento}`,
      `Entrega: ${o.entrega}`,
      `Válido até ${dataTxt(validadeAte(o))}`,
    ];
    return l.filter((x) => x !== null).join('\n');
  }

  $('#bt-whats').addEventListener('click', () => {
    let fone = (orc.cliente.tel || '').replace(/\D/g, '');
    if (fone.length === 10 || fone.length === 11) fone = `55${fone}`;
    else if (!(fone.length >= 12 && fone.startsWith('55'))) fone = '';
    const url = `https://wa.me/${fone}?text=${encodeURIComponent(textoResumo(orc))}`;
    window.open(url, '_blank', 'noopener');
  });
  $('#bt-copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textoResumo(orc));
      avisar('Resumo copiado. É só colar na conversa.');
    } catch {
      avisar('Não foi possível copiar automaticamente neste navegador.');
    }
  });

  // ---------- celular ----------
  const barra = $('#barra-movel');
  $('#bt-ver-orc').addEventListener('click', () => $('#orc').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => barra.classList.toggle('oculta', en.isIntersecting), { threshold: 0 });
    io.observe($('.orc__rodape'));
  }

  // ---------- exemplo ----------
  function carregarExemplo() {
    const pega = (id) => PRODUTOS.find((p) => p.id === id);
    orc = {
      ...novoOrcamento(orc.numero), // reaproveita o número já reservado
      id: orc.id,
      cliente: { nome: 'Construtora Vale Verde Ltda.', doc: '27.418.630/0001-00', tel: '(92) 99000-1234', endereco: 'Rua das Seringueiras, 210 — Ponta Negra, Manaus/AM' },
      descGeral: { tipo: 'pct', valor: 3 },
      frete: 15000,
      pagamento: 'Boleto 28 dias',
      entrega: 'Entrega agendada',
      vendedor: 'Rafael Monteiro',
      obs: 'Descarregar no portão lateral. Obra recebe material até as 16 h.',
      itens: [
        ['CIM001', 120, 0], ['AGR001', 6, 0], ['AGR004', 4, 0], ['BLC001', 3000, 5],
        ['FER001', 40, 0], ['FER004', 3, 0], ['HID007', 3, 0], ['ELE001', 3, 0],
      ].map(([id, qtd, desc]) => {
        const p = pega(id);
        return { id: uid(), pid: p.id, codigo: p.codigo, nome: p.nome, un: p.un, preco: p.preco, qtd, desc, avulso: false };
      }),
    };
    alteradoDesdeSalvo = true;
    armazem.gravar(K.rascunho, orc);
    renderTudo();
    avisar('Exemplo carregado. Mude quantidades e descontos à vontade.');
  }
  $('#bt-exemplo').addEventListener('click', carregarExemplo);

  // ---------- aviso ----------
  let tAviso;
  function avisar(html) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.add('vis');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => t.classList.remove('vis'), 2600);
  }

  // ---------- início ----------
  armazem.gravar(K.rascunho, orc);
  renderTudo();
  if (new URLSearchParams(location.search).has('exemplo') && !orc.itens.length) carregarExemplo();
})();
