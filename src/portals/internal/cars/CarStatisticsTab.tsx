import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../../../lib/supabase'
import { filterTransactionsByMonth } from '../../../lib/ledgerPdf'
import { sumRecordedRentalFeeFromTransactions } from '../../../lib/partnerRentalFee'
import type { Tables } from '../../../types/database'
import type { TransactionRow } from '../../../types/transaction'

type Props = { carId: string }

function formatIdrNumber(n: number): string {
  return Math.round(n).toLocaleString('id-ID')
}

function sumGrossRentalIncome(transactions: TransactionRow[]): number {
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'income') continue
    if (t.category === 'rental_income' || t.category === 'dp_rental_income') {
      total += Number(t.amount)
    }
  }
  return total
}

function overlapDayCount(startYmd: string, endYmd: string, month: Dayjs): number {
  const ms = month.startOf('month').startOf('day')
  const me = month.endOf('month').startOf('day')
  const s = dayjs(startYmd).startOf('day')
  const e = dayjs(endYmd).startOf('day')
  const lo = s.isAfter(ms) ? s : ms
  const hi = e.isBefore(me) ? e : me
  if (lo.isAfter(hi)) return 0
  return hi.diff(lo, 'day') + 1
}

function daysInMonth(month: Dayjs): number {
  return month.daysInMonth()
}

function occupancyPercent(
  sources: { start_date: string; end_date: string }[],
  month: Dayjs,
): number {
  const dim = daysInMonth(month)
  if (dim <= 0) return 0
  let rented = 0
  for (const row of sources) {
    rented += overlapDayCount(row.start_date, row.end_date, month)
  }
  return Math.min(100, (rented / dim) * 100)
}

function monthLabel(m: Dayjs): string {
  return m.format('MMM YYYY')
}

