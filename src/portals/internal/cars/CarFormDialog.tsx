import { useRef, useState } from 'react'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { CarDetailEditForm, type CarDetailEditFormHandle } from './CarDetailEditForm'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/** Create new vehicle only — edit opens {@link CarDetailPage}. */
export function CarFormDialog({ open, onClose, onSaved }: Props) {
  const formRef = useRef<CarDetailEditFormHandle>(null)
  const [busy, setBusy] = useState({ saving: false, uploading: false })
  const isBusy = busy.saving || busy.uploading

  function handleClose() {
    if (isBusy) return
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Tambah kendaraan</DialogTitle>
      <DialogContent dividers>
        {open ? (
          <CarDetailEditForm
            ref={formRef}
            car={null}
            hideActions
            onBusyChange={setBusy}
            onSaved={() => {
              onSaved()
              onClose()
            }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isBusy}>
          Batal
        </Button>
        <Button
          variant="contained"
          onClick={() => void formRef.current?.save()}
          disabled={isBusy}
        >
          {busy.uploading ? (
            <CircularProgress size={18} color="inherit" />
          ) : busy.saving ? (
            'Menyimpan…'
          ) : (
            'Simpan'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
