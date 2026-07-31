# Callie & Vallie (Godot)

Original cozy farming vertical slice for `annsymons.com/callievallie`.

## Run locally

Open `project.godot` in Godot 4.7+ and press F6, or:

```bash
godot --path game/callievallie-godot --editor
```

## Export for the website

Install the matching Godot export templates, then:

```bash
godot --headless \
  --path game/callievallie-godot \
  --export-release Web ../../public/callievallie-game/index.html
```

The Next.js page embeds `public/callievallie-game/index.html`.

## Art and license

The farm world and Callie/Vallie character sheet are original generated assets
created for this project. They do not contain Stardew Valley code or assets.
The game code is original to Callie & Vallie.
