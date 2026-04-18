import { useCallback, useEffect, useRef, useState } from 'react'
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

const SCROLL_SPEED_PX = 1.2
const SCROLL_INTERVAL_MS = 40
const PAUSE_AT_BOTTOM_MS = 3000
const PAUSE_AT_TOP_MS = 1500

export function TvDisplayPage() {
  const [rentals, setRentals] = useState<ActiveRental[]>([])
  const [overtimeRate, setOvertimeRate] = useState(25000)
  const [now, setNow] = useState(() => dayjs())
  const scrollRef = useRef<HTMLDivElement>(null)
  const pauseRef = useRef(false)

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
        container.scrollTop += SCROLL_SPEED_PX
      }
    }, SCROLL_INTERVAL_MS)
    return () => clearInterval(tick)
  }, [])

  const clockStr = now.format('HH:mm:ss')
  const dateStr = `${ID_DAYS[now.day()]}, ${now.format('DD MMMM YYYY')}`

  const COLS = ['No', 'Mobil', 'Waktu Mulai (24h)', 'Pemakai', 'Berjalan', 'ETA', 'Tagihan Berjalan']

  return (
    <Box
      sx={{
        height: '100vh',
        bgcolor: '#060c1a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          background: 'linear-gradient(90deg, #b84500 0%, #e07800 55%, #c85f00 100%)',
          px: 4,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: '#fff',
              boxShadow: '0 0 8px #fff',
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }}
          />
          <Typography
            sx={{ fontSize: '2rem', fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}
          >
            Rental Berjalan
          </Typography>
        </Box>
        <Box textAlign="right">
          <Typography
            sx={{ fontFamily: '"Roboto Mono", "Courier New", monospace', fontSize: '2.2rem', fontWeight: 700, letterSpacing: 3, lineHeight: 1 }}
          >
            {clockStr}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', opacity: 0.85, mt: 0.3, letterSpacing: 1 }}>
            {dateStr}
          </Typography>
        </Box>
      </Box>

      {/* ── Column headers ── */}
      <Box sx={{ flexShrink: 0, bgcolor: '#0f1e3d', borderBottom: '2px solid #e07800' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <ColGroup />
          <thead>
            <tr>
              {COLS.map((label) => (
                <th key={label} style={thStyle}>{label}</th>
              ))}
            </tr>
          </thead>
        </table>
      </Box>

      {/* ── Scrollable rows ── */}
      <Box ref={scrollRef} sx={{ flex: 1, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <ColGroup />
          <tbody>
            {rentals.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '4rem', color: '#2a4060', fontSize: '1.3rem', letterSpacing: 2 }}
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
                const dailyRate = r.v2_cars?.daily_rate ?? 0
                const hasOt = (bd?.overtimeHours ?? 0) > 0

                return (
                  <tr
                    key={r.id}
                    style={{ background: i % 2 === 0 ? '#081120' : '#0c1a30', borderBottom: '1px solid #122040' }}
                  >
                    {/* No */}
                    <td style={{ ...tdBase, textAlign: 'center', color: '#3a5a80', fontWeight: 600 }}>
                      {i + 1}
                    </td>

                    {/* Mobil */}
                    <td style={tdBase}>
                      <div style={{ fontWeight: 700, fontSize: '1.1em' }}>{r.v2_cars?.name ?? '—'}</div>
                      <div style={{ color: '#5a9aff', fontSize: '0.85em', letterSpacing: 2, marginTop: 2, fontFamily: 'monospace' }}>
                        {r.v2_cars?.plate ?? '—'}
                      </div>
                    </td>

                    {/* Waktu Mulai */}
                    <td style={{ ...tdBase, color: '#c8d8f0', fontFamily: 'monospace', fontSize: '0.9em' }}>
                      {formatDateTimeId(r.start_date, r.start_time)}
                    </td>

                    {/* Pemakai */}
                    <td style={tdBase}>
                      <div style={{ fontWeight: 600 }}>{r.renter_name}</div>
                      {r.renter_phone && (
                        <div style={{ color: '#5a9aff', fontSize: '0.85em', marginTop: 2 }}>
                          {r.renter_phone}
                        </div>
                      )}
                    </td>

                    {/* Berjalan */}
                    <td style={{ ...tdBase, color: '#60c0ff', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.97em' }}>
                      {bd ? formatElapsed(bd.elapsedHours) : <span style={{ color: '#3a5a80' }}>—</span>}
                    </td>

                    {/* ETA */}
                    <td style={{ ...tdBase, color: '#c8d8f0', fontFamily: 'monospace', fontSize: '0.9em' }}>
                      {r.end_date ? formatDateTimeId(r.end_date, r.end_time) : <span style={{ color: '#3a5a80' }}>—</span>}
                    </td>

                    {/* Tagihan Berjalan */}
                    <td style={tdBase}>
                      {!bd ? (
                        <span style={{ color: '#3a5a80' }}>—</span>
                      ) : (
                        <div style={{ fontSize: '0.88em', lineHeight: 1.65, fontFamily: 'monospace' }}>
                          {/* DP line — only when DP > 0 */}
                          {dp > 0 && (
                            <div style={{ color: '#ffd166', marginBottom: 2 }}>
                              {'DP : '}
                              <span style={{ fontWeight: 700 }}>{formatIdr(dp)}</span>
                            </div>
                          )}

                          {/* days line */}
                          <div style={{ color: '#c8d8f0' }}>
                            <span style={{ color: '#a0c0ff' }}>{bd.fullDays}h</span>
                            {' × '}
                            <span>{formatIdr(dailyRate)}</span>
                            {' = '}
                            <span style={{ fontWeight: 700 }}>{formatIdr(bd.dailyCost)}</span>
                          </div>

                          {/* OT line — only when overtime hours > 0 */}
                          {hasOt && (
                            <div style={{ color: '#ffb347' }}>
                              <span style={{ color: '#ffa040' }}>{bd.overtimeHours}j OT</span>
                              {' × '}
                              <span>{formatIdr(overtimeRate)}</span>
                              {' = '}
                              <span style={{ fontWeight: 700 }}>{formatIdr(bd.overtimeCost)}</span>
                            </div>
                          )}

                          {/* Divider */}
                          <div style={{ borderTop: '1px solid #2a4060', margin: '4px 0' }} />

                          {/* Sisa tagihan */}
                          <div style={{ color: '#4ade80', fontWeight: 700 }}>
                            {'Sisa : '}
                            <span>{formatIdr(sisa)}</span>
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
          borderTop: '2px solid #1a3060',
          px: 4,
          py: 0.8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Typography sx={{ color: '#2a4060', fontSize: '0.8rem', letterSpacing: 1 }}>
          ● LIVE — data diperbarui otomatis
        </Typography>
        <Typography sx={{ color: '#2a4060', fontSize: '0.8rem', letterSpacing: 1 }}>
          {rentals.length} rental aktif
        </Typography>
      </Box>
    </Box>
  )
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: '3%' }} />
      <col style={{ width: '16%' }} />
      <col style={{ width: '18%' }} />
      <col style={{ width: '16%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '18%' }} />
      <col style={{ width: '19%' }} />
    </colgroup>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: 2,
  color: '#e07800',
  textTransform: 'uppercase',
}

const tdBase: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
  fontSize: '0.97rem',
  lineHeight: 1.4,
}
