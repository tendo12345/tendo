import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /*
          The ported dataset gets its own chunk.

          It is the largest thing shipped and the least likely to change: app code churns
          every release, the CSVs from the upstream skill almost never do. Splitting them
          means a deploy invalidates the app chunk while returning visitors keep the data
          from cache, rather than re-downloading ~480 kB because a button colour moved.

          It is also not on first load. Nothing mounted at the root imports the engine —
          generation lives in hooks/useGenerate.ts, used only by lazily loaded routes — so
          this chunk arrives with the first route that generates, and a visitor who reads
          the landing page and leaves never downloads it. src/firstLoad.test.ts enforces
          that; a root-level engine import silently undid it from the initial commit on.
        */
        manualChunks(id) {
          // The precomputed landing-page sample lives in src/data but must NOT join the
          // dataset chunk — the whole point of precomputing it is that the home page can
          // render without pulling the dataset in.
          if (id.includes('sample-system')) return undefined
          // Same reasoning: coverage.json is a handful of precomputed counts and names, and
          // must stay OUT of the dataset chunk or the landing page pulls all of src/data in.
          if (id.includes('coverage.json')) return undefined
          if (id.includes('/src/data/')) return 'design-data'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          // Blog post content, same reasoning as design-data: it changes on its own schedule
          // and should not invalidate (or bloat) the app chunk on every unrelated deploy.
          if (id.includes('/src/content/blog/')) return 'blog-content'
          return undefined
        },
      },
    },
  },
})
