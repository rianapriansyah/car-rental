import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { supabase } from '../../../lib/supabase'
import type { RentalWithCar } from '../../../types/rental'
import { RentalFormDialog } from './RentalFormDialog'
import { CompleteRentalDialog } from './CompleteRentalDialog'

type CarFilter = { id: string; name: string }

export function RentalsPage() {
  const [rows, setRows] = useState<RentalWithCar[]>([])
  const [cars, setCars] = useState<CarFilter[]>([])
  const [carFilter, setCarFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [completeId, setCompleteId] = useState<string | null>(null)

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
    if (!qError) {
      setCars(data ?? [])
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase.from('v2_rentals').select('*, v2_cars(name, plate)').order('start_date', { ascending: false })
    if (carFilter) {
      q = q.eq('car_id', carFilter)
    }
    if (statusFilter) {
      q = q.eq('status', statusFilter)
    }
    const { data, error: qError } = await q
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as RentalWithCar[])
  }, [carFilter, statusFilter])

  useEffect(() => {
    void loadCars()
  }, [loadCars])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(() => ['active', 'completed', 'cancelled'], [])

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, width: { xs: '100%', sm: 'auto' } }}>
          Rentals
        </Typography>
        <Button variant="contained" fullWidth sx={{ maxWidth: { xs: '100%', sm: 220 } }} onClick={() => setFormOpen(true)}>
          Start rental
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 200, width: { xs: '100%', sm: 200 } }} size="small">
          <InputLabel id="cf">Car</InputLabel>
          <Select
            labelId="cf"
            label="Car"
            value={carFilter}
            onChange={(e) => setCarFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {cars.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 160, width: { xs: '100%', sm: 160 } }} size="small">
          <InputLabel id="sf">Status</InputLabel>
          <Select
            labelId="sf"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {statusOptions.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">No rentals match the filters.</Typography>
      ) : (
        <ResponsiveTableContainer>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Car</TableCell>
                <TableCell>Renter</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Manual</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {r.v2_cars ? `${r.v2_cars.name} (${r.v2_cars.plate})` : '—'}
                  </TableCell>
                  <TableCell>{r.renter_name}</TableCell>
                  <TableCell>{r.start_date}</TableCell>
                  <TableCell>{r.end_date ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status} />
                  </TableCell>
                  <TableCell>{r.is_manual ? 'Yes' : 'No'}</TableCell>
                  <TableCell align="right">
                    {r.status === 'active' ? (
                      <Button size="small" onClick={() => setCompleteId(r.id)}>
                        Complete
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      )}
      <RentalFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => void load()} />
      <CompleteRentalDialog
        open={completeId !== null}
        rentalId={completeId}
        onClose={() => setCompleteId(null)}
        onCompleted={() => void load()}
      />
    </Box>
  )
}
