// Crée (ou met à jour) le compte consultant pour se connecter à l'application.
// Lancer depuis le dossier du projet :
//   "C:\Program Files\nodejs\node.exe" --env-file=.env prisma/creer-utilisateur.mjs
//
// Le mot de passe est saisi au clavier et n'est jamais enregistré en clair :
// seule sa version chiffrée (bcrypt) est stockée en base.

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import pg from "pg";

const rl = readline.createInterface({ input, output });

const email = (await rl.question("Email de connexion : ")).toLowerCase().trim();
const name = (await rl.question("Nom affiché (facultatif) : ")).trim();
const password = await rl.question("Mot de passe : ");
const password2 = await rl.question("Confirmer le mot de passe : ");
rl.close();

if (!email || !password) {
  console.error("\n✗ Email et mot de passe sont obligatoires.");
  process.exit(1);
}
if (password !== password2) {
  console.error("\n✗ Les deux mots de passe ne correspondent pas.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("\n✗ Le mot de passe doit faire au moins 8 caractères.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query(
  `insert into "User"(id, email, "passwordHash", name, "createdAt", "updatedAt")
   values (gen_random_uuid(), $1, $2, $3, now(), now())
   on conflict(email) do update set "passwordHash" = excluded."passwordHash", name = excluded.name, "updatedAt" = now()`,
  [email, passwordHash, name || null]
);
await c.end();

console.log(`\n✓ Compte prêt : ${email}. Tu peux te connecter sur l'application.`);
