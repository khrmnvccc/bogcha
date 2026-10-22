#!/usr/bin/env node
// Creates the first director account. Run once after applying the migrations:
//   node --env-file=.env.local scripts/create-director.mjs <login> "<To'liq ism>"
// A temporary password is printed once; the director must change it at first login.
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [username, fullName] = process.argv.slice(2);
if (!username || !fullName || !/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error('Foydalanish: node --env-file=.env.local scripts/create-director.mjs <login> "<To\'liq ism>"');
  console.error("Login: 3-40 ta kichik lotin harfi, raqam, nuqta, chiziqcha.");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kerak (.env.local).");
  process.exit(1);
}
const domain = process.env.AUTH_EMAIL_DOMAIN || "users.bogcha.app";
const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
let password = "";
while (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
  password = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await admin.auth.admin.createUser({
  email: `${username}@${domain}`,
  password,
  email_confirm: true,
  app_metadata: { role: "director", full_name: fullName, username, must_change_password: true },
});
if (error) {
  console.error("Xatolik:", error.message);
  process.exit(1);
}
console.log("Direktor hisobi yaratildi:", data.user.id);
console.log("Login:              ", username);
console.log("Vaqtinchalik parol: ", password);
console.log("Birinchi kirishda parolni almashtirish so'raladi.");
