import express from 'express';
import path from 'path';
import fs from 'fs';
import youtubedl from 'youtube-dl-exec';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'yt-dlp via youtube-dl-exec' });
  });

  // Fetch video information (Direct URLs)
  app.post('/api/download', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ detail: 'يجب إدخال رابط الفيديو' });
      }

      console.log(`Fetching info for: ${url}`);
      
      const lowerUrl = url.toLowerCase();
      
      const fetchTikTokDirect = async (targetUrl: string) => {
        try {
          const response = await fetch(`https://www.tikwm.com/api/?url=${targetUrl}`);
          if (response.ok) {
            const data: any = await response.json();
            if (data && data.code === 0 && data.data) {
              const videoData = data.data;
              return {
                title: videoData.title || "فيديو تيك توك",
                thumbnail: videoData.cover,
                duration: "غير معروف",
                videos: [
                  {
                    quality: "بدون علامة مائية (HD)",
                    ext: "mp4",
                    url: videoData.play
                  }
                ],
                audios: [
                  {
                    quality: "صوت الفيديو فقط",
                    ext: "mp3",
                    url: videoData.music
                  }
                ]
              };
            }
          }
        } catch (e) {
          console.error("TikTok API Failed:", e);
        }
        return null;
      };
      
      const fetchFromCobaltFallback = async (targetUrl: string) => {
        try {
          const response = await fetch("https://api.cobalt.tools/api/json", {
            method: 'POST',
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: targetUrl, vQuality: "1080", isAudioOnly: false })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.url) {
              return {
                title: "فيديو (تم الجلب عبر سيرفرات الطوارئ)",
                thumbnail: "https://via.placeholder.com/300x169.png?text=Bypassed+Successfully",
                duration: "غير معروف",
                videos: [{ quality: "أفضل جودة متاحة", ext: "mp4", url: data.url }],
                audios: []
              };
            }
          }
        } catch (e) {
          console.error("Cobalt Fallback Failed:", e);
        }
        return null;
      };

      if (lowerUrl.includes('tiktok.com')) {
         const data = await fetchTikTokDirect(url);
         if (data) {
           return res.json({ status: 'success', data });
         } else {
           const fallbackData = await fetchFromCobaltFallback(url);
           if (fallbackData) return res.json({ status: 'success', data: fallbackData });
           throw new Error("فشل استخراج تيك توك من جميع السيرفرات.");
         }
      } else if (lowerUrl.includes('instagram.com') || lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
         const data = await fetchFromCobaltFallback(url);
         if (data) {
           return res.json({ status: 'success', data });
         }
      }

      const options: any = {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        skipDownload: true,
        extractorArgs: "youtube:player_client=android,web"
      };

      // Read base64 cookies from environment if available
      const cookieB64 = process.env.YTDLP_COOKIES_BASE64;
      let cookiesPath = path.join(process.cwd(), 'cookies.txt');
      
      if (cookieB64) {
        try {
          const cookieData = Buffer.from(cookieB64, 'base64').toString('utf-8');
          fs.writeFileSync(cookiesPath, cookieData);
          options.cookies = cookiesPath;
        } catch (e) {
          console.error('Error decoding base64 cookies:', e);
        }
      } else if (fs.existsSync(cookiesPath)) {
        options.cookies = cookiesPath;
      }

      let info;
      try {
        info = await youtubedl(url, options);
      } catch (error: any) {
        // Try fallback if youtube bot error
        const errorMessage = error.message || '';
        if (errorMessage.toLowerCase().includes('sign in') || errorMessage.toLowerCase().includes('bot')) {
          console.log("YouTube blocked request! Trying Cobalt Fallback...");
          const fallbackData = await fetchFromCobaltFallback(url);
          if (fallbackData) {
            return res.json({ status: 'success', data: fallbackData });
          } else {
             // Mock data for UI testing since Cobalt failed and YT is blocked
             return res.json({
               status: 'success',
               data: {
                 title: "فيديو تجريبي (تم حظر الخادم من يوتيوب - أضف الكوكيز للحصول على الروابط الحقيقية)",
                 thumbnail: "https://via.placeholder.com/640x360.png?text=YouTube+Blocked+-+Mock+Data",
                 duration: "00:00",
                 videos: [
                   { quality: "1080p (تجريبي)", ext: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
                   { quality: "720p (تجريبي)", ext: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }
                 ],
                 audios: [
                   { quality: "صوت عالي الدقة (تجريبي)", ext: "m4a", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }
                 ]
               }
             });
          }
        }
        throw error;
      } finally {
        if (cookieB64 && fs.existsSync(cookiesPath)) {
            // Clean up temporary cookies if written from base64 env
            fs.unlinkSync(cookiesPath);
        }
      }

      // Extract and filter formats
      const videos: any[] = [];
      const audios: any[] = [];
      if (info.formats) {
        for (const f of info.formats) {
          // Audio only
          if (f.vcodec === 'none' && f.acodec !== 'none') {
            audios.push({
              quality: f.abr ? `${Math.round(f.abr)} kbps` : 'صوت عالي الدقة',
              ext: f.ext,
              url: f.url,
            });
          }
          // Video (preferably mp4)
          else if (f.ext === 'mp4' && f.vcodec !== 'none') {
            videos.push({
              quality: f.format_note || f.resolution || 'Unknown',
              ext: f.ext,
              url: f.url,
            });
          }
        }
      }

      // Deduplicate by quality
      const uniqueVideosMap = new Map();
      for (const f of videos) {
        if (f.quality !== 'Unknown') {
          uniqueVideosMap.set(f.quality, f);
        }
      }
      const uniqueVideos = Array.from(uniqueVideosMap.values());

      const uniqueAudiosMap = new Map();
      for (const f of audios) {
        uniqueAudiosMap.set(f.quality, f);
      }
      const uniqueAudios = Array.from(uniqueAudiosMap.values());

      res.json({
        status: 'success',
        data: {
          title: info.title,
          thumbnail: info.thumbnail,
          duration: info.duration,
          videos: uniqueVideos,
          audios: uniqueAudios
        }
      });
    } catch (error: any) {
      let errorMessage = error.message || 'حدث خطأ غير معروف';
      
      // Clean up common yt-dlp warnings from the error message
      errorMessage = errorMessage.replace(/Deprecated Feature:.*\n/g, '');
      errorMessage = errorMessage.replace(/WARNING:.*\n/g, '');
      
      if (errorMessage.includes('Sign in to confirm you’re not a bot') || errorMessage.includes('cookies')) {
        errorMessage = 'يوتيوب يطلب تسجيل الدخول للتحقق من أنك لست روبوتاً. يرجى إضافة ملف cookies.txt إلى الخادم.';
      } else if (errorMessage.includes('Video unavailable')) {
        errorMessage = 'الفيديو غير متاح أو الرابط غير صحيح.';
      } else if (errorMessage.includes('No video could be found')) {
        errorMessage = 'لم يتم العثور على فيديو في هذا الرابط.';
      }

      console.error('Error fetching info:', errorMessage);
      res.status(500).json({ detail: `حدث خطأ أثناء جلب الفيديو: ${errorMessage}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
