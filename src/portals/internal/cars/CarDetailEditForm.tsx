import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { supabase } from '../../../lib/supabase'
import type { PartnerRow } from '../../../types/partner'
import type { CarWithPartner } from '../../../types/car'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { DangerZone } from '../../../components/DangerZone'

type Props = {
  car: CarWithPartner | null
  onSaved: () => void
  /** Batal (create dialog only). */
  onCancel?: () => void
  /** After soft-delete succeeds (detail page navigates away). */
  onDeleted?: () => void
}

export function CarDetailEditForm({
  car,
  onSaved,
  onCancel,
  onDeleted,
}: Props) {
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [ownershipType, setOwnershipType] = useState<'rental' | 'partner'>('rental')
  const [partnerId, setPartnerId] = useState<string>('')
  const [hasGps, setHasGps] = useState(false)
  const [dailyRate, setDailyRate] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState('')
  const [fleetActive, setFleetActive] = useState(true)
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const hasPartnerOption = partners.some((p) => p.id === partnerId)
  const partnerSelectValue = hasPartnerOption ? partnerId : ''

  useEffect(() => {
    setError(null)
    setName(car?.name ?? '')
    setPlate(car?.plate ?? '')
    setOwnershipType((car?.ownership_type as 'rental' | 'partner') ?? 'rental')
    setPartnerId(car?.partner_id ?? '')
    setHasGps(car?.has_gps ?? false)
    setDailyRate(car?.daily_rate != null ? String(car.daily_rate) : '')
    setPhotoFile(null)
    setPhotoPreview('')
    setNotes(car?.notes ?? '')
    setFleetActive(car ? car.status !== 'inactive' : true)
  }, [car])

  useEffect(() => {
    void supabase
      .from('v2_partners')
      .select('*')
      .eq('verified', true)
      .order('name')
      .then(({ data, error: qError }) => {
        if (qError) {
          setError(qError.message)
          return
        }
        setPartners(data ?? [])
      })
  }, [])

  async function handleSave() {
    if (ownershipType === 'partner' && !partnerId) {
      setError('Pilih mitra untuk kendaraan milik mitra.')
      return
    }
    setSaving(true)
    setError(null)
    const dailyRateValue = dailyRate.trim() === '' ? null : Number(dailyRate)
    let nextPhotoUrl: string | null = car?.photo_url ?? null
    if (photoFile) {
      setUploading(true)
      const ext = photoFile.name.includes('.') ? photoFile.name.split('.').pop()?.toLowerCase() : null
      const path = `vehicles/${Date.now()}.${ext || 'jpg'}`
      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(path, photoFile, { upsert: true })
      if (uploadError) {
        setUploading(false)
        setSaving(false)
        setError(uploadError.message)
        return
      }
      const { data } = supabase.storage.from('vehicle-photos').getPublicUrl(path)
      nextPhotoUrl = data.publicUrl
      setUploading(false)
    }
    const nextStatus = !fleetActive
      ? 'inactive'
      : car?.status === 'rented'
        ? 'rented'
        : 'available'

    const payload = {
      name: name.trim(),
      plate: plate.trim(),
      ownership_type: ownershipType,
      partner_id: ownershipType === 'partner' && partnerId ? partnerId : null,
      has_gps: hasGps,
      daily_rate: dailyRateValue != null && Number.isFinite(dailyRateValue) ? dailyRateValue : null,
      photo_url: photoFile ? nextPhotoUrl : car ? car.photo_url : null,
      notes: notes.trim() || null,
      status: nextStatus,
    }

    if (car) {
      const { error: uError } = await supabase.from('v2_cars').update(payload).eq('id', car.id)
      setSaving(false)
      if (uError) {
        setError(uError.message)
        return
      }
    } else {
      const { error: iError } = await supabase.from('v2_cars').insert(payload)
      setSaving(false)
      if (iError) {
        setError(iError.message)
        return
      }
    }
    onSaved()
  }

  async function handleSoftDelete() {
    if (!car) return
    setSaving(true)
    setError(null)
    const { error: dError } = await supabase
      .from('v2_cars')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', car.id)
    setSaving(false)
    if (dError) {
      setError(dError.message)
      return
    }
    setConfirmDeleteOpen(false)
    if (onDeleted) {
      onDeleted()
    } else {
      onSaved()
    }
  }

  const actionsRow = (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap', mt: 2 }}>
      {onCancel ? (
        <Button onClick={onCancel} disabled={saving}>
          Batal
        </Button>
      ) : null}
      <Button variant="contained" onClick={() => void handleSave()} disabled={saving || uploading}>
        {uploading ? <CircularProgress size={18} color="inherit" /> : saving ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </Box>
  )

  return (
    <>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        <TextField
          size="small"
          label="Nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          size="small"
          label="Plat"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          required
          fullWidth
        />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        <FormControl fullWidth size="small">
          <InputLabel id="own-label">Kepemilikan</InputLabel>
          <Select
            labelId="own-label"
            label="Kepemilikan"
            value={ownershipType}
            onChange={(e) => setOwnershipType(e.target.value as 'rental' | 'partner')}
          >
            <MenuItem value="rental">Rental (perusahaan)</MenuItem>
            <MenuItem value="partner">Mitra</MenuItem>
          </Select>
        </FormControl>
        {ownershipType === 'partner' ? (
          <FormControl fullWidth size="small">
            <InputLabel id="p-label">Mitra</InputLabel>
            <Select
              labelId="p-label"
              label="Mitra"
              value={partnerSelectValue}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <MenuItem value="">
                <em>Pilih mitra</em>
              </MenuItem>
              {partners.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
      </Box>
      <TextField
        size="small"
        label="Tarif harian (IDR)"
        value={dailyRate}
        onChange={(e) => setDailyRate(e.target.value)}
        type="number"
        fullWidth
        sx={{ mb: 2 }}
        slotProps={{ htmlInput: { min: 0 } }}
      />
      <Box sx={{ mb: 2 }}>
        <Button component="label" variant="outlined" fullWidth>
          {photoFile ? photoFile.name : 'Upload Foto'}
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              setPhotoFile(file)
              setPhotoPreview(file ? URL.createObjectURL(file) : '')
            }}
          />
        </Button>
        {photoPreview ? (
          <Box sx={{ position: 'relative', mt: 1 }}>
            <img
              src={photoPreview}
              alt="Preview foto kendaraan"
              style={{
                width: '100%',
                maxHeight: '160px',
                objectFit: 'cover',
                borderRadius: '8px',
              }}
            />
            <IconButton
              size="small"
              onClick={() => {
                setPhotoFile(null)
                setPhotoPreview('')
              }}
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                bgcolor: 'background.paper',
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : null}
      </Box>
      <TextField
        size="small"
        label="Catatan"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        multiline
        minRows={4}
        fullWidth
        sx={{ mb: 2 }}
      />
      <Box sx={{ mb: 1.5 }}>
        <FormControlLabel
          control={
            <Switch checked={fleetActive} onChange={(_, v) => setFleetActive(v)} size="small" color="primary" />
          }
          label="Kendaraan aktif"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: -0.5 }}>
          Nonaktifkan jika kendaraan tidak dipakai operasional (mis. dibawa pemilik).
        </Typography>
      </Box>
      <FormControlLabel
        sx={{ mb: 2, display: 'block' }}
        control={<Switch checked={hasGps} onChange={(_, v) => setHasGps(v)} size="small" />}
        label="GPS"
      />
      {actionsRow}
      {car && !car.deleted_at ? (
        <Box sx={{ mt: 3 }}>
          <DangerZone
            title="Zona bahaya"
            description="Kendaraan ini akan ditandai dihapus dan tidak muncul di armada publik maupun portal mitra."
            actionLabel="Hapus kendaraan"
            disabled={saving}
            onAction={() => setConfirmDeleteOpen(true)}
          />
        </Box>
      ) : null}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Hapus kendaraan?"
        description="Kendaraan ini akan ditandai sebagai dihapus dan tidak muncul di armada publik maupun portal mitra."
        confirmLabel="Hapus"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleSoftDelete()}
      />
    </>
  )
}
