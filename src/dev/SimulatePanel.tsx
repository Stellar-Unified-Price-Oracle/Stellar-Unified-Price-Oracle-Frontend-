/**
 * SimulatePanel (#475)
 *
 * Dev-only floating panel for exercising the UI under simulated WebSocket
 * degradation: throttling, flooding, or silently dropping live messages,
 * targeting specific oracle sources for downtime or divergence, and
 * deterministically replaying a recorded (or canned) message sequence.
 *
 * Mount behind `import.meta.env.DEV` (see `App.tsx`) — this file must never
 * be reachable from a production build. See `dev/wsSimulator.ts` for the
 * tree-shaking contract this relies on.
 */
import { memo, useCallback, useEffect, useState } from 'react'
import { usePriceContext } from '../context/PriceContext'
import { setDevMessageInterceptor } from '../api/websocket'
import { KNOWN_SOURCES } from '../components/FilterPanel'
import {
  applySimulation,
  buildSampleSequence,
  configureSimulation,
  getRecordedFrames,
  getSimulationConfig,
  isRecording,
  replaySequence,
  resetSimulation,
  startRecording,
  stopRecording,
  subscribeSimulation,
  type ReplayHandle,
  type SimulationConfig,
  type SourceEffect,
} from './wsSimulator'

const HIDDEN_STORAGE_KEY = 'ws_simulate_panel_hidden'
const MODES: SimulationConfig['mode'][] = ['off', 'throttle', 'flood', 'drop']

