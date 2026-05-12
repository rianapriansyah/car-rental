import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { supabase } from '../../lib/supabase'
import { formatIdr } from '../../lib/formatIdr'
import { formatReceiptDateTime } from '../internal/rentals/rentalReceiptFormat'
import {
  isRentalVerificationSnapshot,
  type RentalVerificationSnapshot,
} from '../../types/rentalVerification'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function VerifyReceiptPage() {
  const { rentalId = '' } = useParams<{ rentalId: string }>()
  const idDecoded = decodeURIComponent(rentalId)
  const idValid = useMemo(() => UUID_RE.test(idDecoded.trim()), [idDecoded])

  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<RentalVerificationSnapshot | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!idValid) {
      setLoading(false)
      setSnapshot(null)
      setNotFound(false)
      setError(null)
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      setNotFound(false)
      setSnapshot(null)

      const { data, error: rpcError } = await supabase.rpc('get_rental_verification_snapshot', {
        p_rental_id: idDecoded.trim(),
      })

      if (cancelled) return
      setLoading(false)

      if (rpcError) {
        setError(rpcError.message)
        return
      }

      if (data == null || !isRentalVerificationSnapshot(data)) {
        setNotFound(true)
        return
      }

      setSnapshot(data)
    })()

    return () => {
      cancelled = true
    }
  }, [idDecoded, idValid])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: 4 }}>
      <Container maxWidth="sm">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <Button component={RouterLink} to="/public" size="small" color="inherit" sx={{ p: 0, minWidth: 0 }}>
            ← Katalog
          </Button>
        </Typography>

        {!idValid ? (
          <Alert severity="warning">Tautan verifikasi tidak valid.</Alert>
        ) : loading ? (
          <Typography color="text.secondary">Memuat…</Typography>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : notFound ? (
          <Alert severity="info">
            Kuitansi ini tidak ditemukan atau belum dapat diverifikasi. Pastikan tautan sesuai kuitansi resmi Anda.
          </Alert>
        ) : snapshot ? (
          <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  Verifikasi kuitansi
                </Typography>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
                  label="Terverifikasi"
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Data berikut cocok dengan catatan sistem pada saat verifikasi. Tidak perlu login.
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                Perusahaan
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: snapshot.admin_number ? 0.5 : 2 }}>
                {snapshot.company_name}
              </Typography>
              {snapshot.admin_number ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {snapshot.admin_number}
                </Typography>
              ) : null}

              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                Referensi
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>
                {snapshot.receipt_no}
              </Typography>

              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                Penyewa
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 2 }}>
                {snapshot.renter_name}
              </Typography>

              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                Kendaraan
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {snapshot.car_name}
              </Typography>
              {snapshot.car_plate ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {snapshot.car_plate}
                </Typography>
              ) : (
                <Box sx={{ mb: 2 }} />
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mb: 2 }}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                    Mulai
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatReceiptDateTime(snapshot.start_date, snapshot.start_time)}
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                    Selesai
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {snapshot.end_date
                      ? formatReceiptDateTime(snapshot.end_date, snapshot.end_time)
                      : '—'}
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                <Typography variant="body1" sx={{ fontWeight: 800 }}>
                  Jumlah tercatat
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {formatIdr(snapshot.amount)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Container>
    </Box>
  )
}
