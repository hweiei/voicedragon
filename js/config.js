// Set this to your HTTPS backend endpoint in WeChat/Douyin builds.
// The backend receives field "audio" and must return:
// { "transcript": "顶硬上", "confidence": 0.93 }
// Keep all ASR provider credentials on the backend.
globalThis.__VOICE_API_ENDPOINT__ = globalThis.__VOICE_API_ENDPOINT__ || "";
