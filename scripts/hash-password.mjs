#!/usr/bin/env node
/**
 * Turns a password you type into the scrypt digest that goes in
 * PORTFOLIO_AUTH_HASH, plus a fresh SESSION_SECRET.
 *
 *   node scripts/hash-password.mjs
 *
 * The password is read with echo off, never printed, never written to disk, and
 * never passed as an argument (which would leave it in your shell history and
 * in `ps` output). Only the digest is shown — the plaintext cannot be recovered
 * from it, so the digest is safe to paste into Railway's env settings.
 */
import { createInterface } from 'node:readline'
import { randomBytes, scryptSync } from 'node:crypto'

const SCRYPT_N = 16384
const SCRYPT_r = 8
const SCRYPT_p = 1
const KEY_LEN = 64

function hashPassword(password) {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p })
  return ['scrypt', SCRYPT_N, SCRYPT_r, SCRYPT_p, salt.toString('base64'), key.toString('base64')].join('$')
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    // Swallow the echoed characters so the password never appears on screen.
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) return
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

console.log('\nRailway → Variables bölümüne şunları ekleyin:\n')
console.log(`PORTFOLIO_AUTH_USER=${process.env.USER ?? 'kullanici-adiniz'}`)
console.log(`PORTFOLIO_AUTH_HASH=${hashPassword(password)}`)
console.log(`SESSION_SECRET=${randomBytes(32).toString('base64url')}`)
console.log('\nPAROLANIN KENDİSİ hiçbir yere yazılmadı; yalnızca yukarıdaki özet saklanır.')
console.log('PORTFOLIO_AUTH_USER degerini kendi kullanici adinizla degistirin.\n')
