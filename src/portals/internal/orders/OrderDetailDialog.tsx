import { useCallback, useEffect, useState } from 'react'
import SendIcon from '@mui/icons-material/Send'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { V2OrderStatusChip } from '../../../components/V2OrderStatusChip'
import { fetchAdminNumberDisplay, fetchCompanyDisplayName } from '../../../lib/ledgerPdf'
import { supabase } from '../../../lib/supabase'
import { formatIdr } from '../../../lib/formatIdr'
import { buildWhatsAppMeUrlWithMessage } from '../../../lib/whatsappLink'
import { fetchV2StatusesByType, type V2StatusRow } from '../../../lib/v2StatusHelpers'
import type { Tables } from '../../../types/database'
import { generateOrderConfirmationPdf } from './orderConfirmationPdf'
import { buildOrderConfirmationWhatsAppMessage } from './orderConfirmationWhatsapp'
import { OrderCancelDialog } from './OrderCancelDialog'

export type OrderDetail = Tables<'v2_orders'> & {
  v2_cars: { name: string; plate: string; daily_rate: number | null } | null
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
  const [busy, setBusy] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [adminNumber, setAdminNumber] = useState('')

  useEffect(() => {
    if (!open) return
    void fetchCompanyDisplayName(supabase).then(setCompanyName)
    void fetchAdminNumberDisplay(supabase).then(setAdminNumber)
  }, [open])

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    const [{ data, error: qError }, map] = await Promise.all([
      supabase.from('v2_orders').select('*, v2_cars(name, plate, daily_rate)').eq('id', orderId).maybeSingle(),
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
  const canSendProof = row?.status === 'confirmed'

  function handleKirimBuktiPesanan() {
    if (!row) return
    generateOrderConfirmationPdf(row, companyName, adminNumber)
    if (row.renter_phone) {
      const msg = buildOrderConfirmationWhatsAppMessage(row)
      const waUrl = buildWhatsAppMeUrlWithMessage(row.renter_phone, msg)
      if (waUrl) window.open(waUrl, '_blank', 'noopener,noreferrer')
    }
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
        <DialogContent dividers>
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
                {canSendProof ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={handleKirimBuktiPesanan}
                    sx={{ ml: 'auto' }}
                  >
                    Kirim Bukti Pesanan
                  </Button>
                ) : null}
              </Box>
              <Divider sx={{ my: 2 }} />
              <DetailField label="Kendaraan" value={carLabel} />
              <DetailField label="Nama penyewa" value={row.renter_name} />
              <DetailField label="Telepon" value={row.renter_phone ?? '—'} />
              <DetailField label="Mulai" value={row.start_date} />
              <DetailField label="Jam mulai" value={row.start_time ?? '—'} />
              <DetailField label="Selesai" value={row.end_date ?? '—'} />
              <DetailField label="Durasi (hari)" value={row.duration_days != null ? String(row.duration_days) : '—'} />
              <DetailField
                label="Referensi tarif"
                value={
                  row.v2_cars?.daily_rate == null
                    ? '—'
                    : row.duration_days != null
                      ? `${formatIdr(Number(row.v2_cars.daily_rate) * row.duration_days)} (${row.duration_days} hari × ${formatIdr(Number(row.v2_cars.daily_rate))})`
                      : `${formatIdr(Number(row.v2_cars.daily_rate))} / hari`
                }
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
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={busy} sx={{ mr: 'auto' }}>
            Tutup
          </Button>
          {row && !loading ? (
            <>
              {canCancel ? (
                <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)} disabled={busy}>
                  Pembatalan
                </Button>
              ) : null}
              {canActivate ? (
                <Button variant="contained" onClick={() => void handleActivate()} disabled={busy}>
                  Aktifkan
                </Button>
              ) : null}
            </>
          ) : null}
        </DialogActions>
      </Dialog>

      <OrderCancelDialog
        open={cancelOpen}
        orderId={orderId}
        onClose={() => setCancelOpen(false)}
        onCancelled={async () => {
          await load()
          onOrderUpdated?.()
        }}
        onError={setError}
      />
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
