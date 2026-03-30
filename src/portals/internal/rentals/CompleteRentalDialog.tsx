import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { completeRentalWithIncome } from '../../../lib/feeEngine'
import { formatIdr } from '../../../lib/formatIdr'

type Props = {
  open: boolean
  rentalId: string | null
  downPayment: number
  checkInNote?: string | null
  onClose: () => void
  onCompleted: () => void
}

function buildCombinedNote(checkIn: string, checkOut: string): string | undefined {
  const ci = checkIn.trim()
  const co = checkOut.trim()
  if (!ci && !co) return undefined
  return `check in note :\n${ci || '—'}\n\ncheck out note :\n${co || '—'}`
}

export function CompleteRentalDialog({ open, rentalId, downPayment, checkInNote, onClose, onCompleted }: Props) {
  const [gross, setGross] = useState('')
  const [checkOutNote, setCheckOutNote] = useState('')
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs())
  const [endTime, setEndTime] = useState<Dayjs | null>(dayjs())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleClose = () => {
    if (busy) return
    onClose()
  }

  async function submit() {
    if (!rentalId) return
    const grossInput = Number(gross.replace(/\D/g, ''))
    if (!Number.isFinite(grossInput) || grossInput < 0) {
      setError('Masukkan jumlah pendapatan kotor yang valid (IDR).')
      return
    }
    const totalGrossIncome = downPayment + grossInput
    if (totalGrossIncome <= 0) {
      setError('Total pendapatan kotor (DP + jumlah saat selesai) harus lebih dari 0.')
      return
    }
    setBusy(true)
    setError(null)
    const combinedNote = buildCombinedNote(checkInNote ?? '', checkOutNote)
    const completionAt =
      endDate && endTime
        ? {
            endDate: endDate.format('YYYY-MM-DD'),
            endTime: endTime.format('HH:mm'),
          }
        : null

    if (!completionAt) {
      setBusy(false)
      setError('Tanggal dan jam selesai wajib diisi.')
      return
    }

    const { error: doneError } = await completeRentalWithIncome(
      rentalId,
      totalGrossIncome,
      combinedNote,
      completionAt,
    )
    setBusy(false)
    if (doneError) {
      setError(doneError.message)
      return
    }
    setGross('')
    setCheckOutNote('')
    setEndDate(dayjs())
    setEndTime(dayjs())
    onCompleted()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Selesaikan Sewa</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        {checkInNote ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Catatan Check-in
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.25, mt: 0.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {checkInNote}
              </Typography>
            </Paper>
          </Box>
        ) : null}

        <TextField
          size="small"
          label="Pendapatan kotor saat selesai (IDR)"
          value={gross}
          onChange={(e) => setGross(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          fullWidth
          sx={{ mb: 2 }}
          helperText={
            downPayment > 0
              ? `DP ${formatIdr(downPayment)} otomatis ditambahkan.`
              : undefined
          }
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
          <DatePicker
            label="Tanggal selesai"
            value={endDate}
            onChange={(v) => setEndDate(v)}
            slotProps={{ textField: { fullWidth: true, size: 'small' } }}
          />
          <TimePicker
            label="Jam selesai (24 jam)"
            value={endTime}
            onChange={(v) => setEndTime(v)}
            ampm={false}
            slotProps={{ textField: { fullWidth: true, size: 'small' } }}
          />
        </Box>
        <TextField
          size="small"
          label="Catatan check-out (opsional)"
          value={checkOutNote}
          onChange={(e) => setCheckOutNote(e.target.value)}
          multiline
          minRows={3}
          fullWidth
            placeholder="mis. Bensin: ½ tangki dikembalikan. Dikenakan biaya kekurangan bensin."
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          Batal
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !rentalId}>
          {busy ? 'Menyelesaikan…' : 'Selesaikan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
