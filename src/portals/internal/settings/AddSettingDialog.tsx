import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'
import { isNumericSettingKey } from './settingHelpers'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}

export function AddSettingDialog({ open, onClose, onSaved, onError }: Props) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setKey('')
      setValue('')
      setDescription('')
      setBusy(false)
    }
  }, [open])

  const requestClose = () => {
    if (busy) return
    onClose()
  }

  async function submit() {
    const keyRaw = key.trim().toLowerCase().replace(/\s+/g, '_')
    if (!keyRaw || !/^[\d_a-z]+$/.test(keyRaw)) {
      onError('Kunci wajib diisi (huruf kecil, angka, dan garis bawah saja).')
      return
    }
    const valRaw = value.trim()
    if (!valRaw) {
      onError('Nilai wajib diisi.')
      return
    }
    setBusy(true)
    const payload = {
      key: keyRaw,
      value: isNumericSettingKey(keyRaw) ? valRaw.replace(/\D/g, '') : valRaw,
      description: description.trim() || null,
    }
    if (isNumericSettingKey(keyRaw) && !payload.value) {
      setBusy(false)
      onError('Nilai angka tidak valid.')
      return
    }
    const { error: iError } = await supabase.from('v2_app_settings').insert(payload)
    setBusy(false)
    if (iError) {
      onError(iError.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onClose={requestClose} fullWidth maxWidth="sm">
      <DialogTitle>Tambah pengaturan</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Kunci"
            size="small"
            required
            fullWidth
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="company_name"
            helperText="Huruf kecil, angka, dan garis bawah (contoh: company_name)."
          />
          <TextField
            label="Nilai"
            size="small"
            required
            fullWidth
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nilai yang disimpan"
          />
          <TextField
            label="Deskripsi (opsional)"
            size="small"
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Penjelasan singkat untuk operator"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={requestClose} disabled={busy}>
          Batal
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
