# app/main.py
from pathlib import Path
import os
import time
import logging
import httpx
from difflib import SequenceMatcher
from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import FastAPI, Request, Header, HTTPException
from konlpy.tag import Okt
from googletrans import Translator
from google.cloud import texttospeech
from gtts import gTTS
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse , HTMLResponse, Response
import io
import threading

# 로그 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# .env 파일 불러오기
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
DOMAIN_NAME = os.getenv("DOMAIN_NAME", "http://localhost:8001")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "sdui-internal-dev-key")

HF_API_URL_KO_EN = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-ko-en"
HF_API_URL_EN_JA = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-jap"

HF_API_KEY = os.getenv("HF_API_KEY")
ENV = os.getenv("ENV", "development")

if ENV == "production":
    # 배포용 환경설정
    logger.info("Running in PRODUCTION mode")
else:
    logger.info("Running in DEVELOPMENT mode")

# app 객체를 만들어준다 ! *****
app = FastAPI()

origins = [
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://yerin.duckdns.org"
]

# 이 줄 추가! (static 폴더 연결)
app.mount("/static", StaticFiles(directory="static"), name="static")
# CORS 설정 (Vue랑 통신할 때 꼭 필요!)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

okt = Okt()

# pydantic 모델
class Diary(BaseModel):
    content: str

class PronunciationRequest(BaseModel):
    spoken: str
    expected: str
    language: str = "en"

@app.post("/pronunciation-score")
async def pronunciation_score(
    req: PronunciationRequest,
    x_internal_api_key: str = Header(None, alias="X-Internal-Api-Key")
):
    """사용자의 발화(spoken)와 기대 텍스트(expected)를 비교하여 유사도 점수를 반환"""
    if x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    spoken = req.spoken.lower().strip()
    expected = req.expected.lower().strip()

    if not spoken or not expected:
        return {"score": 0, "feedback": "텍스트가 비어 있습니다."}

    ratio = SequenceMatcher(None, spoken, expected).ratio()
    score = round(ratio * 100)

    if score >= 85:
        feedback = "Excellent! Very accurate pronunciation."
    elif score >= 65:
        feedback = "Good job! Minor improvements needed."
    elif score >= 45:
        feedback = "Keep practicing! You're making progress."
    else:
        feedback = "Try again - focus on matching the phrase more closely."

    logger.info(f"/pronunciation-score: score={score}, lang={req.language}")
    return {"score": score, "feedback": feedback}

@app.get("/")
async def root():
    logger.info("/root 호출됨")
    return {"message": "FastAPI 서버가 열렸어요!"}

@app.post("/analyze")
async def analyze_text(diary: Diary):
    logger.info("/analyze 호출됨2")
    # 받아온 일기 내용
    text = diary.content
    # 형태소 분석 실행
    tokens = okt.pos(text)

    return {"morph_analysis": tokens}

# 구글 번역기 객체 만들기
translator = Translator()

def delete_file_later(filepath, delay=10):
    def delete():
        time.sleep(delay)
        if os.path.exists(filepath):
            os.remove(filepath)
    threading.Thread(target=delete).start()

@app.post("/translate")
async def translate_text(diary: Diary):
    text = diary.content

    # 1단계: 한국어 ➔ 영어 번역
    english = translator.translate(text, src='ko', dest='en').text

    # 2단계: 영어 ➔ 일본어 번역
    japanese = translator.translate(english, src='en', dest='ja').text

    return {"translated_text": japanese}

async def translate(text: str, url: str):
    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, headers=headers, json={"inputs": text})

        if response.status_code != 200:
            raise Exception(f"HuggingFace API 호출 실패: {response.status_code} {response.text}")

        result = response.json()
        # 에러 처리
        if isinstance(result, dict) and result.get("error"):
            raise Exception(f"HuggingFace API 오류: {result['error']}")

        return result[0]["translation_text"]

