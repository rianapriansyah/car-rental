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
  TextField,
  Typography,
} from '@mui/material'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { supabase } from '../../../lib/supabase'
import type { TransactionRow } from '../../../types/transaction'
import { formatIdr } from '../../../lib/formatIdr'
import { ManualTransactionDialog } from './ManualTransactionDialog'

type CarOption = { id: string; name: string }

export function TransactionsPage() {
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState<string>('')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
    if (qError) {
      setError(qError.message)
      return
    }
    setCars(data ?? [])
    setCarId((prev) => prev || (data?.[0]?.id ?? ''))
  }, [])

  const loadTx = useCallback(async () => {
    if (!carId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    const start = `${month}-01T00:00:00.000Z`
    const [y, m] = month.split('-').map(Number)
    const next = new Date(y, m, 1)
    const end = next.toISOString()

    const { data, error: qError } = await supabase
      .from('v2_transactions')
      .select('*')
      .eq('car_id', carId)
      .gte('recorded_at', start)
      .lt('recorded_at', end)
      .order('recorded_at', { ascending: true })

    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows(data ?? [])
  }, [carId, month])

  useEffect(() => {
    void loadCars()
  }, [loadCars])

  useEffect(() => {
    void loadTx()
  }, [loadTx])

  const { balance, running } = useMemo(() => {
    let b = 0
    const r: number[] = []
    for (const t of rows) {
      const delta = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
      b += delta
      r.push(b)
    }
    return { balance: b, running: r }
  }, [rows])

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        Transactions
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
        <FormControl sx={{ minWidth: 220, width: { xs: '100%', sm: 220 } }} size="small">
          <InputLabel id="car-tx">Car</InputLabel>
          <Select labelId="car-tx" label="Car" value={carId} onChange={(e) => setCarId(e.target.value)}>
            {cars.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          type="month"
          label="Month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          size="small"
          sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 } }}
        />
        <Button
          variant="contained"
          disabled={!carId}
          fullWidth
          sx={{ maxWidth: { xs: '100%', sm: 200 } }}
          onClick={() => setDialogOpen(true)}
        >
          Add entry
        </Button>
      </Box>
      <Typography variant="subtitle1" gutterBottom sx={{ wordBreak: 'break-word' }}>
        Running balance (month scope): {formatIdr(balance)}
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!carId ? (
        <Typography color="text.secondary">Select a car to view the ledger.</Typography>
      ) : loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">No transactions in this month.</Typography>
      ) : (
        <ResponsiveTableContainer>
          <Table size="small" sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Running</TableCell>
                <TableCell>Auto fee</TableCell>
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t, i) => (
                <TableRow key={t.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {t.recorded_at ? new Date(t.recorded_at).toLocaleString('id-ID') : '—'}
                  </TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell align="right">{formatIdr(Number(t.amount))}</TableCell>
                  <TableCell align="right">{formatIdr(running[i] ?? 0)}</TableCell>
                  <TableCell>
                    {t.auto_fee ? <Chip size="small" label="Auto" color="secondary" /> : null}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200, wordBreak: 'break-word' }}>{t.manual_note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      )}
      {carId ? (
        <ManualTransactionDialog
          open={dialogOpen}
          carId={carId}
          onClose={() => setDialogOpen(false)}
          onSaved={() => void loadTx()}
        />
      ) : null}
    </Box>
  )
}
