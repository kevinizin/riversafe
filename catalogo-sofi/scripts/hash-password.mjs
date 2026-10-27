// Gera o ADMIN_PASSWORD_HASH para uma senha: node scripts/hash-password.mjs 'minhaSenha'
import { randomBytes, scrypt } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error("Use uma senha com pelo menos 10 caracteres.");
  process.exit(1);
}
const N = 2 ** 15, r = 8, p = 1;
const salt = randomBytes(16);
scrypt(password, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) => {
  if (err) throw err;
  console.log(["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$"));
});
