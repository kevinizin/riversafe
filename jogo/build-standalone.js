/* ============================================================
   Gera versões de arquivo único do HortaPop a partir de index.html

     node build-standalone.js                 -> jogo/hortapop.html
     node build-standalone.js frag <destino>  -> versão sem <html>/<head>/<body>
                                                 (para hospedar como página solta)
   ============================================================ */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const src = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');

// insere data.js / art.js / game.js no lugar das tags <script src="...">
const inlined = src.replace(/<script src="([^"]+)"><\/script>/g, function (_, file) {
  let js = fs.readFileSync(path.join(DIR, file), 'utf8');
  // sem service worker: no arquivo único não existe sw.js para registrar
  js = js.replace(/\n[ \t]*if \('serviceWorker' in navigator[\s\S]*?\n[ \t]*\}\n/, '\n');
  if (/serviceWorker/.test(js)) throw new Error('não consegui remover o registro do service worker de ' + file);
  new Function(js); // falha cedo se a remoção quebrar a sintaxe
  return '<script>\n/* ---- ' + file + ' ---- */\n' + js + '\n</script>';
});

// sem manifest nem ícones externos
const noRefs = inlined
  .replace(/\s*<link rel="manifest"[^>]*>/g, '')
  .replace(/\s*<link rel="icon"[^>]*>/g, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');

const mode = process.argv[2];

if (mode === 'frag') {
  const dest = process.argv[3];
  if (!dest) { console.error('faltou o caminho de destino'); process.exit(1); }
  const title = noRefs.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = noRefs.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = noRefs.match(/<body>([\s\S]*?)<\/body>/)[1];
  fs.writeFileSync(dest, title + '\n' + style + '\n' + body.trim() + '\n');
  console.log('gerado: ' + dest);
} else {
  const dest = path.join(DIR, 'hortapop.html');
  fs.writeFileSync(dest, noRefs);
  console.log('gerado: ' + dest + ' (' + Math.round(noRefs.length / 1024) + ' KB)');
}
