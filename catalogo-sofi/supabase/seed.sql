-- Dados iniciais da Sobremesas Sofi (os mesmos do modo demonstração).
-- Rode DEPOIS do schema.sql, no SQL Editor do Supabase. As fotos ficam em
-- public/sofi/ e podem ser trocadas pelo painel a qualquer momento.

update public.store_settings set
  name = 'Sobremesas Sofi',
  tagline = 'Com açúcar, com afeto, fiz seu predileto.',
  whatsapp = '5592991364541',
  instagram = 'Sobremesas_Sofi',
  address = null,
  hours_text = null,
  accepting_orders = true,
  delivery_enabled = true,
  pickup_enabled = true,
  delivery_fee_cents = 500,
  min_order_cents = 0,
  cover_image_path = '/sofi/bombom-morango-pote.webp',
  logo_image_path = '/sofi/logo.webp'
where id = 1;

insert into public.categories (id, name, sort_order, is_active) values
  ('00000000-0000-4000-8000-000000000001', 'Escondidinhos de Brownie', 1, true),
  ('00000000-0000-4000-8000-000000000002', 'Copos & Potes', 2, true),
  ('00000000-0000-4000-8000-000000000003', 'Fatias', 3, true),
  ('00000000-0000-4000-8000-000000000004', 'Morangos & Palitos', 4, true),
  ('00000000-0000-4000-8000-000000000005', 'Palhas Italianas', 5, true)
on conflict (id) do nothing;

insert into public.products
  (id, category_id, name, description, price_cents, compare_at_cents, serving, tags, image_path, is_visible, is_available, is_featured, sort_order)
values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001', 'Escondidinho de Brownie: Ninho', 'Camadas de brownie macio intercaladas com creme de Leite Ninho, finalizado com um pedaço de brownie.', 1600, null, null, array['Mais pedido'], '/sofi/escondidinho-ninho.webp', true, true, true, 1),
  ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-000000000001', 'Escondidinho de Brownie: Brigadeiro', 'Pedaços de brownie com brigadeiro cremoso, em camadas até a borda.', 1600, null, null, '{}'::text[], '/sofi/escondidinho-brigadeiro.webp', true, true, false, 2),
  ('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-000000000001', 'Escondidinho de Brownie: Ferrero Rocher', 'Brownie em camadas com creme de Ferrero Rocher e castanhas crocantes.', 1600, null, null, '{}'::text[], '/sofi/escondidinho-ferrero.webp', true, true, false, 3),
  ('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-000000000002', 'Bombom de Morango no Pote', 'Creme branco com morangos frescos e cobertura de chocolate.', 1500, null, null, array['Mais pedido'], '/sofi/bombom-morango-pote.webp', true, true, true, 4),
  ('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-000000000002', 'Copo Pudim', 'Pudim no topo, camadas de bolo, creme e doce de leite.', 1600, null, null, '{}'::text[], '/sofi/copo-pudim.webp', true, true, false, 5),
  ('00000000-0000-4000-9000-000000000006', '00000000-0000-4000-8000-000000000002', 'Bolo no Pote de Prestígio', 'Bolo de chocolate, creme de coco e brigadeiro com granulado, na tampa bolha.', 1600, null, null, '{}'::text[], '/sofi/bolo-pote-prestigio.webp', true, true, false, 6),
  ('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-8000-000000000002', 'Maracujá Trufado', 'Mousse de maracujá em camadas com ganache de chocolate.', 1300, null, null, '{}'::text[], '/sofi/maracuja-trufado.webp', true, true, false, 7),
  ('00000000-0000-4000-9000-000000000008', '00000000-0000-4000-8000-000000000002', 'Mini Pudim', 'Pudim de leite cremoso com calda de caramelo.', 1500, null, null, '{}'::text[], '/sofi/mini-pudim.webp', true, true, false, 8),
  ('00000000-0000-4000-9000-000000000009', '00000000-0000-4000-8000-000000000003', 'Fatia ChocoNinho', 'Bolo de chocolate com recheio e cobertura metade brigadeiro, metade Ninho.', 1800, null, null, '{}'::text[], '/sofi/fatia-choconinho.webp', true, true, true, 9),
  ('00000000-0000-4000-9000-000000000010', '00000000-0000-4000-8000-000000000003', 'Fatia Matilda', 'Bolo de chocolate molhadinho, recheado e coberto com brigadeiro.', 1800, null, null, '{}'::text[], '/sofi/fatia-matilda.webp', true, true, false, 10),
  ('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-8000-000000000003', 'Fatia Olho de Sogra', 'Bolo em camadas com ameixa, doce de leite e coco.', 1800, null, null, '{}'::text[], '/sofi/fatia-olho-de-sogra.webp', true, true, false, 11),
  ('00000000-0000-4000-9000-000000000012', '00000000-0000-4000-8000-000000000003', 'Fatia Brownie', 'Brownie em camadas com recheio de Ninho ou Ninho com Nutella, decorado com morangos. Informe o recheio na observação.', 1800, null, null, '{}'::text[], '/sofi/fatia-brownie.webp', true, true, true, 12),
  ('00000000-0000-4000-9000-000000000013', '00000000-0000-4000-8000-000000000004', 'Bombom de Morango no Palito', 'Morango envolto em creme, coberto com chocolate ao leite ou chocolate branco. Informe a cobertura na observação.', 1800, null, null, '{}'::text[], '/sofi/bombom-morango-palito.webp', true, true, true, 13),
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-8000-000000000004', 'Morango Cravejado', 'Morango inteiro com creme, coberto com chocolate branco e morango crocante.', 1500, null, null, '{}'::text[], '/sofi/morango-cravejado.webp', true, true, true, 14),
  ('00000000-0000-4000-9000-000000000015', '00000000-0000-4000-8000-000000000004', 'Coxinha de Brigadeiro com Morango', 'Caixa com 2 unidades. Sabores: Ninho com Nutella + Ferrero Rocher, ou Chocolate + Ninho com Nutella. Informe a opção na observação.', 1700, null, '2 unidades', '{}'::text[], '/sofi/coxinha-brigadeiro-morango.webp', true, true, true, 15),
  ('00000000-0000-4000-9000-000000000016', '00000000-0000-4000-8000-000000000004', 'Brownie no Palito', 'Brownie recheado com Ninho com Nutella e cobertura de chocolate.', 1800, null, null, '{}'::text[], '/sofi/brownie-no-palito.webp', true, true, false, 16),
  ('00000000-0000-4000-9000-000000000017', '00000000-0000-4000-8000-000000000005', 'Palha Italiana de Ferrero Rocher', 'Coberta com castanhas crocantes e fios de chocolate.', 1400, null, null, '{}'::text[], '/sofi/palha-italiana-ferrero.webp', true, true, false, 17),
  ('00000000-0000-4000-9000-000000000018', '00000000-0000-4000-8000-000000000005', 'Palha Italiana de Ninho com Nutella', 'Palha italiana de Leite Ninho com recheio de Nutella.', 1400, null, null, '{}'::text[], '/sofi/palha-italiana-ninho-nutella.webp', true, true, false, 18)
on conflict (id) do nothing;

