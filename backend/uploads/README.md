# Upload pipeline

The frontend can select many images/videos/files. Production storage should use object storage rather than Git. Keep uploaded media outside the repository and pass only secure references to the AI backend.

The UI is intentionally not capped at 300 items; practical limits come from browser, storage, server, and model/provider constraints.
