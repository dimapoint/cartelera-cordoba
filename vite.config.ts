import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// base relativa: GitHub Pages sirve el sitio en /<repo>/
export default defineConfig({ base: "./", plugins: [react()] })
