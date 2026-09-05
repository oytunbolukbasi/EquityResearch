#!/usr/bin/env node
/**
 * Turns a password you type into the scrypt digest that goes in
 * PORTFOLIO_AUTH_HASH.
 *
 *   node scripts/hash-password.mjs           → print the values for Railway
 *   node scripts/hash-password.mjs --write   → set the local .env password
 *   node scripts/hash-password.mjs --check   → does a password match .env?
 *
 * The password is read with echo off, never printed, never written to disk, and
 * never passed as an argument (which would leave it in your shell history and
 * in `ps` output). Only the digest is shown — the plaintext cannot be recovered
 * from it, so the digest is safe to paste into Railway's env settings.
 *
 * `--write` exists because the copy-paste step was the whole difficulty: the
 * digest is 130 characters of base64 that has to land in exactly one line of a
 * dotfile. Editing it by hand is all risk and no judgement, so the script does
 * it — and still never learns anything the console version didn't.
 */
import { createInterface } from 'node:readline'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRYPT_N = 16384
const SCRYPT_r = 8
const SCRYPT_p = 1
const KEY_LEN = 64

const ENV_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), '.env')

export function hashPassword(password) {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p })
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$')
}

/** Mirrors verifyPassword in server/lib/auth.ts. */
export function matches(password, stored) {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, keyB64] = parts
  const expected = Buffer.from(keyB64, 'base64')
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    // Swallow the echoed characters so the password never appears on screen.
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) return
      process.stdout.write('\x1b[2K\x1b[200D' + question + '*'.repeat(rl.line.length))
    }
    process.stdin.on('data', onData)
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData)
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

/**
 * Replaces the PORTFOLIO_AUTH_HASH line in `text`, leaving every other line
 * byte-for-byte alone. Returns the new file contents.
 *
 * SESSION_SECRET is deliberately untouched: rotating it would invalidate every
 * signed cookie and log you out everywhere, which has nothing to do with
 * changing a password.
 */
export function replaceHashLine(text, hash) {
  const lines = text.split('\n')
  const i = lines.findIndex((l) => l.startsWith('PORTFOLIO_AUTH_HASH='))
  if (i === -1) lines.push(`PORTFOLIO_AUTH_HASH=${hash}`)
  else lines[i] = `PORTFOLIO_AUTH_HASH=${hash}`
  return lines.join('\n')
}

function readEnv() {
  if (!existsSync(ENV_PATH)) {
    console.error(`\n.env bulunamadı: ${ENV_PATH}`)
    process.exit(1)
  }
  return readFileSync(ENV_PATH, 'utf8')
}

export function envValue(text, key) {
  // Only the first '=' separates key from value — base64 digests contain '='.
  for (const line of text.split('\n')) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1)
  }
  return null
}

// Importing this file (a test, say) must not launch a password prompt.
const RUN_CLI = (process.argv[1] ?? '').endsWith('hash-password.mjs')
const mode = process.argv[2] ?? ''

async function main() {
  // ── --check: is this the password .env currently accepts? ───────────────────
  if (mode === '--check') {
    const stored = envValue(readEnv(), 'PORTFOLIO_AUTH_HASH')
    if (!stored) {
      console.error('\n.env içinde PORTFOLIO_AUTH_HASH yok.')
      process.exit(1)
    }
    const password = await askHidden('Parola: ')
    console.log(
      matches(password, stored)
        ? '\n✓ Eşleşiyor — bu parola ile yerelde giriş yapabilirsiniz.\n'
        : '\n✗ Eşleşmiyor. Yerel parolayı değiştirmek için: node scripts/hash-password.mjs --write\n',
    )
    process.exit(0)
  }

  // ── ask for a new password (shared by the default and --write modes) ────────
  const password = await askHidden('Yeni parola: ')
  if (password.length < 12) {
    console.error('\nParola en az 12 karakter olmalı. Hiçbir şey üretilmedi.')
    process.exit(1)
  }
  const again = await askHidden('Tekrar: ')
  if (password !== again) {
    console.error('\nParolalar eşleşmedi. Hiçbir şey üretilmedi.')
    process.exit(1)
  }

  // ── --write: replace the hash line in .env, touching nothing else ───────────
  if (mode === '--write') {
    const text = readEnv()
    writeFileSync(ENV_PATH, replaceHashLine(text, hashPassword(password)))

    const user = envValue(text, 'PORTFOLIO_AUTH_USER')
    console.log(`\n✓ .env güncellendi (yalnızca PORTFOLIO_AUTH_HASH satırı).`)
    console.log(`  Kullanıcı adı: ${user ?? '(PORTFOLIO_AUTH_USER tanımlı değil)'}`)
    console.log('\nDev sunucusunu yeniden başlatın — .env yalnızca açılışta okunur.')
    console.log('Bu YEREL parola; Railway’deki üretim parolası değişmedi.\n')
    process.exit(0)
  }

  // ── default: print the values to paste into Railway ─────────────────────────
  console.log('\nRailway → Variables bölümüne şunları ekleyin:\n')
  console.log(`PORTFOLIO_AUTH_USER=${process.env.USER ?? 'kullanici-adiniz'}`)
  console.log(`PORTFOLIO_AUTH_HASH=${hashPassword(password)}`)
  console.log(`SESSION_SECRET=${randomBytes(32).toString('base64url')}`)
  console.log('\nPAROLANIN KENDİSİ hiçbir yere yazılmadı; yalnızca yukarıdaki özet saklanır.')
  console.log('PORTFOLIO_AUTH_USER degerini kendi kullanici adinizla degistirin.\n')
}

if (RUN_CLI) await main()
