import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import type { TransactionRow, TransactionCategory, TransactionType } from '../../../types/transaction'
import { formatIdr } from '../../../lib/formatIdr'
import { ManualTransactionDialog } from './ManualTransactionDialog'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const CATEGORY_OPTIONS: TransactionCategory[] = [
  'rental_income',
  'gps_topup',
  'maintenance',
  'partner_fee',
  'owner_withdrawal',
  'other',
]

type CarOption = { id: string; name: string }

type TransactionGridRow = TransactionRow & { runningBalance: number }

function matchesKeyword(row: TransactionRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const blob = `${row.type} ${row.category} ${row.manual_note ?? ''} ${formatIdr(Number(row.amount))}`.toLowerCase()
  return blob.includes(s)
}

export function TransactionsPage() {
  const [cars, setCars] = useState<CarOption[]>([])
  const [carId, setCarId] = useState<string>('')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'' | TransactionType>('')
  const [categoryFilter, setCategoryFilter] = useState<'' | TransactionCategory>('')
  const [autoFeeFilter, setAutoFeeFilter] = useState<'' | 'yes' | 'no'>('')

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
    if (qError) {
      setError(qError.message)
      return
    }
    setCars(data ?? [])
    setCarId((prev) => prev || (data?.[0]?.id ?? ''))
  }, [])

  const loadTx = useCallback(async () => {
    if (!carId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    const start = `${month}-01T00:00:00.000Z`
    const [y, m] = month.split('-').map(Number)
    const next = new Date(y, m, 1)
    const end = next.toISOString()

    const { data, error: qError } = await supabase
      .from('v2_transactions')
      .select('*')
      .eq('car_id', carId)
      .gte('recorded_at', start)
      .lt('recorded_at', end)
      .order('recorded_at', { ascending: true })

    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows(data ?? [])
  }, [carId, month])

  useEffect(() => {
    void loadCars()
  }, [loadCars])

  useEffect(() => {
    void loadTx()
  }, [loadTx])

  const { balance, gridRows, filteredGridRows, tableFiltersActive } = useMemo(() => {
    let b = 0
    const out: TransactionGridRow[] = []
    for (const t of rows) {
      const delta = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
      b += delta
      out.push({ ...t, runningBalance: b })
    }

    const filtered = out.filter((t) => {
      if (!matchesKeyword(t, keyword)) return false
      if (typeFilter && t.type !== typeFilter) return false
      if (categoryFilter && t.category !== categoryFilter) return false
      if (autoFeeFilter === 'yes' && !t.auto_fee) return false
      if (autoFeeFilter === 'no' && t.auto_fee) return false
      return true
    })

    const tableFiltersActive =
      Boolean(keyword.trim()) || Boolean(typeFilter) || Boolean(categoryFilter) || Boolean(autoFeeFilter)

    let runningFiltered: TransactionGridRow[] = []
    if (tableFiltersActive) {
      let run = 0
      runningFiltered = filtered.map((t) => {
        const delta = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
        run += delta
        return { ...t, runningBalance: run }
      })
    }

    return {
      balance: b,
      gridRows: out,
      filteredGridRows: tableFiltersActive ? runningFiltered : out,
      tableFiltersActive,
    }
  }, [rows, keyword, typeFilter, categoryFilter, autoFeeFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setTypeFilter('')
    setCategoryFilter('')
    setAutoFeeFilter('')
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<TransactionGridRow>[] = useMemo(
    () => [
      {
        field: 'recorded_at',
        headerName: 'When',
        width: 180,
        valueGetter: (_v, row) =>
          row.recorded_at ? new Date(row.recorded_at).toLocaleString('id-ID') : '—',
      },
      { field: 'type', headerName: 'Type', width: 100 },
      { field: 'category', headerName: 'Category', width: 120 },
      {
        field: 'amount',
        headerName: 'Amount',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => formatIdr(Number(row.amount)),
      },
      {
        field: 'runningBalance',
        headerName: 'Running',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => formatIdr(row.runningBalance),
      },
      {
        field: 'auto_fee',
        headerName: 'Auto fee',
        width: 100,
        renderCell: (params) =>
          params.row.auto_fee ? <Chip size="small" label="Auto" color="secondary" sx={{ my: 0.5 }} /> : null,
      },
      {
        field: 'manual_note',
        headerName: 'Note',
        flex: 1,
        minWidth: 160,
        valueGetter: (_v, row) => row.manual_note ?? '—',
      },
    ],
    [],
  )

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Transactions
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
        <FormControl sx={{ minWidth: 220, width: { xs: '100%', sm: 220 } }} size="small">
          <InputLabel id="car-tx">Car</InputLabel>
          <Select labelId="car-tx" label="Car" value={carId} onChange={(e) => setCarId(e.target.value)}>
            {cars.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          type="month"
          label="Month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          size="small"
          sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 } }}
        />
      </Box>

      {carId ? (
        <InternalDataGridSearchPanel
          keyword={keyword}
          onKeywordChange={setKeyword}
          expanded={expanded}
          onExpandedToggle={() => setExpanded((x) => !x)}
          onSubmit={handleSearch}
          onClear={handleClear}
          onCollapseExpanded={() => setExpanded(false)}
          searchPlaceholder="Search type, category, amount, note…"
          loading={loading}
          expandedContent={
            <>
              <TextField
                select
                fullWidth
                size="small"
                label="Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as '' | TransactionType)}
                slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                <MenuItem value="income">Income</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label="Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as '' | TransactionCategory)}
                slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label="Auto fee"
                value={autoFeeFilter}
                onChange={(e) => setAutoFeeFilter(e.target.value as '' | 'yes' | 'no')}
                slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                <MenuItem value="yes">Auto only</MenuItem>
                <MenuItem value="no">Manual only</MenuItem>
              </TextField>
            </>
          }
        />
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button
          variant="contained"
          disabled={!carId}
          fullWidth
          sx={{ maxWidth: { xs: '100%', sm: 200 } }}
          onClick={() => setDialogOpen(true)}
        >
          Add entry
        </Button>
      </Box>

      <Typography variant="subtitle1" gutterBottom sx={{ wordBreak: 'break-word' }}>
        Running balance (month scope): {formatIdr(balance)}
        {tableFiltersActive ? (
          <Typography component="span" variant="body2" color="text.secondary" display="block">
            Running column reflects the filtered rows only.
          </Typography>
        ) : null}
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!carId ? (
        <Typography color="text.secondary">Select a car to view the ledger.</Typography>
      ) : !loading && gridRows.length === 0 ? (
        <Typography color="text.secondary">No transactions in this month.</Typography>
      ) : (
        <Paper
          sx={{
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
            mt: error ? 2 : 0,
          }}
          variant="outlined"
        >
          <DataGrid
            rows={filteredGridRows}
            columns={columns}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            disableRowSelectionOnClick
            autoHeight
            sx={{ border: 'none' }}
          />
        </Paper>
      )}
      {carId ? (
        <ManualTransactionDialog
          open={dialogOpen}
          carId={carId}
          onClose={() => setDialogOpen(false)}
          onSaved={() => void loadTx()}
        />
      ) : null}
    </Box>
  )
}
