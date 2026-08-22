# SUPERME AI BUILD MODE

BUILD MODE turns a natural-language request into a project workspace and a downloadable build artifact.

Flow:

1. User describes an app/game.
2. AI generates the project files.
3. The builder detects the project type.
4. Automated checks run.
5. GitHub Actions builds the project.
6. The workflow uploads the resulting APK/Web/ZIP as an artifact.
7. The UI can expose a download link when the run finishes.

Example prompt:

> O'zbekcha Hill Climb Driving uslubidagi o'yin yarat.

The generated project must be original and must not copy another game's copyrighted assets or source code.

This folder contains the contract and configuration for the build agent; actual builds require a runner with the appropriate SDK/toolchain installed.
