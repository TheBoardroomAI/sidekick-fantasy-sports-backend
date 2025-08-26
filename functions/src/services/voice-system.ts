import axios from "axios";
import * as functions from "firebase-functions";
import { db, storage, COLLECTIONS } from "../config/firebase";

// ElevenLabs API Configuration
const ELEVENLABS_API_KEY = functions.config().elevenlabs?.api_key || process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

// Voice IDs for the 6 AI Personas (will be created/configured)
export const PERSONA_VOICES = {
  ORACLE: {
    voiceId: "oracle_voice_id", // To be replaced with actual ElevenLabs voice ID
    name: "The Oracle",
    description: "Mystical, wise, prophetic tone",
    settings: {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.6
    }
  },
  REBEL: {
    voiceId: "rebel_voice_id",
    name: "The Rebel", 
    description: "Edgy, contrarian, confident tone",
    settings: {
      stability: 0.65,
      similarity_boost: 0.80,
      style: 0.8
    }
  },
  MENTOR: {
    voiceId: "mentor_voice_id",
    name: "The Mentor",
    description: "Patient, teaching, encouraging tone", 
    settings: {
      stability: 0.80,
      similarity_boost: 0.75,
      style: 0.4
    }
  },
  ANALYST: {
    voiceId: "analyst_voice_id",
    name: "The Analyst",
    description: "Data-driven, precise, analytical tone",
    settings: {
      stability: 0.85,
      similarity_boost: 0.70,
      style: 0.3
    }
  },
  ROOKIE: {
    voiceId: "rookie_voice_id", 
    name: "The Rookie",
    description: "Enthusiastic, energetic, learning tone",
    settings: {
      stability: 0.60,
      similarity_boost: 0.85,
      style: 0.9
    }
  },
  ZANE: {
    voiceId: "zane_voice_id",
    name: "Zane the AI Sports Reporter",
    description: "Professional broadcaster, dramatic, authoritative",
    settings: {
      stability: 0.75,
      similarity_boost: 0.80,
      style: 0.7
    }
  }
};

export class VoiceSystemService {

