import { useEffect, useState } from 'react'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PrintIcon from '@mui/icons-material/Print'
import GlobalStyles from '@mui/material/GlobalStyles'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Typography,
} from '@mui/material'
import type { RentalWithCar } from '../../../types/rental'
import { supabase } from '../../../lib/supabase'
import { fetchCompanyDisplayName } from '../../../lib/ledgerPdf'
import { formatIdr } from '../../../lib/formatIdr'
import {
  buildDetailRows,
  formatReceiptDateTime,
  formatReceiptToday,
  receiptNumber,
  receiptTotal,
} from './rentalReceiptFormat'
import { downloadRentalReceiptPdf } from './rentalReceiptPdf'

type Props = {
  open: boolean
  rental: RentalWithCar | null
  onClose: () => void
}

const MUTED = 'text.secondary'
const SECTION = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, color: MUTED, mb: 1.25 }

function summaryCard(label: string, value: string) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
        {value}
      </Typography>
    </Box>
  )
}

export function RentalReceiptDialog({ open, rental, onClose }: Props) {
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const name = await fetchCompanyDisplayName(supabase)
      if (!cancelled) setCompanyName(name)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!rental) return null

  const issued = formatReceiptToday()
  const detailRows = buildDetailRows(rental)
  const total = receiptTotal(rental)
  const note = rental.manual_note?.trim()

  return (
    <>
      {open ? (
        <GlobalStyles
          styles={{
            '@media print': {
              'body *': { visibility: 'hidden' },
              '#rental-receipt-print-root, #rental-receipt-print-root *': { visibility: 'visible' },
              '#rental-receipt-print-root': {
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                background: '#fff',
              },
            },
          }}
        />
      ) : null}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="body">
        <DialogContent sx={{ pt: 3, pb: 1 }}>
          <Box id="rental-receipt-print-root" sx={{ maxWidth: 520, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.5 }}>
                  Kuitansi Sewa
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {companyName}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Chip label="Selesai" size="small" color="success" variant="outlined" sx={{ mb: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {receiptNumber(rental)}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography sx={SECTION}>PENYEWA</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 2 }}>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {rental.renter_name}
                </Typography>
                {rental.renter_phone ? (
                  <Typography variant="body2" color="text.secondary">
                    {rental.renter_phone}
                  </Typography>
                ) : null}
              </Box>
              <Box sx={{ flex: '0 1 auto' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Tanggal kuitansi
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {issued}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography sx={SECTION}>KENDARAAN</Typography>
            <Typography variant="body1" sx={{ fontWeight: 700, mb: 2 }}>
              {rental.v2_cars ? `${rental.v2_cars.name}` : '—'}
            </Typography>
            {rental.v2_cars ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {rental.v2_cars.plate}
              </Typography>
            ) : null}

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              {summaryCard('Mulai', formatReceiptDateTime(rental.start_date, rental.start_time))}
              {summaryCard(
                'Selesai',
                rental.end_date ? formatReceiptDateTime(rental.end_date, rental.end_time) : '—',
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography sx={SECTION}>RINCIAN</Typography>
            <Box sx={{ mb: 2 }}>
              {detailRows.map((row, i) => (
                <Box
                  key={`${row.key}-${i}`}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    py: 1.25,
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
                    {row.key}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {row.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 0.5 }} />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                py: 2,
                px: 0,
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Total dibayar
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {total > 0 ? formatIdr(total) : '—'}
              </Typography>
            </Box>

            {note ? (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Catatan
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {note}
                </Typography>
              </>
            ) : null}

            <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
              Terima kasih telah menyewa.
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 2, textAlign: 'center', lineHeight: 1.5, fontStyle: 'italic' }}
            >
              Kuitansi ini dibuat secara elektronik oleh sistem dan berlaku sebagai bukti pembayaran sewa kendaraan
              yang sah sesuai data yang tercatat.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            flexWrap: 'wrap',
            gap: 1,
            '@media print': { display: 'none' },
          }}
        >
          <Button onClick={onClose}>Tutup</Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={() => {
              downloadRentalReceiptPdf(rental, companyName)
              onClose()
            }}
          >
            Simpan PDF
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Cetak kuitansi
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
