# Midnight Table materials

Created for Joker Clash on 2026-10-28. Art direction: midnight emerald, warm brass, ivory paper, and restrained engraved ornament. Title composition leads into the battle table; dealing, card selection, score impact, and Joker reveals provide the motion.

## Main artwork

`assets/art/midnight-table.jpg` was made with the built-in OpenAI image-generation tool, then exported as JPEG for the browser. No external stock image was used. It is original generated concept artwork, not a photograph of a real venue. The full generation prompt follows:

> Use case: stylized-concept. Asset type: full bleed title-screen key art for JOKER CLASH, a premium poker card battle browser game. Wide cinematic landscape 16:9. A moody midnight private card room: on the RIGHT HALF a striking ivory and dark emerald theatrical jester mask resting beside a loosely fanned hand of ornate ivory playing cards and a few small stacks of antique brass poker chips on deep emerald wool felt. Beautiful tactile material detail: engraved brass, worn paper edges, woven felt, dark walnut rail. Background shadowy and atmospheric with a single warm amber practical light far upper right. Camera low and close to the table, sophisticated editorial game art with painterly realism, dramatic chiaroscuro, subtle film grain. LEFT HALF mostly very dark forest green shadow and uncluttered felt, intentionally quiet negative space to hold large website title text. The mask is the main focal point at 75% horizontal, 45% vertical. No text, no lettering, no logos, no UI, no borders, no collage. Restrained emerald, ivory, warm gold palette; not purple, not cartoon, not neon.

## Vector family

52 card faces in `assets/deck/` use ivory paper shading, warm hairline borders, legible corner indices, and suit pips. Court cards use geometric seals. `assets/art/card-back.svg` carries the emerald/brass diamond pattern; the same language continues through two hero crests and 28 Joker seals. The SVGs are editable source materials and scale without raster blur.

The font remains the existing bundled Cinzel (OFL). Legacy Kenney assets retain their credit and license entries in `assets/CREDITS.txt`.

## Media provenance

- `joker-clash-cover.jpg`: rendered title screen, 1470 × 812.
- `joker-clash-table.png`: 1440 × 900 staged Royal Flush composition using the existing `?shot=1` preview. This is not footage of an organically dealt hand.
- `joker-clash-mobile.png`: 390 × 844 capture from a normal match.
- `joker-clash-draft.png`: earned Joker draft from normal play.
- `joker-clash-gameplay.mp4`: 1440 × 900, 36 seconds, silent H.264. Real browser interactions at 12 captured frames per second, encoded at 24 fps with repeated frames. The recording starts a normal match, selects and plays hands, drafts Berserker, and shows the opponent's turn. It finishes in round 2 with player HP 108 and opponent HP 130. No game state was injected for this recording.

The clip deliberately has no soundtrack; the game's synthesized effects remain available in play through the Sound control. No third-party music is bundled.
