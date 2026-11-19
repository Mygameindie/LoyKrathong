# 🪷 Loy Krathong – One River for Everyone

A one-page Loy Krathong for phones, iPads and computers. Make a krathong, light its candle, make a wish,
and swipe it onto the river under the full moon. It drifts away to join the other krathongs, and sky lanterns
and fireworks go up.

## How it works

The main page is **one shared river** with every krathong people have released (the newest 60), drifting
across the water with their candles lit. Tap one to see whose it is and their message. New ones float in by themselves
(the page checks every 20 seconds), and the panel shows how many were released today.

- **🪷 Make a krathong**, then choose how:
  - **✏️ Draw your krathong:** a drawing studio with a sheet of paper in the middle, like a sketching app:
    - 🖌️ brush, 🪣 paint bucket (fills a closed shape cleanly, right up to the lines), 🧽 eraser, 🕯️ candle (tap where up to 3 flames burn)
    - color picker: 16 colors, any color, and your recent colors
    - size slider, undo and redo (two-finger tap = undo, three-finger tap = redo; Ctrl+Z / Ctrl+Shift+Z on a computer)
    - keyboard: B brush, G bucket, E eraser, C candle, [ and ] for size
    - a guide with the water line. The paper stays behind: only the drawing floats. If you color the paper with
      the bucket (a fill that reaches the edge of the paper), it shows while drawing but is see-through on the river.
  - **🧩 Create your krathong:** base (banana trunk, bread, coconut, lotus), folded leaves and color, flowers,
    the middle (lotus bud, flower cone, big marigold), candle color and 0–3 incense sticks.
  - **Name** (optional) and a **message** are shown on the river for everyone.
  - **🪷 Release krathong:** light the candle, type a secret wish (it never leaves the device), and swipe the krathong
    up. It floats away and joins everyone else's on the river, marked **★ yours** on your screen.
- **🌊 See the river:** just watch.

Old share links (`?m=create&...`, `#d=...`) still open a single krathong to float.

## Where the krathongs are stored

Supabase project `happybirthday-cake`:

- Table **`krathongs`**: name, message, how it looks (`look` for created ones, `strokes` for drawings) and flame spots.
  Anyone can add a row and read the list. Nobody can change or delete rows from the site.
- Bucket **`krathong-drawings`**: only for very big drawings (over 40,000 characters of stroke code), stored as PNG.

To remove a krathong (for example a rude name or message), delete its row in the Supabase dashboard → Table Editor → `krathongs`.
The key in `krathong.js` is Supabase's public key, made to be in the page.

## Hosting

Any static host works, for example GitHub Pages (Settings → Pages → deploy from this branch).
The shared river works from any address, because the page talks to Supabase directly.

## Files

- `index.html`: the page
- `style.css`: the look, plus phone fixes (no zoom or bounce)
- `krathong.js`: options, links, drawing a created krathong (SVG), the drawing codec, and the shared river (Supabase)
- `river.js`: the night river (moon, lanterns, fireworks), everyone's krathongs, lighting and floating away
- `builder.js`: choosing what to do, the drawing pad and options, releasing
