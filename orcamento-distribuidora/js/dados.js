/* Dados da empresa e catálogo.
   ------------------------------------------------------------------------
   Este é o ÚNICO lugar onde a marca mora. Para adaptar a um cliente real:
     1. troque EMPRESA (nome, razão social, contato, slogan);
     2. troque as duas cores em EMPRESA.marca.cores — o app deriva os tons;
     3. salve a logo do cliente em img/logo.png (fundo transparente) e, para o
        cabeçalho escuro, uma versão clara em img/logo-negativa.png; o ícone da
        aba em img/icone.png. Sem arquivo de logo, o nome aparece escrito.
     4. troque PRODUTOS pelo catálogo dele.
   Nada mais precisa ser editado: HTML, CSS e documento leem daqui.
   A empresa abaixo é fictícia, para demonstração. Preços em centavos.
   ------------------------------------------------------------------------ */
window.DADOS = (() => {
  const EMPRESA = {
    nome: 'Vértice',
    razao: 'Vértice Distribuidora de Materiais Ltda.',
    cnpj: '41.902.734/0001-43',
    endereco: 'Av. das Torres, 2.300 — Parque Dez',
    cidade: 'Manaus/AM',
    fone: '(92) 3000-7100',
    email: 'vendas@verticedistribuidora.com.br',
    site: 'verticedistribuidora.com.br',
    slogan: 'O ponto alto da sua obra.',
    // Acima deste desconto (% sobre o subtotal) o sistema avisa que precisa de aprovação
    descontoMaximo: 10,

    marca: {
      // Como a empresa se apresenta no cabeçalho, no documento e no WhatsApp.
      nomeCompleto: 'Vértice Distribuidora',
      logo: 'img/logo.png',
      logoNegativa: 'img/logo-negativa.png',
      icone: 'img/icone.png',
      // Só as duas cores base. Tons mais claros e mais escuros são derivados
      // pelo app ao iniciar (ver aplicarMarca em app.js), então um cliente
      // informa duas cores e todo o sistema acompanha — botões, foco, faixa,
      // documento impresso.
      cores: { primaria: '#142D4E', destaque: '#F47721' },
    },
  };

  const CATEGORIAS = [
    { id: 'cimento', nome: 'Cimento e argamassa', curto: 'Cimento' },
    { id: 'agregados', nome: 'Areia, brita e seixo', curto: 'Agregados' },
    { id: 'blocos', nome: 'Tijolos e blocos', curto: 'Tijolos e blocos' },
    { id: 'aco', nome: 'Aço e ferragens', curto: 'Aço' },
    { id: 'hidraulica', nome: 'Hidráulica', curto: 'Hidráulica' },
    { id: 'eletrica', nome: 'Elétrica', curto: 'Elétrica' },
    { id: 'tintas', nome: 'Tintas e impermeabilizantes', curto: 'Tintas' },
    { id: 'cobertura', nome: 'Telhas e cobertura', curto: 'Cobertura' },
    { id: 'pisos', nome: 'Pisos e revestimentos', curto: 'Pisos' },
    { id: 'ferramentas', nome: 'Ferramentas e EPI', curto: 'Ferramentas e EPI' },
  ];

  // [código, descrição, categoria, unidade, preço em centavos]
  const linhas = [
    ['CIM001', 'Cimento CP II-E 32 — saco 50 kg', 'cimento', 'sc', 4290],
    ['CIM002', 'Cimento CP IV-32 RS — saco 50 kg', 'cimento', 'sc', 4450],
    ['ARG010', 'Argamassa AC-I uso interno — 20 kg', 'cimento', 'sc', 1590],
    ['ARG011', 'Argamassa AC-III porcelanato — 20 kg', 'cimento', 'sc', 3890],
    ['ARG020', 'Rejunte flexível cinza platina — 1 kg', 'cimento', 'un', 990],
    ['CAL001', 'Cal hidratada CH-III — 20 kg', 'cimento', 'sc', 1990],

    ['AGR001', 'Areia média lavada', 'agregados', 'm³', 11000],
    ['AGR002', 'Areia fina para reboco', 'agregados', 'm³', 10500],
    ['AGR003', 'Brita 1', 'agregados', 'm³', 18900],
    ['AGR004', 'Seixo rolado lavado', 'agregados', 'm³', 16000],
    ['AGR005', 'Pó de pedra', 'agregados', 'm³', 14500],

    ['BLC001', 'Tijolo cerâmico 8 furos 9 × 19 × 19 cm', 'blocos', 'un', 105],
    ['BLC002', 'Bloco de concreto 14 × 19 × 39 cm', 'blocos', 'un', 420],
    ['BLC003', 'Bloco de concreto 9 × 19 × 39 cm', 'blocos', 'un', 340],
    ['BLC004', 'Canaleta de concreto 14 × 19 × 39 cm', 'blocos', 'un', 490],

    ['FER001', 'Vergalhão CA-50 3/8" (10 mm) — barra 12 m', 'aco', 'br', 5490],
    ['FER002', 'Vergalhão CA-50 5/16" (8 mm) — barra 12 m', 'aco', 'br', 3690],
    ['FER003', 'Vergalhão CA-60 4,2 mm — barra 12 m', 'aco', 'br', 1290],
    ['FER004', 'Arame recozido nº 18', 'aco', 'kg', 2290],
    ['FER005', 'Prego com cabeça 17 × 27', 'aco', 'kg', 1890],
    ['FER006', 'Tela soldada Q-92 — painel 2 × 3 m', 'aco', 'un', 11990],

    ['HID001', 'Tubo PVC soldável 25 mm — barra 6 m', 'hidraulica', 'br', 2490],
    ['HID002', 'Tubo PVC soldável 50 mm — barra 6 m', 'hidraulica', 'br', 6290],
    ['HID003', 'Tubo PVC esgoto 100 mm — barra 6 m', 'hidraulica', 'br', 7990],
    ['HID004', 'Joelho 90° soldável 25 mm', 'hidraulica', 'un', 120],
    ['HID005', 'Tê soldável 25 mm', 'hidraulica', 'un', 160],
    ['HID006', 'Registro de gaveta bruto 3/4"', 'hidraulica', 'un', 4990],
    ['HID007', 'Caixa d’água polietileno 1.000 L com tampa', 'hidraulica', 'un', 48900],
    ['HID008', 'Adesivo plástico para PVC — 175 g', 'hidraulica', 'un', 1990],
    ['HID009', 'Fita veda-rosca 18 mm × 50 m', 'hidraulica', 'un', 790],

    ['ELE001', 'Cabo flexível 2,5 mm² 750 V — rolo 100 m', 'eletrica', 'rl', 23900],
    ['ELE002', 'Cabo flexível 4,0 mm² 750 V — rolo 100 m', 'eletrica', 'rl', 37900],
    ['ELE003', 'Cabo flexível 6,0 mm² 750 V — rolo 100 m', 'eletrica', 'rl', 55900],
    ['ELE004', 'Disjuntor DIN unipolar 20 A', 'eletrica', 'un', 1490],
    ['ELE005', 'Disjuntor DIN bipolar 40 A', 'eletrica', 'un', 5990],
    ['ELE006', 'Tomada 2P+T 10 A com placa 4 × 2', 'eletrica', 'un', 1390],
    ['ELE007', 'Interruptor simples com placa 4 × 2', 'eletrica', 'un', 1190],
    ['ELE008', 'Eletroduto corrugado 3/4" — rolo 50 m', 'eletrica', 'rl', 5490],
    ['ELE009', 'Lâmpada LED bulbo 12 W branca', 'eletrica', 'un', 990],
    ['ELE010', 'Quadro de distribuição embutir 12 disjuntores', 'eletrica', 'un', 8990],

    ['TIN001', 'Tinta acrílica fosca branco neve — lata 18 L', 'tintas', 'lata', 28900],
    ['TIN002', 'Tinta acrílica fosca branco neve — galão 3,6 L', 'tintas', 'gl', 7990],
    ['TIN003', 'Massa corrida PVA — balde 25 kg', 'tintas', 'bd', 6990],
    ['TIN004', 'Selador acrílico — lata 18 L', 'tintas', 'lata', 15900],
    ['TIN005', 'Impermeabilizante manta líquida — balde 18 kg', 'tintas', 'bd', 24900],
    ['TIN006', 'Rolo de lã 23 cm com cabo', 'tintas', 'un', 2990],

    ['TEL001', 'Telha fibrocimento 6 mm 2,44 × 1,10 m', 'cobertura', 'un', 6990],
    ['TEL002', 'Telha galvalume trapezoidal 0,43 mm', 'cobertura', 'm', 5490],
    ['TEL003', 'Cumeeira fibrocimento 6 mm', 'cobertura', 'un', 3990],
    ['TEL004', 'Parafuso para telha 5/16" × 110 mm com vedação', 'cobertura', 'un', 290],

    ['PIS001', 'Porcelanato acetinado 60 × 60 cm', 'pisos', 'm²', 6990],
    ['PIS002', 'Piso cerâmico 45 × 45 cm PEI 4', 'pisos', 'm²', 3490],
    ['PIS003', 'Revestimento de parede 32 × 57 cm branco brilho', 'pisos', 'm²', 3990],

    ['FRT001', 'Carrinho de mão 60 L com pneu', 'ferramentas', 'un', 24900],
    ['FRT002', 'Pá quadrada com cabo', 'ferramentas', 'un', 5990],
    ['FRT003', 'Colher de pedreiro 8"', 'ferramentas', 'un', 2490],
    ['FRT004', 'Nível de alumínio 40 cm', 'ferramentas', 'un', 3990],
    ['FRT005', 'Trena emborrachada 5 m', 'ferramentas', 'un', 2490],
    ['EPI001', 'Luva de raspa', 'ferramentas', 'par', 1490],
    ['EPI002', 'Capacete de segurança classe B', 'ferramentas', 'un', 2490],
  ];

  const PRODUTOS = linhas.map(([codigo, nome, cat, un, preco]) => ({ id: codigo, codigo, nome, cat, un, preco }));

  const UNIDADES = ['un', 'sc', 'm', 'm²', 'm³', 'kg', 'br', 'rl', 'lata', 'gl', 'bd', 'par', 'cx'];

  return { EMPRESA, CATEGORIAS, PRODUTOS, UNIDADES };
})();