export const SimulatePanel = memo(function SimulatePanel() {
  const { _injectSimulatedMessage } = usePriceContext()
  const [visible, setVisible] = useState(() => localStorage.getItem(HIDDEN_STORAGE_KEY) !== '1')
  const [cfg, setCfg] = useState<SimulationConfig>(() => getSimulationConfig())
  const [recordingActive, setRecordingActive] = useState(false)
  const [recordedCount, setRecordedCount] = useState(0)
  const [replayHandle, setReplayHandle] = useState<ReplayHandle | null>(null)

  useEffect(() => subscribeSimulation(setCfg), [])

  // Wires the live simulation engine into the WS client's message pipeline
  // for exactly as long as this (dev-only) panel is mounted.
  useEffect(() => {
    setDevMessageInterceptor(applySimulation)
    return () => setDevMessageInterceptor(null)
  }, [])

  const toggleVisible = useCallback(() => {
    setVisible((v) => {
      const next = !v
      localStorage.setItem(HIDDEN_STORAGE_KEY, next ? '0' : '1')
      return next
    })
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording()) {
      const frames = stopRecording()
      setRecordingActive(false)
      setRecordedCount(frames.length)
    } else {
      startRecording()
      setRecordingActive(true)
      setRecordedCount(0)
    }
  }, [])

  const runReplay = useCallback(
    (frames: ReturnType<typeof getRecordedFrames>) => {
      replayHandle?.stop()
      if (frames.length === 0) {
        setReplayHandle(null)
        return
      }
      const handle = replaySequence(frames, _injectSimulatedMessage)
      setReplayHandle(handle)
    },
    [_injectSimulatedMessage, replayHandle],
  )

  const stopReplay = useCallback(() => {
    replayHandle?.stop()
    setReplayHandle(null)
  }, [replayHandle])

  const setSourceEffect = useCallback(
    (source: string, effect: SourceEffect | 'none') => {
      const withoutSource = cfg.sourceTargets.filter((t) => t.source !== source)
      const next =
        effect === 'none' ? withoutSource : [...withoutSource, { source, effect, magnitude: 0.05 }]
      configureSimulation({ sourceTargets: next })
    },
    [cfg.sourceTargets],
  )

  if (!import.meta.env.DEV) return null

  if (!visible) {
    return (
      <button
        onClick={toggleVisible}
        title="Show WS simulate panel"
        className="fixed bottom-4 right-4 z-[9999] rounded border border-slate-600 bg-slate-900/90 px-2 py-1 font-mono text-xs text-slate-400 hover:text-slate-100"
        aria-label="Show WS simulate panel"
      >
        🧪 simulate
      </button>
    )
  }

  return (
    <aside
      role="complementary"
      aria-label="WebSocket simulate panel"
      className="fixed bottom-4 right-4 z-[9999] w-72 max-h-[80vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-3 font-mono text-xs shadow-2xl backdrop-blur space-y-3"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold text-slate-300">🧪 Simulate</span>
        <button onClick={toggleVisible} title="Hide panel" className="text-slate-500 hover:text-slate-200" aria-label="Hide WS simulate panel">
          ✕
        </button>
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-slate-400">Enabled</span>
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => configureSimulation({ enabled: e.target.checked })}
          aria-label="Enable WS simulation"
        />
      </label>

      <fieldset>
        <legend className="text-slate-400 mb-1">Mode</legend>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Simulation mode">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={cfg.mode === m}
              onClick={() => configureSimulation({ mode: m })}
              className={`px-2 py-1 rounded border text-xs capitalize ${
                cfg.mode === m
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </fieldset>

      {cfg.mode === 'throttle' && (
        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Delay (ms)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={cfg.throttleMs}
            onChange={(e) => configureSimulation({ throttleMs: Math.max(0, Number(e.target.value) || 0) })}
            className="w-20 rounded border border-slate-700 bg-slate-800 px-1 text-right text-slate-100"
            aria-label="Throttle delay in milliseconds"
          />
        </label>
      )}

      {cfg.mode === 'flood' && (
        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Extra copies</span>
          <input
            type="number"
            min={0}
            max={100}
            value={cfg.floodCopies}
            onChange={(e) => configureSimulation({ floodCopies: Math.max(0, Number(e.target.value) || 0) })}
            className="w-20 rounded border border-slate-700 bg-slate-800 px-1 text-right text-slate-100"
            aria-label="Flood duplicate count"
          />
        </label>
      )}

      {cfg.mode === 'drop' && (
        <label className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Drop rate</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={cfg.dropRate}
            onChange={(e) =>
              configureSimulation({ dropRate: Math.min(1, Math.max(0, Number(e.target.value) || 0)) })
            }
            className="w-20 rounded border border-slate-700 bg-slate-800 px-1 text-right text-slate-100"
            aria-label="Drop probability, 0 to 1"
          />
        </label>
      )}

      <fieldset>
        <legend className="text-slate-400 mb-1">Source targets</legend>
        <div className="space-y-1">
          {KNOWN_SOURCES.map((source) => {
            const target = cfg.sourceTargets.find((t) => t.source === source)
            return (
              <div key={source} className="flex items-center justify-between gap-2">
                <span className="text-slate-300 capitalize">{source}</span>
                <select
                  value={target?.effect ?? 'none'}
                  onChange={(e) => setSourceEffect(source, e.target.value as SourceEffect | 'none')}
                  className="rounded border border-slate-700 bg-slate-800 text-slate-100 text-xs"
                  aria-label={`Simulated effect for ${source}`}
                >
                  <option value="none">none</option>
                  <option value="downtime">downtime</option>
                  <option value="divergence">divergence</option>
                </select>
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="border-t border-slate-700 pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Recording</span>
          <button
            onClick={toggleRecording}
            className={`px-2 py-1 rounded border text-xs ${
              recordingActive ? 'border-red-500 text-red-400' : 'border-slate-700 text-slate-300 hover:text-slate-100'
            }`}
          >
            {recordingActive ? '● Stop' : 'Record'}
          </button>
        </div>
        {!recordingActive && recordedCount > 0 && (
          <div className="text-slate-500">{recordedCount} frame(s) captured</div>
        )}

        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => runReplay(getRecordedFrames())}
            disabled={getRecordedFrames().length === 0}
            className="px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ Replay recorded
          </button>
          <button
            onClick={() => runReplay(buildSampleSequence())}
            className="px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100"
          >
            ▶ Replay sample
          </button>
          {replayHandle && (
            <button onClick={stopReplay} className="px-2 py-1 rounded border border-red-600 text-red-400">
              ■ Stop replay
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          stopReplay()
          resetSimulation()
        }}
        className="w-full px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-100"
      >
        Reset all
      </button>
    </aside>
  )
})
