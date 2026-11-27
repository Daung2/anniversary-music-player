import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const SCREENSHOTS = '/tmp/opencode/anniversary-player'
mkdirSync(SCREENSHOTS, { recursive: true })

function makeWav(seconds = 2, frequency = 440) {
  const sampleRate = 8000
  const samples = sampleRate * seconds
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index += 1) {
    const value = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 12000
    buffer.writeInt16LE(Math.round(value), 44 + index * 2)
  }
  return buffer
}

const coverPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DAwMDAxMDAwAAAFQAB/+3k5QAAAABJRU5ErkJggg==',
  'base64',
)

const failures = []
const notes = []
const consoleErrors = []

function check(condition, message) {
  if (!condition) failures.push(message)
  else notes.push(`✓ ${message}`)
}

let browser

async function main() {
  browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  })

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`)
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  await page.getByRole('dialog', { name: 'Welcome, my love' }).waitFor({ timeout: 10000 })
  await page.screenshot({ path: `${SCREENSHOTS}/01-first-opening-mobile.png`, fullPage: true })
  await page.getByRole('button', { name: 'Open our little world' }).click()
  check(!(await page.getByRole('dialog', { name: 'Welcome, my love' }).isVisible().catch(() => false)), 'First-opening welcome can be dismissed')

  await page.getByText('A little music, just for you').first().waitFor()
  await page.screenshot({ path: `${SCREENSHOTS}/02-home-mobile.png`, fullPage: true })
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 1, `Mobile layout has no horizontal overflow (${mobileOverflow}px)`)
  const touchSizes = await page.evaluate(() =>
    ['.bottom-nav__item', '.mini-player__controls button', '.top-bar__add'].flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((element) => {
        const rect = element.getBoundingClientRect()
        return { selector, width: rect.width, height: rect.height }
      }),
    ),
  )
  check(touchSizes.length > 0 && touchSizes.every((size) => size.width >= 40 && size.height >= 40), 'Primary mobile controls have touch-friendly targets')

  // Import two real audio files.
  await page.locator('.top-bar__add').click()
  await page.locator('.drop-zone input[type=file]').setInputFiles([
    { name: 'Our Song One.wav', mimeType: 'audio/wav', buffer: makeWav(2, 440) },
    { name: 'Our Song Two.wav', mimeType: 'audio/wav', buffer: makeWav(2, 523) },
  ])
  await page.locator('.import-dialog textarea').fill('Because of that rainy Sunday morning.')
  await page.getByRole('button', { name: 'Add to playlist' }).click()
  await page.getByText('2 songs added to your playlist.').waitFor({ timeout: 15000 })
  check(true, 'Multiple audio files import successfully')

  await page.getByRole('button', { name: 'Songs', exact: true }).click()
  await page.getByText('Our Song One').first().waitFor()
  check(await page.getByText('Our Song Two').first().isVisible(), 'Imported songs appear in the playlist')

  // Playback and controls.
  await page.getByRole('button', { name: 'Play Our Song One' }).click()
  await page.getByRole('button', { name: 'Pause' }).first().waitFor({ timeout: 10000 })
  check(true, 'Playback starts from the playlist')

  await page.locator('.mini-player__main').click()
  await page.getByRole('dialog', { name: 'Now playing' }).waitFor()
  await page.screenshot({ path: `${SCREENSHOTS}/03-now-playing-mobile.png` })

  const position = page.getByRole('slider', { name: 'Song position' })
  await position.evaluate((element) => {
    const input = element
    input.value = '1'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  check(Number(await position.inputValue()) === 1, 'Seeking updates playback position')

  const volume = page.getByRole('slider', { name: 'Volume' })
  await volume.evaluate((element) => {
    const input = element
    input.value = '0.35'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  check(Number(await volume.inputValue()) === 0.35, 'Volume control responds')

  await page.getByRole('button', { name: 'Turn shuffle on' }).click()
  check(await page.getByRole('button', { name: 'Turn shuffle off' }).isVisible(), 'Shuffle mode toggles')
  await page.getByRole('button', { name: 'Repeat: off' }).click()
  check(await page.getByRole('button', { name: 'Repeat: all' }).isVisible(), 'Repeat mode cycles')
  await page.getByRole('button', { name: 'Repeat: all' }).click()
  check(await page.getByRole('button', { name: 'Repeat: one' }).isVisible(), 'Repeat one mode is available')
  await page.getByRole('button', { name: 'Repeat: one' }).click()
  await page.getByRole('button', { name: 'Turn shuffle off' }).click()
  await page.getByRole('button', { name: 'Next song' }).last().click()
  await page.getByText('Our Song Two').first().waitFor()
  check(true, 'Next track changes the current song')
  await page.getByRole('button', { name: 'Previous song' }).click()
  await page.getByText('Our Song One').first().waitFor()
  check(true, 'Previous track returns to the earlier song')

  const nearEnd = Math.max(0, Number(await position.getAttribute('max')) - 0.25)
  await position.evaluate((element, value) => {
    const input = element
    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, nearEnd)
  await page.waitForFunction(() => document.querySelector('.now-playing__meta h3')?.textContent === 'Our Song Two', null, { timeout: 10000 })
  check(true, 'Playback advances automatically when a song ends')

  await page.getByRole('button', { name: 'Open playlist queue' }).click()
  check(await page.getByRole('dialog', { name: 'Our queue' }).isVisible(), 'Queue sheet opens')
  await page.getByRole('button', { name: 'Close' }).last().click()
  await page.getByRole('button', { name: 'Close' }).last().click()

  // Edit metadata and artwork through the real editor.
  await page.getByRole('button', { name: 'Edit Our Song One' }).click()
  await page.locator('.track-editor input:not([type=file])').first().fill('Our Song One (edited)')
  await page.locator('.track-editor input:not([type=file])').nth(1).fill('Us')
  await page.locator('.track-editor textarea').fill('This was playing the night we said yes.')
  await page.locator('.track-editor__cover-actions input[type=file]').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: coverPng,
  })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText('Our Song One (edited)').first().waitFor()
  check(true, 'Metadata and cover image can be edited')

  const editedRow = page.locator('.track-row', { hasText: 'Our Song One (edited)' })
  await editedRow.getByRole('button', { name: 'Move Our Song One (edited) down' }).click()
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.track-row')]
    return rows.findIndex((row) => row.textContent.includes('Our Song Two')) + 1 ===
      rows.findIndex((row) => row.textContent.includes('Our Song One (edited)'))
  })
  check(true, 'Tracks can be reordered by touch controls')
  await editedRow.getByRole('button', { name: 'Move Our Song One (edited) up' }).click()
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.track-row')]
    return rows.findIndex((row) => row.textContent.includes('Our Song One (edited)')) + 1 ===
      rows.findIndex((row) => row.textContent.includes('Our Song Two'))
  })
  check(true, 'Track order can be restored')

  // Corrupt files are reported instead of silently imported.
  await page.locator('.top-bar__add').click()
  await page.locator('.drop-zone input[type=file]').setInputFiles({
    name: 'broken.mp3',
    mimeType: 'audio/mpeg',
    buffer: Buffer.from('this is not really audio'),
  })
  await page.getByRole('button', { name: 'Add to playlist' }).click()
  await page.locator('.error-panel').waitFor({ timeout: 10000 })
  check((await page.locator('.error-panel').textContent()).includes('broken.mp3'), 'Corrupt audio produces a clear error')
  await page.getByRole('button', { name: 'Close' }).last().click()

  await page.getByRole('button', { name: 'Edit Our Song Two' }).click()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Delete song' }).click()
  await page.locator('.track-row', { hasText: 'Our Song Two' }).waitFor({ state: 'detached' })
  check(true, 'Songs can be deleted from the playlist')

  // Persistence across reload.
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('A little music, just for you').first().waitFor()
  await page.getByRole('button', { name: 'Songs', exact: true }).click()
  await page.getByText('Our Song One (edited)').first().waitFor()
  check(true, 'Playlist and metadata persist across reload')

  // Service worker + offline shell and playback.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  check(await page.evaluate(() => Boolean(document.querySelector('link[rel="manifest"]'))), 'PWA manifest is linked')
  check(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Service worker controls the page')
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText('A little music, just for you').first().waitFor({ timeout: 15000 })
  check(true, 'App shell opens offline from the service worker cache')
  await page.getByRole('button', { name: 'Play', exact: true }).first().click()
  await page.getByRole('button', { name: 'Pause' }).first().waitFor({ timeout: 10000 })
  check(true, 'Imported audio plays while offline')
  await context.setOffline(false)

  // Desktop and tablet layouts.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.screenshot({ path: `${SCREENSHOTS}/04-home-desktop.png`, fullPage: true })
  check(await page.locator('.sidebar').isVisible(), 'Desktop navigation is visible')
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.screenshot({ path: `${SCREENSHOTS}/05-home-tablet.png`, fullPage: true })
  check(await page.locator('.bottom-nav').isVisible(), 'Tablet layout uses touch-friendly navigation')
  const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(tabletOverflow <= 1, `Tablet layout has no horizontal overflow (${tabletOverflow}px)`)

  // Backup round trip.
  await page.getByRole('button', { name: 'You', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup' }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  check(Boolean(backupPath) && download.suggestedFilename().endsWith('.zip'), 'Backup downloads as a ZIP file')
  await page.locator('.settings-page input[type=file]').setInputFiles(backupPath)
  await page.getByText(/Restored \d+ playlists and \d+ songs/).waitFor({ timeout: 15000 })
  check(true, 'Backup can be imported and restored')

  // Personalisation and additional playlists.
  await page.locator('.settings-panel input').first().fill('A playlist for my favourite person')
  await page.getByRole('button', { name: 'Save our words' }).click()
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await page.getByText('A playlist for my favourite person').first().waitFor()
  check(true, 'Welcome message can be personalised')
  await page.getByRole('button', { name: 'Lists', exact: true }).click()
  await page.locator('.create-playlist input').first().fill('Rainy day songs')
  await page.getByRole('button', { name: 'Create playlist' }).click()
  await page.getByText('Rainy day songs').first().waitFor()
  check(true, 'Additional playlists can be created')

  await browser.close()

  console.log(notes.join('\n'))
  if (consoleErrors.length) console.log(`\nBrowser console messages:\n${consoleErrors.join('\n')}`)
  if (failures.length) {
    console.error(`\nFailures:\n${failures.join('\n')}`)
    process.exitCode = 1
  } else {
    console.log(`\nAll ${notes.length} smoke checks passed. Screenshots: ${SCREENSHOTS}`)
  }
}

main().catch(async (error) => {
  console.error(error)
  if (browser) await browser.close().catch(() => {})
  process.exitCode = 1
})
