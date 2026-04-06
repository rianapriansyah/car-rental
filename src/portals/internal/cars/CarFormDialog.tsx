import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import { CarDetailEditForm } from './CarDetailEditForm'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/** Create new vehicle only — edit opens {@link CarDetailPage}. */
export function CarFormDialog({ open, onClose, onSaved }: Props) {
  function handleClose() {
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Tambah kendaraan</DialogTitle>
      <DialogContent>
        {open ? (
          <CarDetailEditForm
            car={null}
            onSaved={() => {
              onSaved()
              onClose()
            }}
            onCancel={handleClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
