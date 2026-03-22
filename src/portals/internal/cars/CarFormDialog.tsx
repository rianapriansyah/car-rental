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
    setPhotoUrl(initial?.photo_url ?? '')
    setNotes(initial?.notes ?? '')
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    void supabase
      .from('v2_partners')
      .select('*')
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
      setError('Select a partner for partner-owned cars.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: name.trim(),
      plate: plate.trim(),
      ownership_type: ownershipType,
      partner_id: ownershipType === 'partner' && partnerId ? partnerId : null,
      has_gps: hasGps,
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
        <DialogTitle>{initial ? 'Edit car' : 'Add car'}</DialogTitle>
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
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              size="small"
              label="Plate"
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
              <InputLabel id="own-label">Ownership</InputLabel>
              <Select
                labelId="own-label"
                label="Ownership"
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value as 'rental' | 'partner')}
              >
                <MenuItem value="rental">Rental (company)</MenuItem>
                <MenuItem value="partner">Partner</MenuItem>
              </Select>
            </FormControl>
            {ownershipType === 'partner' ? (
              <FormControl fullWidth size="small">
                <InputLabel id="p-label">Partner</InputLabel>
                <Select
                  labelId="p-label"
                  label="Partner"
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
          <FormControlLabel
            control={<Switch checked={hasGps} onChange={(_, v) => setHasGps(v)} size="small" />}
            label="Has GPS"
            sx={{ mb: 1 }}
          />
          <TextField
            size="small"
            label="Photo URL"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            size="small"
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <span>
            {initial && !initial.deleted_at ? (
              <Button color="error" onClick={() => setConfirmDeleteOpen(true)} disabled={saving}>
                Delete
              </Button>
            ) : null}
          </span>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete car?"
        description="This marks the car as deleted. It will be hidden from the public fleet and partner portal."
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleSoftDelete()}
      />
    </>
  )
}
