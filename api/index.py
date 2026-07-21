from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import yt_dlp
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Video Downloader API")

# السماح للواجهة الأمامية بالاتصال بالـ API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    url: str

def get_video_info(url: str):
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    
    if os.path.exists('cookies.txt'):
        ydl_opts['cookiefile'] = 'cookies.txt'
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            videos = []
            audios = []
            
            for f in info.get('formats', []):
                # استخراج الصوت فقط
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    audios.append({
                        'quality': f"{int(f.get('abr', 0))} kbps" if f.get('abr') else 'صوت عالي الدقة',
                        'ext': f.get('ext'), # غالباً m4a أو webm
                        'url': f.get('url'),
                    })
                # استخراج الفيديو (يفضل mp4)
                elif f.get('ext') == 'mp4' and f.get('vcodec') != 'none':
                    videos.append({
                        'quality': f.get('format_note') or f.get('resolution') or 'Unknown',
                        'ext': f.get('ext'),
                        'url': f.get('url'),
                    })
            
            # تنظيف الجودات لتجنب التكرار
            unique_videos = {f['quality']: f for f in videos if f['quality'] != 'Unknown'}.values()
            unique_audios = {f['quality']: f for f in audios}.values()
            
            return {
                "title": info.get('title'),
                "thumbnail": info.get('thumbnail'),
                "duration": info.get('duration'),
                "videos": list(unique_videos),
                "audios": list(unique_audios)
            }
    except Exception as e:
        raise Exception(str(e))

@app.post("/api/download")
async def download_video(request: VideoRequest):
    if not request.url:
        raise HTTPException(status_code=400, detail="يجب إدخال رابط الفيديو")
    
    try:
        data = get_video_info(request.url)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء جلب الفيديو: {str(e)}")
