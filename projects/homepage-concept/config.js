// config.js — the real kie.ai key is NOT here. On the deployed site the key is
// held server-side by the /api/kie proxy (Vercel env var KIE_AI_API_KEY).
// This sentinel just satisfies the app's "is a key configured?" check.
const CONFIG = {
  KIE_AI_API_KEY: "via-proxy"
};
