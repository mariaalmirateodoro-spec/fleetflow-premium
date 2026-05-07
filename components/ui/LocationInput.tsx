'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

interface Suggestion {
  place_id: number
  display_name: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  inputClassName?: string
}

function formatSuggestion(name: string): string {
  // Show first 4 comma-separated parts to keep labels readable
  return name.split(',').slice(0, 4).join(',').trim()
}

export function LocationInput({ value, onChange, placeholder, required, inputClassName }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch suggestions when value changes
  useEffect(() => {
    if (value.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=6&addressdetails=0`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data: Suggestion[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
        setActiveIndex(-1)
      } catch {
        // silently ignore network errors
      }
      setLoading(false)
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      select(suggestions[activeIndex].display_name)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function select(displayName: string) {
    onChange(formatSuggestion(displayName))
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
        <input
          required={required}
          className={inputClassName}
          style={{ paddingLeft: '2.25rem' }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-[#131929] shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                select(s.display_name)
              }}
              className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors flex items-start gap-2.5 border-b border-white/5 last:border-0 ${
                i === activeIndex
                  ? 'bg-fleet-600/20 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-fleet-400 shrink-0 mt-0.5" />
              <span className="text-xs leading-relaxed">{formatSuggestion(s.display_name)}</span>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-slate-600 border-t border-white/5">
            Powered by OpenStreetMap
          </div>
        </div>
      )}
    </div>
  )
}
