/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional absolute base URL of the FastAPI backend, e.g.
   * http://localhost:8000.  When empty or unset the frontend calls the
   * relative path "/api" (same-origin).  Never store secrets here — all
   * VITE_* variables are public by design.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
