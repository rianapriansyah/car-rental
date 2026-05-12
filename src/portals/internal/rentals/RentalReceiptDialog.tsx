import { useEffect, useState } from 'react'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PrintIcon from '@mui/icons-material/Print'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { RentalWithCar } from '../../../types/rental'
import { supabase } from '../../../lib/supabase'
import { fetchAdminNumberDisplay, fetchCompanyDisplayName } from '../../../lib/ledgerPdf'
import { formatIdr } from '../../../lib/formatIdr'
import {
  buildDetailRows,
  buildReceiptLineItems,
  formatReceiptDateTime,
  formatReceiptToday,
  receiptNumber,
  receiptTotal,
} from './rentalReceiptFormat'
import { downloadRentalReceiptPdf } from './rentalReceiptPdf'
import { printStandaloneReceipt } from './rentalReceiptPrint'
import { buildRentalVerificationUrl } from '../../../lib/receiptVerificationUrl'

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
  const [adminNumber, setAdminNumber] = useState('')
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitAnchorEl, setSplitAnchorEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const [name, admin] = await Promise.all([
        fetchCompanyDisplayName(supabase),
        fetchAdminNumberDisplay(supabase),
      ])
      if (!cancelled) {
        setCompanyName(name)
        setAdminNumber(admin)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!rental) return null

  const verificationUrl = buildRentalVerificationUrl(rental.id)

  const issued = formatReceiptToday()
  const lineItems = buildReceiptLineItems(rental)
  const detailRows = buildDetailRows(rental)
  const total = receiptTotal(rental)
  const note = rental.manual_note?.trim()

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="body">
        <DialogContent dividers sx={{ pt: 3, pb: 1 }}>
          <Box id="rental-receipt-print-root" sx={{ maxWidth: 520, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.5 }}>
                  Kuitansi Sewa
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {companyName}
                </Typography>
                {adminNumber ? (
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {adminNumber}
                  </Typography>
                ) : null}
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
            {lineItems.length > 0 ? (
              <TableContainer sx={{ mb: detailRows.length > 0 ? 2 : 0 }}>
                <Table size="small" sx={{ '& .MuiTableCell-root': { borderColor: 'divider', py: 1.125 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Durasi</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        Tarif Harian
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        Total
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((ln) => (
                      <TableRow key={ln.item}>
                        <TableCell sx={{ fontWeight: 600 }}>{ln.item}</TableCell>
                        <TableCell>{ln.durasi}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {ln.tarifHarian}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                          {ln.total}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}
            {detailRows.length > 0 ? (
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
            ) : null}

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
            gap: 1,
            justifyContent: 'space-between',
            '@media print': { display: 'none' },
          }}
        >
          <Button onClick={onClose}>Batal</Button>
          <Box>
            <ButtonGroup variant="contained" ref={setSplitAnchorEl}>
              <Button
                startIcon={<PrintIcon />}
                onClick={() => void printStandaloneReceipt(rental, companyName, adminNumber, verificationUrl)}
              >
                Cetak kuitansi
              </Button>
              <Button
                size="small"
                aria-label="Pilih aksi kuitansi"
                aria-haspopup="menu"
                aria-expanded={splitOpen}
                onClick={() => setSplitOpen((prev) => !prev)}
              >
                <ArrowDropDownIcon />
              </Button>
            </ButtonGroup>
            <Popper
              open={splitOpen}
              anchorEl={splitAnchorEl}
              transition
              disablePortal
              placement="top-end"
              sx={{ zIndex: 1400 }}
            >
              {({ TransitionProps }) => (
                <Grow {...TransitionProps} style={{ transformOrigin: 'right bottom' }}>
                  <Paper elevation={3}>
                    <ClickAwayListener onClickAway={() => setSplitOpen(false)}>
                      <MenuList autoFocusItem dense>
                        <MenuItem
                          onClick={() => {
                            setSplitOpen(false)
                            void downloadRentalReceiptPdf(rental, companyName, adminNumber, verificationUrl).then(
                              () => onClose(),
                            )
                          }}
                        >
                          <PictureAsPdfIcon fontSize="small" sx={{ mr: 1.5 }} />
                          Simpan PDF
                        </MenuItem>
                      </MenuList>
                    </ClickAwayListener>
                  </Paper>
                </Grow>
              )}
            </Popper>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  )
}
