# Self-tests

Open these from a local server (they load the app in an iframe and drive it):

- `/_test/scene.html`: the Scene variant, full solution + every documented stuck point + error/loop cases
- `/_test/ring.html`: the Target variant, same idea

Each prints one line per scenario: the stage pass pattern (P/f per stage, in order) and the first failing stage's reason. Expected patterns are in the vault's `task-spec.md`.
