import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import { Link as RouterLink } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminUser } from '../../../lib/authRole'
import { usePartnerProfile } from '../../../hooks/usePartnerProfile'
import type { CarWithPartner } from '../../../types/car'
import type { TransactionRow } from '../../../types/transaction'
import { transactionCategoryLabel } from '../../../types/transaction'
import { formatIdr } from '../../../lib/formatIdr'
import {
  currentMonthYyyyMm,
  downloadLedgerReport,
  fetchCompanyDisplayName,
  fetchLedgerRentalMap,
  filterTransactionsByMonth,
} from '../../../lib/ledgerPdf'

/** Preview rows on dashboard per car (newest first). */
const HOME_TX_PREVIEW_COUNT = 5

type LedgerSummaryRow = {
  car_id: string | null
  month: string | null
  total_income: number | null
  total_expense: number | null
  balance: number | null
}

export function HomePage() {
  const theme = useTheme()
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'))
  const { user } = useAuth()
  const isAdmin = user ? isAdminUser(user) : false
  const { partner, loading: partnerLoading } = usePartnerProfile(isAdmin ? undefined : user?.id)
  const [cars, setCars] = useState<CarWithPartner[]>([])
  const [txByCar, setTxByCar] = useState<Record<string, TransactionRow[]>>({})
  const [summaryRows, setSummaryRows] = useState<LedgerSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusyCarId, setPdfBusyCarId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: carData, error: carError } = await supabase
      .from('v2_cars')
      .select('*, v2_partners(name)')
      .is('deleted_at', null)
      .order('name')

    if (carError) {
      setError(carError.message)
      setLoading(false)
      return
    }

    const list = (carData ?? []) as CarWithPartner[]
    setCars(list)

    const carIds = list.map((c) => c.id)
    if (carIds.length === 0) {
      setTxByCar({})
      setSummaryRows([])
      setLoading(false)
      return
    }

    const { data: txData, error: txError } = await supabase
      .from('v2_transactions')
      .select('*')
      .in('car_id', carIds)
      .order('recorded_at', { ascending: true })

    if (txError) {
      setError(txError.message)
      setLoading(false)
      return
    }

    const grouped: Record<string, TransactionRow[]> = {}
    for (const id of carIds) grouped[id] = []
    for (const t of txData ?? []) {
      if (!grouped[t.car_id]) grouped[t.car_id] = []
      grouped[t.car_id].push(t)
    }
    setTxByCar(grouped)

    const { data: sumData, error: sumError } = await supabase
      .from('v2_car_ledger_summary')
      .select('*')
      .in('car_id', carIds)

    if (sumError) {
      setError(sumError.message)
      setLoading(false)
      return
    }

    setSummaryRows((sumData ?? []) as LedgerSummaryRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) {
      void load()
    } else if (!partnerLoading && partner) {
      void load()
    }
  }, [isAdmin, partner, partnerLoading, load])

  async function handleDownloadMonthLedger(car: CarWithPartner) {
    const month = currentMonthYyyyMm()
    const txs = filterTransactionsByMonth(txByCar[car.id] ?? [], month)
    setPdfBusyCarId(car.id)
    try {
      const rentalIds = txs.map((t) => t.rental_id).filter(Boolean) as string[]
      const [rentalById, companyName] = await Promise.all([
        fetchLedgerRentalMap(supabase, rentalIds),
        fetchCompanyDisplayName(supabase),
      ])
      downloadLedgerReport({
        companyName,
        month,
        car: {
          name: car.name,
          plate: car.plate,
          ownership_type: car.ownership_type,
          partnerName: car.v2_partners?.name ?? null,
          hasGps: Boolean(car.has_gps),
        },
        transactions: txs,
        rentalById,
      })
    } finally {
      setPdfBusyCarId(null)
    }
  }

  const chartData = useMemo(() => {
    const byMonth = new Map<string, { month: string; income: number; expense: number }>()
    for (const row of summaryRows) {
      if (!row.month) continue
      const key = row.month
      const cur = byMonth.get(key) ?? { month: key, income: 0, expense: 0 }
      cur.income += Number(row.total_income ?? 0)
      cur.expense += Number(row.total_expense ?? 0)
      byMonth.set(key, cur)
    }
    return Array.from(byMonth.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({
        ...r,
        label: new Date(r.month).toLocaleString('default', { month: 'short', year: 'numeric' }),
      }))
  }, [summaryRows])

  if (!isAdmin && (partnerLoading || !partner)) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  const title = isAdmin
    ? 'Semua Kendaraan'
    : partner
      ? `Kendaraan: ${partner.name}`
      : 'Kendaraan Anda'

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        {title}
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : cars.length === 0 ? (
        <Typography color="text.secondary">Belum ada kendaraan.</Typography>
      ) : (
        <>
          <Card sx={{ mb: 3, overflow: 'hidden' }}>
            <CardContent sx={{ px: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 2, sm: 2 } } }}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                Pendapatan vs pengeluaran per bulan
              </Typography>
              {chartData.length === 0 ? (
                <Typography color="text.secondary">Belum ada data buku besar.</Typography>
              ) : (
                <Box sx={{ width: '100%', height: { xs: 260, sm: 300, md: 340 }, minHeight: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{
                        top: 8,
                        right: isSmDown ? 4 : 8,
                        left: isSmDown ? -12 : 0,
                        bottom: isSmDown ? 36 : 8,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: isSmDown ? 10 : 12 }}
                        interval="preserveStartEnd"
                        angle={isSmDown ? -35 : 0}
                        textAnchor={isSmDown ? 'end' : 'middle'}
                        height={isSmDown ? 50 : 30}
                      />
                      <YAxis
                        width={isSmDown ? 52 : 64}
                        tick={{ fontSize: isSmDown ? 9 : 11 }}
                        tickFormatter={(v) => formatIdr(Number(v)).replace('Rp', 'Rp ')}
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatIdr(typeof value === 'number' ? value : Number(value))
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: isSmDown ? 12 : 14 }} />
                      <Bar dataKey="income" name="Pendapatan" fill="#2e7d32" />
                      <Bar dataKey="expense" name="Pengeluaran" fill="#c62828" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>

          {cars.map((car) => {
            const txs = txByCar[car.id] ?? []
            let bal = 0
            const running = txs.map((t) => {
              bal += t.type === 'income' ? Number(t.amount) : -Number(t.amount)
              return bal
            })
            const startIdx = Math.max(0, txs.length - HOME_TX_PREVIEW_COUNT)
            const previewRows = txs
              .slice(startIdx)
              .map((t, j) => ({ t, runningIdx: startIdx + j }))
              .reverse()
            return (
              <Card key={car.id} sx={{ mb: 2, overflow: 'hidden' }}>
                <CardContent sx={{ px: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {car.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                    sx={{ wordBreak: 'break-word' }}
                  >
                    {car.plate} · Saldo: {formatIdr(bal)}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  {txs.length === 0 ? (
                    <Typography color="text.secondary">Belum ada transaksi.</Typography>
                  ) : (
                    <ResponsiveTableContainer>
                      <Table size="small" sx={{ minWidth: 640 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Waktu</TableCell>
                            <TableCell>Jenis</TableCell>
                            <TableCell>Kategori</TableCell>
                            <TableCell align="right">Jumlah</TableCell>
                            <TableCell align="right">Berjalan</TableCell>
                            <TableCell>Biaya</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {previewRows.map(({ t, runningIdx }) => (
                            <TableRow key={t.id}>
                              <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                {t.recorded_at
                                  ? new Date(t.recorded_at).toLocaleString('id-ID')
                                  : '—'}
                              </TableCell>
                              <TableCell>{t.type}</TableCell>
                              <TableCell>{transactionCategoryLabel(t.category)}</TableCell>
                              <TableCell align="right">{formatIdr(Number(t.amount))}</TableCell>
                              <TableCell align="right">{formatIdr(running[runningIdx] ?? 0)}</TableCell>
                              <TableCell>
                                {t.auto_fee ? (
                                  <Chip size="small" label="Auto" color="secondary" />
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ResponsiveTableContainer>
                  )}
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 1,
                      mt: 2,
                    }}
                  >
                    {txs.length > 0 ? (
                      <Button
                        component={RouterLink}
                        to={`/internal/transactions?car=${encodeURIComponent(car.id)}`}
                        size="small"
                      >
                        Lihat semua
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      disabled={pdfBusyCarId === car.id}
                      onClick={() => void handleDownloadMonthLedger(car)}
                    >
                      Unduh Rekap Bulan Berjalan
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )
          })}
        </>
      )}
    </Box>
  )
}
