# Blooket Cheetos

A self-contained bookmarklet for Blooket that works on **any** blooket.com page — the dashboard, the join screen, or inside a live game. One click opens the full menu: a tab for every supported game mode is always there, so you can arm cheats before the match even starts. Toggles engage automatically when a game goes live. Press **Ctrl+Shift+X** (or **Ctrl+Shift+E**) anytime to hide or show the panel.

> Use at your own risk. This is a client-side tool for testing and education. Blooket can action accounts that use cheats, and Blooket updates can break individual cheats.

## Features

- Works on any blooket.com page — no need to re-run the bookmark as you navigate around the site.
- Fully self-contained: the entire cheat lives inside the bookmark URL and never loads anything from the network, so Blooket's content-security rules have nothing to block.
- Full menu everywhere: a **General** tab (Global cheats + Humanizer) plus a tab for every supported mode.
- Arm cheats in advance: toggle them on the dashboard, they engage automatically when a game starts.
- Auto-detects the current game (including games hosted in an iframe), shows a live / waiting status, and jumps to the right tab when a match goes live.
- Humanizer: answer delays, typing simulation, and an accuracy dial so auto-answer behaves like a real player.
- Stops Blooket's in-game report beacon.
- **Ctrl+Shift+X** or **Ctrl+Shift+E** hides or shows the panel.
- Free game modes only. Nothing that requires Blooket Plus.

## Install

Open the install page and drag the **Cheetos** button into your bookmarks bar:

**https://Cleetus14.github.io/Blooket-Cheetos/**

That is the whole install — the bookmark carries everything with it.

### Manual setup (Chrome, Edge, Opera / Opera GX)

1. Open the install page: <https://Cleetus14.github.io/Blooket-Cheetos/>
2. Click **Copy bookmarklet**.
3. Show your bookmarks bar with `Ctrl+Shift+B`.
4. Right-click the bookmarks bar → **Add page…** (Edge: **Add to favorites**; Opera: **Add to bookmarks**).
5. Name it `Blooket Cheetos`, paste the copied code into the **URL** field, and save.

Chromebooks work exactly the same way — Chrome on ChromeOS accepts bookmarks just like desktop Chrome.

> The bookmark URL is large (~100 KB) because the whole cheat is stored inside it. That is intentional: it makes the bookmark work on every page and keeps it working even if Blooket tightens its script rules further. It never talks to any server, so there is nothing extra to block.

## How to use

1. Click the `Blooket Cheetos` bookmark on any Blooket page — the dashboard works fine.
2. The panel opens immediately. The header shows where you are (`Gold Quest · live`, `Lobby`, or `Dashboard`).
3. Use the tabs to switch between **General** (Global cheats + Humanizer settings) and every game mode.
4. Turn on whatever you want, even before a game starts. Toggle cheats turn green while armed and engage automatically when the game goes live.
5. When you join a live game, the panel jumps to that mode's tab automatically.
6. **Ctrl+Shift+X** / **Ctrl+Shift+E** hides or shows the panel; the small **Cheetos** button in the corner also reopens it.
7. **Stop All Cheats** on the General tab turns everything off in one click.

## Supported modes

| Mode | Cheats |
|---|---|
| Global (any quiz mode) | Auto Answer, Highlight Answers, Every Answer Correct, Change Blook In Game, Remove Random Name, Use Any Blook, Sell Duplicate Blooks, Kick Player |
| Rewards | Add Tokens (+XP) |
| Gold Quest | Set Gold, Set Player Gold, Reset Player Gold, Reset All Gold, Silent Steal Gold, Silent Reset Gold, Ruin Chests, Chest ESP, Always Triple, Auto Choose, Swap Gold, Steal All Gold, No Bad Chests, Kick Player |
| Cyber Hack | Set Crypto, Steal Player's Crypto, Set Password, Remove Hack, Always Triple, Auto Guess, Password ESP, Choice ESP |
| Café | Set Cash, Stock Food, Max Items, Remove Customers |
| Factory | Set Cash, Max Blooks, Free Upgrades, Send Glitch, Remove Glitches, Set All Mega Bot |
| Tower of Doom | Max Stats, Set Coins, Max Health, Fill Deck, Max Cards, Min Enemy |
| Tower Defense | Set Tokens, Set Damage, Max Towers, Set Round, Remove Enemies, Remove Ducks, Remove Obstacles |
| Crazy Kingdom | Max Stats, Set Guests, Disable Toucan, Choice ESP, Skip Guest |
| Fishing Frenzy | Set Weight, Frenzy, Set Lure, Send Distraction, Remove Distraction |
| Blook Rush | Set Defense, Set Blooks |
| Deceptive Dinos | Set Fossils, Set Multiplier, Auto Choose, Rock ESP |
| Monster Brawl | Max Abilities, Instant Kill, Invincibility, Kill Enemies, Next Level, Double Enemy XP, Half Enemy Speed, Reset Health, Magnet, Remove Obstacles |
| Santa's Workshop | Set Toys, Send Distraction, Set Toys Per Q |
| Voyage | Set Doubloons, Steal Doubloons, Swap Doubloons, Start Heist, Max Island Levels |
| Racing | Instant Win, Set Progress |

Blooket Plus-only modes are not included.

## License

[MIT](LICENSE)
