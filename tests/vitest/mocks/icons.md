`icons.json` is not a file in `res/`. `CodexModule::getIcons` synthesises it
while a request is being served, from the names listed in `extension.json`, so
there is nothing on disk for a test to load. `vitest.config.mjs` rewrites the
require to the stub beside this note.

The stub carries the same keys as the real set, each holding a one-line path
that differs only in where it starts. Nothing asserts what an icon looks like --
only which one a component picked, by comparing its mark with the stub's entry
for that icon -- and paths that differ in one character make that readable.

An icon named in `extension.json` but missing here resolves to `undefined`,
which draws nothing and fails the tests that expect a shape.
