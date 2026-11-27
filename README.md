# Our Little Playlist

A private, romantic music player built as a first-anniversary gift. It is a React + TypeScript + Vite progressive web app: all audio, artwork, notes and playlists stay in the browser's IndexedDB on the device. Nothing is uploaded.

## Run it

```bash
npm install
npm run dev
```

For a production/PWA build:

```bash
npm run build
npm run preview
```

Generate the PWA icons (requires Python with Pillow):

```bash
npm run icons
```

Run the browser smoke tests against a running preview server:

```bash
npm run test:smoke
```

The smoke test uses the locally installed Chrome and covers imports, playback, seeking, volume, shuffle/repeat, queue, metadata/artwork editing, reordering, corrupt files, persistence, offline playback, responsive layouts, backup/restore and personalisation. Screenshots are written to `/tmp/opencode/anniversary-player`.

## Using the player

- **Add songs:** tap **Add songs** in the top bar. You can select multiple files at once. MP3, WAV, M4A and OGG work where the browser supports them.
- **Fill the ten slots:** tap an empty slot in **Our songs**, or use the pencil editor to mix in audio, artwork and a personal note.
- **Playback:** the player dock stays visible. Tap it for the full Now Playing screen with queue, shuffle, repeat, seek and volume.
- **Personalise:** edit the welcome message, anniversary note, surprise message and date under **Personalise**.
- **Backup:** export a private ZIP containing playlists, notes, artwork and audio. Import it on another device to restore the collection.
- **Install:** when the browser offers it, use **Install** to add the app to the home screen. On iOS, use Share → Add to Home Screen.

## Technical notes

- Audio files and cover images are stored as blobs in IndexedDB. Cover images are resized and converted to WebP/JPEG before storage.
- A service worker caches the application shell so the UI and already-imported songs work offline.
- Autoplay after a page reload is blocked by browsers, so the last song and position are restored but playback waits for a tap.
- Codec support is device-dependent. Unsupported or corrupt files are reported with clear messages instead of being silently added.
- The media session API provides lock-screen and notification controls on supported Android browsers.
- Reduced-motion preferences are respected; decorative animations are disabled.

## Structure

```text
src/
  components/  reusable UI, player, dialogs, navigation
  context/     library/IndexedDB state and HTML5 audio player
  hooks/       PWA install prompt
  lib/         database, backup, media validation, formatting
  pages/       Home, playlist editor, playlists, personalisation
  styles/      design tokens and responsive CSS
scripts/       icon generation and browser smoke test
```
