import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import agents from "agents/vite";

const removeCopiedDevSecrets = {
  name: "remove-copied-dev-secrets",
  apply: "build" as const,
  async closeBundle() {
    await rm(resolve("dist/cf_job_search_agent/.dev.vars"), { force: true });
  },
};

export default defineConfig({ plugins: [agents(), react(), cloudflare(), removeCopiedDevSecrets] });
