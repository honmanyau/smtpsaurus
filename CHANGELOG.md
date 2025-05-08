# Changelog

## v0.1.2

- Implement the ability for `smtpsaurus` to optionally find an open port to
  listen on when the one specified is already in use, which may be useful for
  circumventing the address in use error (`Deno.errors.AddrInUse`) when running
  tests in parallel. The new constructor option is `findPortOnConflict`, which
  defaults to `false`.
- Fix incorrect `from` strings given to `nodemailer` in code examples.

## v0.1.1

- Fix linting issues.
- Add GitHub workflow for publishing `smtpsaurus` to JSR automatically.

## v0.1.0

Initial release of `smtpsaurus`! ☀️🎉
