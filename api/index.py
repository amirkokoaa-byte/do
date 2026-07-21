import os
import tempfile
import base64
from fastapi import FastAPI, HTTPException
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

def fetch_from_cobalt_fallback(url: str):
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    data = {"url": url, "vQuality": "1080", "isAudioOnly": False}
    try:
        response = requests.post("https://api.cobalt.tools/api/json", headers=headers, json=data, timeout=15)
        if response.status_code == 200:
            res_data = response.json()
            if res_data.get('url'):
                return {
                    "title": "فيديو (تم الجلب عبر سيرفرات الطوارئ)",
                    "thumbnail": "https://via.placeholder.com/300x169.png?text=Bypassed+Successfully",
                    "duration": "غير معروف",
                    "videos": [{"quality": "أفضل جودة متاحة", "ext": "mp4", "url": res_data.get('url')}],
                    "audios": []
                }
    except Exception as e:
        print(f"Cobalt Fallback Failed: {e}")
    return None

def get_video_info(url: str):
    # قراءة الكوكيز المشفرة بـ Base64 من Vercel
    cookie_b64 = os.environ.get("YTDLP_COOKIES_BASE64")
    cookie_file_path = None

    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'no_warnings': True,
        'extract_flat': False,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web']
            }
        }
    }
    
    try:
        if cookie_b64:
            try:
                # فك التشفير لاستعادة هيكل الأسطر الأصلي
                cookie_data = base64.b64decode(cookie_b64).decode('utf-8')
                
                # إنشاء الملف المؤقت
                fd, cookie_file_path = tempfile.mkstemp(suffix=".txt", text=True)
                with os.fdopen(fd, 'w') as f:
                    f.write(cookie_data)
                ydl_opts['cookiefile'] = cookie_file_path
            except Exception as decode_err:
                print(f"خطأ في فك تشفير الكوكيز: {decode_err}")
        else:
            print("تحذير: لم يتم العثور على YTDLP_COOKIES_BASE64.")

        # بدء عملية الاستخراج
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            videos = []
            audios = []
            
            for f in info.get('formats', []):
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    audios.append({
                        'quality': f"{int(f.get('abr', 0))} kbps" if f.get('abr') else 'صوت',
                        'ext': f.get('ext'),
                        'url': f.get('url'),
                    })
                elif f.get('ext') == 'mp4' and f.get('vcodec') != 'none':
                    videos.append({
                        'quality': f.get('format_note') or f.get('resolution') or 'Unknown',
                        'ext': f.get('ext'),
                        'url': f.get('url'),
                    })
            
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
        error_msg = str(e).lower()
        if "sign in" in error_msg or "bot" in error_msg:
            print("Vercel IP Blocked even with Cookies! Trying Fallback...")
            fallback_data = fetch_from_cobalt_fallback(url)
            if fallback_data:
                return fallback_data
            
        raise Exception(f"يوتيوب يرفض الاتصال بقوة. يرجى التأكد من تشفير الكوكيز بشكل صحيح. تفاصيل الخطأ: {str(e)}")
        
    finally:
        # مسح ملف الكوكيز فور الانتهاء
        if cookie_file_path and os.path.exists(cookie_file_path):
            os.remove(cookie_file_path)

@app.post("/api/download")
async def download_video(request: VideoRequest):
    if not request.url:
        raise HTTPException(status_code=400, detail="يجب إدخال رابط الفيديو")
    
    url = request.url.lower()
    
    try:
        if "tiktok.com" in url or "instagram.com" in url or "twitter.com" in url or "x.com" in url:
            data = fetch_from_cobalt_fallback(request.url)
            if data:
                return {"status": "success", "data": data}
            else:
                data = get_video_info(request.url)
                return {"status": "success", "data": data}
        else:
            data = get_video_info(request.url)
            return {"status": "success", "data": data}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
