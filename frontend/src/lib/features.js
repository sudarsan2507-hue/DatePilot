/** Feature flags, set at build time (frontend/.env or the shell). */

// Instagram export and screenshot uploads. Off unless VITE_ENABLE_UPLOADS=true
// (the backend checks ENABLE_UPLOADS as well).
export const ENABLE_UPLOADS = import.meta.env.VITE_ENABLE_UPLOADS === 'true';
