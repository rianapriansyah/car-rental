import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material'
import { SEGMENT_FULL_DAY_THRESHOLD_H } from '../../../lib/rentalCost'

type Props = {
  open: boolean
  onClose: () => void
}

export function TarifInfoDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Aturan Tarif Sewa</DialogTitle>
      <DialogContent dividers>
        <DialogContentText component="div" sx={{ '& strong': { color: 'text.primary' } }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Perhitungan biaya pada <strong>Referensi Tarif</strong> mengikuti aturan berikut:
          </Typography>
          <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 0.75 } }}>
            <li>
              <Typography variant="body2">
                <strong>25 jam pertama</strong> dihitung <strong>1 hari penuh</strong> (1× tarif harian).
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Setelah jam ke-25, sisa waktu dipotong per <strong>segmen 24 jam</strong>.
                Untuk tiap segmen:
              </Typography>
              <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
                <li>
                  <Typography variant="body2">
                    ≤ <strong>{SEGMENT_FULL_DAY_THRESHOLD_H} jam</strong> → dihitung sebagai{' '}
                    <strong>overtime (OT)</strong>, jam dibulatkan ke atas dan dikalikan tarif overtime per jam.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    &gt; <strong>{SEGMENT_FULL_DAY_THRESHOLD_H} jam</strong> → dihitung{' '}
                    <strong>+1 hari penuh</strong> (1× tarif harian).
                  </Typography>
                </li>
              </Box>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Total</strong> = (jumlah hari × tarif harian) + (jam overtime × tarif overtime).
              </Typography>
            </li>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Tarif harian diambil dari data kendaraan; tarif overtime per jam mengikuti pengaturan aplikasi.
            Nilai ini hanya <strong>referensi</strong> — jumlah aktual yang diterima tetap diisi pada kolom pembayaran.
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Mengerti
        </Button>
      </DialogActions>
    </Dialog>
  )
}
