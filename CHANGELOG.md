# Changelog

## v0.2.0

⚠️ This version contains a breaking change and the unofficial support for
version 1.45.0 has now been dropped.

- Instantiating a new instance with new SmtpServer() no longer starts the server
  automatically. To start a server, call the start() method on the server
  instance. This change was introduced so that the caller can have greater
  control over the lifecycle of a smtpsaurus instance, especially in test
  environments.
- Add a `isListening` method for determining whether or not an `smtpsaurus`
  instance has started.

## v0.1.3

- Add the ability to run `smtpsaurus` in quiet mode, which stops `smtpsaurus`
  from logging to STDOUT.

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
