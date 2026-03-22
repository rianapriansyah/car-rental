import { useEffect, useState } from 'react'
import {
  Alert,
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
import { useDialogFullScreen } from '../../../hooks/useDialogFullScreen'

type Props = {
  open: boolean
  initial: CarWithPartner | null
  onClose: () => void
  onSaved: () => void
}

export function CarFormDialog({ open, initial, onClose, onSaved }: Props) {
  const fullScreen = useDialogFullScreen()
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
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
        <DialogTitle>{initial ? 'Edit car' : 'Add car'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, px: { xs: 2, sm: 3 } }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Plate" value={plate} onChange={(e) => setPlate(e.target.value)} required />
          <FormControl fullWidth>
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
            <FormControl fullWidth>
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
          <FormControlLabel
            control={<Switch checked={hasGps} onChange={(_, v) => setHasGps(v)} />}
            label="Has GPS"
          />
          <TextField
            label="Photo URL"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
            px: { xs: 2, sm: 3 },
            pb: 2,
          }}
        >
          <span>
            {initial && !initial.deleted_at ? (
              <Button color="error" onClick={() => setConfirmDeleteOpen(true)} disabled={saving}>
                Delete
              </Button>
            ) : null}
          </span>
          <span>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
              Save
            </Button>
          </span>
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
