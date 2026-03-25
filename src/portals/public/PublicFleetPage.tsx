import { useCallback, useEffect, useMemo, useState } from 'react'
import { useV2RealtimeRefresh } from '../../hooks/useV2RealtimeRefresh'
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Toolbar,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { CarRow } from '../../types/car'
import type { RentalRow } from '../../types/rental'

type FleetCar = CarRow & {
  activeRental: Pick<RentalRow, 'end_date' | 'duration_days'> | null
}

export function PublicFleetPage() {
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
      .select('car_id, end_date, duration_days, status')
      .eq('status', 'active')

    if (rentalError) {
      setError(rentalError.message)
      setLoading(false)
      return
    }

    const byCar = new Map<string, Pick<RentalRow, 'end_date' | 'duration_days'>>()
    for (const r of rentalData ?? []) {
      byCar.set(r.car_id, { end_date: r.end_date, duration_days: r.duration_days })
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
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
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
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
            {cars.map((car) => (
              <Card key={car.id} variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {car.photo_url ? (
                  <CardMedia
                    component="img"
                    height="160"
                    image={car.photo_url}
                    alt=""
                    sx={{ objectFit: 'cover', flexShrink: 0, height: { xs: 160, sm: 180 } }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: { xs: 160, sm: 180 },
                      flexShrink: 0,
                      bgcolor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography color="text.secondary">No photo</Typography>
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1, pt: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="h6" component="h2" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {car.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {car.plate}
                  </Typography>
                  <Chip
                    size="small"
                    label={car.status === 'rented' ? 'Rented' : 'Available'}
                    color={car.status === 'rented' ? 'warning' : 'success'}
                    sx={{ mb: 1 }}
                  />
                  {car.status === 'rented' && car.activeRental ? (
                    <Box>
                      <Typography variant="body2">
                        Return: {car.activeRental.end_date ?? 'TBD'}
                      </Typography>
                      {car.activeRental.duration_days != null ? (
                        <Typography variant="body2" color="text.secondary">
                          Duration: {car.activeRental.duration_days} days
                        </Typography>
                      ) : null}
                    </Box>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Container>
    </Box>
  )
}
