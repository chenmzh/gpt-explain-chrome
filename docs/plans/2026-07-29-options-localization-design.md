# Settings-page localization

## Goal

Make the configuration page understandable without requiring Chinese, while keeping answer language independent from interface language.

## Design

- Add an `uiLanguage` setting with `auto`, English, Simplified Chinese, German, French, and Italian values.
- `auto` follows the browser language for the five supported languages and falls back to English.
- Keep English text in the HTML as a no-JavaScript fallback, then translate every labeled element through local bundled dictionaries. No translation service or network permission is introduced.
- Translate dynamic connection states and model-default suffixes as well as static headings, descriptions, controls, buttons, placeholders, and toast messages.
- Preserve `language` as the separate answer-language preference; changing the interface never changes model output language.
- Expose `?preview=1&lang=<locale>` for deterministic visual verification.

## Verification

- Unit-test locale completeness, browser-language resolution, and interpolation.
- Run the existing extension and Native Host suites.
- Capture English, German, French, Italian, and Chinese previews and inspect the longest translations for wrapping.
- Build a credential-free v0.3.2 distribution and publish it with the source update.
