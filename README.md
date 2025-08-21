# 🎤 Real-Time Speech-to-Text (React Native + FastAPI + Whisper)

This project implements a **real-time speech-to-text system** using a React Native frontend and a FastAPI backend with the **faster-whisper** model.  
It captures live audio from the user, splits it into chunks, sends them to the backend, and displays the transcription continuously.

---

## 📌 Features
- ✅ Real-time microphone recording in React Native  
- ✅ Splits audio into small chunks (~6s) for processing  
- ✅ Uses a **queue system** to ensure no audio is lost  
- ✅ Backend with **FastAPI** receives audio files and transcribes them  
- ✅ Transcription powered by **faster-whisper** (runs locally, no OpenAI API)  
- ✅ Optimized for CPU with `int8` precision and warm-up for faster first request  
- ✅ Live transcription box in the app  

---

## 🛠️ Tech Stack
- **Frontend:** React Native  
- **Backend:** FastAPI (Python)  
- **Speech Model:** [faster-whisper](https://github.com/SYSTRAN/faster-whisper)  
- **Language:** Python, JavaScript  

---

## ⚙️ Backend Setup (FastAPI + Whisper)
1. Clone the repo and install dependencies:
   ```bash
   pip install fastapi uvicorn faster-whisper python-multipart


Run the FastAPI server:
    uvicorn server:app --reload --host 0.0.0.0 --port 8000


📱 Frontend Setup (React Native)
    --app/tabs/index.tsx
    npm install


Start the app:
    npx expo start

    --Scan the QR Code from your mobile camera for IOS and Expo GO app on Android