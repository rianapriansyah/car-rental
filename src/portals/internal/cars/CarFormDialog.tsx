import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'
import type { PartnerRow } from '../../../types/partner'
import type { CarWithPartner } from '../../../types/car'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { DangerZone } from '../../../components/DangerZone'

type Props = {
  open: boolean
  initial: CarWithPartner | null
  onClose: () => void
  onSaved: () => void
}

export function CarFormDialog({ open, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [ownershipType, setOwnershipType] = useState<'rental' | 'partner'>('rental')
  const [partnerId, setPartnerId] = useState<string>('')
  const [hasGps, setHasGps] = useState(false)
  const [dailyRate, setDailyRate] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(initial?.name ?? '')
    setPlate(initial?.plate ?? '')
    setOwnershipType((initial?.ownership_type as 'rental' | 'partner') ?? 'rental')
    setPartnerId(initial?.partner_id ?? '')
    setHasGps(initial?.has_gps ?? false)
    setDailyRate(initial?.daily_rate != null ? String(initial.daily_rate) : '')
    setPhotoUrl(initial?.photo_url ?? '')
    setNotes(initial?.notes ?? '')
  }, [open, initial])

  useEffect(() => {
    if (!open) return
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
  }, [open])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  async function handleSave() {
    if (ownershipType === 'partner' && !partnerId) {
      setError('Pilih mitra untuk kendaraan milik mitra.')
      return
    }
    setSaving(true)
    setError(null)
    const dailyRateValue = dailyRate.trim() === '' ? null : Number(dailyRate)
    const payload = {
      name: name.trim(),
      plate: plate.trim(),
      ownership_type: ownershipType,
      partner_id: ownershipType === 'partner' && partnerId ? partnerId : null,
      has_gps: hasGps,
      daily_rate: dailyRateValue != null && Number.isFinite(dailyRateValue) ? dailyRateValue : null,
      photo_url: photoUrl.trim() || null,
      notes: notes.trim() || null,
    }

    if (initial) {
      const { error: uError } = await supabase.from('v2_cars').update(payload).eq('id', initial.id)
      setSaving(false)
      if (uError) {
        setError(uError.message)
        return
      }
    } else {
      const { error: iError } = await supabase.from('v2_cars').insert({
        ...payload,
        status: 'available',
      })
      setSaving(false)
      if (iError) {
        setError(iError.message)
        return
      }
    }
    onSaved()
    onClose()
  }

  async function handleSoftDelete() {
    if (!initial) return
    setSaving(true)
    setError(null)
    const { error: dError } = await supabase
      .from('v2_cars')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id)
    setSaving(false)
    if (dError) {
      setError(dError.message)
      return
    }
    setConfirmDeleteOpen(false)
    onSaved()
    onClose()
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{initial ? 'Ubah kendaraan' : 'Tambah kendaraan'}</DialogTitle>
        <DialogContent>
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
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  {partners.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mb: 1,
              alignItems: 'center',
            }}
          >
            <FormControlLabel
              control={<Switch checked={hasGps} onChange={(_, v) => setHasGps(v)} size="small" />}
              label="GPS"
            />
            <TextField
              size="small"
              label="Tarif harian (IDR)"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Box>
          <TextField
            size="small"
            label="URL Foto"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            size="small"
            label="Catatan"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={handleClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogActions>
        {initial && !initial.deleted_at ? (
          <Box sx={{ px: 3, pb: 2, pt: 2 }}>
            <DangerZone
              title="Zona bahaya"
              description="Kendaraan ini akan ditandai dihapus dan tidak muncul di armada publik maupun portal mitra."
              actionLabel="Hapus kendaraan"
              disabled={saving}
              onAction={() => setConfirmDeleteOpen(true)}
            />
          </Box>
        ) : null}
      </Dialog>
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
