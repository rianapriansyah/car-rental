import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Box, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { supabase } from '../../lib/supabase'
import { useV2RealtimeRefresh } from '../../hooks/useV2RealtimeRefresh'
import { formatIdr } from '../../lib/formatIdr'
import { calcCost, type CostBreakdown } from '../../lib/rentalCost'
import type { Tables } from '../../types/database'

type ActiveRental = Tables<'v2_rentals'> & {
  v2_cars: Pick<Tables<'v2_cars'>, 'name' | 'plate' | 'daily_rate'> | null
}

const ID_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function formatDateTimeId(date: string | null, time: string | null): string {
  if (!date) return '—'
  const d = dayjs(date)
  return `${ID_DAYS[d.day()]}, ${d.format('DD-MM-YYYY')} ${time ? time.slice(0, 5) : '--:--'}`
}

/** Elapsed hours → "2h 1j 30m" / "13j 7m" (hari, jam, menit) */
function formatElapsed(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const days = Math.floor(totalMinutes / (60 * 24))
  const remH = Math.floor((totalMinutes % (60 * 24)) / 60)
  const remM = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}h`)
  if (remH > 0 || days === 0) parts.push(`${remH}j`)
  if (remM > 0 || (days === 0 && remH === 0)) parts.push(`${remM}m`)
  return parts.join(' ')
}

/** IDR amount without the Rp prefix (e.g. 25.000) for inline breakdowns */
function formatIdrPlain(amount: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(amount))
}

function calcBreakdown(
  rental: ActiveRental,
  now: dayjs.Dayjs,
  overtimeRate: number,
): CostBreakdown | null {
  const { start_date, start_time } = rental
  const dailyRate = rental.v2_cars?.daily_rate ?? 0
  if (!dailyRate || !start_date) return null
  const startDt = dayjs(`${start_date}T${start_time ?? '00:00:00'}`)
  const elapsedHours = now.diff(startDt, 'hour', true)
  if (elapsedHours <= 0) return null
  return calcCost(elapsedHours, dailyRate, overtimeRate)
}

const SCROLL_INTERVAL_MS = 40
const PAUSE_AT_BOTTOM_MS = 3000
const PAUSE_AT_TOP_MS = 1500
/** Base step at ~720px viewport height; scaled in effect for other TVs */
const SCROLL_SPEED_BASE = 1.2
const SCROLL_SPEED_REF_HEIGHT = 720

/** Fluid typography & spacing — scales from small kiosk browsers to 4K TVs */
const tvRootSx = {
  /* typographic scale */
  '--tv-title': 'clamp(1rem, 2.1vw + 0.55rem, 2.85rem)',
  '--tv-clock': 'clamp(1.15rem, 2.6vw + 0.45rem, 3.15rem)',
  '--tv-date': 'clamp(0.62rem, 0.55vw + 0.48rem, 1rem)',
  '--tv-th': 'clamp(0.52rem, 0.42vw + 0.42rem, 0.92rem)',
  '--tv-td': 'clamp(0.68rem, 0.55vw + 0.48rem, 1.12rem)',
  '--tv-td-lg': 'clamp(0.78rem, 0.65vw + 0.52rem, 1.22rem)',
  '--tv-footer': 'clamp(0.58rem, 0.55vw + 0.38rem, 0.92rem)',
  '--tv-empty': 'clamp(0.82rem, 1.35vw + 0.42rem, 1.45rem)',
  /* spacing */
  '--tv-pad-x': 'clamp(0.6rem, 2.2vw, 2.6rem)',
  '--tv-pad-y-header': 'clamp(0.45rem, 1.1vh, 1.15rem)',
  '--tv-cell-pad-x': 'clamp(0.35rem, 1.1vw, 1rem)',
  '--tv-cell-pad-y': 'clamp(0.35rem, 1vh, 0.85rem)',
  '--tv-pulse': 'clamp(6px, 0.65vw, 11px)',
} as const

export function TvDisplayPage() {
  const [rentals, setRentals] = useState<ActiveRental[]>([])
  const [overtimeRate, setOvertimeRate] = useState(25000)
  const [now, setNow] = useState(() => dayjs())
  const scrollRef = useRef<HTMLDivElement>(null)
  const pauseRef = useRef(false)
  const scrollStepRef = useRef(SCROLL_SPEED_BASE)

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(async () => {
    const [{ data: rentalData }, { data: settingData }] = await Promise.all([
      supabase
        .from('v2_rentals')
        .select('*, v2_cars(name, plate, daily_rate)')
        .eq('status', 'active')
        .order('start_date', { ascending: true }),
      supabase
        .from('v2_app_settings')
        .select('value')
        .eq('key', 'overtime_hourly_rate')
        .maybeSingle(),
    ])
    setRentals((rentalData ?? []) as ActiveRental[])
    if (settingData?.value) setOvertimeRate(Number(settingData.value))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useV2RealtimeRefresh('v2_rentals,v2_cars', load)

  useEffect(() => {
    const updateScrollStep = () => {
      const h = typeof window !== 'undefined' ? window.innerHeight : SCROLL_SPEED_REF_HEIGHT
      const scale = h / SCROLL_SPEED_REF_HEIGHT
      scrollStepRef.current = Math.min(3.2, Math.max(0.65, SCROLL_SPEED_BASE * scale))
    }
    updateScrollStep()
    window.addEventListener('resize', updateScrollStep)
    return () => window.removeEventListener('resize', updateScrollStep)
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const tick = setInterval(() => {
      if (pauseRef.current) return
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollHeight <= clientHeight) return
      if (scrollTop + clientHeight >= scrollHeight - 2) {
        pauseRef.current = true
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = 0
          setTimeout(() => { pauseRef.current = false }, PAUSE_AT_TOP_MS)
        }, PAUSE_AT_BOTTOM_MS)
      } else {
        container.scrollTop += scrollStepRef.current
      }
    }, SCROLL_INTERVAL_MS)
    return () => clearInterval(tick)
  }, [rentals.length])

  const clockStr = now.format('HH:mm:ss')
  const dateStr = `${ID_DAYS[now.day()]}, ${now.format('DD MMMM YYYY')}`

  const COLS = ['No', 'Mobil', 'Pemakai', 'Waktu Mulai', 'Berjalan', 'DP', 'Tagihan Berjalan']

  return (
    <Box
      sx={{
        ...tvRootSx,
        bgcolor: '#060c1a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        height: '100vh',
        width: '100%',
        '@supports (height: 100dvh)': {
          height: '100dvh',
        },
        maxWidth: '100vw',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          background: 'linear-gradient(90deg, #b84500 0%, #e07800 55%, #c85f00 100%)',
          px: 'var(--tv-pad-x)',
          py: 'var(--tv-pad-y-header)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 'clamp(0.5rem, 1.5vw, 1.25rem)',
          boxShadow: '0 0.22vw 1.1vw rgba(0,0,0,0.6)',
        }}
      >
        <Box display="flex" alignItems="center" sx={{ gap: 'clamp(0.35rem, 1.2vw, 1rem)' }}>
          <Box
            sx={{
              width: 'var(--tv-pulse)',
              height: 'var(--tv-pulse)',
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: '#fff',
              boxShadow: '0 0 0.55vw #fff',
              animation: 'tvPulse 2s ease-in-out infinite',
              '@keyframes tvPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }}
          />
          <Typography
            component="h1"
            sx={{
              fontSize: 'var(--tv-title)',
              fontWeight: 800,
              letterSpacing: 'clamp(0.06em, 0.2vw, 0.28em)',
              textTransform: 'uppercase',
              textShadow: '0 0.12vw 0.35vw rgba(0,0,0,0.4)',
              lineHeight: 1.15,
            }}
          >
            Rental Berjalan
          </Typography>
        </Box>
        <Box textAlign="right" sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: '"Roboto Mono", "Courier New", monospace',
              fontSize: 'var(--tv-clock)',
              fontWeight: 700,
              letterSpacing: 'clamp(0.06em, 0.25vw, 0.22em)',
              lineHeight: 1,
            }}
          >
            {clockStr}
          </Typography>
          <Typography
            sx={{
              fontSize: 'var(--tv-date)',
              opacity: 0.85,
              mt: '0.25em',
              letterSpacing: 'clamp(0.03em, 0.12vw, 0.08em)',
            }}
          >
            {dateStr}
          </Typography>
        </Box>
      </Box>

      {/* ── Column headers ── */}
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: '#0f1e3d',
          borderBottom: 'max(1px, 0.12vw) solid #e07800',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
        }}
      >
        <table style={tableBaseStyle}>
          <ColGroup />
          <thead>
            <tr>
              {COLS.map((label, idx) => (
                <th
                  key={label}
                  style={{
                    ...getThStyle(idx === 5),
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </Box>

      {/* ── Scrollable rows ── */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'hidden',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
        }}
      >
        <table style={tableBaseStyle}>
          <ColGroup />
          <tbody>
            {rentals.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: 'clamp(2rem, 8vh, 4.5rem) var(--tv-pad-x)',
                    color: '#2a4060',
                    fontSize: 'var(--tv-empty)',
                    letterSpacing: 'clamp(0.04em, 0.35vw, 0.14em)',
                  }}
                >
                  Tidak ada rental aktif saat ini
                </td>
              </tr>
            ) : (
              rentals.map((r, i) => {
                const bd = calcBreakdown(r, now, overtimeRate)
                const dp = r.down_payment ?? 0
                const gross = bd?.total ?? 0
                const sisa = Math.max(0, gross - dp)
                const hasOt = (bd?.overtimeHours ?? 0) > 0

                return (
                  <tr
                    key={r.id}
                    style={{ background: i % 2 === 0 ? '#081120' : '#0c1a30', borderBottom: '1px solid #122040' }}
                  >
                    {/* No */}
                    <td style={{ ...getTdBase(), textAlign: 'center', color: '#3a5a80', fontWeight: 600 }}>
                      {i + 1}
                    </td>

                    {/* Mobil */}
                    <td style={getTdBase()}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--tv-td-lg)', lineHeight: 1.25, wordBreak: 'break-word' }}>
                        {r.v2_cars?.name ?? '—'}
                      </div>
                      <div
                        style={{
                          color: '#5a9aff',
                          fontSize: '0.88em',
                          letterSpacing: 'clamp(0.04em, 0.2vw, 0.16em)',
                          marginTop: '0.2em',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                      >
                        {r.v2_cars?.plate ?? '—'}
                      </div>
                    </td>

                    {/* Pemakai */}
                    <td style={getTdBase()}>
                      <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{r.renter_name}</div>
                      {r.renter_phone && (
                        <div style={{ color: '#5a9aff', fontSize: '0.85em', marginTop: 2 }}>
                          {r.renter_phone}
                        </div>
                      )}
                    </td>

                    {/* Waktu Mulai */}
                    <td
                      style={{
                        ...getTdBase(),
                        color: '#c8d8f0',
                        fontFamily: 'monospace',
                        fontSize: '0.92em',
                        wordBreak: 'break-word',
                      }}
                    >
                      {formatDateTimeId(r.start_date, r.start_time)}
                    </td>

                    {/* Berjalan */}
                    <td
                      style={{
                        ...getTdBase(),
                        color: '#60c0ff',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.96em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {bd ? formatElapsed(bd.elapsedHours) : <span style={{ color: '#3a5a80' }}>—</span>}
                    </td>

                    {/* DP */}
                    <td
                      style={{
                        ...getTdBase(),
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        color: dp > 0 ? '#ffd166' : '#3a5a80',
                        fontWeight: dp > 0 ? 700 : 400,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dp > 0 ? formatIdr(dp) : '—'}
                    </td>

                    {/* Tagihan Berjalan */}
                    <td style={{ ...getTdBase(), wordBreak: 'break-word' }}>
                      {!bd ? (
                        <span style={{ color: '#3a5a80' }}>—</span>
                      ) : (
                        <div style={{ fontSize: '0.9em', lineHeight: 1.6, fontFamily: 'monospace' }}>
                          <div style={{ color: '#e8eef8', fontWeight: 700 }}>{formatIdr(gross)}</div>

                          {hasOt && (
                            <div style={{ color: '#ffb347' }}>
                              {bd.overtimeHours}j OT x {formatIdrPlain(overtimeRate)} = {formatIdr(bd.overtimeCost)}
                            </div>
                          )}

                          <div
                            style={{
                              borderTop: 'max(1px, 0.08vw) dashed #3d5280',
                              margin: 'clamp(4px, 0.9vh, 10px) 0 clamp(3px, 0.6vh, 8px)',
                              paddingTop: 'clamp(3px, 0.55vh, 8px)',
                            }}
                          />

                          <div style={{ color: '#4ade80', fontWeight: 700 }}>
                            Sisa : {formatIdr(sisa)}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Box>

      {/* ── Footer ── */}
      <Box
        sx={{
          bgcolor: '#0c1628',
          borderTop: 'max(1px, 0.12vw) solid #1a3060',
          px: 'var(--tv-pad-x)',
          py: 'clamp(0.35rem, 0.85vh, 0.65rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 'clamp(0.25rem, 1vw, 0.75rem)',
        }}
      >
        <Typography sx={{ color: '#2a4060', fontSize: 'var(--tv-footer)', letterSpacing: 'clamp(0.02em, 0.15vw, 0.06em)' }}>
          ● LIVE — data diperbarui otomatis
        </Typography>
        <Typography sx={{ color: '#2a4060', fontSize: 'var(--tv-footer)', letterSpacing: 'clamp(0.02em, 0.15vw, 0.06em)' }}>
          {rentals.length} rental aktif
        </Typography>
      </Box>
    </Box>
  )
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: '3.2%' }} />
      <col style={{ width: '14.5%' }} />
      <col style={{ width: '14.5%' }} />
      <col style={{ width: '17%' }} />
      <col style={{ width: '10.5%' }} />
      <col style={{ width: '10.5%' }} />
      <col style={{ width: '29.8%' }} />
    </colgroup>
  )
}

const tableBaseStyle: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
}

function getThStyle(rightAligned: boolean): CSSProperties {
  return {
    padding: 'var(--tv-cell-pad-y) var(--tv-cell-pad-x)',
    textAlign: rightAligned ? 'right' : 'left',
    fontWeight: 700,
    fontSize: 'var(--tv-th)',
    letterSpacing: 'clamp(0.04em, 0.18vw, 0.14em)',
    color: '#e07800',
    textTransform: 'uppercase',
    wordBreak: 'break-word',
    verticalAlign: 'middle',
  }
}

function getTdBase(): CSSProperties {
  return {
    padding: 'var(--tv-cell-pad-y) var(--tv-cell-pad-x)',
    verticalAlign: 'middle',
    fontSize: 'var(--tv-td)',
    lineHeight: 1.4,
  }
}
