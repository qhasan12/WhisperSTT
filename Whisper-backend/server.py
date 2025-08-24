from fastapi import FastAPI, UploadFile, Request     # Webframework we use to expose our API
from fastapi.middleware.cors import CORSMiddleware   # allow RN APP running on different port to call our API
from faster_whisper import WhisperModel              # Whisper model for transcription
import tempfile                                      # For creating temporary files before passing to Whisper
import shutil                                        # For copying uploaded audio files to temp location
import os                                            # For environment variables and file operations like WHISPER_MODEL
import ollama                                        # Python API for Ollama
from pydantic import BaseModel

app = FastAPI()         # Create FastAPI app instance

# Allow React Native app to call backend even if it's running on a different port
# This is important for development when frontend and backend are on different ports.
app.add_middleware(
    CORSMiddleware,     # Middleware to handle CORS
    allow_origins=["*"],  # Allow all origins. 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lighter model + better CPU usage
# If you can tolerate a tiny accuracy drop, "tiny.en" is even faster.
MODEL_NAME = os.getenv("WHISPER_MODEL", "small.en")

# On CPU, int8 is good. If you have GPU: device="cuda", compute_type="float16"
model = WhisperModel(
    MODEL_NAME,
    device="cpu",
    compute_type="int8",
    cpu_threads=max(1, os.cpu_count() or 1),
)

# Optional: warm-up so first request isn't slow
# You can comment this out if you prefer a faster boot time.
# Create a 0.2s blank wav to warm the pipeline once.
try:
    import wave, struct
    tmp_warm = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    with wave.open(tmp_warm.name, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        frames = int(0.2 * 16000)
        silence = struct.pack("<h", 0)
        for _ in range(frames):
            wf.writeframesraw(silence)
    _ = list(model.transcribe(tmp_warm.name, without_timestamps=True))
    os.unlink(tmp_warm.name)
except Exception:
    pass

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")   # Create a temporary file to store the uploaded audio
    with tmp as f:
        shutil.copyfileobj(file.file, f)

    # Small speed knobs: no timestamps, don't condition on history
    segments, _ = model.transcribe(
        tmp.name,
        without_timestamps=True,
        condition_on_previous_text=False,
        vad_filter=True,  # enable if your chunks include long silences
        # vad_parameters={"min_silence_duration_ms": 200},
        beam_size=2,  # greedy is faster; raise if you want a bit more accuracy
    )

    text = " ".join([s.text for s in segments])     # Join all segments into a single transcription string
    return {"transcription": text}


class AnalyzeRequest(BaseModel):
    text: str

@app.post("/analyze_text")
async def analyze_text(request: AnalyzeRequest):
    """Analyze text using local Ollama model (phi3:mini)."""
    prompt = f"""
    Here is a Text: {request.text}

    1. Check if there is any interesting event or information.
    2. If yes, summarize it in one short sentence using ONLY the facts provided.
    3. Do NOT invent or assume details that are not explicitly in the text.
    4. If nothing interesting is found, reply exactly with "Nothing interesting".

    Return ONLY the summary sentence or "Nothing interesting".
    """

    try:
        response = ollama.chat(
            model="phi3:mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return {"interesting_part": response["message"]["content"]}
    except Exception as e:
        return {"error": f"Ollama failed: {e}"}
