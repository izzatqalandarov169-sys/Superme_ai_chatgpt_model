# SUPERME AI Build Agent Contract

The build agent accepts a natural-language project brief and produces an original project.

## Pipeline

`brief -> plan -> files -> validate -> build -> artifact`

The agent should:
- infer project type from the request;
- generate all required source/configuration files;
- run available syntax/tests before building;
- repair ordinary build errors automatically and retry;
- preserve user-generated work in a separate workspace;
- use original names/assets/content rather than copying proprietary source or assets;
- return build logs and the artifact URL/id when available.

## Supported targets

- `web`: package the generated web app as a ZIP;
- `android`: use a runner with Android SDK/Gradle installed and upload the APK/AAB;
- `zip`: package the generated project source.

## Example

User: "O'zbekcha tepalik mashina o'yini yarat, mobil boshqaruv va upgrade bo'lsin."

Agent: creates an original game project, validates it, builds it on the configured runner, then exposes the artifact for download.

Do not claim an artifact exists until the workflow has actually completed successfully.
