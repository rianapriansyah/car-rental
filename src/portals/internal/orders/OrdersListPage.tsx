import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { OrderFormDialog } from './OrderFormDialog'
import { OrderDetailDialog } from './OrderDetailDialog'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { V2OrderStatusChip } from '../../../components/V2OrderStatusChip'
import { supabase } from '../../../lib/supabase'
import { fetchV2StatusesByType, type V2StatusRow } from '../../../lib/v2StatusHelpers'
import type { Tables } from '../../../types/database'
import { useV2RealtimeRefresh } from '../../../hooks/useV2RealtimeRefresh'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type OrderRow = Tables<'v2_orders'> & {
  v2_cars: { name: string; plate: string } | null
}

type CarFilter = { id: string; name: string }

function orderSearchBlob(row: OrderRow): string {
  const car = row.v2_cars ? `${row.v2_cars.name} ${row.v2_cars.plate}` : ''
  return `${row.renter_name} ${row.renter_phone ?? ''} ${car}`.toLowerCase()
}

export function OrdersListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const detailOrderId = searchParams.get('order')
  const [rows, setRows] = useState<OrderRow[]>([])
  const [cars, setCars] = useState<CarFilter[]>([])
  const [statusMap, setStatusMap] = useState<Map<string, V2StatusRow>>(new Map())
  const [draftCarFilter, setDraftCarFilter] = useState('')
  const [draftStatusFilter, setDraftStatusFilter] = useState('')
  const [appliedCarFilter, setAppliedCarFilter] = useState('')
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
  const [orderFormOpen, setOrderFormOpen] = useState(false)

  const loadStatuses = useCallback(async () => {
    try {
      const map = await fetchV2StatusesByType('order')
      setStatusMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat status pesanan')
    }
  }, [])

  const loadCars = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_cars')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
    if (!qError) setCars(data ?? [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase
      .from('v2_orders')
      .select('*, v2_cars(name, plate)')
      .order('created_at', { ascending: false })
    if (appliedCarFilter) q = q.eq('car_id', appliedCarFilter)
    if (appliedStatusFilter) q = q.eq('status', appliedStatusFilter)
    const { data, error: qError } = await q
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as OrderRow[])
  }, [appliedCarFilter, appliedStatusFilter])

  useV2RealtimeRefresh('v2_orders', load)

  useEffect(() => {
    void loadStatuses()
    void loadCars()
  }, [loadStatuses, loadCars])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(() => [...statusMap.keys()].sort(), [statusMap])

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => orderSearchBlob(row).includes(q))
  }, [rows, keyword])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedCarFilter(draftCarFilter)
    setAppliedStatusFilter(draftStatusFilter)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setDraftCarFilter('')
    setDraftStatusFilter('')
    setAppliedCarFilter('')
    setAppliedStatusFilter('')
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<OrderRow>[] = useMemo(
    () => [
      {
        field: 'car',
        headerName: 'Kendaraan',
        flex: 1,
        minWidth: 200,
        valueGetter: (_v, row) =>
          row.v2_cars ? `${row.v2_cars.name} (${row.v2_cars.plate})` : '—',
      },
      { field: 'renter_name', headerName: 'Penyewa', width: 160 },
      { field: 'renter_phone', headerName: 'Telepon', width: 140 },
      { field: 'start_date', headerName: 'Mulai', width: 120 },
      { field: 'end_date', headerName: 'Selesai', width: 120 },
      {
        field: 'duration_days',
        headerName: 'Durasi',
        width: 100,
        valueGetter: (_v, row) => (row.duration_days != null ? `${row.duration_days} hari` : '—'),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 140,
        renderCell: (params) => (
          <V2OrderStatusChip statusId={params.row.status} statusMap={statusMap} />
        ),
      },
      {
        field: 'deposit_paid',
        headerName: 'DP lunas',
        width: 110,
        valueGetter: (_v, row) => (row.deposit_paid ? 'Ya' : 'Tidak'),
      },
    ],
    [statusMap],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Pesanan
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        expanded={expanded}
        onExpandedToggle={() => setExpanded((x) => !x)}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari penyewa, kendaraan, plat…"
        loading={loading}
        expandedContent={
          <>
            <TextField
              select
              fullWidth
              size="small"
              label="Kendaraan"
              value={draftCarFilter}
              onChange={(e) => setDraftCarFilter(e.target.value)}
              slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
            >
              <MenuItem value="">
                <em>Semua</em>
              </MenuItem>
              {cars.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={draftStatusFilter}
              onChange={(e) => setDraftStatusFilter(e.target.value)}
              slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
            >
              <MenuItem value="">
                <em>Semua</em>
              </MenuItem>
              {statusOptions.map((id) => (
                <MenuItem key={id} value={id}>
                  {statusMap.get(id)?.label ?? id}
                </MenuItem>
              ))}
            </TextField>
          </>
        }
      />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button
          variant="contained"
          fullWidth
          sx={{ maxWidth: { xs: '100%', sm: 200 } }}
          onClick={() => setOrderFormOpen(true)}
        >
          Tambah pesanan
        </Button>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Typography color="text.secondary">Tidak ada pesanan yang sesuai.</Typography>
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
            rows={filteredRows}
            columns={columns}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            disableRowSelectionOnClick
            autoHeight
            sx={{ border: 'none', cursor: 'pointer' }}
            onRowClick={(p) =>
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                next.set('order', String(p.id))
                return next
              })
            }
          />
        </Paper>
      )}

      <OrderFormDialog
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
        onSaved={(orderId) => {
          setOrderFormOpen(false)
          void load()
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set('order', orderId)
            return next
          })
        }}
      />

      <OrderDetailDialog
        open={detailOrderId != null && detailOrderId !== ''}
        orderId={detailOrderId}
        onClose={() => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('order')
            return next
          })
        }}
        onOrderUpdated={() => void load()}
        onActivated={(rentalId) =>
          navigate(`/internal/rentals?rentalId=${encodeURIComponent(rentalId)}`)
        }
      />
    </Box>
  )
}
