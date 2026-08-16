// Each platform adapter registers itself here once implemented, then both
// apps/web (OAuth connect/callback) and apps/worker (publish) import this
// module once at startup so the registry is populated everywhere.
import { registerAdapter } from "./registry";
import { youtubeAdapter } from "./adapters/youtube";
import { instagramAdapter } from "./adapters/instagram";

registerAdapter(youtubeAdapter);
registerAdapter(instagramAdapter);
