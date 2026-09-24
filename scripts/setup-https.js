#!/usr/bin/env node

/**
 * @file scripts/setup-https.js
 *
 * Generates local HTTPS certificates using mkcert.
 * 
 * This script:
 * 1. Checks if mkcert is installed
 * 2. Creates a local CA if needed
 * 3. Generates certificates for localhost and 127.0.0.1
 * 4. Stores certificates in .vite-certs/
 * 
 * Usage:
 *   node scripts/setup-https.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const os = require('os')

const CERTS_DIR = path.join(__dirname, '..', '.vite-certs')
const CERT_FILE = path.join(CERTS_DIR, 'localhost.crt')
const KEY_FILE = path.join(CERTS_DIR, 'localhost.key')

function log(message, level = 'info') {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    warning: '\x1b[33m', // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m',
  }

  const icon = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
  }[level]

  const color = colors[level] || colors.info
  console.log(`${color}${icon} ${message}${colors.reset}`)
}

function isMkcertInstalled() {
  try {
    execSync('mkcert --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function installMkcert() {
  const platform = os.platform()
  
  log('mkcert is not installed. Install instructions:', 'warning')
  console.log('')
  
  if (platform === 'darwin') {
    console.log('  macOS (Homebrew):')
    console.log('    brew install mkcert')
    console.log('    brew install nss  # for Firefox')
  } else if (platform === 'win32') {
    console.log('  Windows (Chocolatey):')
    console.log('    choco install mkcert')
    console.log('')
    console.log('  Or download from: https://github.com/FiloSottile/mkcert/releases')
  } else {
    console.log('  Linux (Ubuntu/Debian):')
    console.log('    sudo apt-get install mkcert')
    console.log('')
    console.log('  Or see: https://github.com/FiloSottile/mkcert#installation')
  }
  
  console.log('')
  process.exit(1)
}

function certExists() {
  return fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)
}

function setupCertificates() {
  try {
    // Ensure certs directory exists
    if (!fs.existsSync(CERTS_DIR)) {
      fs.mkdirSync(CERTS_DIR, { recursive: true })
      log(`Created directory: ${CERTS_DIR}`)
    }

    // Create local CA (one-time, idempotent)
    log('Creating local Certificate Authority...')
    try {
      execSync('mkcert -install', { stdio: 'inherit' })
      log('Local CA created/verified', 'success')
    } catch (err) {
      log(`CA creation failed: ${err.message}`, 'error')
      throw err
    }

    // Generate certificates for localhost
    log('Generating certificates for localhost...')
    try {
      execSync(
        `mkcert -cert-file "${CERT_FILE}" -key-file "${KEY_FILE}" localhost 127.0.0.1 ::1`,
        { stdio: 'inherit' },
      )
      log('Certificates generated successfully', 'success')
    } catch (err) {
      log(`Certificate generation failed: ${err.message}`, 'error')
      throw err
    }

    // Verify files exist
    if (!certExists()) {
      throw new Error('Certificate files not created')
    }

    log(`Certificate: ${CERT_FILE}`, 'success')
    log(`Key: ${KEY_FILE}`, 'success')
    console.log('')
    log('You can now use HTTPS for local development!', 'success')
    console.log('')
    console.log('Usage:')
    console.log('  npm run dev:https    # Start dev server with HTTPS')
    console.log('  npm run dev          # Start normal HTTP dev server')
    console.log('')
    console.log('Environment variables:')
    console.log('  HTTPS=true npm run dev      # Enable HTTPS')
    console.log('  VITE_HTTPS=true npm run dev # Enable HTTPS (alternative)')
  } catch (err) {
    log(`Setup failed: ${err.message}`, 'error')
    process.exit(1)
  }
}

function main() {
  console.log('')
  log('Setting up local HTTPS certificates', 'info')
  console.log('')

  // Check if mkcert is installed
  if (!isMkcertInstalled()) {
    log('mkcert not found', 'error')
    installMkcert()
  }

  // Check if certs already exist
  if (certExists()) {
    log('Certificates already exist', 'success')
    return
  }

  // Generate certificates
  setupCertificates()
}

main()
