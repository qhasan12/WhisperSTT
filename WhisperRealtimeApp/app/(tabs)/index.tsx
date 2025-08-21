// // This is the main file for the React Native app that handles audio recording and transcription.
// this code is doing real time transcription in RN without any gaps between chunks.
// It uses Expo's Audio API for recording and Axios for sending audio chunks to a backend server

import React, { useState, useRef } from "react";
import { View, Button, Text, ScrollView, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import axios from "axios";

interface TranscribeResponse {
  transcription: string;
}

export default function App() {
  const [transcription, setTranscription] = useState<string>("");    // Holds the transcribed text
  const [recording, setRecording] = useState<boolean>(false);  

  const recordingFlagRef = useRef<boolean>(false);
  const recordingRef = useRef<Audio.Recording | null>(null);  // holds the current recording instance

  // Background upload queue
  const uploadQueueRef = useRef<string[]>([]);    // Queue of recorded audio chunks to be uploaded
  const workerRunningRef = useRef<boolean>(false);   // Flag to prevent multiple upload workers running simultaneously

  // 4 seconds is a nice balance (fewer requests, still responsive)
  const CHUNK_DURATION = 6000;

  // Recording options for different platforms
  // Using WAV format for compatibility with the backend
  // Sample rate is set to 16kHz, mono channel, and bitrate of 128kbps
  // This ensures good quality while keeping file sizes manageable.
  const recordingOptions: Audio.RecordingOptions = {
    android: {
      extension: ".wav",
      outputFormat: 0,
      audioEncoder: 0,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: ".wav",
      audioQuality: 0,
      sampleRate: 16000,
      numberOfChannels: 1,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
      bitRate: 128000,
    },
    web: {
      mimeType: "audio/wav",
      bitsPerSecond: 128000,
    },
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const startNewRecording = async () => {
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(recordingOptions);
    await rec.startAsync();
    recordingRef.current = rec;
  };

  // this code runs in the background to process the upload queue ine by one to the backend 

  const processQueue = async () => {
    if (workerRunningRef.current) return;
    workerRunningRef.current = true;       // esnures only one worker runs even if multiple chunks arrive

    try {
      while (uploadQueueRef.current.length > 0) {
        const uri = uploadQueueRef.current.shift();
        if (!uri) continue;

        const formData = new FormData();        // it is used to upload audio files in .wav
        formData.append("file", {               //updates the form data with the audio file
          uri,
          name: "chunk.wav",
          type: "audio/wav",
        } as any);

        try {
          const res = await axios.post<TranscribeResponse>(
            "http://192.168.18.12:8000/transcribe",
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );

          setTranscription((prev) =>
            (prev + " " + (res.data?.transcription || "")).trim()
          );
        } catch (e) {
          console.log("Upload/transcribe error:", e);
        }
      }
    } finally {
      workerRunningRef.current = false;
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();  // Request microphone permission
      // If permission is not granted, exit early
      if (permission.status !== "granted") return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setTranscription("");
      await startNewRecording();

      setRecording(true);
      recordingFlagRef.current = true;     // starts initial recording

      // Chunk loop
      (async () => {                      
        while (recordingFlagRef.current) {   
          await sleep(CHUNK_DURATION);

          // Cut current chunk
          if (!recordingRef.current) continue;
          try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            // 🔁 Immediately start recording the next chunk (no gap)
            if (recordingFlagRef.current) {
              await startNewRecording();
            }

            // Enqueue previous chunk for background upload
            if (uri) {
              uploadQueueRef.current.push(uri);
              processQueue(); // fire & forget; ensures only one worker runs
            }
          } catch (err) {
            console.log("Error slicing chunk:", err);
            // Try to keep recording going if something failed
            if (recordingFlagRef.current && !recordingRef.current) {
              try {
                await startNewRecording();
              } catch (e) {
                console.log("Failed to recover recording:", e);
              }
            }
          }
        }
      })();
    } catch (err) {
      console.log("Error starting recording:", err);
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    recordingFlagRef.current = false;

    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        if (uri) {
          uploadQueueRef.current.push(uri);
          processQueue();
        }
      }
    } catch (e) {
      console.log("Error stopping recording:", e);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: "#fff",
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    transcriptionBox: {
      flex: 1,
      backgroundColor: "#f2f2f2",
      borderRadius: 8,
      padding: 12,
    },
    transcriptionText: {
      fontSize: 16,
      color: "#333",
    },
  });

  return (
    <View style={styles.container}>
      <View className="buttonRow" style={styles.buttonRow}>
        <Button
          title={recording ? "Recording..." : "Start Recording"}
          onPress={startRecording}
          disabled={recording}
          color={recording ? "#aaa" : "#007AFF"}
        />
        <Button
          title="Stop Recording"
          onPress={stopRecording}
          disabled={!recording}
          color={!recording ? "#aaa" : "#FF3B30"}
        />
      </View>
      <ScrollView style={styles.transcriptionBox}>
        <Text style={styles.transcriptionText}>{transcription}</Text>
      </ScrollView>
    </View>
  );
}
