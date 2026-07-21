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
      
      const options: any = {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        skipDownload: true,
      };

      const cookiesPath = path.join(process.cwd(), 'cookies.txt');
      if (fs.existsSync(cookiesPath)) {
        options.cookies = cookiesPath;
      }

      const info = await youtubedl(url, options);

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
      console.error('Error fetching info:', error);
      res.status(500).json({ detail: `حدث خطأ أثناء جلب الفيديو: ${error.message}` });
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
