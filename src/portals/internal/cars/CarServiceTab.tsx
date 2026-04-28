import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { formatIdr } from '../../../lib/formatIdr'
import { useCarServices } from '../../../hooks/useCarServices'
import { SERVICE_TYPE_LABELS } from '../../../constants/serviceTypes'
import type { ServiceCategory } from '../../../types/service'
import { LogServiceDialog } from './LogServiceDialog'

function serviceCategoryLabel(category: ServiceCategory): string {
  return category === 'component_replacement' ? 'Component Replacement' : 'Routine Maintenance'
}

type Props = {
  carId: string
}

export function CarServiceTab({ carId }: Props) {
  const { services, reminders, intervalDefaultsByType, loading, error, deleteService, addService, refresh } = useCarServices(carId)
  const [logOpen, setLogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteService(id)
      await refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error ? (
        <Alert severity="error" onClose={() => void refresh()}>
          {error}
        </Alert>
      ) : null}

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
              <Alert key={item.id} severity={item.reminder_level === 'overdue' ? 'error' : 'warning'} variant="outlined">
                {SERVICE_TYPE_LABELS[item.service_type]} — due {item.next_due_date}
              </Alert>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Service History
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLogOpen(true)}>
          Log Service
        </Button>
      </Box>

      {services.length === 0 ? (
        <Typography color="text.secondary">Belum ada riwayat service.</Typography>
      ) : (
        <ResponsiveTableContainer>
          <Table size="small" sx={{ minWidth: 1040 }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Service Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Next Due</TableCell>
                <TableCell align="right">Service km</TableCell>
                <TableCell align="right">Next km</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.service_date}</TableCell>
                  <TableCell>{serviceCategoryLabel(row.category)}</TableCell>
                  <TableCell>{SERVICE_TYPE_LABELS[row.service_type]}</TableCell>
                  <TableCell>{row.description ?? '—'}</TableCell>
                  <TableCell>{row.next_due_date ?? '—'}</TableCell>
                  <TableCell align="right">
                    {row.service_mileage != null ? row.service_mileage.toLocaleString('id-ID') : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {row.next_due_mileage != null ? row.next_due_mileage.toLocaleString('id-ID') : '—'}
                  </TableCell>
                  <TableCell align="right">{row.cost != null ? formatIdr(Number(row.cost)) : '—'}</TableCell>
                  <TableCell>{row.vendor ?? '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => void handleDelete(row.id)}
                      disabled={deletingId === row.id}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      )}

      <LogServiceDialog
        open={logOpen}
        carId={carId}
        addService={addService}
        intervalDefaultsByType={intervalDefaultsByType}
        onClose={() => setLogOpen(false)}
        onSaved={() => void refresh()}
      />
    </Box>
  )
}
