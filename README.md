# 🪷 Loy Krathong – Float a Krathong

A one-page Loy Krathong for phones, iPads and computers. Make a krathong, light its candle, make a wish,
and swipe it onto the river under the full moon. It drifts away to join the other krathongs, and sky lanterns
and fireworks go up.

## Two sides, like the birthday cake

Opening the page with no krathong in the link asks what you'd like to do:

- **🪷 Make a krathong**, then choose how:
  - **✏️ Draw your krathong:** draw it with a finger or mouse on a pad (16 colors, 4 sizes, eraser, undo, a dashed
    guide with the water line). With the **🕯️ Candle** tool you tap where up to 3 flames burn.
  - **🧩 Create your krathong:** pick the base (banana trunk, bread, coconut, lotus), folded leaves and their color,
    flowers (marigold, rose, orchid, jasmine), the middle (lotus bud, flower cone, big marigold), the candle color and 0–3 incense sticks.
  - You can switch between Draw and Create at any time. The **✍️ Words** tab adds who it's for, who it's from and a message.
  - **🎁 Send this krathong** makes a link (copied for you, or the share sheet on a phone).
  - **🌊 Float it now** takes it to the river yourself, then **✏️ Back to making**.
- **🌊 Float a krathong:** go straight to the river with a ready-made one.

Whoever opens a link goes straight to the river with *that* krathong: tap the candle to light it, type a wish
(it never leaves the device), then swipe the krathong up or tap **Let it float**. Afterwards they can make their own.
The maker's last design is remembered on their device.

## What's in the link

- Created krathongs are just settings: `?m=create&name=Mia&base=banana&leaf=pointed&leafc=green&fl=marigold,rose&center=lotus&candle=gold&inc=3`
- Small drawings travel inside the link itself, packed into a short code after the `#` (`#d=...`).
- Bigger drawings (a code longer than 3000 characters) are uploaded as a PNG to Supabase Storage
  (project `happybirthday-cake`, bucket `krathong-drawings`) and the link only carries the id (`&did=...`).
  If the upload fails, the long link is used instead.

The key in `krathong.js` is Supabase's public key. With it people can only *add* new PNG drawings under 300 KB
with a random name. Nobody can list, replace or delete them. To remove drawings use the Supabase dashboard → Storage → `krathong-drawings`.

## Hosting

Any static host works, for example GitHub Pages (Settings → Pages → deploy from this branch).
Sharing needs the page to be online at an https:// address.

## Files

- `index.html`: the page
- `style.css`: the look, plus phone fixes (no zoom or bounce)
- `krathong.js`: options, links, drawing a created krathong (SVG), and the drawing codec and upload
- `river.js`: the night river (moon, stars, lanterns, fireworks, other krathongs), lighting and floating away
- `builder.js`: choosing what to do, the drawing pad and options, sending the link
