# AGENTS

Repository conventions for automated changes.

## Expectations
- Run `npm run build` after any changes that affect runtime behavior or docs that reference build output.
- Keep `index.html` and `demo/index.html` aligned in content and configuration.
- Do not edit `dist/` by hand. Always regenerate via `npm run build`.
- Commit regenerated `dist/` files because GitHub Pages serves from `main` / root.
- Update `README.md` when public attributes, JS API, or defaults change.
- Recommended check: `npm run build`.
