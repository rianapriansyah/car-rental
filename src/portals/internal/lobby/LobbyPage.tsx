import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Toolbar,
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
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
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
import { CheckOutPanel } from '../inout/CheckOutPanel'

type ActiveRental = Tables<'v2_rentals'> & {
  v2_cars: Pick<Tables<'v2_cars'>, 'name' | 'plate' | 'daily_rate'> | null
}

export function LobbyPage() {
  const { user, loading: authLoading } = useAuth()
  const theme = useTheme()
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down('sm'))

  const [rentals, setRentals] = useState<ActiveRental[]>([])
  const [companyName, setCompanyName] = useState('')
  const [overtimeRate, setOvertimeRate] = useState(25000)
  const [dailyDriverRate, setDailyDriverRate] = useState(0)
  const [now, setNow] = useState(() => dayjs())
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkOutRental, setCheckOutRental] = useState<ActiveRental | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
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

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="sticky" elevation={2}>
          <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" noWrap sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                Mobil Keluar
              </Typography>
              {companyName ? (
                <Typography variant="caption" noWrap sx={{ display: 'block', opacity: 0.85 }}>
                  {companyName}
                </Typography>
              ) : null}
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography
                sx={{
                  fontFamily: '"Roboto Mono", "Courier New", monospace',
                  fontSize: { xs: '1.1rem', sm: '1.35rem' },
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {clockStr}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {dateStr}
              </Typography>
            </Box>
            <Tooltip title="Dashboard internal">
              <IconButton
                component={Link}
                to="/internal/home"
                color="inherit"
                aria-label="Buka dashboard internal"
                sx={{ flexShrink: 0 }}
              >
                <SpaceDashboardOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 }, maxWidth: '100vw' }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1.5,
              mb: 2,
            }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setCheckInOpen(true)}
            >
              Keluarkan Mobil
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {rentals.length > 0
                ? `${rentals.length} mobil sedang keluar — ketuk baris untuk check out`
                : '0 mobil sedang keluar'}
            </Typography>
          </Box>

          {rentals.length === 0 ? (
            <Typography color="text.secondary">Tidak ada mobil yang sedang keluar.</Typography>
          ) : (
            <ResponsiveTableContainer>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="right" sx={{ width: 48 }}>
                      No
                    </TableCell>
                    <TableCell>Mobil</TableCell>
                    <TableCell>Pemakai</TableCell>
                    <TableCell>Waktu Mulai</TableCell>
                    <TableCell>Berjalan</TableCell>
                    <TableCell align="right">DP</TableCell>
                    <TableCell align="right">Tagihan Berjalan</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rentals.map((r, i) => {
                    const { breakdown: bd, dp, gross, sisa } = calcActiveRentalTotals(
                      r,
                      now,
                      overtimeRate,
                      dailyDriverRate,
                    )
                    const hasOt = (bd?.overtimeHours ?? 0) > 0

                    return (
                      <TableRow
                        key={r.id}
                        hover
                        onClick={() => setCheckOutRental(r)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {i + 1}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {r.v2_cars?.name ?? '—'}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}
                          >
                            {r.v2_cars?.plate ?? '—'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {r.renter_name}
                          </Typography>
                          {r.renter_phone ? (
                            <Typography variant="caption" color="text.secondary">
                              {r.renter_phone}
                            </Typography>
                          ) : null}
                        </TableCell>

                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2">
                            {formatDateTimeId(r.start_date, r.start_time)}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {bd ? (
                            <Chip
                              size="small"
                              color="info"
                              variant="outlined"
                              label={formatElapsedCompact(bd.elapsedHours)}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="body2"
                            fontWeight={dp > 0 ? 700 : 400}
                            color={dp > 0 ? 'warning.main' : 'text.secondary'}
                          >
                            {dp > 0 ? formatIdr(dp) : '—'}
                          </Typography>
                        </TableCell>

                        <TableCell align="right">
                          {!bd ? (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          ) : (
                            <Box>
                              <Typography variant="body2" fontWeight={700}>
                                {formatIdr(gross)}
                              </Typography>
                              {hasOt ? (
                                <Typography variant="caption" color="warning.main" display="block">
                                  {bd.overtimeHours}j OT × {formatIdrPlain(overtimeRate)} ={' '}
                                  {formatIdr(bd.overtimeCost)}
                                </Typography>
                              ) : null}
                              <Divider sx={{ my: 0.5 }} />
                              <Typography variant="body2" fontWeight={700} color="success.main">
                                Sisa : {formatIdr(sisa)}
                              </Typography>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          )}
        </Box>

        <Dialog
          open={checkInOpen}
          onClose={() => setCheckInOpen(false)}
          fullWidth
          maxWidth="sm"
          fullScreen={fullScreenDialog}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
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

        <Dialog
          open={checkOutRental !== null}
          onClose={() => setCheckOutRental(null)}
          fullWidth
          maxWidth="sm"
          fullScreen={fullScreenDialog}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
            <Box component="span" sx={{ flex: 1 }}>
              Check Out — Selesaikan Sewa
            </Box>
            <IconButton aria-label="Tutup" onClick={() => setCheckOutRental(null)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {checkOutRental ? (
              <CheckOutPanel
                refreshTick={refreshTick}
                lockedRentalId={checkOutRental.id}
                onCompleted={() => {
                  setRefreshTick((n) => n + 1)
                  void load()
                }}
                onFinished={(message) => {
                  setCheckOutRental(null)
                  setToast(message)
                  void load()
                }}
                onCancel={() => setCheckOutRental(null)}
              />
            ) : null}
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
