# Blooket Cheetos

A bookmarklet for Blooket that runs on **any** blooket.com page — dashboard, join screen, or live game. One click opens a panel with the full menu: a tab for every supported game mode is always there, so you can arm cheats before the match even starts. Toggles you turn on engage automatically when a game goes live.

> Use at your own risk. This is a client-side tool for testing and education. Blooket can action accounts that use cheats, and Blooket updates can break individual cheats.

## Features

- Works on any blooket.com page — no need to re-run the bookmark when you navigate around the site.
- Full menu everywhere: a **General** tab (Global cheats + Humanizer) plus a tab for every supported mode.
- Arm cheats in advance: toggle them on the dashboard, they engage automatically when a game starts.
- Auto-detects the current game, shows a live / waiting status, and jumps to the right tab when a match goes live.
- Humanizer: answer delays, typing simulation, and an accuracy dial so auto-answer behaves like a real player.
- Stops Blooket's in-game report beacon.
- Free game modes only. Nothing that requires Blooket Plus.

## Install

The bookmarklet loads the cheat from this repository (GitHub Pages first, CDN fallback), so it stays up to date whenever the repo is updated.

Create a new bookmark and set its **URL** to:

```js
javascript:(()=>{const urls=['https://Cleetus14.github.io/Blooket-Cheetos/cheetos.js','https://cdn.jsdelivr.net/gh/Cleetus14/Blooket-Cheetos@main/dist/cheetos.js'];let i=0;const load=()=>{if(i>=urls.length){alert('Blooket Cheetos failed to load');return}const s=document.createElement('script');s.src=urls[i++];s.onerror=()=>{s.remove();load()};document.body.appendChild(s)};load()})();
```

Name it `Blooket Cheetos`.

### Google Chrome

1. Show the bookmarks bar with `Ctrl+Shift+B`.
2. Right-click the bookmarks bar and choose **Add page…**.
3. Name it `Blooket Cheetos`, paste the code above into the URL field, and save.

### Microsoft Edge

1. Show the favorites bar with `Ctrl+Shift+B`.
2. Right-click the bar and choose **Add page…** (or use the star icon → More options → Edit).
3. Use the same name and URL.

### Opera / Opera GX

1. Show the bookmarks bar with `Ctrl+Shift+B` (or Easy Setup → Appearance → Show bookmarks bar).
2. Right-click the bar and choose **Add page…**.
3. Use the same name and URL.

### Drag-and-drop alternative

Open <https://Cleetus14.github.io/Blooket-Cheetos/> and drag the **Cheetos** button into your bookmarks bar.

## How to use

1. Click the `Blooket Cheetos` bookmark on any Blooket page — the dashboard works fine.
2. The panel opens immediately. The header shows where you are (`Gold Quest · live`, `Lobby`, or `Dashboard`).
3. Use the tabs at the top to switch between **General** (Global cheats + Humanizer settings) and every game mode.
4. Turn on whatever you want, even before a game starts. Toggle cheats turn green while armed and engage automatically when the game goes live.
5. When you join a live game, the panel jumps to that mode's tab automatically.
6. **Stop All Cheats** on the General tab turns everything off in one click.

## Supported modes

| Mode | Cheats |
|---|---|
| Global (any quiz mode) | Auto Answer, Highlight Answers, Every Answer Correct |
| Gold Quest | Set Gold, Chest ESP, Always Triple, Auto Choose, Swap Gold |
| Crypto Hack | Set Crypto, Auto Guess, Password ESP, Choice ESP |
| Café | Set Cash, Stock Food, Max Items |
| Factory | Set Cash, Max Blooks, Free Upgrades |
| Tower of Doom | Max Stats, Set Coins, Max Health |
| Tower Defense | Set Tokens, Set Damage, Max Towers, Set Round |
| Crazy Kingdom | Max Stats, Choice ESP, Skip Guest |
| Fishing Frenzy | Set Weight, Frenzy, Set Lure |
| Blook Rush | Set Defense, Set Blooks |
| Deceptive Dinos | Set Fossils, Set Multiplier, Auto Choose, Rock ESP |
| Monster Brawl | Max Abilities, Instant Kill, Invincibility |
| Santa's Workshop | Set Toys, Remove Distractions, Swap Toys |

Blooket Plus-only modes are not included.

## License

[MIT](LICENSE)
