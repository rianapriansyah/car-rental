import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'
import { useDialogFullScreen } from '../../../hooks/useDialogFullScreen'
import { invitePartnerByEmail } from '../../../lib/invitePartner'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function PartnerFormDialog({ open, onClose, onSaved }: Props) {
  const fullScreen = useDialogFullScreen()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setName('')
    setEmail('')
    setPhone('')
    setNotes('')
    setError(null)
    setInfo(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setInfo(null)

    const { data: inserted, error: insertError } = await supabase
      .from('v2_partners')
      .insert({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      setSaving(false)
      setError(insertError?.message ?? 'Insert failed')
      return
    }

    const invite = await invitePartnerByEmail(email.trim())
    if (!invite.ok) {
      setInfo(
        `Partner saved, but invite failed: ${invite.message}. Link auth_user_id manually or deploy the invite-partner Edge Function.`,
      )
      setSaving(false)
      onSaved()
      handleClose()
      return
    }

    const { error: updateError } = await supabase
      .from('v2_partners')
      .update({ auth_user_id: invite.userId })
      .eq('id', inserted.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    onSaved()
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle>Add partner</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {info ? <Alert severity="info">{info}</Alert> : null}
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          helperText="Invitation email (Edge Function must be deployed)."
        />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          Save & invite
        </Button>
      </DialogActions>
    </Dialog>
  )
}
