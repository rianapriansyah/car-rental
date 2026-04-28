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
import { formatSettingValue, isNumericSettingKey, type SettingRow } from './settingHelpers'

type Props = {
  target: SettingRow | null
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}

export function EditSettingDialog({ target, onClose, onSaved, onError }: Props) {
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (target) {
      setValue(target.value)
      setDescription(target.description ?? '')
      setBusy(false)
    }
  }, [target])

  const requestClose = () => {
    if (busy) return
    onClose()
  }

  async function submit() {
    if (!target) return
    const isNumeric = isNumericSettingKey(target.key)
    const sanitized = isNumeric ? value.replace(/\D/g, '') : value.trim()
    if (!sanitized) {
      onError('Nilai tidak boleh kosong.')
      return
    }
    const nextDescription = description.trim() || null
    setBusy(true)
    const { error: uError } = await supabase
      .from('v2_app_settings')
      .update({ value: sanitized, description: nextDescription })
      .eq('key', target.key)
    setBusy(false)
    if (uError) {
      onError(uError.message)
      return
    }
    onSaved()
    onClose()
  }

  const isUnchanged =
    target !== null && value === target.value && description === (target.description ?? '')

  return (
    <Dialog open={target !== null} onClose={requestClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit Pengaturan</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Kunci"
            size="small"
            fullWidth
            value={target?.key ?? ''}
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            label="Nilai lama"
            size="small"
            fullWidth
            value={target ? formatSettingValue(target.key, target.value) : ''}
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            label="Nilai baru"
            size="small"
            fullWidth
            autoFocus
            multiline
            minRows={3}
            value={value}
            onChange={(e) =>
              setValue(
                target && isNumericSettingKey(target.key)
                  ? e.target.value.replace(/\D/g, '')
                  : e.target.value,
              )
            }
            inputMode={target && isNumericSettingKey(target.key) ? 'numeric' : 'text'}
          />
          <TextField
            label="Deskripsi"
            size="small"
            fullWidth
            multiline
            minRows={2}
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
        <Button variant="contained" disabled={busy || isUnchanged} onClick={() => void submit()}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
