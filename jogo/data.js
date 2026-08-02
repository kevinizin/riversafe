/* ============================================================
   HortaPop — Banco de palavras
   en = inglês | pt = português | ph = pronúncia aproximada
   art = { s: forma, c: cor principal, c2: cor secundária }
   ============================================================ */

const ITEMS = [
  /* ---------- FRUTAS ---------- */
  { id:'apple', en:'Apple', pt:'Maçã', ph:'É-pol', cat:'fruit', emoji:'🍎',
    art:{ s:'apple', c:'#e4342f' },
    ex:'I eat an apple every morning.', exPt:'Eu como uma maçã toda manhã.' },

  { id:'banana', en:'Banana', pt:'Banana', ph:'ba-NÉ-na', cat:'fruit', emoji:'🍌',
    art:{ s:'banana', c:'#f5ce3e' },
    ex:'The banana is very sweet.', exPt:'A banana é bem doce.' },

  { id:'orange', en:'Orange', pt:'Laranja', ph:'Ó-rindj', cat:'fruit', emoji:'🍊',
    art:{ s:'citrus', c:'#ff9126' },
    ex:'I drink orange juice.', exPt:'Eu bebo suco de laranja.',
    note:'“Orange” também é a cor laranja.' },

  { id:'grape', en:'Grape', pt:'Uva', ph:'greip', cat:'fruit', emoji:'🍇',
    art:{ s:'cluster', c:'#7a3fa0' },
    ex:'These grapes are green.', exPt:'Estas uvas são verdes.' },

  { id:'strawberry', en:'Strawberry', pt:'Morango', ph:'STRÓ-be-ri', cat:'fruit', emoji:'🍓',
    art:{ s:'strawberry', c:'#e4342f' },
    ex:'I love strawberry cake.', exPt:'Eu amo bolo de morango.' },

  { id:'watermelon', en:'Watermelon', pt:'Melancia', ph:'UÓ-ter-mé-lon', cat:'fruit', emoji:'🍉',
    art:{ s:'slice', c:'#f0506e', c2:'#4caf50' },
    ex:'Watermelon is perfect in summer.', exPt:'Melancia é perfeita no verão.',
    note:'water (água) + melon (melão) = melancia.' },

  { id:'pineapple', en:'Pineapple', pt:'Abacaxi', ph:'PÁIN-é-pol', cat:'fruit', emoji:'🍍',
    art:{ s:'pineapple', c:'#f2b233' },
    ex:'The pineapple is sweet and sour.', exPt:'O abacaxi é doce e azedo.',
    note:'pine (pinheiro) + apple (maçã).' },

  { id:'lemon', en:'Lemon', pt:'Limão siciliano', ph:'LÉ-mon', cat:'fruit', emoji:'🍋',
    art:{ s:'lemon', c:'#f7de3a' },
    ex:'Add lemon to the fish.', exPt:'Coloque limão no peixe.',
    note:'Amarelo = lemon. Verde = lime.' },

  { id:'lime', en:'Lime', pt:'Limão (verde)', ph:'laim', cat:'fruit', emoji:'🍈',
    art:{ s:'lemon', c:'#8cc63e' },
    ex:'I want lime in my water.', exPt:'Quero limão na minha água.' },

  { id:'pear', en:'Pear', pt:'Pera', ph:'pér', cat:'fruit', emoji:'🍐',
    art:{ s:'pear', c:'#b7d14a' },
    ex:'This pear is very juicy.', exPt:'Esta pera é bem suculenta.' },

  { id:'peach', en:'Peach', pt:'Pêssego', ph:'pítch', cat:'fruit', emoji:'🍑',
    art:{ s:'peach', c:'#ffab7c' },
    ex:'The peach has soft skin.', exPt:'O pêssego tem a casca macia.' },

  { id:'mango', en:'Mango', pt:'Manga', ph:'MÉN-gou', cat:'fruit', emoji:'🥭',
    art:{ s:'mango', c:'#f2a03d' },
    ex:'Mango is my favorite fruit.', exPt:'Manga é minha fruta favorita.' },

  { id:'cherry', en:'Cherry', pt:'Cereja', ph:'TCHÉ-ri', cat:'fruit', emoji:'🍒',
    art:{ s:'cherries', c:'#d42a3a' },
    ex:'There is a cherry on the cake.', exPt:'Tem uma cereja no bolo.' },

  { id:'kiwi', en:'Kiwi', pt:'Kiwi', ph:'KÍ-ui', cat:'fruit', emoji:'🥝',
    art:{ s:'kiwi', c:'#8b6b3e' },
    ex:'Kiwi has a lot of vitamin C.', exPt:'O kiwi tem muita vitamina C.' },

  { id:'coconut', en:'Coconut', pt:'Coco', ph:'KÔ-co-nãt', cat:'fruit', emoji:'🥥',
    art:{ s:'coconut', c:'#8b5e3c' },
    ex:'I drink coconut water.', exPt:'Eu bebo água de coco.' },

  { id:'melon', en:'Melon', pt:'Melão', ph:'MÉ-lon', cat:'fruit', emoji:'🍈',
    art:{ s:'melon', c:'#d9e27a' },
    ex:'The melon is cold and fresh.', exPt:'O melão está gelado e fresco.' },

  { id:'blueberry', en:'Blueberry', pt:'Mirtilo', ph:'BLÚ-bé-ri', cat:'fruit', emoji:'🫐',
    art:{ s:'berries', c:'#4a6fd4' },
    ex:'Blueberries are small and blue.', exPt:'Mirtilos são pequenos e azuis.',
    note:'blue (azul) + berry (fruta pequena).' },

  { id:'raspberry', en:'Raspberry', pt:'Framboesa', ph:'RÉZ-bé-ri', cat:'fruit', emoji:'🍇',
    art:{ s:'drupelet', c:'#d63a6a' },
    ex:'Raspberry jam is delicious.', exPt:'Geleia de framboesa é deliciosa.' },

  { id:'blackberry', en:'Blackberry', pt:'Amora', ph:'BLÉK-bé-ri', cat:'fruit', emoji:'🍇',
    art:{ s:'drupelet', c:'#3a2e52' },
    ex:'I found blackberries in the garden.', exPt:'Achei amoras no quintal.' },

  { id:'papaya', en:'Papaya', pt:'Mamão', ph:'pa-PÁI-a', cat:'fruit', emoji:'🍈',
    art:{ s:'papaya', c:'#f0913a' },
    ex:'I eat papaya for breakfast.', exPt:'Eu como mamão no café da manhã.' },

  { id:'guava', en:'Guava', pt:'Goiaba', ph:'GUÁ-va', cat:'fruit', emoji:'🍐',
    art:{ s:'round', c:'#9fc96a', c2:'#e4626f' },
    ex:'Guava is red inside.', exPt:'A goiaba é vermelha por dentro.' },

  { id:'passionfruit', en:'Passion fruit', pt:'Maracujá', ph:'PÉ-shon frút', cat:'fruit', emoji:'🍋',
    art:{ s:'round', c:'#f0b93a' },
    ex:'Passion fruit juice is sour.', exPt:'Suco de maracujá é azedo.' },

  { id:'avocado', en:'Avocado', pt:'Abacate', ph:'á-vo-CÁ-dou', cat:'fruit', emoji:'🥑',
    art:{ s:'avocado', c:'#5e8c3a' },
    ex:'I make juice with avocado.', exPt:'Eu faço suco com abacate.' },

  { id:'tangerine', en:'Tangerine', pt:'Tangerina / Mexerica', ph:'tãn-dje-RÍN', cat:'fruit', emoji:'🍊',
    art:{ s:'citrus', c:'#ff7a1a' },
    ex:'A tangerine is easy to peel.', exPt:'A tangerina é fácil de descascar.' },

  { id:'plum', en:'Plum', pt:'Ameixa', ph:'plãm', cat:'fruit', emoji:'🍇',
    art:{ s:'oval', c:'#7b3e8f' },
    ex:'The plum is dark purple.', exPt:'A ameixa é roxa escura.' },

  { id:'fig', en:'Fig', pt:'Figo', ph:'fíg', cat:'fruit', emoji:'🍐',
    art:{ s:'fig', c:'#6b3a6e' },
    ex:'Figs grow on a fig tree.', exPt:'Figos crescem na figueira.' },

  { id:'pomegranate', en:'Pomegranate', pt:'Romã', ph:'PÓM-gra-nét', cat:'fruit', emoji:'🍎',
    art:{ s:'pomegranate', c:'#c22a3a' },
    ex:'A pomegranate has many seeds.', exPt:'A romã tem muitas sementes.' },

  { id:'apricot', en:'Apricot', pt:'Damasco', ph:'ÉI-pri-cót', cat:'fruit', emoji:'🍑',
    art:{ s:'peach', c:'#ffa95c', k:0.82 },
    ex:'Dried apricots are sweet.', exPt:'Damascos secos são doces.' },

  { id:'persimmon', en:'Persimmon', pt:'Caqui', ph:'per-SÍ-mon', cat:'fruit', emoji:'🍅',
    art:{ s:'round', c:'#f2762e' },
    ex:'Persimmon is soft when ripe.', exPt:'O caqui é mole quando maduro.' },

  { id:'starfruit', en:'Starfruit', pt:'Carambola', ph:'STÁR-frút', cat:'fruit', emoji:'⭐',
    art:{ s:'star', c:'#f2d13a' },
    ex:'Starfruit looks like a star.', exPt:'A carambola parece uma estrela.' },

  { id:'cashew', en:'Cashew', pt:'Caju', ph:'KÉ-shu', cat:'fruit', emoji:'🥜',
    art:{ s:'cashew', c:'#f2b02e' },
    ex:'The cashew nut is on the outside.', exPt:'A castanha do caju fica por fora.' },

  { id:'soursop', en:'Soursop', pt:'Graviola', ph:'SÁUER-sóp', cat:'fruit', emoji:'🍈',
    art:{ s:'spiky', c:'#8fbf5a' },
    ex:'Soursop ice cream is famous.', exPt:'Sorvete de graviola é famoso.' },

  { id:'jackfruit', en:'Jackfruit', pt:'Jaca', ph:'DJÉK-frút', cat:'fruit', emoji:'🍈',
    art:{ s:'spiky', c:'#c9b03a' },
    ex:'Jackfruit is a very big fruit.', exPt:'A jaca é uma fruta bem grande.' },

  { id:'grapefruit', en:'Grapefruit', pt:'Toranja', ph:'GREIP-frút', cat:'fruit', emoji:'🍊',
    art:{ s:'citrus', c:'#f4795e' },
    ex:'Grapefruit is a little bitter.', exPt:'A toranja é um pouco amarga.' },

  { id:'acerola', en:'Acerola', pt:'Acerola', ph:'a-se-RÔ-la', cat:'fruit', emoji:'🍒',
    art:{ s:'round', c:'#e42f3a' },
    ex:'Acerola has a lot of vitamin C.', exPt:'A acerola tem muita vitamina C.' },

  { id:'date', en:'Date', pt:'Tâmara', ph:'déit', cat:'fruit', emoji:'🥜',
    art:{ s:'oval', c:'#8b5a2b' },
    ex:'Dates are very sweet.', exPt:'Tâmaras são bem doces.',
    note:'“Date” também significa data (do calendário).' },

  /* ---------- LEGUMES ---------- */
  { id:'tomato', en:'Tomato', pt:'Tomate', ph:'to-MÊI-tou', cat:'veg', emoji:'🍅',
    art:{ s:'tomato', c:'#e63329' },
    ex:'I put tomato in the salad.', exPt:'Eu coloco tomate na salada.' },

  { id:'carrot', en:'Carrot', pt:'Cenoura', ph:'KÉ-rot', cat:'veg', emoji:'🥕',
    art:{ s:'cone', c:'#f2762e' },
    ex:'Rabbits love carrots.', exPt:'Coelhos amam cenouras.' },

  { id:'potato', en:'Potato', pt:'Batata', ph:'po-TÊI-tou', cat:'veg', emoji:'🥔',
    art:{ s:'tuber', c:'#c9a06a' },
    ex:'French fries are made of potato.', exPt:'Batata frita é feita de batata.' },

  { id:'sweetpotato', en:'Sweet potato', pt:'Batata-doce', ph:'suít po-TÊI-tou', cat:'veg', emoji:'🍠',
    art:{ s:'tuber', c:'#c4623a' },
    ex:'Sweet potato is orange inside.', exPt:'A batata-doce é laranja por dentro.' },

  { id:'onion', en:'Onion', pt:'Cebola', ph:'Ã-nion', cat:'veg', emoji:'🧅',
    art:{ s:'bulb', c:'#d9a05b' },
    ex:'The onion makes me cry.', exPt:'A cebola me faz chorar.' },

  { id:'garlic', en:'Garlic', pt:'Alho', ph:'GÁR-lic', cat:'veg', emoji:'🧄',
    art:{ s:'garlic', c:'#f0e6d2' },
    ex:'Put garlic in the rice.', exPt:'Coloque alho no arroz.' },

  { id:'corn', en:'Corn', pt:'Milho', ph:'córn', cat:'veg', emoji:'🌽',
    art:{ s:'cob', c:'#f5ce3e' },
    ex:'I like corn on the cob.', exPt:'Eu gosto de milho na espiga.' },

  { id:'cucumber', en:'Cucumber', pt:'Pepino', ph:'KIÚ-cãm-ber', cat:'veg', emoji:'🥒',
    art:{ s:'cylinder', c:'#4e9c42' },
    ex:'Cucumber is fresh and crunchy.', exPt:'Pepino é fresco e crocante.' },

  { id:'bellpepper', en:'Bell pepper', pt:'Pimentão', ph:'bél PÉ-per', cat:'veg', emoji:'🫑',
    art:{ s:'bell', c:'#e63329' },
    ex:'The bell pepper is red.', exPt:'O pimentão é vermelho.' },

  { id:'chilipepper', en:'Chili pepper', pt:'Pimenta', ph:'TCHÍ-li PÉ-per', cat:'veg', emoji:'🌶️',
    art:{ s:'chili', c:'#d42a22' },
    ex:'This chili pepper is very hot!', exPt:'Esta pimenta é bem ardida!' },

  { id:'eggplant', en:'Eggplant', pt:'Berinjela', ph:'ÉG-plant', cat:'veg', emoji:'🍆',
    art:{ s:'eggplant', c:'#6a3a8f' },
    ex:'Eggplant is purple.', exPt:'A berinjela é roxa.',
    note:'egg (ovo) + plant (planta).' },

  { id:'mushroom', en:'Mushroom', pt:'Cogumelo', ph:'MÃCH-rum', cat:'veg', emoji:'🍄',
    art:{ s:'mushroom', c:'#c4784a' },
    ex:'I want mushrooms on my pizza.', exPt:'Quero cogumelos na minha pizza.' },

  { id:'broccoli', en:'Broccoli', pt:'Brócolis', ph:'BRÓ-co-li', cat:'veg', emoji:'🥦',
    art:{ s:'tree', c:'#3e8c4a' },
    ex:'Broccoli looks like a little tree.', exPt:'O brócolis parece uma arvorezinha.' },

  { id:'cauliflower', en:'Cauliflower', pt:'Couve-flor', ph:'KÓ-li-flauer', cat:'veg', emoji:'🥦',
    art:{ s:'tree', c:'#f0ead6' },
    ex:'Cauliflower is white.', exPt:'A couve-flor é branca.' },

  { id:'pea', en:'Pea', pt:'Ervilha', ph:'pí', cat:'veg', emoji:'🫛',
    art:{ s:'pod', c:'#6fb03a' },
    ex:'There are six peas in the pod.', exPt:'Tem seis ervilhas na vagem.' },

  { id:'bean', en:'Bean', pt:'Feijão', ph:'bín', cat:'veg', emoji:'🫘',
    art:{ s:'beans', c:'#8b4a2b' },
    ex:'We eat rice and beans.', exPt:'Nós comemos arroz e feijão.' },

  { id:'greenbean', en:'Green bean', pt:'Vagem', ph:'grín bín', cat:'veg', emoji:'🫛',
    art:{ s:'podlong', v:'thin', c:'#5ea83a' },
    ex:'Green beans are long and thin.', exPt:'Vagens são compridas e finas.' },

  { id:'pumpkin', en:'Pumpkin', pt:'Abóbora', ph:'PÃMP-kin', cat:'veg', emoji:'🎃',
    art:{ s:'pumpkin', c:'#f2842e' },
    ex:'Pumpkin soup is warm.', exPt:'Sopa de abóbora é quentinha.' },

  { id:'zucchini', en:'Zucchini', pt:'Abobrinha', ph:'zu-KÍ-ni', cat:'veg', emoji:'🥒',
    art:{ s:'cylinder', c:'#3e7c3a' },
    ex:'I fry zucchini with garlic.', exPt:'Eu frito abobrinha com alho.' },

  { id:'beet', en:'Beet', pt:'Beterraba', ph:'bít', cat:'veg', emoji:'🍠',
    art:{ s:'beet', c:'#9c2a54' },
    ex:'Beet juice is dark red.', exPt:'Suco de beterraba é vermelho escuro.' },

  { id:'radish', en:'Radish', pt:'Rabanete', ph:'RÉ-dich', cat:'veg', emoji:'🍅',
    art:{ s:'radish', c:'#e4425e' },
    ex:'The radish is small and red.', exPt:'O rabanete é pequeno e vermelho.' },

  { id:'turnip', en:'Turnip', pt:'Nabo', ph:'TÉR-nip', cat:'veg', emoji:'🥔',
    art:{ s:'radish', c:'#efe7f0', c2:'#9a6fc4' },
    ex:'Turnip is white and purple.', exPt:'O nabo é branco e roxo.' },

  { id:'cassava', en:'Cassava', pt:'Mandioca', ph:'ca-SÁ-va', cat:'veg', emoji:'🥔',
    art:{ s:'root', c:'#8b6b4a' },
    ex:'Fried cassava is delicious.', exPt:'Mandioca frita é deliciosa.' },

  { id:'yam', en:'Yam', pt:'Inhame', ph:'iám', cat:'veg', emoji:'🥔',
    art:{ s:'root', c:'#6d5238' },
    ex:'Yam is good for your health.', exPt:'O inhame faz bem para a saúde.' },

  { id:'chayote', en:'Chayote', pt:'Chuchu', ph:'tchai-Ó-ti', cat:'veg', emoji:'🥒',
    art:{ s:'pear', c:'#9cc46a' },
    ex:'Chayote has a soft taste.', exPt:'O chuchu tem sabor suave.' },

  { id:'okra', en:'Okra', pt:'Quiabo', ph:'ÔU-kra', cat:'veg', emoji:'🫛',
    art:{ s:'podlong', c:'#5e9c3a' },
    ex:'Okra is used in Brazilian food.', exPt:'O quiabo é usado na comida brasileira.' },

  { id:'asparagus', en:'Asparagus', pt:'Aspargo', ph:'as-PÉ-ra-gãs', cat:'veg', emoji:'🌿',
    art:{ s:'stalk', c:'#6fa83a' },
    ex:'Asparagus grows very fast.', exPt:'O aspargo cresce bem rápido.' },

  { id:'ginger', en:'Ginger', pt:'Gengibre', ph:'DJÍN-djer', cat:'veg', emoji:'🫚',
    art:{ s:'ginger', c:'#d9b07a' },
    ex:'Ginger tea helps my throat.', exPt:'Chá de gengibre ajuda minha garganta.' },

  { id:'leek', en:'Leek', pt:'Alho-poró', ph:'lík', cat:'veg', emoji:'🌿',
    art:{ s:'leek', c:'#7fbf4a' },
    ex:'Leek soup is very tasty.', exPt:'Sopa de alho-poró é bem gostosa.' },

  { id:'celery', en:'Celery', pt:'Aipo / Salsão', ph:'SÉ-le-ri', cat:'veg', emoji:'🌿',
    art:{ s:'stalks', c:'#9cc44a' },
    ex:'Celery is crunchy.', exPt:'O aipo é crocante.' },

  { id:'artichoke', en:'Artichoke', pt:'Alcachofra', ph:'ÁR-ti-tchouk', cat:'veg', emoji:'🌿',
    art:{ s:'artichoke', c:'#7a9c5a' },
    ex:'Artichoke has many leaves.', exPt:'A alcachofra tem muitas folhas.' },

  /* ---------- VERDURAS ---------- */
  { id:'lettuce', en:'Lettuce', pt:'Alface', ph:'LÉ-tis', cat:'green', emoji:'🥬',
    art:{ s:'head', v:'loose', c:'#8fc94a' },
    ex:'The salad has lettuce and tomato.', exPt:'A salada tem alface e tomate.' },

  { id:'cabbage', en:'Cabbage', pt:'Repolho', ph:'KÉ-bidj', cat:'green', emoji:'🥬',
    art:{ s:'head', v:'tight', c:'#7cb342' },
    ex:'Cabbage is round and heavy.', exPt:'O repolho é redondo e pesado.' },

  { id:'kale', en:'Kale', pt:'Couve', ph:'kêiu', cat:'green', emoji:'🥬',
    art:{ s:'leaves', v:'curly', c:'#2f6b3a' },
    ex:'Kale goes well with feijoada.', exPt:'Couve combina com feijoada.' },

  { id:'spinach', en:'Spinach', pt:'Espinafre', ph:'SPÍ-nitch', cat:'green', emoji:'🥬',
    art:{ s:'leaves', v:'round', c:'#3e8c3a' },
    ex:'Spinach makes you strong.', exPt:'Espinafre deixa você forte.' },

  { id:'arugula', en:'Arugula', pt:'Rúcula', ph:'a-RÚ-gu-la', cat:'green', emoji:'🥬',
    art:{ s:'leaves', v:'lobed', c:'#5e9c3a' },
    ex:'Arugula has a strong taste.', exPt:'A rúcula tem sabor forte.' },

  { id:'watercress', en:'Watercress', pt:'Agrião', ph:'UÓ-ter-crés', cat:'green', emoji:'🌿',
    art:{ s:'sprig', v:'round', c:'#4e9c4a' },
    ex:'Watercress grows in water.', exPt:'O agrião cresce na água.' },

  /* ---------- TEMPEROS VERDES ---------- */
  { id:'parsley', en:'Parsley', pt:'Salsinha', ph:'PÁRS-li', cat:'herb', emoji:'🌿',
    art:{ s:'sprig', c:'#3e8c3a' },
    ex:'Put parsley on the soup.', exPt:'Coloque salsinha na sopa.' },

  { id:'cilantro', en:'Cilantro', pt:'Coentro', ph:'si-LÁN-trou', cat:'herb', emoji:'🌿',
    art:{ s:'sprig', v:'fan', c:'#5ea83a' },
    ex:'Some people hate cilantro.', exPt:'Algumas pessoas odeiam coentro.' },

  { id:'chives', en:'Chives', pt:'Cebolinha', ph:'tcháivs', cat:'herb', emoji:'🌿',
    art:{ s:'stalks', c:'#4e9c3a' },
    ex:'Chives are thin and green.', exPt:'A cebolinha é fina e verde.' },

  { id:'basil', en:'Basil', pt:'Manjericão', ph:'BÊI-zol', cat:'herb', emoji:'🌿',
    art:{ s:'sprig', v:'big', c:'#3e7c3a' },
    ex:'Basil is great with tomato.', exPt:'Manjericão é ótimo com tomate.' },

  { id:'mint', en:'Mint', pt:'Hortelã', ph:'mínt', cat:'herb', emoji:'🌿',
    art:{ s:'sprig', v:'mint', c:'#4fb85e' },
    ex:'Mint tea is refreshing.', exPt:'Chá de hortelã é refrescante.' },
];

