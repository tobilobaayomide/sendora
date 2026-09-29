export type UploadProgress = {
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
  bytesPerSecond: number | null;
  remainingSeconds: number | null;
};

export function createProgressTracker(totalBytes: number, startedAt: number) {
  let sampleTime = startedAt;
  let sampleBytes = 0;
  let speed: number | null = null;
  let samples = 0;
  return (loadedBytes: number, now: number): UploadProgress => {
    const loaded = Number.isFinite(loadedBytes) ? Math.min(totalBytes, Math.max(0, loadedBytes)) : 0;
    const elapsed = now - sampleTime;
    // Sample at most twice per second; smooth noise rather than displaying each
    // event's instantaneous rate. No timer advances bytes or percentage.
    if (elapsed >= 500 && loaded >= sampleBytes) {
      const rate = (loaded - sampleBytes) * 1000 / elapsed;
      speed = speed === null ? rate : speed * 0.75 + rate * 0.25;
      sampleBytes = loaded;
      sampleTime = now;
      samples++;
    }
    const validSpeed = speed !== null && Number.isFinite(speed) && speed > 0 ? speed : null;
    const estimate = validSpeed ? (totalBytes - loaded) / validSpeed : null;
    return {
      loadedBytes: loaded,
      totalBytes,
      percentage: totalBytes > 0 ? Math.min(100, loaded / totalBytes * 100) : 0,
      bytesPerSecond: validSpeed,
      remainingSeconds: samples >= 2 && now - startedAt >= 2000 && loaded > 0 &&
        estimate !== null && estimate > 0 && estimate <= 86400 ? estimate : null,
    };
  };
}

export function formatUploadEta(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) return null;
  if (seconds < 60) return `About ${Math.ceil(seconds)} sec remaining`;
  if (seconds < 3600) return `About ${Math.ceil(seconds / 60)} min remaining`;
  return `About ${Math.ceil(seconds / 3600)} hr remaining`;
}

export function uploadFile(url: string, file: Blob, onProgress: (progress: UploadProgress) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const track = createProgressTracker(file.size, performance.now());
    const cleanUp = () => {
      xhr.upload.onprogress = null;
      xhr.onload = xhr.onerror = xhr.onabort = xhr.ontimeout = null;
    };
    const fail = () => {
      cleanUp();
      reject(new Error("File upload failed."));
    };
    // Register before open/send for browser compatibility. The request body is
    // the original File/Blob, so its known size is the network progress total.
    xhr.upload.onprogress = (event) => onProgress(track(event.loaded, performance.now()));
    xhr.onload = () => {
      const succeeded = xhr.status >= 200 && xhr.status < 300;
      cleanUp();
      if (succeeded) resolve();
      else reject(new Error("File upload failed."));
    };
    xhr.onerror = xhr.onabort = xhr.ontimeout = fail;
    try {
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    } catch {
      fail();
    }
  });
}
