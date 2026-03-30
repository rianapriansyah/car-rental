import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useNavigate } from 'react-router-dom'
import { OrderFormDialog } from './OrderFormDialog'
import { OrderDetailDialog } from './OrderDetailDialog'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { V2OrderStatusChip } from '../../../components/V2OrderStatusChip'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { supabase } from '../../../lib/supabase'
import { fetchV2StatusesByType, type V2StatusRow } from '../../../lib/v2StatusHelpers'
import type { Tables } from '../../../types/database'
import { useV2RealtimeRefresh } from '../../../hooks/useV2RealtimeRefresh'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type OrderRow = Tables<'v2_orders'> & {
  v2_cars: { name: string; plate: string } | null
}

function orderSearchBlob(row: OrderRow, statusMap: Map<string, V2StatusRow>): string {
  const car = row.v2_cars ? `${row.v2_cars.name} ${row.v2_cars.plate}` : ''
  const st = row.status
  const stLabel = statusMap.get(st)?.label ?? st
  return `${row.renter_name} ${row.renter_phone ?? ''} ${car} ${st} ${stLabel}`.toLowerCase()
}

export function OrdersListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [statusMap, setStatusMap] = useState<Map<string, V2StatusRow>>(new Map())
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)

  const loadStatuses = useCallback(async () => {
    try {
      const map = await fetchV2StatusesByType('order')
      setStatusMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat status pesanan')
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qError } = await supabase
      .from('v2_orders')
      .select('*, v2_cars(name, plate)')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as OrderRow[])
  }, [])

  useV2RealtimeRefresh('v2_orders', load)

  useEffect(() => {
    void loadStatuses()
  }, [loadStatuses])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => matchesSearchTokens(orderSearchBlob(row, statusMap), keyword))
  }, [rows, keyword, statusMap])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
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
      {
        field: 'actions',
        headerName: 'Aksi',
        width: 72,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <DataGridUpdateIconButton
            title="Detail"
            onClick={() => setDetailOrderId(String(params.id))}
          />
        ),
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
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari penyewa, telepon, kendaraan, plat, status…"
        loading={loading}
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
            sx={{ border: 'none' }}
          />
        </Paper>
      )}

      <OrderFormDialog
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
        onSaved={(orderId) => {
          setOrderFormOpen(false)
          void load()
          setDetailOrderId(orderId)
        }}
      />

      <OrderDetailDialog
        open={detailOrderId != null}
        orderId={detailOrderId}
        onClose={() => setDetailOrderId(null)}
        onOrderUpdated={() => void load()}
        onActivated={(rentalId) =>
          navigate(`/internal/rentals?rentalId=${encodeURIComponent(rentalId)}`)
        }
      />
    </Box>
  )
}