/* Mapa rápido id -> item */
const BY_ID = {};
ITEMS.forEach(function (it) { BY_ID[it.id] = it; });

/* Rótulos de categoria */
const CATS = {
  fruit: { label: 'Fruta',   color: '#ff6b6b' },
  veg:   { label: 'Legume',  color: '#ff9f43' },
  green: { label: 'Verdura', color: '#26a65b' },
  herb:  { label: 'Tempero', color: '#12b886' },
};

/* ============================================================
   FASES — cada fase apresenta palavras novas e revisa as antigas
   ============================================================ */
const LEVELS = [
  { id:1,  name:'Frutas do dia a dia', emoji:'🍎', color:'#ff6b6b',
    items:['apple','banana','orange','grape','strawberry','watermelon'] },

  { id:2,  name:'Mais frutas',         emoji:'🍍', color:'#ffa94d',
    items:['pineapple','lemon','lime','pear','peach','cherry'] },

  { id:3,  name:'Frutas tropicais',    emoji:'🥭', color:'#ff922b',
    items:['mango','papaya','coconut','guava','passionfruit','avocado'] },

  { id:4,  name:'Frutinhas e berries', emoji:'🫐', color:'#845ef7',
    items:['kiwi','melon','blueberry','raspberry','blackberry','plum'] },

  { id:5,  name:'Frutas especiais',    emoji:'⭐', color:'#e64980',
    items:['fig','pomegranate','apricot','persimmon','starfruit','tangerine'] },

  { id:6,  name:'Frutas do Brasil',    emoji:'🌴', color:'#f76707',
    items:['cashew','soursop','jackfruit','acerola','grapefruit','date'] },

  { id:7,  name:'Legumes básicos',     emoji:'🍅', color:'#fa5252',
    items:['tomato','carrot','potato','onion','garlic','corn'] },

  { id:8,  name:'Mais legumes',        emoji:'🫑', color:'#40c057',
    items:['cucumber','bellpepper','chilipepper','eggplant','mushroom','broccoli'] },

  { id:9,  name:'Raízes e tubérculos', emoji:'🥔', color:'#a9756a',
    items:['sweetpotato','cassava','yam','beet','radish','turnip','ginger'] },

  { id:10, name:'Vagens e abóboras',   emoji:'🎃', color:'#f59f00',
    items:['pea','bean','greenbean','okra','chayote','zucchini','pumpkin','cauliflower'] },

  { id:11, name:'Talos e hastes',      emoji:'🌿', color:'#94d82d',
    items:['asparagus','celery','leek','artichoke'] },

  { id:12, name:'Verduras',            emoji:'🥬', color:'#2f9e44',
    items:['lettuce','cabbage','kale','spinach','arugula','watercress'] },

  { id:13, name:'Temperos verdes',     emoji:'🌱', color:'#12b886',
    items:['parsley','cilantro','chives','basil','mint'] },

  { id:14, name:'Desafio final',       emoji:'🏆', color:'#fab005', boss:true,
    items:[] }, // preenchida com tudo
];

// A fase final usa todas as palavras
LEVELS[LEVELS.length - 1].items = ITEMS.map(function (i) { return i.id; });
