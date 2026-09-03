/**
 * Alert sound playback (#308).
 *
 * Synthesizes a short tone with the Web Audio API instead of shipping an audio
 * file, so there's no binary asset to source or license.
 *
 * Browsers block audio playback until a user gesture has occurred on the page.
 * `unlockAudioContext` should be called from the first click/keydown so the
 * `AudioContext` is running by the time an alert later fires and calls
 * `playAlertSound`. If no gesture has happened yet, `playAlertSound` simply
 * returns `false` instead of throwing — alert firing must never crash on a
 * blocked autoplay policy.
 */

let audioContext: AudioContext | null = null

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null
  audioContext = new Ctor()
  return audioContext
}

/** Call on the first user interaction so autoplay policies don't block later alert sounds. */
export function unlockAudioContext(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      /* still blocked; playAlertSound will no-op until the next gesture */
    })
  }
}

/**
 * Plays a short alert tone at the given volume (0-1).
 * Returns `true` if playback started, `false` if it was blocked (e.g. no user
 * gesture yet) or the Web Audio API is unavailable — callers should treat
 * `false` as a silent no-op, not an error.
 */
export function playAlertSound(volume: number): boolean {
  const ctx = getAudioContext()
  if (!ctx || ctx.state !== 'running') return false

  const clampedVolume = Math.min(1, Math.max(0, volume))
  if (clampedVolume === 0) return false

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, ctx.currentTime)
  gain.gain.setValueAtTime(clampedVolume * 0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start()
  oscillator.stop(ctx.currentTime + 0.35)

  return true
}
