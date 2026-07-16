import { useCallback, useRef, useState } from 'react'

const MAX_FILE_SIZE = 5 * 1024 * 1024

export interface CsvRow {
  timestamp: number
  price: number
}

interface Props {
  onImport: (rows: CsvRow[]) => void
  onClear: () => void
  hasImport: boolean
}

function parseCsv(text: string): { rows: CsvRow[]; error: string | null } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length === 0) return { rows: [], error: 'File is empty' }

  const rows: CsvRow[] = []
  const startIdx = Number.isNaN(Number(lines[0].split(',')[0].trim())) ? 1 : 0

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].trim().split(',')
    if (parts.length < 2) continue
    let ts = Number(parts[0].trim())
    const price = Number(parts[1].trim())
    if (!Number.isFinite(ts) || !Number.isFinite(price) || price <= 0) continue
    if (ts < 1e10) ts *= 1000
    rows.push({ timestamp: ts, price })
  }

  if (rows.length === 0) {
    return { rows: [], error: 'No valid rows found. Expected columns: timestamp, price' }
  }

  return { rows: rows.sort((a, b) => a.timestamp - b.timestamp), error: null }
}

export function CsvImportZone({ onImport, onClear, hasImport }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      if (file.size > MAX_FILE_SIZE) {
        setError('File exceeds 5MB limit')
        return
      }
      if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv')) {
        setError('Only CSV files are supported')
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const { rows, error: parseError } = parseCsv(e.target?.result as string)
        if (parseError) {
          setError(parseError)
          return
        }
        onImport(rows)
      }
      reader.readAsText(file)
    },
    [onImport],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  if (hasImport) {
    return (
      <div className="flex items-center gap-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-sm">
        <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-cyan-300 flex-1">CSV data imported — shown as overlay on chart</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
        >
          Clear
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        aria-label="Upload CSV file for price data import"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          isDragging
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
        }`}
      >
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-400">
          Drop a CSV file or <span className="text-cyan-400">browse</span>
        </p>
        <p className="text-xs text-gray-600">Columns: timestamp, price — max 5 MB</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
