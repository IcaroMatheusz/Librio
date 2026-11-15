# Librio

Librio is a React, TypeScript, and Vite application with a desktop version
powered by Electron.

## Development

- `npm run dev` starts the web application.
- `npm run electron:dev` starts the desktop application with Vite.
- `npm run build` builds the web application.
- `npm run electron:dist` builds the desktop app and creates a platform installer.

The desktop app uses the same React interface while keeping Electron's Node.js
access in its main process. The renderer receives only a restricted preload API.

## Local library and reading progress

Local books are references to files in their original locations. Librio stores
the catalog and file paths on the computer; removing an entry from the app does
not delete its original file. Moving a file makes its entry unavailable until
it is added again.
PDF and comic-book covers are generated locally and stored on the computer;
local book covers can also be replaced with an image file from the computer.

Local file contents, paths, and cover images are never uploaded. Supabase stores
only the authenticated user's opaque local book ID, reading progress, and
last-read timestamp in `local_reading_progress`. Apply the SQL migration in
`supabase/migrations` before enabling local reading progress.

The web library continues to show cloud books only. Local books are listed and
opened only by the desktop app.

To upload CBR comics to Supabase, apply
`supabase/migrations/20261115003000_allow_cbr_storage_mime_type.sql`. It adds
`application/vnd.comicbook-rar` to the existing MIME allowlist of the `books`
bucket without changing the other allowed types.

To upload CBZ comics, also apply
`supabase/migrations/20261115003100_allow_cbz_storage_mime_type.sql`. It adds
`application/vnd.comicbook+zip` to the same allowlist.
