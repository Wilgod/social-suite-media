// Each platform adapter registers itself here once implemented, then both
// apps/web (OAuth connect/callback) and apps/worker (publish) import this
// module once at startup so the registry is populated everywhere.
import { registerAdapter } from "./registry";
import { youtubeAdapter } from "./adapters/youtube";
import { instagramAdapter } from "./adapters/instagram";
import { facebookAdapter } from "./adapters/facebook";
import { douyinAdapter } from "./adapters/douyin";
import { bilibiliAdapter } from "./adapters/bilibili";
import { xiaohongshuAdapter } from "./adapters/xiaohongshu";
import { tiktokAdapter } from "./adapters/tiktok";
import { threadsAdapter } from "./adapters/threads";
import { xAdapter } from "./adapters/x";

registerAdapter(youtubeAdapter);
registerAdapter(instagramAdapter);
registerAdapter(facebookAdapter);
registerAdapter(douyinAdapter);
registerAdapter(bilibiliAdapter);
registerAdapter(xiaohongshuAdapter);
registerAdapter(tiktokAdapter);
registerAdapter(threadsAdapter);
registerAdapter(xAdapter);
