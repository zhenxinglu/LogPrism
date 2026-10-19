# Git Commit Workflow

Automates checking git status, inspecting diffs, staging modified/untracked files, generating conventional commit messages, and committing changes to the current Git branch.

## Steps

1. **Check Status**: Run `git status` to identify modified, deleted, and untracked files on the current branch.
2. **Inspect Changes**: Run `git diff` (and `git diff --cached` if applicable) to analyze code changes.
3. **Stage Files**: Execute `git add .` (or stage specific changed files as appropriate).
4. **Formulate Commit Message**:
   - Write a clear commit message in English adhering to Conventional Commits (e.g., `fix: ...`, `feat: ...`, `refactor: ...`, `docs: ...`).
   - Include a concise summary line and optional detail body if changes are extensive.
5. **Commit**: Execute `git commit -m "[commit message]"`.
6. **Verify**: Execute `git status` to confirm that the working tree is clean and check `git log -n 1`.