# TTS 함수
def text_to_speech(text, lang="ja-JP"):
    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(
        language_code=lang,
        ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    filename = f"output_{int(time.time())}.mp3"  # 고유 이름 만들기
    filepath = f"static/{filename}"  # static 폴더 안에 저장

    os.makedirs("static", exist_ok=True)  # static 폴더 없으면 만들기

    with open(filepath, "wb") as out:
        out.write(response.audio_content)

    return filename  # 파일 이름만 리턴


# blob 재생용 HTML 페이지 + CSP 헤더 포함
@app.get("/test", response_class=HTMLResponse)
async def test():
    html = """
    <html>
      <head>
        <title>Blob Test</title>
        <meta charset='UTF-8'>
      </head>
      <body>
        <h1> Blob 오디오 테스트</h1>
        <button onclick="playAudio()">▶ 오디오 재생</button>
        <script>
          async function playAudio() {
            const res = await fetch('/tts_blob', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: 'これはテストです。' })
            });
            const blob = await res.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.play();
          }
        </script>
      </body>
    </html>
    """
    headers = {
        "Content-Security-Policy": "default-src 'self'; media-src 'self' blob:;"
    }
    return HTMLResponse(content=html, headers=headers)


class TextRequest(BaseModel):
    text: str

# Google Cloud TTS로 직접 blob 전송 (파일 저장 X)

@app.post("/tts_blob")
async def tts_blob(text_request: TextRequest):
    text = text_request.text
    logger.info(f"TTS 요청 받은 텍스트: {text}")

    try:
        if not text.strip():
            logger.warning("⚠️ TTS 요청이 비어있거나 공백입니다.")
            return Response(status_code=400, content="TTS 요청이 비어 있음")

        client = texttospeech.TextToSpeechClient()

        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="ja-JP",
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        audio_bytes = response.audio_content

        if not audio_bytes:
            logger.warning("⚠️ Google TTS 응답이 비어 있음")
            return Response(status_code=500, content="TTS 음성 생성 실패")

        audio_stream = io.BytesIO(audio_bytes)

        return StreamingResponse(
            audio_stream,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=tts.mp3"}
        )

    except Exception as e:
        logger.error(f"❌ TTS 변환 중 오류 발생: {e}")
        return Response(status_code=500, content=f"TTS 변환 오류: {str(e)}")

@app.post("/tts_only")
async def tts_only(text_request: TextRequest):
    text  = text_request.text
    filename = text_to_speech(text)
    # 10초 후 자동 삭제
    delete_file_later(f"static/{filename}", delay=10)
    return {"tts_audio_url": f"{DOMAIN_NAME}/static/{filename}"}


@app.post("/translate_and_tts")
async def translate_and_tts(diary: Diary):
    text = diary.content

    # 1단계: 번역(구글 번역기)
    english = translator.translate(text, src='ko', dest='en').text
    japanese = translator.translate(english, src='en', dest='ja').text

    # 2단계: TTS (Cloud Text-to-Speech API 기준)
    tts_filename = text_to_speech(japanese)

    return {
        "translated_text": japanese,
        "tts_audio_url": f"{DOMAIN_NAME}/static/{tts_filename}"
    }

@app.post("/translate1")
async def translate_text(diary: Diary):
    text = diary.content

    # 1단계: 한국어 ➔ 영어
    english_text = await translate(text, HF_API_URL_KO_EN)

    # 2단계: 영어 ➔ 일본어
    japanese_text = await translate(english_text, HF_API_URL_EN_JA)

    return {"translated_text": japanese_text}


@app.post("/tts_gtts")
async def tts_gtts(text_request: TextRequest):
    """gTTS (무료) 기반 TTS — Google Cloud TTS 키 없이 사용 가능"""
    text = text_request.text
    lang = "ja"
    logger.info(f"/tts_gtts 요청: {text[:30]}...")

    if not text.strip():
        return Response(status_code=400, content="텍스트가 비어 있음")

    tts = gTTS(text=text, lang=lang)
    audio_stream = io.BytesIO()
    tts.write_to_fp(audio_stream)
    audio_stream.seek(0)

    return StreamingResponse(
        audio_stream,
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=tts_gtts.mp3"}
    )
