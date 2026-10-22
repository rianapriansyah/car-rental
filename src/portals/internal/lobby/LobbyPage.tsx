import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Alert,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import CloseIcon from '@mui/icons-material/Close'
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { useV2RealtimeRefresh } from '../../../hooks/useV2RealtimeRefresh'
import { isInternalStaffUser } from '../../../lib/authRole'
import {
  calcActiveRentalTotals,
  formatDateTimeId,
  formatElapsedCompact,
  formatIdrPlain,
  ID_DAYS,
} from '../../../lib/activeRentalDisplay'
import { formatIdr } from '../../../lib/formatIdr'
import { fetchCompanyDisplayName } from '../../../lib/ledgerPdf'
import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/database'
import { CheckInPanel } from '../inout/CheckInPanel'

type ActiveRental = Tables<'v2_rentals'> & {
  v2_cars: Pick<Tables<'v2_cars'>, 'name' | 'plate' | 'daily_rate'> | null
}

/** Kiosk palette — shared with the TV display so the two screens read as one family. */
const C = {
  bg: '#060c1a',
  surface: '#0b1526',
  rowA: '#081120',
  rowB: '#0c1a30',
  border: '#122040',
  headerBg: '#0f1e3d',
  accent: '#e07800',
  muted: '#3a5a80',
  dim: '#2a4060',
  label: '#c8d8f0',
  plate: '#5a9aff',
  elapsed: '#60c0ff',
  dp: '#ffd166',
  ot: '#ffb347',
  due: '#4ade80',
} as const

const COLS = ['No', 'Mobil', 'Pemakai', 'Waktu Mulai', 'Berjalan', 'DP', 'Tagihan Berjalan'] as const

