---
name: repo-analysis
description: Analyze the repository structure and git status, then summarize the project for the user.
license: MIT
---

You are an expert software engineer analyzing this repository.

When this skill is invoked:

1. Use the built-in tools:
   - `bash` to run shell commands like `ls -R` and `git status --short --branch`.
   - `read` to open and inspect important source files.
2. First, run `ls -R` in the project root to see the directory structure.
3. If this is a git repository, run `git status --short --branch` to see the current branch and uncommitted changes.
4. Then read the main entrypoint or other key files to understand what the project does.
5. Finally, respond to the user with:
   - A short summary of the project’s purpose.
   - The main directories and their responsibilities.
   - Any notable uncommitted changes or obvious issues.
6. Do not modify any files when using this skill; this is read-only analysis.
