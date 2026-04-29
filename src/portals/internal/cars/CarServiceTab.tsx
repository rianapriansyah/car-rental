import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useCarServices } from '../../../hooks/useCarServices'
import { SERVICE_TYPE_LABELS } from '../../../constants/serviceTypes'
import type { CarServiceRow, ServiceType } from '../../../types/service'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { LogServiceDialog } from './LogServiceDialog'
import { ServiceDetailDialog } from './ServiceDetailDialog'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type Props = {
  carId: string
}

export function CarServiceTab({ carId }: Props) {
  const {
    services,
    reminders,
    intervalDefaultsByType,
    loading,
    error,
    deleteService,
    addService,
    refresh,
  } = useCarServices(carId)

  const [logOpen, setLogOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<CarServiceRow | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const remindersSummary = useMemo(() => {
    if (reminders.length === 0) return { overdue: 0, dueSoon: 0 }
    return reminders.reduce(
      (acc, row) => {
        if (row.reminder_level === 'overdue') acc.overdue += 1
        else acc.dueSoon += 1
        return acc
      },
      { overdue: 0, dueSoon: 0 },
    )
  }, [reminders])

  const handleDelete = useCallback(async (): Promise<string | null> => {
    if (!detailRow) return 'Tidak ada service yang dipilih.'
    try {
      await deleteService(detailRow.id)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Gagal menghapus service.'
    }
  }, [detailRow, deleteService])

  const columns: GridColDef<CarServiceRow>[] = useMemo(
    () => [
      {
        field: 'service_date',
        headerName: 'Date',
        width: 120,
      },
      {
        field: 'service_type',
        headerName: 'Service Type',
        flex: 1,
        minWidth: 160,
        valueGetter: (v) =>
          SERVICE_TYPE_LABELS[v as ServiceType] ?? String(v),
      },
      {
        field: 'service_mileage',
        headerName: 'Service KM',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (v) =>
          v != null ? (v as number).toLocaleString('id-ID') : '—',
      },
      {
        field: 'next_due_mileage',
        headerName: 'Next KM',
        width: 120,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (v) =>
          v != null ? (v as number).toLocaleString('id-ID') : '—',
      },
      {
        field: '_actions',
        headerName: '',
        width: 64,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <DataGridUpdateIconButton
            title="Lihat detail"
            onClick={(e) => {
              e.stopPropagation()
              setDetailRow(params.row)
            }}
          />
        ),
      },
    ],
    [],
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error ? (
        <Alert severity="error" onClose={() => void refresh()}>
          {error}
        </Alert>
      ) : null}

      {/* ── Reminders ─────────────────────────────────────────────────── */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Upcoming / Overdue
        </Typography>
        {loading ? (
          <Typography color="text.secondary">Memuat reminder…</Typography>
        ) : reminders.length === 0 ? (
          <Alert severity="success" variant="outlined">
            All good. Tidak ada service yang overdue / due soon.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {remindersSummary.overdue > 0 ? (
                <Chip color="error" label={`Overdue: ${remindersSummary.overdue}`} size="small" />
              ) : null}
              {remindersSummary.dueSoon > 0 ? (
                <Chip color="warning" label={`Due soon: ${remindersSummary.dueSoon}`} size="small" />
              ) : null}
            </Box>
            {reminders.map((item) => (
              <Alert
                key={item.id}
                severity={item.reminder_level === 'overdue' ? 'error' : 'warning'}
                variant="outlined"
              >
                {SERVICE_TYPE_LABELS[item.service_type]} — due {item.next_due_date}
              </Alert>
            ))}
          </Box>
        )}
      </Box>

      {/* ── Service History ────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Service History
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLogOpen(true)}>
          Log Service
        </Button>
      </Box>

      {services.length === 0 && !loading ? (
        <Typography color="text.secondary">Belum ada riwayat service.</Typography>
      ) : (
        <Paper variant="outlined" sx={{ width: '100%', overflow: 'hidden' }}>
          <DataGrid
            rows={services}
            columns={columns}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            autoHeight
            disableRowSelectionOnClick
            onRowClick={(params) => setDetailRow(params.row as CarServiceRow)}
            sx={{ border: 'none', cursor: 'pointer' }}
          />
        </Paper>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────── */}
      <LogServiceDialog
        open={logOpen}
        carId={carId}
        addService={addService}
        intervalDefaultsByType={intervalDefaultsByType}
        onClose={() => setLogOpen(false)}
        onSaved={() => void refresh()}
      />

      <ServiceDetailDialog
        open={detailRow !== null}
        service={detailRow}
        onClose={() => setDetailRow(null)}
        onDeleted={() => {
          setDetailRow(null)
          void refresh()
        }}
        onDelete={handleDelete}
      />
    </Box>
  )
}