  /**
   * Generate speech using ElevenLabs TTS
   */
  static async generateSpeech(
    text: string, 
    persona: keyof typeof PERSONA_VOICES,
    options: { cacheKey?: string } = {}
  ): Promise<{ audioData: string; cacheKey: string }> {
    try {
      // Check cache first
      const cacheKey = options.cacheKey || this.generateCacheKey(text, persona);
      const cachedAudio = await this.getCachedVoice(cacheKey);
      
      if (cachedAudio) {
        return { audioData: cachedAudio, cacheKey };
      }

      const voiceConfig = PERSONA_VOICES[persona];
      
      const response = await axios.post(
        `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceConfig.voiceId}`,
        {
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: voiceConfig.settings
        },
        {
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
          },
          responseType: "arraybuffer"
        }
      );

      // Convert to base64
      const audioBuffer = Buffer.from(response.data);
      const audioBase64 = audioBuffer.toString("base64");

      // Cache the audio
      await this.cacheVoice(cacheKey, audioBase64, { persona, text });

      return { audioData: audioBase64, cacheKey };

    } catch (error: any) {
      functions.logger.error("ElevenLabs TTS error:", error);
      throw new Error(`Voice generation failed: ${error}`);
    }
  }

  /**
   * Create custom voice for persona (voice cloning)
   */
  static async createPersonaVoice(
    persona: keyof typeof PERSONA_VOICES,
    audioSamples: Buffer[]
  ): Promise<string> {
    try {
      const voiceConfig = PERSONA_VOICES[persona];
      
      // Create form data for voice cloning
      const formData = new FormData();
      formData.append("name", voiceConfig.name);
      formData.append("description", voiceConfig.description);
      
      // Add audio samples
      audioSamples.forEach((sample, index) => {
        formData.append("files", new Blob([sample]), `sample_${index}.mp3`);
      });

      const response = await axios.post(
        `${ELEVENLABS_BASE_URL}/voices/add`,
        formData,
        {
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "multipart/form-data"
          }
        }
      );

      const voiceId = response.data.voice_id;
      
      // Update voice configuration
      PERSONA_VOICES[persona].voiceId = voiceId;
      
      // Store voice ID in Firestore
      await db.collection("voice_config").doc(persona).set({
        voiceId,
        name: voiceConfig.name,
        description: voiceConfig.description,
        settings: voiceConfig.settings,
        createdAt: new Date()
      });

      return voiceId;

    } catch (error: any) {
      functions.logger.error("Voice cloning error:", error);
      throw new Error(`Voice cloning failed: ${error}`);
    }
  }

  /**
   * Get available voices from ElevenLabs
   */
  static async getAvailableVoices(): Promise<any> {
    try {
      const response = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY
        }
      });

      return response.data.voices;
    } catch (error: any) {
      functions.logger.error("Get voices error:", error);
      throw new Error(`Failed to get voices: ${error}`);
    }
  }

  /**
   * Cache voice audio in Firebase Storage and Firestore
   */
  static async cacheVoice(
    cacheKey: string, 
    audioBase64: string, 
    metadata: { persona: string; text: string }
  ): Promise<void> {
    try {
      // Store in Firebase Storage
      const bucket = storage.bucket();
      const file = bucket.file(`voice-cache/${cacheKey}.mp3`);
      
      const audioBuffer = Buffer.from(audioBase64, "base64");
      await file.save(audioBuffer, {
        metadata: {
          contentType: "audio/mpeg",
          metadata: {
            persona: metadata.persona,
            textLength: metadata.text.length.toString(),
            createdAt: new Date().toISOString()
          }
        }
      });

      // Store metadata in Firestore
      await db.collection(COLLECTIONS.VOICE_CACHE).doc(cacheKey).set({
        persona: metadata.persona,
        text: metadata.text,
        textHash: this.hashText(metadata.text),
        audioSize: audioBuffer.length,
        storagePath: `voice-cache/${cacheKey}.mp3`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

    } catch (error: any) {
      functions.logger.error("Voice cache error:", error);
    }
  }

  /**
   * Get cached voice audio
   */
  static async getCachedVoice(cacheKey: string): Promise<string | null> {
    try {
      // Check Firestore metadata
      const cacheDoc = await db.collection(COLLECTIONS.VOICE_CACHE).doc(cacheKey).get();
      
      if (!cacheDoc.exists) {
        return null;
      }

      const cacheData = cacheDoc.data();
      const now = new Date();
      
      // Check if cache is expired
      if (cacheData?.expiresAt && cacheData.expiresAt.toDate() < now) {
        // Clean up expired cache
        await this.cleanupExpiredCache(cacheKey);
        return null;
      }

      // Get audio from Firebase Storage
      const bucket = storage.bucket();
      const file = bucket.file(cacheData?.storagePath);
      
      const [buffer] = await file.download();
      return buffer.toString("base64");

    } catch (error: any) {
      functions.logger.error("Get cached voice error:", error);
      return null;
    }
  }

  /**
   * Generate cache key for voice
   */
  static generateCacheKey(text: string, persona: string): string {
    const textHash = this.hashText(text);
    return `${persona}_${textHash}`;
  }

  /**
   * Hash text for cache key
   */
  static hashText(text: string): string {
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache(cacheKey: string): Promise<void> {
    try {
      // Delete from Firestore
      await db.collection(COLLECTIONS.VOICE_CACHE).doc(cacheKey).delete();
      
      // Delete from Storage
      const bucket = storage.bucket();
      const file = bucket.file(`voice-cache/${cacheKey}.mp3`);
      await file.delete();

    } catch (error: any) {
      functions.logger.error("Cache cleanup error:", error);
    }
  }

  /**
   * Get voice system health status
   */
  static async getVoiceSystemHealth(): Promise<any> {
    try {
      // Test ElevenLabs API
      const voices = await this.getAvailableVoices();
      
      // Check cache statistics
      const cacheStats = await db.collection(COLLECTIONS.VOICE_CACHE)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      return {
        status: "healthy",
        elevenlabs: {
          connected: true,
          availableVoices: voices.length
        },
        cache: {
          recentEntries: cacheStats.size,
          totalSize: cacheStats.docs.reduce((sum, doc) => sum + (doc.data().audioSize || 0), 0)
        },
        personas: Object.keys(PERSONA_VOICES).length,
        lastChecked: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        status: "error",
        error: error?.message || "Unknown error",
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Batch generate voices for common phrases
   */
  static async preGenerateCommonPhrases(): Promise<void> {
    const commonPhrases = [
      "Hello! I'm here to help with your fantasy football decisions.",
      "Let me analyze the data for you.",
      "Based on the current matchups, here's my recommendation.",
      "That's an interesting question. Let me think about it.",
      "I'd be happy to help you with that lineup decision."
    ];

    const personas = Object.keys(PERSONA_VOICES) as Array<keyof typeof PERSONA_VOICES>;

    for (const persona of personas) {
      for (const phrase of commonPhrases) {
        try {
          await this.generateSpeech(phrase, persona);
          functions.logger.info(`Pre-generated voice for ${persona}: ${phrase.substring(0, 30)}...`);
        } catch (error: any) {
          functions.logger.error(`Failed to pre-generate voice for ${persona}:`, error);
        }
      }
    }
  }
}

