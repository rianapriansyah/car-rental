import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { isInternalStaffUser } from '../../../lib/authRole'
import {
  sumMonthIncomeFromTransactions,
  sumOpsExpenseExcludingRentalFee,
  sumRecordedRentalFeeFromTransactions,
} from '../../../lib/partnerRentalFee'
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
  const isStaff = user ? isInternalStaffUser(user) : false
  const { partner, loading: partnerLoading } = usePartnerProfile(isStaff ? undefined : user?.id)
  const [cars, setCars] = useState<CarWithPartner[]>([])
  const [txByCar, setTxByCar] = useState<Record<string, TransactionRow[]>>({})
  const [summaryRows, setSummaryRows] = useState<LedgerSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusyCarId, setPdfBusyCarId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthYyyyMm())

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
    if (isStaff) {
      void load()
    } else if (!partnerLoading && partner) {
      void load()
    }
  }, [isStaff, partner, partnerLoading, load])

  async function handleDownloadMonthLedger(car: CarWithPartner) {
    const month = selectedMonth
    const txs = filterTransactionsByMonth(txByCar[car.id] ?? [], selectedMonth)
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

  const selectedMonthLabel = useMemo(
    () =>
      dayjs(`${selectedMonth}-01`).toDate().toLocaleString('id-ID', {
        month: 'long',
        year: 'numeric',
      }),
    [selectedMonth],
  )

  const rincianCashBreakdown = useMemo(() => {
    const month = selectedMonth
    let companyNet = 0
    let partnerIncomeMinusOpsExclFee = 0
    let partnerNettMitra = 0
    let partnerRentalFee = 0

    for (const car of cars) {
      const txs = filterTransactionsByMonth(txByCar[car.id] ?? [], month)
      if (car.ownership_type === 'partner') {
        const monthIncome = sumMonthIncomeFromTransactions(txs)
        const opsExclFee = sumOpsExpenseExcludingRentalFee(txs)
        const feeRecorded = sumRecordedRentalFeeFromTransactions(txs)
        partnerIncomeMinusOpsExclFee += monthIncome - opsExclFee
        partnerNettMitra += monthIncome - opsExclFee - feeRecorded
        partnerRentalFee += feeRecorded
      } else {
        let income = 0
        let expense = 0
        for (const t of txs) {
          if (t.type === 'income') income += Number(t.amount)
          else if (t.type === 'expense') expense += Number(t.amount)
        }
        companyNet += income - expense
      }
    }

    const totalCash = companyNet + partnerIncomeMinusOpsExclFee
    const monthLabel = dayjs(`${month}-01`).toDate().toLocaleString('id-ID', {
      month: 'long',
      year: 'numeric',
    })
    return {
      month,
      monthLabel,
      totalCash,
      companyNet,
      partnerIncomeMinusOpsExclFee,
      partnerNettMitra,
      partnerRentalFee,
    }
  }, [cars, txByCar, selectedMonth])

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

  if (!isStaff && (partnerLoading || !partner)) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  const title = isStaff
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
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                <DatePicker
                  label="Filter bulan"
                  value={dayjs(`${selectedMonth}-01`)}
                  views={['month']}
                  minDate={dayjs().startOf('year')}
                  maxDate={dayjs().endOf('month')}
                  disableFuture
                  onChange={(value: Dayjs | null) => {
                    if (value) setSelectedMonth(value.startOf('month').format('YYYY-MM'))
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { minWidth: 220 },
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>

          {isStaff ? (
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                mb: 3,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Rincian Cash ({rincianCashBreakdown.monthLabel})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total: {formatIdr(rincianCashBreakdown.totalCash)}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List dense disablePadding>
                  <ListItem disableGutters sx={{ py: 0.5, alignItems: 'flex-start' }}>
                    <ListItemText
                      primary="Dari sewa Kendaraan milik perusahaan"
                      secondary={formatIdr(rincianCashBreakdown.companyNet)}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <Box sx={{ py: 0.5, width: '100%' }}>
                    <Accordion
                      disableGutters
                      elevation={0}
                      sx={{
                        width: '100%',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        '&:before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <ListItemText
                          primary="Dari sewa Kendaraan milik partner"
                          secondary={formatIdr(rincianCashBreakdown.partnerIncomeMinusOpsExclFee)}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: 'body2' }}
                        />
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                        <List dense disablePadding sx={{ pl: 1 }}>
                          <ListItem disableGutters sx={{ py: 0.5, alignItems: 'flex-start' }}>
                            <ListItemText
                              primary="Perkiraan Nett Mitra"
                              secondary={formatIdr(rincianCashBreakdown.partnerNettMitra)}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                              secondaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                          <ListItem disableGutters sx={{ py: 0.5, alignItems: 'flex-start' }}>
                            <ListItemText
                              primary="Perkiraan Rental Fee"
                              secondary={formatIdr(rincianCashBreakdown.partnerRentalFee)}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                              secondaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                </List>
              </AccordionDetails>
            </Accordion>
          ) : null}

          {cars.map((car) => {
            const txs = txByCar[car.id] ?? []
            const monthTxs = filterTransactionsByMonth(txs, selectedMonth)
            let bal = 0
            const running = monthTxs.map((t) => {
              bal += t.type === 'income' ? Number(t.amount) : -Number(t.amount)
              return bal
            })
            const startIdx = Math.max(0, monthTxs.length - HOME_TX_PREVIEW_COUNT)
            const previewRows = monthTxs
              .slice(startIdx)
              .map((t, j) => ({ t, runningIdx: startIdx + j }))
              .reverse()
            const monthIncome = sumMonthIncomeFromTransactions(monthTxs)
            const opsExpense = sumOpsExpenseExcludingRentalFee(monthTxs)
            const feeRecorded = sumRecordedRentalFeeFromTransactions(monthTxs)
            const nettMitra = monthIncome - opsExpense - feeRecorded
            const isPartner = car.ownership_type === 'partner'
            return (
              <Card key={car.id} sx={{ mb: 2, overflow: 'hidden' }}>
                <CardContent sx={{ px: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {car.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ wordBreak: 'break-word', mb: 1.5 }}
                  >
                    {car.plate}
                    {isPartner ? (
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                        Kendaraan mitra
                      </Typography>
                    ) : (
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                        Kendaraan milik perusahaan
                      </Typography>
                    )}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: isPartner ? '1fr 1fr' : '1fr',
                        sm: isPartner ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                      },
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      border: 1,
                      borderColor: 'divider',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Pemasukan ({selectedMonthLabel})
                      </Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {formatIdr(monthIncome)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Pengeluaran operasional
                      </Typography>
                      <Typography variant="body2" fontWeight={700} color="error.main">
                        {formatIdr(opsExpense)}
                      </Typography>
                    </Box>
                    {isPartner ? (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Biaya pengelolaan (tercatat)
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="warning.main">
                          {formatIdr(feeRecorded)}
                        </Typography>
                      </Box>
                    ) : null}
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {isPartner ? 'Neto mitra' : 'Saldo bersih'}
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {formatIdr(nettMitra)}
                      </Typography>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  {monthTxs.length === 0 ? (
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
                    {monthTxs.length > 0 ? (
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
                      Unduh Rekap {selectedMonthLabel}
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
