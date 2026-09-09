Drop pictures here, then tell Claude (or edit evening-routine.html yourself).

Each day slide has a panel like this:

    <div class="art"><span>שישי</span></div>

Point it at a file by adding --img:

    <div class="art" style="--img:url('images/friday.jpg')"><span>שישי</span></div>

Suggested names, one per day slide:
  weekday.jpg    ימים א׳–ד׳
  training.jpg   יום אימון
  thursday.jpg   יום חמישי
  friday.jpg     יום שישי
  saturday.jpg   יום שבת

Notes
- Landscape images work best (the panel is 4:3 on desktop, 16:7 on phones).
- Anything the browser reads is fine: jpg, png, webp, gif.
- Files in this folder are gitignored, so they are NOT published to
  https://therubioftw.github.io/Random/ . On the public page those panels
  show a coloured tile instead. To publish them, remove images/ from
  .gitignore first - and only do that for images you have the right to share.
