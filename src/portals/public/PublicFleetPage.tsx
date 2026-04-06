import { useCallback, useEffect, useMemo, useState } from 'react'
import { useV2RealtimeRefresh } from '../../hooks/useV2RealtimeRefresh'
import {
  AppBar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Toolbar,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCarStatusChipProps } from '../../lib/statusChips'
import { formatIdr } from '../../lib/formatIdr'
import type { CarRow } from '../../types/car'
import type { RentalRow } from '../../types/rental'

type FleetCar = CarRow & {
  activeRental: Pick<RentalRow, 'start_date' | 'start_time' | 'end_date' | 'duration_days'> | null
}

function isMissingPhotoSource(src: string | null): boolean {
  if (!src || !src.trim()) return true
  const value = src.toLowerCase()
  return (
    value.includes('no-photo') ||
    value.includes('nophoto') ||
    value.includes('placeholder') ||
    value.includes('default')
  )
}

function FleetCardImage({ src, alt }: { src: string | null; alt: string }) {
  const [hasError, setHasError] = useState(false)
  const canShowImage = Boolean(!isMissingPhotoSource(src) && !hasError)

  if (canShowImage) {
    return (
      <Box
        component="img"
        src={src as string}
        alt={alt}
        onError={() => setHasError(true)}
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', bgcolor: 'grey.200' }}
      />
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography sx={{ color: '#1f2937', fontWeight: 700, letterSpacing: 0.2 }}>
        No photo
      </Typography>
    </Box>
  )
}

function parseYmdHm(dateStr: string, timeStr: string | null): Date | null {
  const [yRaw, mRaw, dRaw] = dateStr.split('-')
  const year = Number(yRaw)
  const month = Number(mRaw)
  const day = Number(dRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  const [hRaw = '0', minRaw = '0'] = (timeStr ?? '00:00').split(':')
  const hour = Number(hRaw)
  const minute = Number(minRaw)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function formatYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** e.g. 2026-04-03 → "03 April 2026" */
function formatPublicReturnDate(ymd: string): string {
  const [yRaw, mRaw, dRaw] = ymd.split('-')
  const year = Number(yRaw)
  const month = Number(mRaw)
  const day = Number(dRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return ymd
  const monthName = MONTH_NAMES_EN[month - 1]
  if (!monthName) return ymd
  return `${String(day).padStart(2, '0')} ${monthName} ${year}`
}

function formatHm(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function getVirtualEndFromStart(rental: FleetCar['activeRental']): Date | null {
  if (!rental?.start_date || rental.duration_days == null) return null
  const start = parseYmdHm(rental.start_date, rental.start_time)
  if (!start) return null
  const end = new Date(start)
  end.setDate(end.getDate() + rental.duration_days)
  return end
}

function getRentalDisplay(rental: FleetCar['activeRental']): { returnDateLabel: string; etaLabel: string; durationLabel: string } {
  if (!rental) {
    return {
      returnDateLabel: 'TBD',
      etaLabel: '-',
      durationLabel: '-',
    }
  }

  const virtualEnd = getVirtualEndFromStart(rental)
  const returnYmd = rental.end_date ?? (virtualEnd ? formatYmd(virtualEnd) : null)
  return {
    returnDateLabel: returnYmd ? formatPublicReturnDate(returnYmd) : 'TBD',
    etaLabel: virtualEnd ? formatHm(virtualEnd) : '-',
    durationLabel: rental.duration_days != null ? `${rental.duration_days} hari` : '-',
  }
}

export function PublicFleetPage() {
  const cardMediaHeight = { xs: 320, sm: 320, md: 320 }
  const navigate = useNavigate()
  const [cars, setCars] = useState<FleetCar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFleet = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: carData, error: carError } = await supabase
      .from('v2_cars')
      .select('*')
      .is('deleted_at', null)
      .order('name')

    if (carError) {
      setError(carError.message)
      setLoading(false)
      return
    }

    const { data: rentalData, error: rentalError } = await supabase
      .from('v2_rentals')
      .select('car_id, start_date, start_time, end_date, duration_days, status')
      .eq('status', 'active')

    if (rentalError) {
      setError(rentalError.message)
      setLoading(false)
      return
    }

    const byCar = new Map<string, Pick<RentalRow, 'start_date' | 'start_time' | 'end_date' | 'duration_days'>>()
    for (const r of rentalData ?? []) {
      byCar.set(r.car_id, {
        start_date: r.start_date,
        start_time: r.start_time,
        end_date: r.end_date,
        duration_days: r.duration_days,
      })
    }

    const merged: FleetCar[] = (carData ?? []).map((c) => ({
      ...c,
      activeRental: byCar.get(c.id) ?? null,
    }))

    setCars(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchFleet()
  }, [fetchFleet])

  useV2RealtimeRefresh('v2_cars,v2_rentals', fetchFleet)

  const subtitle = useMemo(
    () => 'Live fleet status — updates automatically when rentals change.',
    [],
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ flexWrap: 'wrap', gap: 1, py: { xs: 1, sm: 0 }, minHeight: { xs: 56, sm: 64 } }}>
          <Typography variant="h6" sx={{ flexGrow: 1, minWidth: '40%', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Public fleet
          </Typography>
          <Button variant="outlined" size="small" onClick={() => navigate('/login')}>
            Masuk
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
          Available cars
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, sm: 3 } }}>
          {subtitle}
        </Typography>
        {error ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        ) : null}
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : cars.length === 0 ? (
          <Typography color="text.secondary">No cars to display.</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, sm: 2, md: 2.5 },
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {cars.map((car) => {
              const rentalDisplay = getRentalDisplay(car.activeRental)
              const imageItems = [{ img: car.photo_url, title: car.name, subtitle: car.plate }]
              const statusChip = getCarStatusChipProps(car.status, 'en')

              return (
                <Card key={car.id} variant="outlined" sx={{ height: '100%', overflow: 'hidden' }}>
                  <ImageList cols={1} gap={0} sx={{ m: 0, width: '100%', height: cardMediaHeight }}>
                    {imageItems.map((item) => (
                      <ImageListItem key={item.img ?? `${car.id}-no-photo`} sx={{ height: '100% !important', overflow: 'hidden', position: 'relative' }}>
                        <FleetCardImage src={item.img} alt={item.title} />
                        <ImageListItemBar
                          title={item.title}
                          subtitle={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography component="div" variant="caption" sx={{ color: 'inherit', display: 'block' }}>
                                {item.subtitle}
                              </Typography>
                              <Box
                                sx={{
                                  mt: 0.5,
                                  mb: 0.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.75,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Chip
                                  label={statusChip.label}
                                  color={statusChip.color}
                                  size="small"
                                  sx={{ height: 20, '& .MuiChip-label': { px: 1, fontSize: '0.7rem', fontWeight: 700 } }}
                                />
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{ color: 'inherit', fontWeight: 700, lineHeight: 1.2 }}
                                >
                                  {car.daily_rate != null ? `${formatIdr(Number(car.daily_rate))}/hari` : '—'}
                                </Typography>
                              </Box>
                              {car.status === 'rented' && car.activeRental ? (
                                <>
                                  <Typography component="div" variant="caption" sx={{ color: 'inherit', display: 'block' }}>
                                    Perkiraan kembali: {rentalDisplay.returnDateLabel} ETA {rentalDisplay.etaLabel}
                                  </Typography>
                                  <Typography component="div" variant="caption" sx={{ color: 'inherit', display: 'block' }}>
                                    Durasi: {rentalDisplay.durationLabel}
                                  </Typography>
                                </>
                              ) : null}
                            </Box>
                          }
                          sx={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0) 100%)',
                            '& .MuiImageListItemBar-title': { fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 },
                            '& .MuiImageListItemBar-subtitle': { lineHeight: 1.2 },
                          }}
                        />
                      </ImageListItem>
                    ))}
                  </ImageList>
                </Card>
              )
            })}
          </Box>
        )}
      </Container>
    </Box>
  )
}
