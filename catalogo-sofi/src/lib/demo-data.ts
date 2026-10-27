import type { Category, Product, StoreSettings } from "./types";

// Dados iniciais da Sobremesas Sofi. Aparecem no modo demonstração (sem
// Supabase) e também estão em supabase/seed.sql para popular o banco real.
// Preços conforme a tabela enviada pela loja; a taxa de entrega ainda é provisória.

const photo = (name: string) => `/sofi/${name}.webp`;

export const demoSettings: StoreSettings = {
  name: "Sobremesas Sofi",
  tagline: "Com açúcar, com afeto, fiz seu predileto.",
  whatsapp: "5592991364541",
  instagram: "Sobremesas_Sofi",
  address: null,
  hours_text: null,
  accepting_orders: true,
  delivery_enabled: true,
  pickup_enabled: true,
  delivery_fee_cents: 500, // a confirmar
  min_order_cents: 0,
  cover_image_path: photo("bombom-morango-pote"),
  logo_image_path: photo("logo"),
};

const cat = (id: string, name: string, sort_order: number): Category => ({
  id,
  name,
  sort_order,
  is_active: true,
});

export const demoCategories: Category[] = [
  cat("00000000-0000-4000-8000-000000000001", "Escondidinhos de Brownie", 1),
  cat("00000000-0000-4000-8000-000000000002", "Copos & Potes", 2),
  cat("00000000-0000-4000-8000-000000000003", "Fatias", 3),
  cat("00000000-0000-4000-8000-000000000004", "Morangos & Palitos", 4),
  cat("00000000-0000-4000-8000-000000000005", "Palhas Italianas", 5),
];

let seq = 0;
const p = (
  category: number,
  name: string,
  price: number,
  image: string,
  extra: Partial<Product> = {},
): Product => {
  seq += 1;
  return {
    id: `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`,
    category_id: demoCategories[category - 1].id,
    name,
    description: null,
    price_cents: price,
    compare_at_cents: null,
    serving: null,
    tags: [],
    image_path: photo(image),
    is_visible: true,
    is_available: true,
    is_featured: false,
    sort_order: seq,
    ...extra,
  };
};

export const demoProducts: Product[] = [
  // Escondidinhos de Brownie
  p(1, "Escondidinho de Brownie: Ninho", 1600, "escondidinho-ninho", {
    description:
      "Camadas de brownie macio intercaladas com creme de Leite Ninho, finalizado com um pedaço de brownie.",
    tags: ["Mais pedido"],
    is_featured: true,
  }),
  p(1, "Escondidinho de Brownie: Brigadeiro", 1600, "escondidinho-brigadeiro", {
    description: "Pedaços de brownie com brigadeiro cremoso, em camadas até a borda.",
  }),
  p(1, "Escondidinho de Brownie: Ferrero Rocher", 1600, "escondidinho-ferrero", {
    description: "Brownie em camadas com creme de Ferrero Rocher e castanhas crocantes.",
  }),

  // Copos & Potes
  p(2, "Bombom de Morango no Pote", 1500, "bombom-morango-pote", {
    description: "Creme branco com morangos frescos e cobertura de chocolate.",
    tags: ["Mais pedido"],
    is_featured: true,
  }),
  p(2, "Copo Pudim", 1600, "copo-pudim", {
    description: "Pudim no topo, camadas de bolo, creme e doce de leite.",
  }),
  p(2, "Bolo no Pote de Prestígio", 1600, "bolo-pote-prestigio", {
    description: "Bolo de chocolate, creme de coco e brigadeiro com granulado, na tampa bolha.",
  }),
  p(2, "Maracujá Trufado", 1300, "maracuja-trufado", {
    description: "Mousse de maracujá em camadas com ganache de chocolate.",
  }),
  p(2, "Mini Pudim", 1500, "mini-pudim", {
    description: "Pudim de leite cremoso com calda de caramelo.",
  }),

  // Fatias
  p(3, "Fatia ChocoNinho", 1800, "fatia-choconinho", {
    description: "Bolo de chocolate com recheio e cobertura metade brigadeiro, metade Ninho.",
    is_featured: true,
  }),
  p(3, "Fatia Matilda", 1800, "fatia-matilda", {
    description: "Bolo de chocolate molhadinho, recheado e coberto com brigadeiro.",
  }),
  p(3, "Fatia Olho de Sogra", 1800, "fatia-olho-de-sogra", {
    description: "Bolo em camadas com ameixa, doce de leite e coco.",
  }),
  p(3, "Fatia Brownie", 1800, "fatia-brownie", {
    description:
      "Brownie em camadas com recheio de Ninho ou Ninho com Nutella, decorado com morangos. Informe o recheio na observação.",
    is_featured: true,
  }),

  // Morangos & Palitos
  p(4, "Bombom de Morango no Palito", 1800, "bombom-morango-palito", {
    description:
      "Morango envolto em creme, coberto com chocolate ao leite ou chocolate branco. Informe a cobertura na observação.",
    is_featured: true,
  }),
  p(4, "Morango Cravejado", 1500, "morango-cravejado", {
    description: "Morango inteiro com creme, coberto com chocolate branco e morango crocante.",
    is_featured: true,
  }),
  p(4, "Coxinha de Brigadeiro com Morango", 1700, "coxinha-brigadeiro-morango", {
    description:
      "Caixa com 2 unidades. Sabores: Ninho com Nutella + Ferrero Rocher, ou Chocolate + Ninho com Nutella. Informe a opção na observação.",
    serving: "2 unidades",
    is_featured: true,
  }),
  p(4, "Brownie no Palito", 1800, "brownie-no-palito", {
    description: "Brownie recheado com Ninho com Nutella e cobertura de chocolate.",
  }),

  // Palhas Italianas
  p(5, "Palha Italiana de Ferrero Rocher", 1400, "palha-italiana-ferrero", {
    description: "Coberta com castanhas crocantes e fios de chocolate.",
  }),
  p(5, "Palha Italiana de Ninho com Nutella", 1400, "palha-italiana-ninho-nutella", {
    description: "Palha italiana de Leite Ninho com recheio de Nutella.",
  }),
];
