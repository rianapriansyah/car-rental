import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { V2OrderStatusChip } from '../../../components/V2OrderStatusChip'
import { supabase } from '../../../lib/supabase'
import { formatIdr } from '../../../lib/formatIdr'
import { fetchV2StatusesByType, type V2StatusRow } from '../../../lib/v2StatusHelpers'
import type { Tables } from '../../../types/database'

export type OrderDetail = Tables<'v2_orders'> & {
  v2_cars: { name: string; plate: string } | null
}

type Props = {
  open: boolean
  orderId: string | null
  onClose: () => void
  /** After cancel or any update that should refresh the list */
  onOrderUpdated?: () => void
  onActivated?: (rentalId: string) => void
}

function todayYmd(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function OrderDetailDialog({
  open,
  orderId,
  onClose,
  onOrderUpdated,
  onActivated,
}: Props) {
  const [row, setRow] = useState<OrderDetail | null>(null)
  const [statusMap, setStatusMap] = useState<Map<string, V2StatusRow>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    const [{ data, error: qError }, map] = await Promise.all([
      supabase.from('v2_orders').select('*, v2_cars(name, plate)').eq('id', orderId).maybeSingle(),
      fetchV2StatusesByType('order').catch(() => new Map<string, V2StatusRow>()),
    ])
    setStatusMap(map)
    setLoading(false)
    if (qError) {
      setError(qError.message)
      setRow(null)
      return
    }
    setRow((data ?? null) as OrderDetail | null)
  }, [orderId])

  useEffect(() => {
    if (!open || !orderId) {
      setRow(null)
      setError(null)
      setCancelOpen(false)
      setCancelReason('')
      return
    }
    void load()
  }, [open, orderId, load])

  const handleClose = () => {
    if (busy) return
    onClose()
  }

  const canCancel = row?.status === 'confirmed'
  const canActivate = row?.status === 'confirmed' && row.start_date <= todayYmd()

  async function handleCancel() {
    if (!orderId || !row) return
    const reason = cancelReason.trim()
    if (!reason) {
      setError('Alasan pembatalan wajib diisi.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: uErr } = await supabase
      .from('v2_orders')
      .update({
        status: 'cancelled',
        cancel_reason: reason,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    setBusy(false)
    if (uErr) {
      setError(uErr.message)
      return
    }
    setCancelOpen(false)
    setCancelReason('')
    await load()
    onOrderUpdated?.()
  }

  async function handleActivate() {
    if (!orderId) return
    setBusy(true)
    setError(null)
    const { data: rentalId, error: rpcErr } = await supabase.rpc('activate_order', { p_order_id: orderId })
    setBusy(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    const rid = rentalId as string | null
    if (!rid) {
      setError('RPC tidak mengembalikan id sewa.')
      return
    }
    onOrderUpdated?.()
    onClose()
    onActivated?.(rid)
  }

  const carLabel = row?.v2_cars ? `${row.v2_cars.name} (${row.v2_cars.plate})` : '—'

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle>Detail pesanan</DialogTitle>
        <DialogContent>
          {loading ? (
            <Typography color="text.secondary" sx={{ py: 1 }}>
              Memuat…
            </Typography>
          ) : !row ? (
            error ? (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            ) : (
              <Typography color="text.secondary">Pesanan tidak ditemukan.</Typography>
            )
          ) : (
            <>
              {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              ) : null}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <V2OrderStatusChip statusId={row.status} statusMap={statusMap} />
              </Box>
              <Divider sx={{ my: 2 }} />
              <DetailField label="Kendaraan" value={carLabel} />
              <DetailField label="Nama penyewa" value={row.renter_name} />
              <DetailField label="Telepon" value={row.renter_phone ?? '—'} />
              <DetailField label="Mulai" value={row.start_date} />
              <DetailField label="Selesai" value={row.end_date} />
              <DetailField label="Durasi (hari)" value={row.duration_days != null ? String(row.duration_days) : '—'} />
              <DetailField
                label="Perkiraan pendapatan"
                value={row.estimated_income != null ? formatIdr(Number(row.estimated_income)) : '—'}
              />
              <DetailField
                label="Deposit"
                value={row.deposit_amount != null ? formatIdr(Number(row.deposit_amount)) : '—'}
              />
              <DetailField label="Deposit lunas" value={row.deposit_paid ? 'Ya' : 'Tidak'} />
              <DetailField label="Catatan" value={row.notes ?? '—'} />
              {row.cancel_reason ? <DetailField label="Alasan batal" value={row.cancel_reason} /> : null}
              {row.cancelled_at ? <DetailField label="Dibatalkan pada" value={row.cancelled_at} /> : null}
              {row.rental_id ? <DetailField label="Id sewa terkait" value={row.rental_id} /> : null}
              <DetailField label="Dibuat" value={row.created_at ?? '—'} />
              <DetailField label="Diperbarui" value={row.updated_at ?? '—'} />
            </>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'space-between',
          }}
        >
          <Button onClick={handleClose} disabled={busy}>
            Tutup
          </Button>
          {row && !loading ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
              {canCancel ? (
                <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)} disabled={busy}>
                  Batalkan pesanan
                </Button>
              ) : null}
              {canActivate ? (
                <Button variant="contained" onClick={() => void handleActivate()} disabled={busy}>
                  Aktifkan menjadi sewa
                </Button>
              ) : null}
            </Box>
          ) : (
            <span />
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => {
          if (!busy) setCancelOpen(false)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Batalkan pesanan</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Alasan pembatalan"
            fullWidth
            multiline
            minRows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelOpen(false)} disabled={busy}>
            Tutup
          </Button>
          <Button variant="contained" color="error" onClick={() => void handleCancel()} disabled={busy}>
            Simpan pembatalan
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  )
}
