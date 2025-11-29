export type WearableDetectCallback = (source: 'wearable', reason: string) => void;

let running = false;
let cb: WearableDetectCallback | null = null;
let unsubscribe: (() => void) | null = null;

export async function startWearableDetection(onDetected: WearableDetectCallback): Promise<boolean> {
  cb = onDetected;
  if (running) return true;
  try {
    const dynImport: any = (Function('m', 'return import(m)')) as any;
    const mod: any = await dynImport('expo-sensors').catch(() => ({}));
    const Accelerometer = mod?.Accelerometer;
    if (!Accelerometer) {
      console.log('[WearableDetection] expo-sensors not available');
      return false;
    }

    let lastTs = Date.now();
    let peaks = 0;
    let lastMag = 0;

    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener((data: { x: number; y: number; z: number }) => {
      const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
      const diff = Math.abs(mag - lastMag);
      const now = Date.now();
      if (diff > 0.6) {
        if (now - lastTs > 400) {
          peaks += 1;
          lastTs = now;
        }
      }
      lastMag = mag;
      if (peaks >= 5) {
        peaks = 0;
        if (cb) cb('wearable', 'motion_pattern');
      }
    });

    unsubscribe = () => {
      try { sub.remove(); } catch {}
    };

    running = true;
    return true;
  } catch (e) {
    console.log('[WearableDetection] start error', e);
    return false;
  }
}

export async function stopWearableDetection(): Promise<void> {
  try {
    if (unsubscribe) unsubscribe();
  } finally {
    unsubscribe = null;
    running = false;
    cb = null;
  }
}

export function isWearableDetectionRunning(): boolean { return running; }
