# Huseyn Maharramli · portfolio

One static page. There is no build step and nothing to install.

| File | What it holds |
| --- | --- |
| `index.html` | All the text and structure |
| `styles.css` | The design: colours, type, layout |
| `script.js` | Theme button, scroll reveal, navigation bar behaviour |
| `ensemble.js` | The decision-tree model behind the picture at the top |
| `demo.js` | Draws that picture and runs its slider |


## The design

- **Type**: the system font on Apple devices, Inter everywhere else.
- **Sections** alternate light and dark. A section with the class `tone-dark` (hero, journey, contact) is dark in both themes; the rest follow the visitor's theme.
- **Accent**: Caspian blue → dusk violet → pomegranate → Baku flame orange. It appears in the eyebrow labels, the four headline numbers and the picture at the top.
- **The picture at the top** is a real model running in the browser: 1,000 small decision trees, each trained on 100 random points from a synthetic two-class dataset, voting on every part of the image. It illustrates the ensemble project; it is not that project's data or results, and the caption and footnote say so.

## Edit it

- **Text** lives in `index.html`. Each section starts with a comment: Hero, About, Projects, Journey, Skills, Recognition, Contact.
- **Colours** are the tokens at the top of `styles.css`. There are two dark blocks and they must stay identical.
- **A chart bar** is one `<li class="meter">`. Its `data-value`, `data-max`, bar width (`--v`, which is value ÷ max × 100) and printed number must agree. The tests fail if they don't.
- **A new project** is a copy of an `<article class="project tile …">` block with a new `id`. `tile-7` and `tile-5` set how wide it is in the 12-column grid.

## Test it

```bash
npm test
```

Needs Node 20 or newer. The 55 checks cover: every section and link is present, the Erasmus entry, the numbers quoted for each project, chart bars matching their labels, the tree model (training, voting, repeatability), how the picture animates (including for visitors who ask for reduced motion), the two dark themes staying in sync, and no phone number or placeholder text on the page.
## Publish it

The site is served by GitHub Pages from the `main` branch of this repository, at https://hmaharramli55-dot.github.io/. Pushing to `main` updates it within a minute or two.

## Contact details

The page shows an email address, LinkedIn and GitHub. A test fails if a phone number or a `tel:` link appears; remove that check in `tests/site.test.js` if you decide to add one.