export function LobbyPage() {
  const { user, loading: authLoading } = useAuth()
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('md'))

  const [rentals, setRentals] = useState<ActiveRental[]>([])
  const [companyName, setCompanyName] = useState('')
  const [overtimeRate, setOvertimeRate] = useState(25000)
  const [dailyDriverRate, setDailyDriverRate] = useState(0)
  const [now, setNow] = useState(() => dayjs())
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(async () => {
    const [{ data: rentalData }, { data: otSetting }, { data: driverSetting }, displayName] =
      await Promise.all([
        supabase
          .from('v2_rentals')
          .select('*, v2_cars(name, plate, daily_rate)')
          .eq('status', 'active')
          .order('start_date', { ascending: true }),
        supabase.from('v2_app_settings').select('value').eq('key', 'overtime_hourly_rate').maybeSingle(),
        supabase.from('v2_app_settings').select('value').eq('key', 'daily_driver_rate').maybeSingle(),
        fetchCompanyDisplayName(supabase),
      ])
    setRentals((rentalData ?? []) as ActiveRental[])
    setCompanyName(displayName)
    if (otSetting?.value) setOvertimeRate(Number(otSetting.value))
    if (driverSetting?.value != null) {
      const n = Number(driverSetting.value)
      if (Number.isFinite(n) && n > 0) setDailyDriverRate(n)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useV2RealtimeRefresh('v2_cars,v2_rentals', load)

  // Safety net for a lobby tablet that may sleep or drop its websocket.
  useEffect(() => {
    const id = setInterval(() => void load(), 15_000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  if (authLoading) return null
  if (!user || !isInternalStaffUser(user)) return <Navigate to="/internal/home" replace />

  const clockStr = now.format('HH:mm:ss')
  const dateStr = `${ID_DAYS[now.day()]}, ${now.locale('id').format('DD MMMM YYYY')}`

  const rows = rentals.map((r, i) => ({
    rental: r,
    index: i,
    totals: calcActiveRentalTotals(r, now, overtimeRate, dailyDriverRate),
  }))

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box
        sx={{
          bgcolor: C.bg,
          color: '#fff',
          minHeight: '100vh',
          '@supports (height: 100dvh)': { minHeight: '100dvh' },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Header ── */}
        <Box
          sx={{
            background: 'linear-gradient(90deg, #b84500 0%, #e07800 55%, #c85f00 100%)',
            px: { xs: 2, md: 3 },
            py: { xs: 1.25, md: 1.5 },
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            boxShadow: '0 2px 14px rgba(0,0,0,0.6)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: '1 1 auto' }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                flexShrink: 0,
                borderRadius: '50%',
                bgcolor: '#fff',
                boxShadow: '0 0 8px #fff',
                animation: 'lobbyPulse 2s ease-in-out infinite',
                '@keyframes lobbyPulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: '1.05rem', sm: '1.25rem', md: '1.5rem' },
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                Mobil Keluar
              </Typography>
              {companyName ? (
                <Typography
                  sx={{
                    fontSize: { xs: '0.75rem', md: '0.9rem' },
                    fontWeight: 600,
                    opacity: 0.9,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {companyName}
                </Typography>
              ) : null}
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              sx={{
                fontFamily: '"Roboto Mono", "Courier New", monospace',
                fontSize: { xs: '1.35rem', md: '1.75rem' },
                fontWeight: 700,
                letterSpacing: '0.1em',
                lineHeight: 1,
              }}
            >
              {clockStr}
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.68rem', md: '0.8rem' }, opacity: 0.85, mt: 0.25 }}>
              {dateStr}
            </Typography>
          </Box>

          <Tooltip title="Dashboard internal">
            <IconButton
              component={Link}
              to="/internal/home"
              size="small"
              aria-label="Buka dashboard internal"
              sx={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0 }}
            >
              <SpaceDashboardOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* ── Action bar ── */}
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: `1px solid ${C.border}`,
            bgcolor: C.surface,
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setCheckInOpen(true)}
            sx={{
              bgcolor: C.accent,
              color: '#fff',
              fontWeight: 800,
              fontSize: { xs: '0.95rem', md: '1.05rem' },
              letterSpacing: '0.04em',
              textTransform: 'none',
              borderRadius: 2,
              px: { xs: 2.5, md: 3.5 },
              py: { xs: 1.25, md: 1.5 },
              minHeight: 56,
              boxShadow: '0 4px 16px rgba(224,120,0,0.35)',
              '&:hover': { bgcolor: '#f08a10' },
            }}
          >
            Keluarkan Mobil
          </Button>

          <Typography sx={{ color: C.muted, fontSize: { xs: '0.8rem', md: '0.9rem' }, ml: 'auto' }}>
            {rentals.length} mobil sedang keluar
          </Typography>
        </Box>

        {/* ── Rows ── */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {rows.length === 0 ? (
            <Typography
              sx={{
                textAlign: 'center',
                color: C.muted,
                py: { xs: 6, md: 10 },
                px: 2,
                fontSize: { xs: '0.95rem', md: '1.15rem' },
                letterSpacing: '0.06em',
              }}
            >
              Tidak ada mobil yang sedang keluar
            </Typography>
          ) : compact ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
              {rows.map(({ rental, index, totals }) => (
                <RentalCard
                  key={rental.id}
                  rental={rental}
                  index={index}
                  totals={totals}
                  overtimeRate={overtimeRate}
                />
              ))}
            </Box>
          ) : (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '24%' }} />
              </colgroup>
              <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  {COLS.map((label, idx) => (
                    <Box
                      component="th"
                      key={label}
                      sx={{
                        bgcolor: C.headerBg,
                        borderBottom: `2px solid ${C.accent}`,
                        px: 1.5,
                        py: 1.25,
                        textAlign: idx >= 5 ? 'right' : 'left',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        letterSpacing: '0.1em',
                        color: C.accent,
                        textTransform: 'uppercase',
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </tr>
              </Box>
              <tbody>
                {rows.map(({ rental: r, index: i, totals }) => {
                  const { breakdown: bd, dp, gross, sisa } = totals
                  const hasOt = (bd?.overtimeHours ?? 0) > 0
                  return (
                    <Box
                      component="tr"
                      key={r.id}
                      sx={{
                        bgcolor: i % 2 === 0 ? C.rowA : C.rowB,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <Td sx={{ textAlign: 'center', color: C.muted, fontWeight: 600 }}>{i + 1}</Td>

                      <Td>
                        <Box sx={{ fontWeight: 700, fontSize: '1.02rem', lineHeight: 1.3 }}>
                          {r.v2_cars?.name ?? '—'}
                        </Box>
                        <Box
                          sx={{
                            color: C.plate,
                            fontSize: '0.82rem',
                            fontFamily: 'monospace',
                            letterSpacing: '0.1em',
                            mt: 0.25,
                          }}
                        >
                          {r.v2_cars?.plate ?? '—'}
                        </Box>
                      </Td>

                      <Td>
                        <Box sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{r.renter_name}</Box>
                        {r.renter_phone ? (
                          <Box sx={{ color: C.plate, fontSize: '0.8rem', mt: 0.25 }}>{r.renter_phone}</Box>
                        ) : null}
                      </Td>

                      <Td sx={{ color: C.label, fontFamily: 'monospace', fontSize: '0.86rem' }}>
                        {formatDateTimeId(r.start_date, r.start_time)}
                      </Td>

                      <Td
                        sx={{
                          color: C.elapsed,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {bd ? formatElapsedCompact(bd.elapsedHours) : <Box component="span" sx={{ color: C.muted }}>—</Box>}
                      </Td>

                      <Td
                        sx={{
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: dp > 0 ? C.dp : C.muted,
                          fontWeight: dp > 0 ? 700 : 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dp > 0 ? formatIdr(dp) : '—'}
                      </Td>

                      <Td sx={{ textAlign: 'right' }}>
                        {!bd ? (
                          <Box component="span" sx={{ color: C.muted }}>—</Box>
                        ) : (
                          <Box sx={{ fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.6 }}>
                            <Box sx={{ fontWeight: 700 }}>{formatIdr(gross)}</Box>
                            {hasOt ? (
                              <Box sx={{ color: C.ot }}>
                                {bd.overtimeHours}j OT x {formatIdrPlain(overtimeRate)} ={' '}
                                {formatIdr(bd.overtimeCost)}
                              </Box>
                            ) : null}
                            <Box
                              sx={{
                                borderTop: `1px dashed #3d5280`,
                                my: 0.75,
                                pt: 0.5,
                                color: C.due,
                                fontWeight: 700,
                              }}
                            >
                              Sisa : {formatIdr(sisa)}
                            </Box>
                          </Box>
                        )}
                      </Td>
                    </Box>
                  )
                })}
              </tbody>
            </Box>
          )}
        </Box>

        {/* ── Check-in modal ── */}
        <Dialog
          open={checkInOpen}
          onClose={() => setCheckInOpen(false)}
          fullWidth
          maxWidth="sm"
          fullScreen={compact}
        >
          <DialogTitle
            sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1, fontSize: '1.1rem', fontWeight: 700 }}
          >
            <Box component="span" sx={{ flex: 1 }}>
              Keluarkan Mobil — Check In
            </Box>
            <IconButton aria-label="Tutup" onClick={() => setCheckInOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <CheckInPanel
              onSaved={(message) => {
                setCheckInOpen(false)
                setToast(message)
                void load()
              }}
              onCancel={() => setCheckInOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Snackbar
          open={toast != null}
          autoHideDuration={6000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success" variant="filled" onClose={() => setToast(null)}>
            {toast}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  )
}

/** Table cell with the kiosk's shared padding / sizing. */
function Td({ children, sx }: { children?: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      component="td"
      sx={[
        { px: 1.5, py: 1.5, verticalAlign: 'middle', fontSize: '0.95rem', lineHeight: 1.4 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  )
}

/** Stacked layout used on portrait / narrow tablets where 7 columns do not fit. */
function RentalCard({
  rental: r,
  index,
  totals,
  overtimeRate,
}: {
  rental: ActiveRental
  index: number
  totals: ReturnType<typeof calcActiveRentalTotals>
  overtimeRate: number
}) {
  const { breakdown: bd, dp, gross, sisa } = totals
  const hasOt = (bd?.overtimeHours ?? 0) > 0

  return (
    <Box
      sx={{
        bgcolor: index % 2 === 0 ? C.rowA : C.rowB,
        border: `1px solid ${C.border}`,
        borderRadius: 2,
        p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ color: C.muted, fontWeight: 700, fontSize: '0.9rem', pt: 0.25 }}>{index + 1}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.3 }}>
            {r.v2_cars?.name ?? '—'}
          </Typography>
          <Typography
            sx={{ color: C.plate, fontFamily: 'monospace', fontSize: '0.82rem', letterSpacing: '0.1em' }}
          >
            {r.v2_cars?.plate ?? '—'}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography
            sx={{ color: C.elapsed, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}
          >
            {bd ? formatElapsedCompact(bd.elapsedHours) : '—'}
          </Typography>
          <Typography sx={{ color: C.dim, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Berjalan
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
        <Field label="Pemakai">
          <Box sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{r.renter_name}</Box>
          {r.renter_phone ? (
            <Box sx={{ color: C.plate, fontSize: '0.8rem' }}>{r.renter_phone}</Box>
          ) : null}
        </Field>
        <Field label="Waktu Mulai">
          <Box sx={{ fontFamily: 'monospace', fontSize: '0.86rem', color: C.label }}>
            {formatDateTimeId(r.start_date, r.start_time)}
          </Box>
        </Field>
        <Field label="DP">
          <Box
            sx={{
              fontFamily: 'monospace',
              fontWeight: dp > 0 ? 700 : 400,
              color: dp > 0 ? C.dp : C.muted,
            }}
          >
            {dp > 0 ? formatIdr(dp) : '—'}
          </Box>
        </Field>
        <Field label="Tagihan Berjalan">
          {!bd ? (
            <Box sx={{ color: C.muted }}>—</Box>
          ) : (
            <Box sx={{ fontFamily: 'monospace', lineHeight: 1.6 }}>
              <Box sx={{ fontWeight: 700 }}>{formatIdr(gross)}</Box>
              {hasOt ? (
                <Box sx={{ color: C.ot, fontSize: '0.8rem' }}>
                  {bd.overtimeHours}j OT x {formatIdrPlain(overtimeRate)} = {formatIdr(bd.overtimeCost)}
                </Box>
              ) : null}
              <Box sx={{ color: C.due, fontWeight: 700 }}>Sisa : {formatIdr(sisa)}</Box>
            </Box>
          )}
        </Field>
      </Box>
    </Box>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          color: C.dim,
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}
