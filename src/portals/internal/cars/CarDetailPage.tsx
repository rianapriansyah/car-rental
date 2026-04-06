import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Breadcrumbs,
  CircularProgress,
  Link,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'
import type { CarWithPartner } from '../../../types/car'
import { CarDetailEditForm } from './CarDetailEditForm'
import { CarServiceTab } from './CarServiceTab'
import { CarStatisticsTab } from './CarStatisticsTab'

export function CarDetailPage() {
  const { carId } = useParams<{ carId: string }>()
  const navigate = useNavigate()
  const [car, setCar] = useState<CarWithPartner | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState(0)

  const load = useCallback(async () => {
    if (!carId) {
      setError('Kendaraan tidak valid.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('*, v2_partners(name)')
      .eq('id', carId)
      .maybeSingle()
    setLoading(false)
    if (qError) {
      setError(qError.message)
      setCar(null)
      return
    }
    if (!data) {
      setError('Kendaraan tidak ditemukan.')
      setCar(null)
      return
    }
    setCar(data as CarWithPartner)
  }, [carId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !car || !carId) {
    return (
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/internal/cars" underline="hover" color="inherit">
            Kendaraan
          </Link>
          <Typography color="text.primary">Detail</Typography>
        </Breadcrumbs>
        <Alert severity="error">{error ?? 'Data tidak tersedia.'}</Alert>
        <Box sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/internal/cars">
            Kembali ke daftar
          </Link>
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/internal/cars" underline="hover" color="inherit">
          Kendaraan
        </Link>
        <Typography color="text.primary">Detail</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 0.5 }}>
        Detail Kendaraan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {car.name} — {car.plate}
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v: number) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          <Tab label="Detail" />
          <Tab label="Statistik" />
          <Tab label="Service" />
        </Tabs>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {tab === 0 ? (
            <CarDetailEditForm
              car={car}
              onSaved={() => void load()}
              onDeleted={() => navigate('/internal/cars')}
            />
          ) : null}
          {tab === 1 ? <CarStatisticsTab carId={carId} /> : null}
          {tab === 2 ? <CarServiceTab carId={carId} /> : null}
        </Box>
      </Paper>
    </Box>
  )
}
