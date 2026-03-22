import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { supabase } from '../../../lib/supabase'
import { invitePartnerByEmail } from '../../../lib/invitePartner'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function PartnerFormDialog({ open, onClose, onSaved }: Props) {
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

  const handleClose = () => {
    if (saving) return
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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add partner</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {info ? <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert> : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
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
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              helperText="Invitation email (Edge Function must be deployed)."
            />
          </Box>
          <TextField
            size="small"
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
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
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save & invite'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
