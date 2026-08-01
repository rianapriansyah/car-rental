import { useEffect, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/id'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { SERVICE_TYPE_LABELS, SERVICE_TYPES_BY_CATEGORY } from '../../../constants/serviceTypes'
import type { ServiceCategory, ServiceIntervalDefaultRow, ServiceType } from '../../../types/service'
import type { TablesInsert } from '../../../types/database'

function addMonthsYmd(ymd: string, months: number): string {
  return dayjs(ymd).add(months, 'month').format('YYYY-MM-DD')
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

type Props = {
  open: boolean
  carId: string
  addService: (payload: TablesInsert<'v2_car_services'>) => Promise<unknown>
  intervalDefaultsByType: Map<string, ServiceIntervalDefaultRow>
  onClose: () => void
  onSaved: () => void
}

export function LogServiceDialog({ open, carId, addService, intervalDefaultsByType, onClose, onSaved }: Props) {
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
  const [nextDueMileageTouched, setNextDueMileageTouched] = useState(false)
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
    setNextDueMileageTouched(false)
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

  useEffect(() => {
    if (nextDueMileageTouched) return
    const sm = parseOptionalKm(serviceMileage)
    const defaultRow = intervalDefaultsByType.get(serviceType)
    if (sm.invalid || sm.value == null || !defaultRow?.default_interval_km) {
      setNextDueMileage('')
      return
    }
    setNextDueMileage(String(sm.value + defaultRow.default_interval_km))
  }, [intervalDefaultsByType, nextDueMileageTouched, serviceMileage, serviceType])

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
      <DialogContent dividers>
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
                setNextDueMileageTouched(false)
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

          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="id">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <DatePicker
                label="Service Date"
                value={serviceDate}
                onChange={setServiceDate}
                format="dddd, DD-MM-YYYY"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              <DatePicker
                label="Next Due Date (optional)"
                value={nextDueDate}
                onChange={(value) => {
                  setNextDueDate(value)
                  setNextDueTouched(true)
                }}
                format="dddd, DD-MM-YYYY"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>
          </LocalizationProvider>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              size="small"
              label="Service mileage (km)"
              value={serviceMileage ? serviceMileage.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
              onChange={(e) => setServiceMileage(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              fullWidth
              slotProps={{ input: { startAdornment: <InputAdornment position="start">KM</InputAdornment> } }}
              helperText="Odometer saat service (opsional)."
            />
            <TextField
              size="small"
              label="Next due mileage (km, optional)"
              value={nextDueMileage ? nextDueMileage.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
              onChange={(e) => {
                setNextDueMileage(e.target.value.replace(/\D/g, ''))
                setNextDueMileageTouched(true)
              }}
              inputMode="numeric"
              fullWidth
              slotProps={{ input: { startAdornment: <InputAdornment position="start">KM</InputAdornment> } }}
              helperText="Target KM untuk service berikutnya."
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              size="small"
              label="Cost (optional)"
              value={cost ? cost.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
              onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">Rp</InputAdornment> } }}
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
