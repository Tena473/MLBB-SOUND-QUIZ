# Hero Echo — MLBB Sound Quiz

A relaxed, endless hero voice quiz built with React, TypeScript, and Vite. Listen to a voice line, type a hero's full name, and keep playing. The interface is in English and works on phones and desktops.

## Run locally

Use Node.js 24 LTS. Node.js 22.13+ (22.x) and Node.js 26+ are also supported.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite, normally http://127.0.0.1:5173. To test on a phone connected to the same Wi-Fi, use `npm run dev -- --host 0.0.0.0` and open the Network URL printed by Vite. Your firewall may need to allow access.

```sh
npm test          # Logic, interface, audio-error handling, and actual asset checks
npm run build    # TypeScript check and production output in dist/
npm run preview  # Serve the production build locally
```

The `predev`, `prebuild`, and `pretest` scripts prepare audio automatically. The app needs no API keys, database, accounts, or external backend. Refreshing the page resets the game. Fonts use Google Fonts when available, with local system-font fallbacks.

## How to play

- Choose an available difficulty. Easy needs at least one hero; Mid and Hard each require ten **distinct heroes** with sound files at that level.
- Press **Play sound**. Playback is never automatic. You can pause, adjust volume, and replay as often as you like.
- Click/tap the empty guess field to browse all heroes with their portraits, or press ↑ / ↓ while the field is focused. The full list is alphabetical and scrollable. Typing filters the results; clearing the text restores the whole roster. Automatic focus at the start of a round does not open the list.
- Type the full hero name or choose a search result, then press **Submit** or Enter. Use ↑ / ↓ and Enter to select a search result, or click/tap it. Selection fills the name without submitting it. Escape, Tab, or clicking outside closes the suggestions. Case and surrounding spaces are ignored; partial names do not count.
- Each correct answer earns one point. Incorrect answers and skipped questions earn zero points.
- **Show Answer** reveals the hero's name and portrait and counts the question once as skipped. You cannot submit an answer afterward. Press **Next** to continue. Answer results also show the portrait after submitting or skipping; portraits are never shown as the answer before the round is resolved.
- **Skip** also reveals the answer and counts as skipped. If the audio is unavailable, retry or skip it; unavailable sounds are tracked separately and excluded from the score and accuracy.
- Heroes do not repeat within a shuffled cycle. After all eligible heroes are used, a new cycle begins without repeating the last hero immediately (unless only one hero is available).
- **End Game** shows correct, incorrect, skipped, and accuracy. The current unanswered question is excluded. Accuracy is `correct / (correct + incorrect + skipped)`; zero scored rounds means 0%.

## Add or replace sounds

Keep original files in `MLBB-sound/`. Each hero folder uses its existing numeric ID and hero name:

```text
MLBB-sound/
  001 - Aamon/
    Aamon-Easy-1.ogg
    Aamon-Easy-2.ogg
    Aamon-Mid-1.ogg
    Aamon-Hard-1.ogg
  012 - Aurora/
    Aurora-Easy-1.ogg
```

Use `<Hero>-<Easy|Mid|Hard>-<number>.ogg`, with the hero name matching the text after the numeric folder prefix **exactly**. For example, `077 - Lapu-Lapu` contains `Lapu-Lapu-Easy-1.ogg`, and `085 - Luo Yi` contains `Luo Yi-Easy-1.ogg`. Use `Easy`, `Mid`, or `Hard`, a positive clip number, and the lowercase `.ogg` extension. Spaces, apostrophes, periods, and hyphens in hero names are supported. Invalid names produce a clear setup error; unrelated non-audio files are ignored. Empty hero folders are omitted. Do not renumber existing folders; use unique IDs for new heroes.

To normalize downloaded sounds or old filenames:

```sh
npm run normalize:sounds:check  # Preview renames without changing files
npm run normalize:sounds        # Apply the planned source-file renames
npm run prepare:sounds          # Refresh the game's roster and copied audio
```

Normalization changes **source filenames** in `MLBB-sound/`, preserving the audio bytes and hero folders. Existing numbered clips retain their difficulty and clip number; unclassified names such as `Lukas.select.ogg` become Easy clips using the first unused number. Recognized Ogg audio with a `.oga` extension is renamed to `.ogg` without transcoding. Filenames with conflicting clip numbers or invalid Ogg contents stop the operation before any rename. Case-only renames are supported on Windows.

After adding, changing, or removing audio, **restart `npm run dev`** or run `npm run build`. No game-code edits are necessary. Mid and Hard unlock automatically once each level has ten eligible heroes. Each question randomly chooses one of the hero's files at that level. Existing Easy audio is never reused as a substitute for another difficulty.

`npm run prepare:sounds` can also be run independently. It generates `src/generated/heroes.json` and copies only recognized audio into `public/sounds/`. Both outputs are ignored by Git and rebuilt from the source library; the script never edits source audio. The production build includes the prepared sounds in `dist/sounds/`.

Latest library snapshot: 131 heroes and 137 sound files — 133 Easy files, 2 Mid files and 2 Hard files. Easy has 131 eligible heroes. Mid and Hard currently belong to Aamon alone, so those levels remain locked. Run `npm run prepare:sounds` to see the current counts after future additions. The empty `033 - Dori` folder was removed without renumbering other heroes.

Tests derive roster counts and difficulty availability from the current library instead of hardcoding the roster size. Scanner and rename edge cases use separate fixture libraries, so adding valid sounds does not require updating test expectations. The scanner validates that each filename matches its hero folder; the folder remains the source of the displayed name.

## Project layout

- `src/game.ts`: difficulty rules, shuffled cycles, answer checking, and score calculations.
- `src/App.tsx`: start, quiz, reveal, and summary screens.
- `src/AudioPlayer.tsx`: manual playback, replay, volume, cleanup, and recovery.
- `src/HeroSearch.tsx`: accessible hero suggestions with portraits, filtering, and keyboard selection.
- `scripts/prepare-sounds.mjs`: scans original sounds and generates web assets.
- `scripts/normalize-sounds.mjs`: previews or applies consistent filenames without changing audio contents.

## Hero portraits

Search-result portraits are stored locally in `public/heroes/`; `src/data/hero-portraits.json` maps each hero's folder ID to its image and source URL. They are bundled into the production build and do not depend on a third-party image request while playing. Missing or broken portraits fall back to initials without affecting search or scoring.

The image references come from the [official MPL Malaysia hero roster](https://my.mpl.mobilelegends.com/?lang=en). To sync portraits after adding heroes, run `npm run sync:portraits` with internet access, then rebuild. Existing matching assets are reused. Portrait syncing is a manual operation; `dev`, `test`, and `build` do not fetch images from the internet. Hero artwork belongs to its respective owners.

This is an unofficial fan quiz for Mobile Legends: Bang Bang. Hero names and supplied audio belong to their respective owners.
