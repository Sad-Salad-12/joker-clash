# Validation — 2026-10-28

## Automated logic and source checks

- `node --check js/game.js` passed.
- `node test/logic.test.js` passed all 31 existing checks: poker hands, scoring, Joker application, deck size/refill, AI combinations, and damage conversion.
- `git diff --check` passed.
- The 36-second H.264 MP4 fully decoded with FFmpeg: 864 output frames, no decode error.

## Chromium browser checks (Ego Browser)

- Normal match: start, select cards, best-hand suggestion, play, damage, refill, Joker reward, keyboard draft selection, end turn, and AI return to round 2.
- Real reward: three Joker choice buttons; focus moves into the draft and the underlying game is inert. Choosing a Joker closes the reward and adds it to the rack.
- Sound toggle updates its pressed state and persists after reload.
- Rules open as a modal and close with the keyboard.
- Space on a focused card toggles that card without consuming a play; card focus survives rerender.
- Number shortcuts honor the five-card cap; Escape clears and H selects a hand.
- A deliberately prepared terminal game state verifies victory, focus on Play Again, and a fresh 150-HP match on restart. This fixture is only a test; the gameplay recording uses an unmodified shuffled match.
- Reduced-motion emulation resolves the card animation duration to 0.00001 seconds.
- No window error events occurred during the final interaction checks.

## Responsive checks

| Viewport | Document width | Horizontal overflow | Visible image failures |
| --- | --- | --- | --- |
| 320 × 740 | 320 | None | 0 |
| 390 × 844 | 390 | None | 0 |
| 768 × 1024 | 768 | None | 0 |
| 1366 × 600 | 1366 | None | 0 |
| 1440 × 900 | 1440 | None | 0 |

At 390 × 844 the title-screen Start button ends at y=748, within the initial viewport. Short desktop viewports can scroll vertically so battle controls remain reachable. Desktop, mobile, draft, and title captures were visually inspected.

## Scope

Validated in desktop Chromium with emulated viewport sizes. Physical iOS/Android devices and Safari/Firefox were not tested. Game balance, poker evaluation, and AI tuning were not changed. The video is silent and captures 12 unique frames per second, encoded at 24 fps; it is a product demonstration, not a 60-fps trailer.
