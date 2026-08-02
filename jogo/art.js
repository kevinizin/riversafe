/* ============================================================
   HortaPop — Desenhos vetoriais (SVG)
   Cada fruta/legume é desenhado por código, então funciona
   offline, é leve e permite o modo "sombra" (silhueta).
   ============================================================ */

const ART = (function () {

  const SIL = '#2b3a2f';
  let uid = 0;

  /* ---------- utilidades de cor ---------- */
  function hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    }).join('');
  }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  const dark = function (c, t) { return mix(c, '#000000', t || 0.22); };
  const lite = function (c, t) { return mix(c, '#ffffff', t || 0.28); };

  /* ---------- contexto de desenho ---------- */
  function ctx(item, sil) {
    const c = item.art.c;
    const k = {
      sil: sil,
      c: c,
      c2: item.art.c2 || null,
      dk: dark(c),
      dk2: dark(c, 0.38),
      lt: lite(c),
      lt2: lite(c, 0.55),
      uid: 'a' + (++uid),
      v: item.art.v || '',
    };
    // fill consciente de silhueta
    k.f = function (col) { return sil ? SIL : col; };
    // detalhe: some no modo silhueta
    k.d = function (markup) { return sil ? '' : markup; };
    return k;
  }

  /* ---------- peças reutilizáveis ---------- */
  function leaf(k, cx, cy, rot, rx, ry, col) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
      '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')" fill="' + k.f(col || '#57a94a') + '"/>';
  }
  function stem(k, d, w, col) {
    return '<path d="' + d + '" fill="none" stroke="' + k.f(col || '#7d5a3c') +
      '" stroke-width="' + (w || 5) + '" stroke-linecap="round"/>';
  }
  function shine(k, cx, cy, rx, ry, rot) {
    return k.d('<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
      '" transform="rotate(' + (rot || -20) + ' ' + cx + ' ' + cy + ')" fill="#ffffff" opacity=".33"/>');
  }
  function dot(k, cx, cy, r, col) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + k.f(col) + '"/>';
  }
  /* folha com ponta, desenhada de (cx,cy) para a direita */
  function pleaf(k, cx, cy, rot, w, h, col) {
    return '<path d="M' + cx + ' ' + cy +
      ' C ' + (cx + w * 0.28) + ' ' + (cy - h) + ' ' + (cx + w * 0.72) + ' ' + (cy - h * 0.7) + ' ' + (cx + w) + ' ' + cy +
      ' C ' + (cx + w * 0.72) + ' ' + (cy + h * 0.7) + ' ' + (cx + w * 0.28) + ' ' + (cy + h) + ' ' + cx + ' ' + cy + ' Z"' +
      ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')" fill="' + k.f(col) + '"/>';
  }

  /* ---------- formas ---------- */
  const S = {

    apple: function (k) {
      return stem(k, 'M50 30 C 51 22 53 16 58 12', 4) +
        leaf(k, 65, 16, -30, 11, 6) +
        '<path d="M50 33 C 43 22 26 20 18 31 C 8 44 13 64 25 77 C 33 86 44 91 50 88 C 56 91 67 86 75 77 C 87 64 92 44 82 31 C 74 20 57 22 50 33 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 33 C 56 22 73 20 81 31 C 91 44 86 64 74 77 C 66 86 56 91 50 88 Z" fill="' + k.dk + '" opacity=".35"/>') +
        shine(k, 33, 46, 7, 11);
    },

    pear: function (k) {
      return stem(k, 'M50 22 C 51 16 54 12 58 10', 4) +
        leaf(k, 64, 13, -35, 10, 5) +
        '<path d="M50 20 C 43 20 39 27 42 36 C 45 46 27 54 27 68 C 27 83 37 92 50 92 C 63 92 73 83 73 68 C 73 54 55 46 58 36 C 61 27 57 20 50 20 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 20 C 57 20 61 27 58 36 C 55 46 73 54 73 68 C 73 83 63 92 50 92 Z" fill="' + k.dk + '" opacity=".28"/>') +
        shine(k, 38, 62, 7, 12);
    },

    banana: function (k) {
      return '<path d="M17 24 C 21 64 45 87 79 85 C 90 84 91 72 82 70 C 53 68 37 50 33 24 C 31 15 16 15 17 24 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M24 30 C 30 60 48 78 76 78 C 79 78 79 74 76 74 C 50 72 34 54 30 29 Z" fill="' + k.lt + '" opacity=".55"/>') +
        k.d('<circle cx="21" cy="20" r="5" fill="' + k.dk2 + '"/>') +
        k.d('<circle cx="84" cy="80" r="5" fill="' + k.dk2 + '"/>');
    },

    citrus: function (k) {
      return stem(k, 'M50 20 C 50 15 50 13 50 11', 4, '#7a5c3a') +
        leaf(k, 62, 15, -28, 12, 6) +
        '<circle cx="50" cy="56" r="33" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 23 A33 33 0 0 1 83 56 A33 33 0 0 1 50 89 Z" fill="' + k.dk + '" opacity=".22"/>') +
        k.d('<circle cx="50" cy="24" r="4" fill="' + k.dk2 + '"/>') +
        shine(k, 36, 44, 8, 12);
    },

    lemon: function (k) {
      return '<path d="M12 54 C 12 38 29 26 50 26 C 71 26 88 38 88 54 C 88 70 71 82 50 82 C 29 82 12 70 12 54 Z" fill="' + k.f(k.c) + '"/>' +
        '<path d="M10 54 C 6 52 6 49 9 47 L14 51 Z" fill="' + k.f(k.dk) + '"/>' +
        '<path d="M90 54 C 94 52 94 49 91 47 L86 51 Z" fill="' + k.f(k.dk) + '"/>' +
        k.d('<path d="M50 26 C 71 26 88 38 88 54 C 88 70 71 82 50 82 Z" fill="' + k.dk + '" opacity=".2"/>') +
        shine(k, 34, 43, 10, 6, -12);
    },

    cluster: function (k) {
      let g = stem(k, 'M50 26 C 50 18 52 14 56 10', 4) + leaf(k, 64, 14, -30, 11, 6);
      const rows = [[42, 34], [58, 34], [34, 48], [50, 48], [66, 48], [42, 62], [58, 62], [50, 76]];
      rows.forEach(function (p, i) {
        g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="' + k.f(i % 3 === 0 ? k.c : lite(k.c, 0.12)) + '"/>';
        g += k.d('<circle cx="' + (p[0] - 3.5) + '" cy="' + (p[1] - 4) + '" r="3" fill="#ffffff" opacity=".3"/>');
      });
      return g;
    },

    strawberry: function (k) {
      let g = '<path d="M50 92 C 27 78 16 60 16 46 C 16 32 32 24 50 31 C 68 24 84 32 84 46 C 84 60 73 78 50 92 Z" fill="' + k.f(k.c) + '"/>';
      g += k.d('<path d="M50 31 C 68 24 84 32 84 46 C 84 60 73 78 50 92 Z" fill="' + k.dk + '" opacity=".22"/>');
      const seeds = [[38, 44], [50, 42], [62, 44], [32, 56], [44, 56], [56, 56], [68, 56], [40, 68], [50, 70], [60, 68], [50, 82]];
      seeds.forEach(function (p) { g += k.d('<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="1.8" ry="2.6" fill="#ffe98a"/>'); });
      g += leaf(k, 50, 24, 0, 16, 6, '#4ea33f') + leaf(k, 36, 27, 25, 12, 5, '#57ad46') + leaf(k, 64, 27, -25, 12, 5, '#57ad46');
      g += stem(k, 'M50 22 L50 12', 4, '#4ea33f');
      return g;
    },

    slice: function (k) {
      const g2 = k.c2 || '#4caf50';
      return '<path d="M10 74 A40 40 0 0 1 90 74 Z" fill="' + k.f(g2) + '"/>' +
        '<path d="M16 74 A34 34 0 0 1 84 74 Z" fill="' + k.f('#f6f7f0') + '"/>' +
        '<path d="M20 74 A30 30 0 0 1 80 74 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<ellipse cx="38" cy="60" rx="2.4" ry="3.4" fill="#3a2a20"/>') +
        k.d('<ellipse cx="50" cy="54" rx="2.4" ry="3.4" fill="#3a2a20"/>') +
        k.d('<ellipse cx="62" cy="60" rx="2.4" ry="3.4" fill="#3a2a20"/>') +
        k.d('<ellipse cx="50" cy="68" rx="2.4" ry="3.4" fill="#3a2a20"/>');
    },

    pineapple: function (k) {
      let g = '';
      [[50, -4, 18], [34, -28, 15], [66, 28, 15], [40, -14, 12], [60, 14, 12]].forEach(function (p) {
        g += '<path d="M' + p[0] + ' 34 C ' + (p[0] - 5) + ' 22 ' + (p[0] - 3) + ' 10 ' + p[0] + ' 4 C ' + (p[0] + 3) + ' 10 ' + (p[0] + 5) + ' 22 ' + p[0] + ' 34 Z" fill="' + k.f('#4ea33f') + '" transform="rotate(' + p[1] + ' ' + p[0] + ' 34)"/>';
      });
      g += '<ellipse cx="50" cy="63" rx="27" ry="31" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        let h = '';
        for (let i = -3; i <= 3; i++) {
          h += '<path d="M' + (50 + i * 11) + ' 30 L' + (50 + i * 11 + 22) + ' 98" stroke="' + k.dk + '" stroke-width="1.8" opacity=".5" fill="none"/>';
          h += '<path d="M' + (50 + i * 11) + ' 30 L' + (50 + i * 11 - 22) + ' 98" stroke="' + k.dk + '" stroke-width="1.8" opacity=".5" fill="none"/>';
        }
        g += '<defs><clipPath id="cp' + k.uid + '"><ellipse cx="50" cy="63" rx="27" ry="31"/></clipPath></defs>' +
          '<g clip-path="url(#cp' + k.uid + ')">' + h + '</g>';
      }
      return g;
    },

    peach: function (k) {
      return leaf(k, 64, 20, -30, 11, 5) + stem(k, 'M52 26 C 54 20 56 17 59 15', 4) +
        '<circle cx="50" cy="58" r="32" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 26 A32 32 0 0 1 50 90" fill="' + k.dk + '" opacity=".18"/>') +
        k.d('<path d="M50 27 C 44 40 44 76 50 89" stroke="' + k.dk2 + '" stroke-width="2" fill="none" opacity=".5"/>') +
        shine(k, 36, 46, 8, 12);
    },

    mango: function (k) {
      const body = 'M28 78 C 13 62 18 36 42 26 C 63 17 84 27 84 47 C 84 70 48 94 28 78 Z';
      return stem(k, 'M64 26 C 66 20 68 16 70 13', 4) +
        '<path d="' + body + '" fill="' + k.f(k.c) + '"/>' +
        k.d('<defs><clipPath id="cp' + k.uid + '"><path d="' + body + '"/></clipPath></defs>' +
          '<g clip-path="url(#cp' + k.uid + ')"><path d="M46 14 C 74 14 96 34 96 62 L96 8 Z" fill="' + (k.c2 || '#e4342f') + '" opacity=".5"/></g>') +
        shine(k, 40, 44, 8, 13, -35);
    },

    cherries: function (k) {
      return stem(k, 'M38 62 C 40 40 46 24 56 14', 4, '#4ea33f') +
        stem(k, 'M66 66 C 62 44 58 28 56 14', 4, '#4ea33f') +
        leaf(k, 70, 18, -25, 13, 6) +
        '<circle cx="34" cy="70" r="17" fill="' + k.f(k.c) + '"/>' +
        '<circle cx="68" cy="74" r="15" fill="' + k.f(dark(k.c, 0.12)) + '"/>' +
        shine(k, 27, 63, 5, 7) + shine(k, 62, 68, 4, 6);
    },

    kiwi: function (k) {
      return '<ellipse cx="50" cy="55" rx="35" ry="32" fill="' + k.f(k.c) + '"/>' +
        k.d('<ellipse cx="50" cy="55" rx="30" ry="27" fill="#9dc35a"/>') +
        k.d('<ellipse cx="50" cy="55" rx="11" ry="10" fill="#f4f6e4"/>') +
        (function () {
          if (k.sil) return '';
          let s = '';
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            s += '<ellipse cx="' + (50 + Math.cos(a) * 19) + '" cy="' + (55 + Math.sin(a) * 17) + '" rx="1.7" ry="2.6" fill="#2f2a1c"/>';
          }
          return s;
        })();
    },

    coconut: function (k) {
      return '<circle cx="50" cy="55" r="33" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 22 A33 33 0 0 1 50 88 Z" fill="' + k.dk + '" opacity=".28"/>') +
        k.d('<path d="M28 34 C 40 48 44 66 42 84 M50 24 C 50 46 52 66 56 86 M70 34 C 62 48 60 66 62 82" ' +
          'stroke="' + k.dk2 + '" stroke-width="2" fill="none" opacity=".45"/>') +
        k.d('<circle cx="42" cy="38" r="3.6" fill="' + k.dk2 + '"/>') +
        k.d('<circle cx="56" cy="36" r="3.6" fill="' + k.dk2 + '"/>') +
        k.d('<circle cx="49" cy="47" r="3.6" fill="' + k.dk2 + '"/>') +
        shine(k, 33, 44, 6, 10);
    },

    melon: function (k) {
      let g = '<ellipse cx="50" cy="56" rx="35" ry="31" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        for (let i = -2; i <= 2; i++) {
          g += '<path d="M' + (50 + i * 13) + ' 27 C ' + (50 + i * 17) + ' 45 ' + (50 + i * 17) + ' 67 ' + (50 + i * 13) + ' 85" stroke="' + k.lt2 + '" stroke-width="3" fill="none" opacity=".7"/>';
        }
      }
      g += stem(k, 'M50 26 C 50 20 52 17 55 15', 4);
      return g;
    },

    berries: function (k) {
      let g = '';
      [[34, 62, 15], [66, 60, 14], [50, 40, 13]].forEach(function (p) {
        g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + k.f(k.c) + '"/>';
        g += k.d('<path d="M' + p[0] + ' ' + (p[1] - p[2] + 3) + ' l4 3 l-4 3 l-4 -3 Z" fill="' + k.dk2 + '"/>');
        g += k.d('<circle cx="' + (p[0] - 4) + '" cy="' + (p[1] + 3) + '" r="3.5" fill="#ffffff" opacity=".22"/>');
      });
      return g;
    },

    drupelet: function (k) {
      let g = '';
      const pts = [[50, 30], [39, 40], [61, 40], [30, 52], [50, 50], [70, 52], [39, 63], [61, 63], [50, 75]];
      pts.forEach(function (p, i) {
        g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="10.5" fill="' + k.f(i % 2 ? k.c : lite(k.c, 0.14)) + '"/>';
      });
      g += leaf(k, 40, 22, 40, 10, 5) + leaf(k, 60, 22, -40, 10, 5);
      return g;
    },

    papaya: function (k) {
      return stem(k, 'M50 16 L50 9', 4) +
        '<path d="M50 14 C 34 20 26 40 28 60 C 30 79 39 90 50 90 C 61 90 70 79 72 60 C 74 40 66 20 50 14 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 14 C 66 20 74 40 72 60 C 70 79 61 90 50 90 Z" fill="' + k.dk + '" opacity=".25"/>') +
        shine(k, 40, 52, 6, 14);
    },

    round: function (k) {
      return stem(k, 'M50 22 C 50 16 51 13 53 11', 4) + leaf(k, 62, 16, -30, 11, 5) +
        '<circle cx="50" cy="56" r="32" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 24 A32 32 0 0 1 50 88 Z" fill="' + k.dk + '" opacity=".2"/>') +
        shine(k, 36, 45, 8, 11);
    },

    avocado: function (k) {
      return stem(k, 'M50 18 L50 11', 4) +
        '<path d="M50 16 C 38 22 33 34 35 46 C 37 58 24 66 24 76 C 24 87 36 94 50 94 C 64 94 76 87 76 76 C 76 66 63 58 65 46 C 67 34 62 22 50 16 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 26 C 42 31 39 39 41 48 C 43 58 32 65 32 74 C 32 82 40 87 50 87 C 60 87 68 82 68 74 C 68 65 57 58 59 48 C 61 39 58 31 50 26 Z" fill="#dbe86f"/>') +
        k.d('<circle cx="50" cy="70" r="13" fill="#a2703f"/>');
    },

    oval: function (k) {
      return stem(k, 'M50 22 L52 14', 4) +
        '<ellipse cx="50" cy="57" rx="26" ry="33" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 24 A26 33 0 0 1 50 90 Z" fill="' + k.dk + '" opacity=".22"/>') +
        k.d('<path d="M50 26 C 45 42 45 72 50 88" stroke="' + k.dk2 + '" stroke-width="2" fill="none" opacity=".4"/>') +
        shine(k, 38, 46, 6, 11);
    },

    fig: function (k) {
      const body = 'M50 18 C 46 26 44 31 39 36 C 27 45 21 58 23 69 C 25 82 35 90 50 90 C 65 90 75 82 77 69 C 79 58 73 45 61 36 C 56 31 54 26 50 18 Z';
      return stem(k, 'M50 20 L50 10', 4, '#5d8a3a') + leaf(k, 58, 13, -30, 9, 4, '#5d8a3a') +
        '<path d="' + body + '" fill="' + k.f(k.c) + '"/>' +
        k.d('<defs><clipPath id="cp' + k.uid + '"><path d="' + body + '"/></clipPath></defs>' +
          '<g clip-path="url(#cp' + k.uid + ')"><rect x="50" y="0" width="60" height="100" fill="' + k.dk + '" opacity=".26"/></g>') +
        shine(k, 38, 60, 6, 11);
    },

    pomegranate: function (k) {
      return '<path d="M50 28 L44 16 L50 20 L56 16 Z" fill="' + k.f(k.dk2) + '"/>' +
        '<path d="M42 20 L46 26 M58 20 L54 26" stroke="' + k.f(k.dk2) + '" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="50" cy="58" r="32" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 26 A32 32 0 0 1 50 90 Z" fill="' + k.dk + '" opacity=".25"/>') +
        shine(k, 36, 47, 8, 11);
    },

    star: function (k) {
      let pts = '';
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 17 : 40, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        pts += (50 + Math.cos(a) * r) + ',' + (55 + Math.sin(a) * r) + ' ';
      }
      return '<polygon points="' + pts + '" fill="' + k.f(k.c) + '"/>' +
        k.d('<circle cx="50" cy="55" r="7" fill="' + k.dk + '" opacity=".4"/>');
    },

    cashew: function (k) {
      const body = 'M50 12 C 32 12 24 26 26 42 C 28 60 38 72 50 72 C 62 72 72 60 74 42 C 76 26 68 12 50 12 Z';
      return stem(k, 'M50 14 L50 5', 4, '#5d8a3a') +
        '<path d="' + body + '" fill="' + k.f(k.c) + '"/>' +
        k.d('<defs><clipPath id="cp' + k.uid + '"><path d="' + body + '"/></clipPath></defs>' +
          '<g clip-path="url(#cp' + k.uid + ')"><ellipse cx="30" cy="40" rx="24" ry="40" fill="#e4342f" opacity=".55"/></g>') +
        shine(k, 62, 34, 5, 11, 15) +
        '<path d="M38 68 C 28 74 26 88 38 92 C 52 97 66 90 62 80 C 59 72 50 70 46 74 C 43 77 39 74 39 70 Z" fill="' + k.f('#9c968a') + '"/>';
    },

    spiky: function (k) {
      let g = '<ellipse cx="50" cy="57" rx="33" ry="35" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const x = 50 + Math.cos(a) * 24, y = 57 + Math.sin(a) * 26;
          g += '<path d="M' + x + ' ' + y + ' l6 -4 l-1 8 Z" transform="rotate(' + (a * 180 / Math.PI) + ' ' + x + ' ' + y + ')" fill="' + k.dk + '" opacity=".55"/>';
        }
      }
      g += stem(k, 'M50 24 L52 14', 5);
      return g;
    },

    tomato: function (k) {
      let g = '<circle cx="50" cy="60" r="31" fill="' + k.f(k.c) + '"/>';
      g += k.d('<path d="M50 29 A31 31 0 0 1 50 91 Z" fill="' + k.dk + '" opacity=".2"/>');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g += '<ellipse cx="' + (50 + Math.cos(a) * 13) + '" cy="' + (31 + Math.sin(a) * 8) + '" rx="10" ry="5" transform="rotate(' + (a * 180 / Math.PI) + ' ' + (50 + Math.cos(a) * 13) + ' ' + (31 + Math.sin(a) * 8) + ')" fill="' + k.f('#4ea33f') + '"/>';
      }
      g += stem(k, 'M50 30 L50 18', 5, '#4ea33f');
      g += shine(k, 37, 50, 7, 10);
      return g;
    },

    cone: function (k) {
      let g = '';
      [[-26, -34], [0, 0], [26, 34]].forEach(function (p) {
        const tx = 50 + p[0], ty = 12;
        g += '<path d="M50 34 L' + tx + ' ' + ty + '" stroke="' + k.f('#4ea33f') + '" stroke-width="3" stroke-linecap="round" fill="none"/>';
        [0, 1, 2].forEach(function (n) {
          const fx = 50 + p[0] * (0.35 + n * 0.28), fy = 30 - n * 7;
          g += '<ellipse cx="' + fx + '" cy="' + fy + '" rx="7" ry="4.5" transform="rotate(' + (p[1] - 10) + ' ' + fx + ' ' + fy + ')" fill="' + k.f(n % 2 ? '#57ad46' : '#4ea33f') + '"/>';
        });
      });
      g += '<path d="M36 34 C 36 30 64 30 64 34 L54 90 C 52 95 48 95 46 90 Z" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        for (let i = 0; i < 4; i++) {
          const y = 44 + i * 12, w = 13 - i * 2.4;
          g += '<path d="M' + (50 - w) + ' ' + y + ' L' + (50 + w) + ' ' + (y + 3) + '" stroke="' + k.dk + '" stroke-width="2" opacity=".45" stroke-linecap="round"/>';
        }
      }
      return g;
    },

    tuber: function (k) {
      return '<ellipse cx="50" cy="55" rx="37" ry="26" transform="rotate(-14 50 55)" fill="' + k.f(k.c) + '"/>' +
        k.d('<ellipse cx="36" cy="48" rx="4" ry="3" fill="' + k.dk + '" opacity=".5"/>') +
        k.d('<ellipse cx="58" cy="60" rx="3.5" ry="2.6" fill="' + k.dk + '" opacity=".5"/>') +
        k.d('<ellipse cx="66" cy="45" rx="3" ry="2.2" fill="' + k.dk + '" opacity=".5"/>') +
        shine(k, 36, 42, 10, 5, -20);
    },

    bulb: function (k) {
      return stem(k, 'M50 26 C 46 16 44 12 42 8', 4, '#7fbf4a') +
        stem(k, 'M50 26 C 54 16 58 12 60 9', 4, '#7fbf4a') +
        '<path d="M50 26 C 30 34 20 48 22 64 C 24 80 36 90 50 90 C 64 90 76 80 78 64 C 80 48 70 34 50 26 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 30 C 44 44 42 74 50 88" stroke="' + k.dk + '" stroke-width="2.4" fill="none" opacity=".45"/>') +
        k.d('<path d="M50 30 C 56 44 58 74 50 88" stroke="' + k.dk + '" stroke-width="2.4" fill="none" opacity=".45"/>') +
        k.d('<path d="M32 40 C 26 54 26 74 34 84" stroke="' + k.dk + '" stroke-width="2" fill="none" opacity=".35"/>') +
        k.d('<path d="M68 40 C 74 54 74 74 66 84" stroke="' + k.dk + '" stroke-width="2" fill="none" opacity=".35"/>');
    },

    garlic: function (k) {
      return stem(k, 'M50 24 L50 12', 5, '#c9bda0') +
        '<path d="M50 22 C 32 34 24 50 26 66 C 28 82 38 90 50 90 C 62 90 72 82 74 66 C 76 50 68 34 50 22 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 24 C 42 42 40 74 46 88" stroke="#cfc3ad" stroke-width="2.6" fill="none"/>') +
        k.d('<path d="M50 24 C 58 42 60 74 54 88" stroke="#cfc3ad" stroke-width="2.6" fill="none"/>') +
        k.d('<path d="M32 44 C 28 60 30 78 36 86" stroke="#cfc3ad" stroke-width="2.2" fill="none"/>') +
        k.d('<path d="M68 44 C 72 60 70 78 64 86" stroke="#cfc3ad" stroke-width="2.2" fill="none"/>');
    },

    cob: function (k) {
      let g = '<path d="M36 26 C 20 40 14 66 22 88 C 32 78 38 58 40 36 Z" fill="' + k.f('#5fae3f') + '"/>' +
        '<path d="M64 26 C 80 40 86 66 78 88 C 68 78 62 58 60 36 Z" fill="' + k.f('#4e9c34') + '"/>' +
        '<path d="M50 12 C 36 20 32 40 32 58 C 32 78 40 92 50 92 C 60 92 68 78 68 58 C 68 40 64 20 50 12 Z" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
          g += '<circle cx="' + (39 + c * 7.5 + (r % 2 ? 3.5 : 0)) + '" cy="' + (26 + r * 11) + '" r="3" fill="' + k.dk + '" opacity=".4"/>';
        }
      }
      return g;
    },

    cylinder: function (k) {
      return '<path d="M56 10 C 68 10 72 26 70 48 C 68 72 62 92 48 92 C 34 92 30 74 32 52 C 34 28 44 10 56 10 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M44 16 C 36 34 34 62 38 86" stroke="' + k.lt + '" stroke-width="4" fill="none" opacity=".55"/>') +
        k.d('<circle cx="58" cy="34" r="2.2" fill="' + k.dk + '" opacity=".5"/>') +
        k.d('<circle cx="62" cy="56" r="2.2" fill="' + k.dk + '" opacity=".5"/>') +
        k.d('<circle cx="50" cy="72" r="2.2" fill="' + k.dk + '" opacity=".5"/>') +
        k.d('<circle cx="52" cy="24" r="2.2" fill="' + k.dk + '" opacity=".5"/>') +
        stem(k, 'M56 12 L58 5', 5, '#5fae3f');
    },

    bell: function (k) {
      return stem(k, 'M50 24 L50 12', 6, '#4ea33f') +
        leaf(k, 50, 26, 0, 13, 6, '#4ea33f') +
        '<path d="M50 28 C 28 28 20 42 20 58 C 20 74 28 86 38 86 C 44 86 45 78 50 78 C 55 78 56 86 62 86 C 72 86 80 74 80 58 C 80 42 72 28 50 28 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 28 C 72 28 80 42 80 58 C 80 74 72 86 62 86 C 56 86 55 78 50 78 Z" fill="' + k.dk + '" opacity=".25"/>') +
        shine(k, 34, 48, 6, 12);
    },

    chili: function (k) {
      return stem(k, 'M34 26 C 34 18 40 14 46 14', 5, '#4ea33f') +
        '<path d="M30 26 C 22 42 30 68 50 80 C 68 91 82 84 80 76 C 78 68 62 66 54 52 C 46 38 46 28 42 24 C 38 20 32 20 30 26 Z" fill="' + k.f(k.c) + '"/>' +
        shine(k, 40, 42, 4, 10, -20);
    },

    eggplant: function (k) {
      return '<path d="M40 30 C 30 26 22 30 24 38 C 26 44 34 44 38 40 Z" fill="' + k.f('#4ea33f') + '"/>' +
        '<path d="M60 30 C 70 26 78 30 76 38 C 74 44 66 44 62 40 Z" fill="' + k.f('#4ea33f') + '"/>' +
        stem(k, 'M50 28 C 52 20 56 15 60 12', 5, '#4ea33f') +
        '<path d="M50 28 C 32 32 24 50 26 66 C 28 82 38 92 50 92 C 62 92 72 82 74 66 C 76 50 68 32 50 28 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 28 C 68 32 76 50 74 66 C 72 82 62 92 50 92 Z" fill="' + k.dk + '" opacity=".3"/>') +
        shine(k, 38, 54, 6, 13);
    },

    mushroom: function (k) {
      return '<path d="M34 60 C 34 82 36 90 40 90 L60 90 C 64 90 66 82 66 60 Z" fill="' + k.f('#efe4d2') + '"/>' +
        '<path d="M16 60 C 16 36 32 22 50 22 C 68 22 84 36 84 60 C 84 66 74 68 50 68 C 26 68 16 66 16 60 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<circle cx="36" cy="42" r="5" fill="#fff6e4" opacity=".85"/>') +
        k.d('<circle cx="58" cy="36" r="4" fill="#fff6e4" opacity=".85"/>') +
        k.d('<circle cx="68" cy="50" r="3.5" fill="#fff6e4" opacity=".85"/>');
    },

    tree: function (k) {
      let g = '<path d="M42 62 L42 88 C 42 92 58 92 58 88 L58 62 Z" fill="' + k.f(lite(k.c, 0.35)) + '"/>';
      [[50, 34, 20], [28, 48, 16], [72, 48, 16], [38, 30, 14], [64, 32, 14], [50, 56, 16]].forEach(function (p) {
        g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + k.f(k.c) + '"/>';
      });
      if (!k.sil) {
        [[42, 32], [58, 36], [32, 50], [68, 50], [50, 46]].forEach(function (p) {
          g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="' + lite(k.c, 0.25) + '" opacity=".8"/>';
        });
      }
      return g;
    },

    pod: function (k) {
      let g = '<path d="M16 40 C 30 78 62 92 86 74 C 92 69 88 62 82 64 C 58 74 34 60 26 34 C 24 27 14 32 16 40 Z" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        [[38, 55], [50, 64], [63, 70]].forEach(function (p) {
          g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="8" fill="' + lite(k.c, 0.35) + '"/>';
        });
      }
      g += stem(k, 'M18 36 L12 28', 4, '#4a8c2f');
      return g;
    },

    beans: function (k) {
      let g = '';
      [[34, 38, -22], [64, 52, 18], [42, 72, 8]].forEach(function (p, i) {
        g += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="20" ry="13" transform="rotate(' + p[2] + ' ' + p[0] + ' ' + p[1] + ')" fill="' + k.f(i === 1 ? dark(k.c, 0.12) : k.c) + '"/>';
        g += k.d('<ellipse cx="' + p[0] + '" cy="' + (p[1] + 11) + '" rx="8" ry="2.6" transform="rotate(' + p[2] + ' ' + p[0] + ' ' + p[1] + ')" fill="' + lite(k.c, 0.55) + '"/>');
        g += k.d('<ellipse cx="' + (p[0] - 7) + '" cy="' + (p[1] - 5) + '" rx="6" ry="3" transform="rotate(' + (p[2] - 15) + ' ' + p[0] + ' ' + p[1] + ')" fill="#ffffff" opacity=".22"/>');
      });
      return g;
    },

    /* v:'thin' = vagem (fina, com caroços) | padrão = quiabo (cônico, com quinas) */
    podlong: function (k) {
      let g;
      if (k.v === 'thin') {
        g = '<path d="M34 90 C 24 72 26 40 42 18 C 46 12 54 14 52 22 C 44 44 38 66 42 88 C 43 95 36 95 34 90 Z" fill="' + k.f(k.c) + '"/>';
        if (!k.sil) {
          [[45, 26], [42, 42], [39, 58], [38, 74]].forEach(function (p) {
            g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" fill="' + lite(k.c, 0.3) + '"/>';
          });
        }
      } else {
        g = '<path d="M32 90 C 24 72 26 42 42 18 C 47 11 57 14 55 24 C 48 46 42 66 44 86 C 45 95 35 96 32 90 Z" fill="' + k.f(k.c) + '"/>';
        if (!k.sil) {
          g += '<path d="M44 22 C 34 44 32 68 36 88" stroke="' + k.dk + '" stroke-width="2.2" fill="none" opacity=".5"/>';
          g += '<path d="M52 26 C 44 46 40 68 42 86" stroke="' + k.dk + '" stroke-width="2.2" fill="none" opacity=".4"/>';
        }
      }
      g += stem(k, 'M50 18 L56 8', 5, '#4a8c2f');
      return g;
    },

    pumpkin: function (k) {
      let g = '<ellipse cx="50" cy="62" rx="38" ry="29" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        g += '<ellipse cx="50" cy="62" rx="24" ry="29" fill="' + lite(k.c, 0.12) + '"/>';
        g += '<ellipse cx="50" cy="62" rx="9" ry="29" fill="' + lite(k.c, 0.22) + '"/>';
      }
      g += stem(k, 'M50 34 C 50 26 48 22 44 18', 6, '#5d8a3a');
      return g;
    },

    beet: function (k) {
      return leaf(k, 34, 22, 30, 8, 15, '#3e8c3a') + leaf(k, 50, 16, 0, 8, 16, '#4ea33f') + leaf(k, 66, 22, -30, 8, 15, '#3e8c3a') +
        stem(k, 'M50 46 L38 26 M50 46 L50 22 M50 46 L62 26', 3, '#7fbf4a') +
        '<path d="M50 40 C 26 40 20 56 26 70 C 32 84 42 92 50 96 C 58 92 68 84 74 70 C 80 56 74 40 50 40 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M50 40 C 74 40 80 56 74 70 C 68 84 58 92 50 96 Z" fill="' + k.dk + '" opacity=".28"/>');
    },

    radish: function (k) {
      const top = k.c2 || k.c;
      return leaf(k, 36, 20, 30, 8, 13, '#3e8c3a') + leaf(k, 50, 15, 0, 8, 14, '#4ea33f') + leaf(k, 64, 20, -30, 8, 13, '#3e8c3a') +
        stem(k, 'M50 42 L40 24 M50 42 L50 20 M50 42 L60 24', 3, '#7fbf4a') +
        '<path d="M50 38 C 30 38 24 52 28 66 C 32 80 44 96 50 96 C 56 96 68 80 72 66 C 76 52 70 38 50 38 Z" fill="' + k.f(k.c) + '"/>' +
        k.d(k.c2 ? '<path d="M50 38 C 30 38 24 52 28 66 L72 66 C 76 52 70 38 50 38 Z" fill="' + top + '" opacity=".8"/>' : '') +
        shine(k, 38, 54, 5, 9);
    },

    root: function (k) {
      return '<path d="M22 86 C 16 78 24 52 40 32 C 50 20 62 12 70 16 C 78 20 74 32 64 42 C 48 58 36 78 34 88 C 32 94 26 92 22 86 Z" fill="' + k.f(k.c) + '"/>' +
        k.d('<path d="M40 34 C 32 50 26 70 26 84" stroke="' + k.dk + '" stroke-width="2.4" fill="none" opacity=".45"/>') +
        k.d('<path d="M58 26 C 48 40 38 60 34 80" stroke="' + k.dk + '" stroke-width="2" fill="none" opacity=".35"/>');
    },

    stalk: function (k) {
      let g = '';
      [[36, 8], [50, 0], [64, -8]].forEach(function (p) {
        g += '<path d="M' + p[0] + ' 92 C ' + (p[0] - 2) + ' 60 ' + (p[0] - 2) + ' 40 ' + p[0] + ' 26 C ' + (p[0] + 4) + ' 18 ' + (p[0] + 6) + ' 20 ' + (p[0] + 4) + ' 26 C ' + (p[0] + 6) + ' 42 ' + (p[0] + 6) + ' 62 ' + (p[0] + 6) + ' 92 Z" transform="rotate(' + p[1] + ' ' + p[0] + ' 92)" fill="' + k.f(k.c) + '"/>';
        g += k.d('<path d="M' + (p[0] + 1) + ' 34 l6 -4 M' + (p[0] + 1) + ' 44 l6 -4 M' + (p[0] + 1) + ' 54 l6 -4" stroke="' + k.dk + '" stroke-width="2" opacity=".4" transform="rotate(' + p[1] + ' ' + p[0] + ' 92)"/>');
      });
      return g;
    },

    ginger: function (k) {
      return '<path d="M26 62 C 18 50 26 38 38 40 C 46 41 48 48 56 46 C 66 44 76 48 78 58 C 80 68 72 74 64 72 C 56 70 54 78 44 80 C 32 82 24 74 26 62 Z" fill="' + k.f(k.c) + '"/>' +
        '<path d="M60 40 C 62 30 72 26 78 32 C 84 38 80 46 72 46 Z" fill="' + k.f(dark(k.c, 0.1)) + '"/>' +
        '<path d="M34 80 C 30 90 36 96 44 94 C 50 92 50 84 44 82 Z" fill="' + k.f(dark(k.c, 0.1)) + '"/>' +
        k.d('<path d="M36 56 C 46 52 58 58 66 60" stroke="' + k.dk + '" stroke-width="2" fill="none" opacity=".4"/>');
    },

    leek: function (k) {
      return '<path d="M44 54 C 36 40 30 22 34 12 C 38 4 44 10 46 20 C 48 32 48 44 50 54 Z" fill="' + k.f(k.c) + '"/>' +
        '<path d="M56 54 C 64 40 70 22 66 12 C 62 4 56 10 54 20 C 52 32 52 44 50 54 Z" fill="' + k.f(dark(k.c, 0.14)) + '"/>' +
        '<path d="M50 30 C 46 44 46 48 46 56 L54 56 C 54 48 54 44 50 30 Z" fill="' + k.f(k.c) + '"/>' +
        '<path d="M40 52 C 40 48 60 48 60 52 L58 86 C 58 92 42 92 42 86 Z" fill="' + k.f('#f1f0dd') + '"/>' +
        k.d('<path d="M46 54 L46 88 M54 54 L54 88" stroke="#dcd9bf" stroke-width="2"/>') +
        '<path d="M46 90 L44 96 M50 90 L50 97 M54 90 L56 96" stroke="' + k.f('#e8e4cf') + '" stroke-width="2.4" stroke-linecap="round"/>';
    },

    stalks: function (k) {
      let g = '';
      [[34, -10], [44, -4], [56, 4], [66, 10]].forEach(function (p, i) {
        g += '<path d="M' + p[0] + ' 92 C ' + (p[0] - 3) + ' 60 ' + (p[0] - 3) + ' 36 ' + p[0] + ' 18 L' + (p[0] + 7) + ' 18 C ' + (p[0] + 4) + ' 36 ' + (p[0] + 4) + ' 60 ' + (p[0] + 7) + ' 92 Z" transform="rotate(' + p[1] + ' ' + p[0] + ' 92)" fill="' + k.f(i % 2 ? k.c : lite(k.c, 0.15)) + '"/>';
        g += leaf(k, p[0] + 3, 16, p[1], 6, 9, dark(k.c, 0.12));
      });
      return g;
    },

    artichoke: function (k) {
      let g = stem(k, 'M50 76 L50 94', 6, '#6f8f4a');
      g += '<ellipse cx="50" cy="52" rx="30" ry="34" fill="' + k.f(k.c) + '"/>';
      if (!k.sil) {
        for (let r = 0; r < 3; r++) for (let i = -2; i <= 2; i++) {
          g += '<ellipse cx="' + (50 + i * 11) + '" cy="' + (34 + r * 16) + '" rx="7" ry="9" fill="' + (r % 2 ? lite(k.c, 0.18) : dark(k.c, 0.12)) + '" opacity=".9"/>';
        }
      }
      g += '<path d="M50 20 L46 8 M50 20 L54 8" stroke="' + k.f(dark(k.c, 0.2)) + '" stroke-width="3" stroke-linecap="round"/>';
      return g;
    },

    /* v:'loose' = alface (folhas soltas e onduladas) | v:'tight' = repolho (compacto) */
    head: function (k) {
      let g = '';
      if (k.v === 'loose') {
        // folhas externas grandes e onduladas
        [[24, 54, -18], [76, 54, 18], [50, 34, 0]].forEach(function (p) {
          g += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="26" ry="30" transform="rotate(' + p[2] + ' ' + p[0] + ' ' + p[1] + ')" fill="' + k.f(dark(k.c, 0.14)) + '"/>';
        });
        g += '<circle cx="50" cy="58" r="31" fill="' + k.f(k.c) + '"/>';
        if (!k.sil) {
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2;
            g += '<circle cx="' + (50 + Math.cos(a) * 29) + '" cy="' + (58 + Math.sin(a) * 29) + '" r="9" fill="' + lite(k.c, 0.18) + '"/>';
          }
          g += '<circle cx="50" cy="58" r="20" fill="' + lite(k.c, 0.34) + '"/>';
          g += '<path d="M38 66 C 44 52 58 50 66 56" stroke="' + lite(k.c, 0.6) + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
        }
      } else {
        g += '<circle cx="50" cy="56" r="34" fill="' + k.f(k.c) + '"/>';
        if (!k.sil) {
          g += '<circle cx="50" cy="56" r="26" fill="' + lite(k.c, 0.14) + '"/>';
          g += '<circle cx="50" cy="56" r="16" fill="' + lite(k.c, 0.28) + '"/>';
          g += '<path d="M50 22 C 40 40 40 74 50 90 M50 22 C 60 40 60 74 50 90" stroke="' + lite(k.c, 0.5) + '" stroke-width="2.6" fill="none" opacity=".8"/>';
        }
        g += '<path d="M28 30 C 36 18 46 15 50 21 C 54 15 64 18 72 30 C 62 24 38 24 28 30 Z" fill="' + k.f(lite(k.c, 0.24)) + '"/>';
      }
      return g;
    },

    /* v:'curly' = couve (borda enrolada) | v:'round' = espinafre | v:'lobed' = rúcula */
    leaves: function (k) {
      let g = stem(k, 'M50 94 L50 58', 4, '#6f9c4a');
      const v = k.v || 'round';
      const set = v === 'lobed'
        ? [[-40, 22, 34], [0, 26, 40], [40, 22, 34]]
        : v === 'curly'
          ? [[-34, 26, 30], [0, 30, 34], [34, 26, 30]]
          : [[-36, 30, 26], [0, 34, 30], [36, 30, 26]];
      set.forEach(function (p, i) {
        const cx = 50 + (i - 1) * 21, base = 60, rot = p[0], w = p[1], h = p[2];
        const col = i === 1 ? k.c : dark(k.c, 0.1);
        // corpo da folha
        g += '<path d="M' + cx + ' ' + base + ' C ' + (cx - w) + ' ' + (base - h * 0.5) + ' ' + (cx - w * 0.75) + ' ' + (base - h * 1.5) + ' ' + cx + ' ' + (base - h * 1.9) +
          ' C ' + (cx + w * 0.75) + ' ' + (base - h * 1.5) + ' ' + (cx + w) + ' ' + (base - h * 0.5) + ' ' + cx + ' ' + base + ' Z"' +
          ' transform="rotate(' + rot + ' ' + cx + ' ' + base + ')" fill="' + k.f(col) + '"/>';
        if (v === 'curly') {
          // borda enrolada da couve
          for (let n = 0; n < 5; n++) {
            const t = 0.2 + n * 0.17;
            const yy = base - h * 1.9 * t;
            g += '<circle cx="' + (cx - w * (0.85 - Math.abs(t - 0.5))) + '" cy="' + yy + '" r="6" transform="rotate(' + rot + ' ' + cx + ' ' + base + ')" fill="' + k.f(col) + '"/>';
            g += '<circle cx="' + (cx + w * (0.85 - Math.abs(t - 0.5))) + '" cy="' + yy + '" r="6" transform="rotate(' + rot + ' ' + cx + ' ' + base + ')" fill="' + k.f(col) + '"/>';
          }
        }
        if (v === 'lobed') {
          // recortes laterais da rúcula
          [0.35, 0.62].forEach(function (t) {
            const yy = base - h * 1.9 * t;
            g += '<ellipse cx="' + (cx - w * 0.75) + '" cy="' + yy + '" rx="8" ry="5" transform="rotate(' + rot + ' ' + cx + ' ' + base + ')" fill="' + k.f(col) + '"/>';
            g += '<ellipse cx="' + (cx + w * 0.75) + '" cy="' + (yy - 5) + '" rx="8" ry="5" transform="rotate(' + rot + ' ' + cx + ' ' + base + ')" fill="' + k.f(col) + '"/>';
          });
        }
        g += k.d('<path d="M' + cx + ' ' + (base - 4) + ' L' + cx + ' ' + (base - h * 1.8) + '" transform="rotate(' + rot + ' ' + cx + ' ' + base + ')" stroke="' + lite(k.c, 0.45) + '" stroke-width="2.4"/>');
      });
      return g;
    },

    /* v:'big' = manjericão | v:'mint' = hortelã | v:'round' = agrião | v:'fan' = coentro | padrão = salsinha */
    sprig: function (k) {
      let g = stem(k, 'M50 94 C 50 70 50 46 50 20', 4, dark(k.c, 0.2));
      const v = k.v || '';

      if (v === 'big') {                       // manjericão: poucas folhas grandes
        [[26, 0], [50, 1], [74, 0]].forEach(function (p, i) {
          g += pleaf(k, 48, p[0], 178, 30, 15, i % 2 ? k.c : dark(k.c, 0.1));
          g += pleaf(k, 52, p[0] + 10, 2, 30, 15, i % 2 ? dark(k.c, 0.1) : k.c);
        });
        g += pleaf(k, 50, 16, -90, 22, 12, lite(k.c, 0.12));

      } else if (v === 'mint') {               // hortelã: folhas pontudas com nervura
        [[30, 0], [52, 1], [74, 0]].forEach(function (p) {
          [[-1, 200], [1, -20]].forEach(function (s) {
            const cx = 50 + s[0] * 3;
            g += pleaf(k, cx, p[0], s[1], 26, 13, k.c);
            g += k.d('<path d="M' + cx + ' ' + p[0] + ' l24 0" transform="rotate(' + s[1] + ' ' + cx + ' ' + p[0] + ')" stroke="' + lite(k.c, 0.5) + '" stroke-width="2"/>');
          });
        });
        g += pleaf(k, 50, 18, -90, 20, 11, lite(k.c, 0.1));

      } else if (v === 'round') {              // agrião: folhinhas redondas
        [[24, 12], [40, 15], [56, 13], [72, 11]].forEach(function (p, i) {
          g += '<circle cx="' + (50 - 16 - i) + '" cy="' + p[0] + '" r="' + p[1] + '" fill="' + k.f(dark(k.c, 0.08)) + '"/>';
          g += '<circle cx="' + (50 + 16 + i) + '" cy="' + (p[0] + 8) + '" r="' + p[1] + '" fill="' + k.f(k.c) + '"/>';
        });
        g += '<circle cx="50" cy="16" r="12" fill="' + k.f(lite(k.c, 0.12)) + '"/>';

      } else if (v === 'fan') {                // coentro: folhas em leque recortadas
        [[30, -35], [50, 0], [70, 35]].forEach(function (p) {
          const cx = 50 + p[1] * 0.5, cy = 26 + Math.abs(p[1]) * 0.25;
          g += '<path d="M' + cx + ' ' + (cy + 34) + ' C ' + (cx - 20) + ' ' + (cy + 14) + ' ' + (cx - 18) + ' ' + cy + ' ' + cx + ' ' + (cy - 6) +
            ' C ' + (cx + 18) + ' ' + cy + ' ' + (cx + 20) + ' ' + (cy + 14) + ' ' + cx + ' ' + (cy + 34) + ' Z" fill="' + k.f(k.c) + '"/>';
          [-1, 1].forEach(function (s) {
            g += '<circle cx="' + (cx + s * 15) + '" cy="' + (cy + 8) + '" r="7" fill="' + k.f(k.c) + '"/>';
            g += '<circle cx="' + (cx + s * 11) + '" cy="' + (cy - 2) + '" r="6" fill="' + k.f(dark(k.c, 0.08)) + '"/>';
          });
        });

      } else {                                  // salsinha: muitas folhinhas
        [[22, 0], [38, 1], [54, 0], [70, 1]].forEach(function (p) {
          g += '<ellipse cx="34" cy="' + p[0] + '" rx="14" ry="8" transform="rotate(-25 34 ' + p[0] + ')" fill="' + k.f(k.c) + '"/>';
          g += '<ellipse cx="66" cy="' + (p[0] + 8) + '" rx="14" ry="8" transform="rotate(25 66 ' + (p[0] + 8) + ')" fill="' + k.f(dark(k.c, 0.12)) + '"/>';
        });
        g += '<ellipse cx="50" cy="14" rx="9" ry="13" fill="' + k.f(lite(k.c, 0.12)) + '"/>';
      }
      return g;
    },
  };

  /* ---------- API ---------- */
  function render(item, opts) {
    opts = opts || {};
    const sil = !!opts.silhouette;
    const k = ctx(item, sil);
    const fn = S[item.art.s] || S.round;
    let inner = fn(k);
    if (item.art.k) inner = '<g transform="translate(50 50) scale(' + item.art.k + ') translate(-50 -50)">' + inner + '</g>';
    if (sil) inner = '<g opacity="' + (opts.solid ? 1 : 0.88) + '">' + inner + '</g>';
    return '<svg class="art" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="' + item.en + '">' + inner + '</svg>';
  }

  return { render: render, mix: mix, lite: lite, dark: dark };
})();