function parseFeePct(settings: Map<string, string>): number | null {
  const raw =
    settings.get('rental_fee_pct') ?? settings.get('partner_fee_pct') ?? settings.get('management_fee_pct')
  if (raw === undefined) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function CarStatisticsTab({ carId }: Props) {
  const theme = useTheme()
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(() => dayjs().startOf('month'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [orders, setOrders] = useState<Tables<'v2_orders'>[]>([])
  const [rentals, setRentals] = useState<Tables<'v2_rentals'>[]>([])
  const [services, setServices] = useState<Tables<'v2_car_services'>[]>([])
  const [settingsMap, setSettingsMap] = useState<Map<string, string>>(new Map())
  const [carMileage, setCarMileage] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const firstWindow = selectedMonth.subtract(5, 'month')
    const fromYmd = firstWindow.format('YYYY-MM-DD')
    const toYmd = selectedMonth.endOf('month').format('YYYY-MM-DD')
    const fromIso = `${firstWindow.format('YYYY-MM')}-01T00:00:00.000Z`
    const endExclusive = `${selectedMonth.add(1, 'month').format('YYYY-MM')}-01T00:00:00.000Z`

    const [
      txRes,
      ordersRes,
      rentalsRes,
      servicesRes,
      settingsRes,
      carRes,
    ] = await Promise.all([
      supabase
        .from('v2_transactions')
        .select('*')
        .eq('car_id', carId)
        .gte('recorded_at', fromIso)
        .lt('recorded_at', endExclusive)
        .order('recorded_at', { ascending: true }),
      supabase
        .from('v2_orders')
        .select('*')
        .eq('car_id', carId)
        .eq('status', 'completed')
        .lte('start_date', toYmd)
        .gte('end_date', fromYmd),
      supabase
        .from('v2_rentals')
        .select('*')
        .eq('car_id', carId)
        .eq('status', 'completed')
        .not('end_date', 'is', null)
        .lte('start_date', toYmd)
        .gte('end_date', fromYmd),
      supabase
        .from('v2_car_services')
        .select('*')
        .eq('car_id', carId)
        .gte('service_date', fromYmd)
        .lte('service_date', toYmd)
        .order('service_date', { ascending: true }),
      supabase.from('v2_app_settings').select('key, value'),
      supabase.from('v2_cars').select('mileage').eq('id', carId).maybeSingle(),
    ])

    const err =
      txRes.error?.message ??
      ordersRes.error?.message ??
      rentalsRes.error?.message ??
      servicesRes.error?.message ??
      settingsRes.error?.message ??
      carRes.error?.message
    if (err) {
      setError(err)
      setLoading(false)
      return
    }

    setTransactions((txRes.data ?? []) as TransactionRow[])
    setOrders(ordersRes.data ?? [])
    setRentals(rentalsRes.data ?? [])
    setServices(servicesRes.data ?? [])

    const sm = new Map<string, string>()
    for (const row of settingsRes.data ?? []) {
      sm.set(row.key, row.value)
    }
    setSettingsMap(sm)
    const cm = carRes.data?.mileage
    setCarMileage(typeof cm === 'number' && Number.isFinite(cm) ? cm : null)
    setLoading(false)
  }, [carId, selectedMonth])

  useEffect(() => {
    void load()
  }, [load])

  const sixMonths = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => selectedMonth.subtract(5 - i, 'month').startOf('month'))
  }, [selectedMonth])

  const monthStr = (m: Dayjs) => m.format('YYYY-MM')

  const txsByMonth = useMemo(() => {
    const map = new Map<string, TransactionRow[]>()
    for (const m of sixMonths) {
      const key = monthStr(m)
      map.set(key, filterTransactionsByMonth(transactions, key))
    }
    return map
  }, [transactions, sixMonths])

  const kpis = useMemo(() => {
    const key = monthStr(selectedMonth)
    const txs = txsByMonth.get(key) ?? []
    const gross = sumGrossRentalIncome(txs)
    const maintenance = services
      .filter((s) => s.service_date >= `${key}-01` && s.service_date <= selectedMonth.endOf('month').format('YYYY-MM-DD'))
      .reduce((acc, s) => acc + (s.cost ?? 0), 0)

    const completedInMonth = orders.filter((o) => dayjs(o.end_date).format('YYYY-MM') === key)

    const occSources =
      orders.length > 0
        ? orders.map((o) => ({ start_date: o.start_date, end_date: o.end_date }))
        : rentals
            .filter((r) => r.end_date)
            .map((r) => ({ start_date: r.start_date, end_date: r.end_date as string }))

    const occ = occupancyPercent(occSources, selectedMonth)

    return {
      gross,
      occupancy: occ,
      completedCount: completedInMonth.length,
      maintenance,
    }
  }, [orders, rentals, selectedMonth, services, txsByMonth])

  const barData = useMemo(() => {
    return sixMonths.map((m) => {
      const key = monthStr(m)
      const txs = txsByMonth.get(key) ?? []
      const income = sumGrossRentalIncome(txs)
      const maintenance = services
        .filter((s) => {
          const d = s.service_date
          return d >= `${key}-01` && d <= m.endOf('month').format('YYYY-MM-DD')
        })
        .reduce((acc, s) => acc + (s.cost ?? 0), 0)
      return {
        label: monthLabel(m),
        monthKey: key,
        income,
        maintenance,
      }
    })
  }, [sixMonths, txsByMonth, services])

  const lineData = useMemo(() => {
    const occSources =
      orders.length > 0
        ? orders.map((o) => ({ start_date: o.start_date, end_date: o.end_date }))
        : rentals
            .filter((r) => r.end_date)
            .map((r) => ({ start_date: r.start_date, end_date: r.end_date as string }))

    return sixMonths.map((m) => ({
      label: monthLabel(m),
      occupancy: Math.round(occupancyPercent(occSources, m) * 10) / 10,
    }))
  }, [sixMonths, orders, rentals])

  const donutData = useMemo(() => {
    const key = monthStr(selectedMonth)
    const txs = txsByMonth.get(key) ?? []
    const gross = sumGrossRentalIncome(txs)
    const fee = sumRecordedRentalFeeFromTransactions(txs)
    const partner = Math.max(0, gross - fee)
    return { gross, fee, partner }
  }, [selectedMonth, txsByMonth])

  const feePctSetting = parseFeePct(settingsMap)

  const pieSlices = useMemo(() => {
    const { fee, partner } = donutData
    const rows: { name: string; value: number; color: string }[] = []
    if (fee > 0) rows.push({ name: 'Biaya pengelolaan', value: fee, color: theme.palette.warning.main })
    if (partner > 0) rows.push({ name: 'Bagian mitra', value: partner, color: theme.palette.success.main })
    return rows
  }, [donutData, theme.palette])

  const selectedMonthEmpty = useMemo(() => {
    const key = monthStr(selectedMonth)
    const txs = txsByMonth.get(key) ?? []
    const gross = sumGrossRentalIncome(txs)
    const maintenance = services
      .filter((s) => s.service_date >= `${key}-01` && s.service_date <= selectedMonth.endOf('month').format('YYYY-MM-DD'))
      .reduce((acc, s) => acc + (s.cost ?? 0), 0)
    const ordersCount = orders.filter((o) => dayjs(o.end_date).format('YYYY-MM') === key).length
    return gross === 0 && maintenance === 0 && ordersCount === 0
  }, [orders, selectedMonth, services, txsByMonth])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200} data-car-id={carId}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Typography color="error" data-car-id={carId}>
        {error}
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-car-id={carId}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Periode
          </Typography>
          <DatePicker
            views={['year', 'month']}
            openTo="month"
            value={selectedMonth}
            onChange={(v) => {
              if (v) setSelectedMonth(v.startOf('month'))
            }}
            slotProps={{ textField: { size: 'small', sx: { maxWidth: 280 } } }}
            label="Bulan"
          />
          <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
            Kilometer saat ini:{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
              {carMileage != null ? `${carMileage.toLocaleString('id-ID')} km` : 'Belum tercatat'}
            </Box>
          </Typography>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Total pendapatan kotor
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Rp {formatIdrNumber(kpis.gross)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Tingkat okupansi
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            {kpis.occupancy.toFixed(1)}%
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Pesanan selesai
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            {kpis.completedCount}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Biaya perawatan
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Rp {formatIdrNumber(kpis.maintenance)}
          </Typography>
        </Paper>
      </Box>

      {selectedMonthEmpty ? (
        <Typography variant="body2" color="text.secondary">
          Belum ada data pendapatan, perawatan, atau pesanan selesai untuk bulan ini.
        </Typography>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Pendapatan vs biaya perawatan (6 bulan)
          </Typography>
          <Box sx={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatIdrNumber(Number(v))} width={72} />
                <Tooltip
                  formatter={(value, name) => [
                    `Rp ${formatIdrNumber(Number(value))}`,
                    name === 'income' ? 'Pendapatan kotor' : 'Biaya perawatan',
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === 'income' ? 'Pendapatan kotor' : value === 'maintenance' ? 'Biaya perawatan' : value
                  }
                />
                <ReferenceLine y={0} stroke="#666" />
                <Bar dataKey="income" name="income" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maintenance" name="maintenance" fill="#ed6c02" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Tren okupansi (6 bulan)
          </Typography>
          <Box sx={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={48} />
                <Tooltip formatter={(value) => [`${value}%`, 'Okupansi']} />
                <Line
                  type="monotone"
                  dataKey="occupancy"
                  name="Okupansi"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Pembagian pendapatan (bulan terpilih)
          </Typography>
          {feePctSetting !== null ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Pengaturan fee referensi: {feePctSetting}%
            </Typography>
          ) : null}
          {donutData.gross <= 0 || pieSlices.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Tidak ada pembagian pendapatan untuk bulan ini.
            </Typography>
          ) : (
            <Box sx={{ position: 'relative', width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={112}
                    paddingAngle={2}
                  >
                    {pieSlices.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`Rp ${formatIdrNumber(Number(value))}`, '']}
                    contentStyle={{ borderRadius: 8 }}
                  />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '42%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Total kotor
                </Typography>
                <Typography variant="subtitle1" fontWeight={600}>
                  Rp {formatIdrNumber(donutData.gross)}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
