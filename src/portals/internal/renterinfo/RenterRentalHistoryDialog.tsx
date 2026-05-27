import { useEffect, useState } from 'react'
import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/database'

type RentalRow = Tables<'v2_rentals'> & {
  v2_cars: { name: string; plate: string } | null
}

type Props = {
  open: boolean
  renterName: string
  onClose: () => void
}

function formatDateTime(date: string | null, time: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(`${date}T12:00:00`)
  const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const t = time?.trim()
  return t ? `${dateStr}, ${t.slice(0, 5)}` : dateStr
}

function durasiLabel(row: RentalRow): string {
  if (row.status === 'cancelled') return '—'
  if (row.duration_days != null && row.duration_days > 0) return `${row.duration_days} hari`
  if (!row.end_date) return 'Aktif'
  const start = new Date(`${row.start_date}T12:00:00`)
  const end = new Date(`${row.end_date}T12:00:00`)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  return `${days} hari`
}

export function RenterRentalHistoryDialog({ open, renterName, onClose }: Props) {
  const [rentals, setRentals] = useState<RentalRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !renterName) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      setRentals([])
      const { data, error: qErr } = await supabase
        .from('v2_rentals')
        .select('*, v2_cars(name, plate)')
        .eq('renter_name', renterName)
        .order('start_date', { ascending: false })
      if (cancelled) return
      setLoading(false)
      if (qErr) { setError(qErr.message); return }
      setRentals((data ?? []) as RentalRow[])
    })()
    return () => { cancelled = true }
  }, [open, renterName])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        Riwayat sewa —{' '}
        <Typography component="span" fontWeight={700}>{renterName}</Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        {loading ? (
          <CircularProgress size={28} />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : rentals.length === 0 ? (
          <Typography color="text.secondary">Belum ada riwayat sewa.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: 72, color: 'text.secondary', fontSize: '0.75rem' }}>Sewa Ke</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem' }}>Mobil</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 90, color: 'text.secondary', fontSize: '0.75rem' }}>Durasi</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 168, color: 'text.secondary', fontSize: '0.75rem' }}>Waktu Check-In</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rentals.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell align="center" sx={{ color: 'text.secondary' }}>
                      {rentals.length - i}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} lineHeight={1.3}>
                        {r.v2_cars?.name ?? '—'}
                      </Typography>
                      {r.v2_cars?.plate ? (
                        <Typography variant="caption" color="text.secondary">
                          {r.v2_cars.plate}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{durasiLabel(r)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {formatDateTime(r.start_date, r.start_time)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  )
}
