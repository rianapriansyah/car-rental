import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
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
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DangerZone } from '../../../components/DangerZone'
import { formatIdr } from '../../../lib/formatIdr'
import { SERVICE_TYPE_LABELS } from '../../../constants/serviceTypes'
import type { CarServiceRow, ServiceCategory } from '../../../types/service'

function categoryLabel(category: ServiceCategory): string {
  return category === 'component_replacement' ? 'Component Replacement' : 'Routine Maintenance'
}

function formatDateId(ymd: string | null): string {
  if (!ymd) return '—'
  return dayjs(ymd).locale('id').format('dddd, DD-MM-YYYY')
}

type Props = {
  open: boolean
  service: CarServiceRow | null
  onClose: () => void
  /**
   * Called after the service has been successfully deleted.
   * The parent is responsible for refreshing the list.
   */
  onDeleted: () => void
  /**
   * Persist the delete. Should resolve to null on success,
   * or an error message string on failure.
   */
  onDelete: () => Promise<string | null>
}

export function ServiceDetailDialog({ open, service, onClose, onDeleted, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setConfirmOpen(false)
      setDeleting(false)
      setError(null)
    }
  }, [open])

  const requestClose = () => {
    if (deleting) return
    onClose()
  }

  async function handleDeleteConfirmed() {
    setDeleting(true)
    const errMsg = await onDelete()
    setDeleting(false)
    if (errMsg) {
      setError(errMsg)
      setConfirmOpen(false)
      return
    }
    setConfirmOpen(false)
    onDeleted()
    onClose()
  }

  const svc = service

  return (
    <>
      <Dialog open={open} onClose={requestClose} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle>Detail Service</DialogTitle>
        <DialogContent dividers>
          {!svc ? (
            <Typography color="text.secondary">Tidak ada data.</Typography>
          ) : (
            <>
              {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              ) : null}
              <Divider sx={{ mb: 2 }} />
              <DetailField label="Tanggal" value={formatDateId(svc.service_date)} />
              <DetailField label="Kategori" value={categoryLabel(svc.category as ServiceCategory)} />
              <DetailField
                label="Tipe service"
                value={SERVICE_TYPE_LABELS[svc.service_type as keyof typeof SERVICE_TYPE_LABELS] ?? svc.service_type}
              />
              {svc.description ? <DetailField label="Deskripsi" value={svc.description} /> : null}
              <DetailField label="Next due date" value={formatDateId(svc.next_due_date)} />
              <DetailField
                label="Service KM"
                value={svc.service_mileage != null ? svc.service_mileage.toLocaleString('id-ID') + ' km' : '—'}
              />
              <DetailField
                label="Next due KM"
                value={svc.next_due_mileage != null ? svc.next_due_mileage.toLocaleString('id-ID') + ' km' : '—'}
              />
              <DetailField
                label="Biaya"
                value={svc.cost != null ? formatIdr(Number(svc.cost)) : '—'}
              />
              <DetailField label="Vendor" value={svc.vendor ?? '—'} />
              {svc.notes ? <DetailField label="Catatan" value={svc.notes} /> : null}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={requestClose} disabled={deleting} sx={{ mr: 'auto' }}>
            Tutup
          </Button>
        </DialogActions>
        {svc ? (
          <Box sx={{ px: 3, pb: 3 }}>
            <DangerZone
              title="Hapus log service"
              description="Menghapus log service juga menghapus transaksi pengeluaran yang terhubung. Tindakan ini tidak dapat dibatalkan."
              actionLabel="Hapus service ini"
              busy={deleting}
              busyLabel="Menghapus…"
              disabled={deleting}
              onAction={() => setConfirmOpen(true)}
            />
          </Box>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title="Hapus log service?"
        description={`Hapus log service "${svc ? (SERVICE_TYPE_LABELS[svc.service_type as keyof typeof SERVICE_TYPE_LABELS] ?? svc.service_type) : ''}" pada ${svc ? formatDateId(svc.service_date) : ''}? Transaksi pengeluaran terkait juga akan dihapus.`}
        confirmLabel={deleting ? 'Menghapus…' : 'Hapus'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleDeleteConfirmed()}
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
