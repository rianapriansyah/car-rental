import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { formatIdr } from '../../../lib/formatIdr'
import { useCarServices } from '../../../hooks/useCarServices'
import { SERVICE_TYPE_LABELS, SERVICE_TYPES_BY_CATEGORY } from '../../../constants/serviceTypes'
import type { ServiceCategory, ServiceType } from '../../../types/service'
import type { TablesInsert } from '../../../types/database'

function addMonthsYmd(ymd: string, months: number): string {
  return dayjs(ymd).add(months, 'month').format('YYYY-MM-DD')
}

function serviceCategoryLabel(category: ServiceCategory): string {
  return category === 'component_replacement' ? 'Component Replacement' : 'Routine Maintenance'
}

function parseOptionalKm(raw: string): { value: number | null; invalid: boolean } {
  const t = raw.trim()
  if (t === '') return { value: null, invalid: false }
  const digits = t.replace(/\D/g, '')
  if (digits === '') return { value: null, invalid: true }
  const n = Math.round(Number(digits))
  if (!Number.isFinite(n) || n < 0) return { value: null, invalid: true }
  return { value: n, invalid: false }
}

type LogServiceDialogProps = {
  open: boolean
  carId: string
  addService: (payload: TablesInsert<'v2_car_services'>) => Promise<unknown>
  intervalDefaultsByType: Map<string, { default_interval_months: number; warning_days: number }>
  onClose: () => void
  onSaved: () => void
}

function LogServiceDialog({ open, carId, addService, intervalDefaultsByType, onClose, onSaved }: LogServiceDialogProps) {
  const [category, setCategory] = useState<ServiceCategory>('component_replacement')
  const [serviceType, setServiceType] = useState<ServiceType>('ban')
  const [description, setDescription] = useState('')
  const [serviceDate, setServiceDate] = useState<Dayjs | null>(dayjs())
  const [nextDueDate, setNextDueDate] = useState<Dayjs | null>(null)
  const [serviceMileage, setServiceMileage] = useState('')
  const [nextDueMileage, setNextDueMileage] = useState('')
  const [cost, setCost] = useState('')
  const [vendor, setVendor] = useState('')
  const [notes, setNotes] = useState('')
  const [nextDueTouched, setNextDueTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoryTypes = SERVICE_TYPES_BY_CATEGORY[category]
  const serviceTypeSelectValue = categoryTypes.includes(serviceType) ? serviceType : ''
  const isOtherType = serviceType === 'part_lainnya' || serviceType === 'perawatan_lainnya'

  useEffect(() => {
    if (!open) return
    setCategory('component_replacement')
    setServiceType('ban')
    setDescription('')
    setServiceDate(dayjs())
    setNextDueDate(null)
    setServiceMileage('')
    setNextDueMileage('')
    setCost('')
    setVendor('')
    setNotes('')
    setNextDueTouched(false)
    setSaving(false)
    setError(null)
  }, [open])

  useEffect(() => {
    if (categoryTypes.includes(serviceType)) return
    setServiceType(categoryTypes[0])
  }, [categoryTypes, serviceType])

  useEffect(() => {
    if (nextDueTouched || !serviceDate) return
    const defaultRow = intervalDefaultsByType.get(serviceType)
    if (!defaultRow) {
      setNextDueDate(null)
      return
    }
    const suggested = addMonthsYmd(serviceDate.format('YYYY-MM-DD'), defaultRow.default_interval_months)
    setNextDueDate(dayjs(suggested))
  }, [intervalDefaultsByType, nextDueTouched, serviceDate, serviceType])

  async function handleSubmit() {
    if (!serviceDate) {
      setError('Tanggal service wajib diisi.')
      return
    }
    if (isOtherType && !description.trim()) {
      setError('Deskripsi wajib diisi untuk tipe lainnya.')
      return
    }
    const sm = parseOptionalKm(serviceMileage)
    const ndm = parseOptionalKm(nextDueMileage)
    if (sm.invalid) {
      setError('Kilometer service tidak valid (masukkan bilangan bulat ≥ 0).')
      return
    }
    if (ndm.invalid) {
      setError('Kilometer jadwal berikutnya tidak valid (masukkan bilangan bulat ≥ 0).')
      return
    }
    setSaving(true)
    setError(null)
    const costValue = cost.trim() === '' ? null : Number(cost)
    try {
      await addService({
        car_id: carId,
        category,
        service_type: serviceType,
        description: description.trim() || null,
        service_date: serviceDate.format('YYYY-MM-DD'),
        next_due_date: nextDueDate ? nextDueDate.format('YYYY-MM-DD') : null,
        service_mileage: sm.value,
        next_due_mileage: ndm.value,
        cost: costValue != null && Number.isFinite(costValue) ? costValue : null,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan service.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Log Service</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              Category
            </Typography>
            <ToggleButtonGroup
              exclusive
              color="primary"
              value={category}
              onChange={(_, value: ServiceCategory | null) => {
                if (value) setCategory(value)
              }}
              size="small"
            >
              <ToggleButton value="component_replacement">Component Replacement</ToggleButton>
              <ToggleButton value="routine_maintenance">Routine Maintenance</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel id="service-type-label">Service Type</InputLabel>
            <Select
              labelId="service-type-label"
              value={serviceTypeSelectValue}
              label="Service Type"
              onChange={(e) => {
                setServiceType(e.target.value as ServiceType)
                setNextDueTouched(false)
              }}
            >
              <MenuItem value="">
                <em>Pilih tipe service</em>
              </MenuItem>
              {categoryTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {SERVICE_TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isOtherType ? (
            <TextField
              size="small"
              label="Description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
            />
          ) : null}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <DatePicker
              label="Service Date"
              value={serviceDate}
              onChange={setServiceDate}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
            <DatePicker
              label="Next Due Date (optional)"
              value={nextDueDate}
              onChange={(value) => {
                setNextDueDate(value)
                setNextDueTouched(true)
              }}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              size="small"
              label="Service mileage (km)"
              value={serviceMileage}
              onChange={(e) => setServiceMileage(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              fullWidth
              helperText="Odometer saat service (opsional)."
            />
            <TextField
              size="small"
              label="Next due mileage (km, optional)"
              value={nextDueMileage}
              onChange={(e) => setNextDueMileage(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              fullWidth
              helperText="Target KM untuk service berikutnya."
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              size="small"
              type="number"
              label="Cost (optional)"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              fullWidth
            />
            <TextField
              size="small"
              label="Vendor (optional)"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              fullWidth
            />
          </Box>

          <TextField
            size="small"
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
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
