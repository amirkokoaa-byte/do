import os
import tempfile
import base64
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from pydantic import BaseModel
import yt_dlp
import requests
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Ultimate Video Downloader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    url: str

def fetch_tiktok_direct(url: str):
    try:
        resp = requests.get(f"https://www.tikwm.com/api/?url={url}", timeout=10)
        if resp.status_code == 200:
            res_data = resp.json()
            if res_data.get('code') == 0 and res_data.get('data'):
                v_data = res_data['data']
                return {
                    "title": v_data.get('title') or "فيديو تيك توك",
                    "thumbnail": v_data.get('cover'),
                    "duration": "غير معروف",
                    "videos": [
                        {
                            "quality": "بدون علامة مائية (HD)",
                            "ext": "mp4",
                            "url": v_data.get('play')
                        }
                    ],
                    "audios": [
                        {
                            "quality": "صوت الفيديو الأصلي",
                            "ext": "mp3",
                            "url": v_data.get('music')
                        }
                    ]
                }
    except Exception as e:
        print(f"TikTok API Error: {e}")
    return None

def get_video_info(url: str):
    cookie_b64 = os.environ.get("YTDLP_COOKIES_BASE64")
    cookie_file_path = None

    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'no_warnings': True,
        'extract_flat': False,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web']
            }
        }
    }
    
    try:
        if cookie_b64:
            try:
                cookie_data = base64.b64decode(cookie_b64).decode('utf-8')
                fd, cookie_file_path = tempfile.mkstemp(suffix=".txt", text=True)
                with os.fdopen(fd, 'w') as f:
                    f.write(cookie_data)
                ydl_opts['cookiefile'] = cookie_file_path
            except Exception as decode_err:
                print(f"خطأ في فك تشفير الكوكيز: {decode_err}")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            videos = []
            audios = []
            
            # 1) Direct URL at root level (Instagram, TikTok, FB, Twitter, Reels)
            direct_url = info.get('url')
            if direct_url:
                videos.append({
                    'quality': info.get('format_note') or info.get('resolution') or 'جودة عالية (HD)',
                    'ext': info.get('ext') or 'mp4',
                    'url': direct_url,
                })

            # 2) Formats array
            for f in info.get('formats', []):
                f_url = f.get('url')
                if not f_url:
                    continue
                
                # Audio only
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    audios.append({
                        'quality': f"{int(f.get('abr', 0))} kbps" if f.get('abr') else 'صوت',
                        'ext': f.get('ext') or 'mp3',
                        'url': f_url,
                    })
                # Video format (or video+audio)
                elif f.get('vcodec') != 'none':
                    videos.append({
                        'quality': f.get('format_note') or f.get('resolution') or f"{f.get('height', 'SD')}p",
                        'ext': f.get('ext') or 'mp4',
                        'url': f_url,
                    })

            # 3) Entries fallback (playlists or reels)
            if not videos and info.get('entries'):
                for entry in info['entries']:
                    if entry and entry.get('url'):
                        videos.append({
                            'quality': 'جودة عالية (HD)',
                            'ext': entry.get('ext') or 'mp4',
                            'url': entry.get('url')
                        })
            
            # Filter duplicates by URL or quality
            unique_vids_map = {}
            for v in videos:
                key = v['quality'] if v['quality'] != 'Unknown' else v['url']
                if key not in unique_vids_map:
                    unique_vids_map[key] = v

            unique_auds_map = {}
            for a in audios:
                key = a['quality']
                if key not in unique_auds_map:
                    unique_auds_map[key] = a
            
            return {
                "title": info.get('title') or "فيديو بدون عنوان",
                "thumbnail": info.get('thumbnail'),
                "duration": f"{info.get('duration')} ثانية" if info.get('duration') else "غير معروف",
                "videos": list(unique_vids_map.values()),
                "audios": list(unique_auds_map.values())
            }
            
    except Exception as e:
        error_msg = str(e).lower()
        raise Exception(f"فشل جلب بيانات الفيديو: {str(e)}")
        
    finally:
        if cookie_file_path and os.path.exists(cookie_file_path):
            os.remove(cookie_file_path)

@app.post("/api/download")
async def download_video(request: VideoRequest):
    if not request.url:
        raise HTTPException(status_code=400, detail="يجب إدخال رابط الفيديو")
    
    url = request.url.lower()
    
    try:
        if "tiktok.com" in url:
            data = fetch_tiktok_direct(request.url)
            if data:
                return {"status": "success", "data": data}
            
        data = get_video_info(request.url)
        return {"status": "success", "data": data}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/proxy-download")
def proxy_download(url: str = Query(...), ext: str = Query("mp4"), filename: str = Query("video")):
    if not url:
        raise HTTPException(status_code=400, detail="URL parameter is required")
    try:
        req_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        res = requests.get(url, headers=req_headers, stream=True, timeout=30)
        
        safe_filename = f"{filename}.{ext}"
        content_type = res.headers.get('Content-Type') or f"video/{ext}"
        
        def iterfile():
            for chunk in res.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        headers = {
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "Access-Control-Allow-Origin": "*",
        }
        if "Content-Length" in res.headers:
            headers["Content-Length"] = res.headers["Content-Length"]

        return StreamingResponse(iterfile(), media_type=content_type, headers=headers)
    except Exception as e:
        return RedirectResponse(url=url)

