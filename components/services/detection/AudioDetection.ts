// Lightweight audio-based smoking trigger (lighter/inhalation) using dynamic import.
// Falls back gracefully if expo-av is not installed or mic permission denied.

export type AudioDetectCallback = (source: 'audio', reason: string) => void;

let running = false;
let cb: AudioDetectCallback | null = null;
let stopFn: (() => Promise<void>) | null = null;

export async function startAudioDetection(onDetected: AudioDetectCallback): Promise<boolean> {
  cb = onDetected;
  if (running) return true;
  try {
    const dynImport: any = (Function('m', 'return import(m)')) as any;
    const av: any = await dynImport('expo-av').catch(() => ({}));
    const Audio = av?.Audio;
    if (!Audio) {
      console.log('[AudioDetection] expo-av not available');
      return false;
    }

    const perm = await Audio.requestPermissionsAsync?.().catch(() => ({ granted: false }));
    if (!perm?.granted) {
      return false;
    }

    await Audio.setAudioModeAsync?.({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const recorder = new Audio.Recording();
    await recorder.prepareToRecordAsync(
      Audio.RecordingOptionsPresets?.HIGH_QUALITY || {
        android: { extension: '.3gp', outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
        ios: { extension: '.caf', audioQuality: 1, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        isMeteringEnabled: true,
      }
    );
    await recorder.startAsync();

    let lastSpike = 0;
    const interval = setInterval(async () => {
      try {
        const status = await recorder.getStatusAsync();
        const level = (status as any)?.metering || 0; // dB-ish
        const now = Date.now();
        // Heuristic: sharp spikes above threshold within short window
        if (level > -20) {
          if (now - lastSpike > 1500) {
            lastSpike = now;
          } else {
            // Two spikes in ~1.5s suggest lighter/click + inhale
            lastSpike = 0;
            if (cb) cb('audio', 'spike_pattern');
          }
        }
      } catch {}
    }, 300);

    stopFn = async () => {
      clearInterval(interval);
      try { await recorder.stopAndUnloadAsync(); } catch {}
    };

    running = true;
    return true;
  } catch (e) {
    console.log('[AudioDetection] start error', e);
    return false;
  }
}

export async function stopAudioDetection(): Promise<void> {
  try {
    if (stopFn) await stopFn();
  } finally {
    stopFn = null;
    cb = null;
    running = false;
  }
}

export function isAudioDetectionRunning(): boolean { return running; }
