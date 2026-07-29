# Language selector and share package design

## Goal

Add an answer-language selector to every result window, make English the default for fresh installations, and produce a macOS package that another person can install while authenticating with their own ChatGPT subscription.

## Language behavior

- Supported values: English, Simplified Chinese, German, French, Italian, and automatic source-language matching.
- The selector lives beside the model and reasoning badges so it is reachable during a conversation.
- A change becomes the global default for later windows and applies to the next answer in the current window. It does not restart an answer already in progress.
- Both initial and follow-up prompts carry an explicit language instruction.
- Existing saved settings remain respected; the new English default applies when no language preference has been stored.

## Distribution and authentication

- The share package contains only extension source, Native Host source/installers, and documentation.
- It must not contain `config.json`, Codex authentication files, API keys, access tokens, or the developer's installed Native Messaging manifest.
- Each recipient loads the bundled unpacked extension, copies their generated extension ID, and runs the installer locally.
- The installer discovers that recipient's own `node` and `codex` binaries, generates a per-user Native Messaging manifest restricted to their extension ID, and leaves ChatGPT authentication to the official `codex login` flow.
- A zip is the portable artifact. A self-hosted CRX is not the primary artifact because normal Chrome installations commonly restrict off-store CRX installation; Chrome Web Store publication remains the route for consumer-style installation and updates.

## Verification

- Unit-test normalization and prompt instructions for every language.
- Run syntax and manifest checks.
- Build the package from an allowlist and scan it for generated credentials or secret-shaped files.
- Exercise the installed Native Host with the package version where practical.
