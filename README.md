# Huseyn Maharramli · portfolio

One static page. There is no build step and nothing to install.

| File | What it holds |
| --- | --- |
| `index.html` | All the text and structure |
| `styles.css` | The design: colours, type, layout |
| `script.js` | Theme button, scroll reveal, count-up numbers, Baku clock |
| `ensemble.js` | The decision-tree model behind the picture at the top |
| `demo.js` | Draws that picture and runs its slider |


## The design

Dark, minimal and precise: charcoal and midnight blue, with electric blue, violet and cyan as accents, and objects that sit in 3D space.

- **Type**: Archivo for the name and headings, Geist for text, Geist Mono for small capital labels.
- **Colour**: the site opens dark (charcoal `#0b0e14`) unless the visitor picks light with the button in the header. Accents are electric blue, muted violet and soft cyan; buttons and the brand mark use a blue-to-violet gradient.
- **Layout**: every section is two columns, a heading rail on the left that stays in view and the content on the right (`.section-grid`, `.section-head`, `.section-body`). On narrow screens they stack.
- **Work** is one row per project (`.case`), numbered P/01 to P/06, with the chart beside the text. Rows respond to the width of their column (container queries), not the window.
- **Dark blocks**: the Journey section, the contact block, the footer and the picture's stage carry the class `tone-dark` and are dark in both themes. Everything else follows the visitor's theme.
- **Header**: a thin bar with the time in Baku (`bakuClock` in `script.js`; it prints "UTC+4" without JavaScript).
- **The picture at the top** is a real model running in the browser: 1,000 small decision trees, each trained on 100 random points from a synthetic two-class dataset, voting on every part of the image. It illustrates the ensemble project; it is not that project's data or results, and the caption and footnote say so.
- `styles.css` is one system, in order: tokens, base, header, hero, sections, components, motion, small screens.

## 3D

- **The workstation in the hero** (`.scene` in `index.html`) is drawn with CSS 3D, no library: a desk, a floating monitor, a keyboard, an AI chip, a stack of model layers and a hologram of a neural network. Each box is a `.cuboid` whose size and position are in its `style` attribute; `initScene` in `script.js` adds the six faces, turns the scene with the mouse and draws the network. The code on the monitor is the real ensemble method and its real result; change it if the project changes. Without JavaScript the scene is simply absent.

- Anything marked `data-tilt` leans toward the mouse and shows a soft glare (`initTilt` in `script.js`; the angle comes from `tiltAngles`). Its contents float a little above it. Touch screens keep these flat.
- The live tree-voting picture sits in its own band under the headline numbers, resting at an angle with its slider floating in front.
- The Skills section opens with a globe of skill names that turns slowly and can be dragged (`initGlobe`). It is built from the skill lists under it, so edit the lists and the globe follows. It is decorative and hidden from screen readers.
- Sections swing up into place as they scroll in, and the name flips up on load.
- Do not put `data-tilt` on an element that also has `reveal`: both use `transform`. A test checks this.

## Motion

- The highlighted words in the tagline get their underline.
- A strip of tools scrolls under the hero (`.ticker`). It holds two identical lists so the loop has no seam; edit both.
- The four headline numbers count up from zero; a thin bar along the top shows how far down the page you are.
- Chart bars grow to their value, skill chips arrive one by one, award icons draw their outline.
- On the Erasmus entry the route draws itself, each city pulses, and a point travels from Baku to Kaunas.
- Contact rows fill with the accent colour on hover. Switching theme cross-fades where the browser supports it.
- Visitors who ask their device for reduced motion get none of this, and the page reads the same without JavaScript.

## Edit it

- **Text** lives in `index.html`. Each section starts with a comment: Hero, About, Projects, Journey, Skills, Recognition, Contact.
- **Colours** are the tokens at the top of `styles.css`. There are two dark blocks and they must stay identical.
- **A chart bar** is one `<li class="meter">`. Its `data-value`, `data-max`, bar width (`--v`, which is value ÷ max × 100) and printed number must agree. The tests fail if they don't.
- **A new project** is a copy of an `<article class="project case reveal">` block with a new `id` and the next `P/0n` number. Every number on the page comes from the linked notebook; keep it that way.

- **After changing `styles.css` or a script**, raise the number in `?v=8` on all four links at the top of `index.html`. Browsers keep old copies for a while; a new number makes them fetch the new files.

## Test it

```bash
npm test
```

Needs Node 20 or newer. The 87 checks cover: every section and link is present, the Erasmus entry, the numbers quoted for each project, chart bars matching their labels, the tree model (training, voting, repeatability), how the picture animates (including for visitors who ask for reduced motion), the count-up numbers, the Baku clock, the tools strip, the 3D helpers, the two dark themes staying in sync, and no phone number or placeholder text on the page.
## Publish it

The site is served by GitHub Pages from the `main` branch of this repository, at https://hmaharramli55-dot.github.io/. Pushing to `main` updates it within a minute or two.

## Contact details

The page shows an email address, LinkedIn and GitHub. A test fails if a phone number or a `tel:` link appears; remove that check in `tests/site.test.js` if you decide to add one.
