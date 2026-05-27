import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { DataGridUpdateIconButton } from '../../../components/DataGridUpdateIconButton'
import { supabase } from '../../../lib/supabase'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'
import { getRenterAccountChipProps, statusChipSx } from '../../../lib/statusChips'
import { buildWhatsAppMeUrl } from '../../../lib/whatsappLink'
import type { Tables } from '../../../types/database'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { RenterInfoFormDialog } from './RenterInfoFormDialog'
import { RenterRentalHistoryDialog } from './RenterRentalHistoryDialog'

type RenterInfo = Tables<'v2_renter_info'>

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function statusChip(status: string) {
  const { label, color } = getRenterAccountChipProps(status)
  return <Chip size="small" label={label} color={color} sx={statusChipSx} />
}

function renterInfoSearchBlob(row: RenterInfo): string {
  const st = row.status === 'blacklisted' ? 'diblokir blacklisted' : 'aktif active'
  return `${row.name} ${row.phone ?? ''} ${row.notes ?? ''} ${row.status} ${st}`.toLowerCase()
}

export function RenterInfoPage() {
  const [rows, setRows] = useState<RenterInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RenterInfo | null>(null)
  const [waConfirmTarget, setWaConfirmTarget] = useState<RenterInfo | null>(null)
  const [historyTarget, setHistoryTarget] = useState<RenterInfo | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('v2_renter_info')
      .select('*')
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  function handleClear() {
    setKeyword('')
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => matchesSearchTokens(renterInfoSearchBlob(r), keyword))
  }, [rows, keyword])

  function handleWhatsAppConfirm() {
    if (!waConfirmTarget?.phone) {
      setWaConfirmTarget(null)
      return
    }
    const waUrl = buildWhatsAppMeUrl(waConfirmTarget.phone)
    if (waUrl) window.open(waUrl, '_blank', 'noopener,noreferrer')
    setWaConfirmTarget(null)
  }

  const columns: GridColDef<RenterInfo>[] = [
    {
      field: 'name',
      headerName: 'Nama',
      flex: 1.2,
      minWidth: 140,
    },
    { field: 'phone', headerName: 'Telepon', flex: 1, minWidth: 130, valueGetter: (v) => v ?? '—' },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (p) => statusChip(p.value as string),
    },
    { field: 'notes', headerName: 'Catatan', flex: 2, minWidth: 180, valueGetter: (v) => v ?? '—' },
    {
      field: '_actions',
      headerName: 'Aksi',
      width: 72,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (p) => (
        <DataGridUpdateIconButton
          onClick={() => {
            setEditing(p.row)
            setDialogOpen(true)
          }}
        />
      ),
    },
  ]

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 3 }}>
        Info Penyewa
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari nama, telepon, catatan, status…"
        loading={loading}
      />

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          Tambah penyewa
        </Button>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <DataGrid
        rows={filtered}
        columns={columns}
        loading={loading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        disableRowSelectionOnClick
        onCellClick={(params) => {
          if (params.field === 'phone') setWaConfirmTarget(params.row)
          if (params.field === 'name') setHistoryTarget(params.row)
        }}
        sx={{
          '& .MuiDataGrid-cell[data-field="phone"]': { cursor: 'pointer' },
          '& .MuiDataGrid-cell[data-field="name"]': { cursor: 'pointer' },
        }}
        autoHeight
      />

      <RenterInfoFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />

      <RenterRentalHistoryDialog
        open={historyTarget !== null}
        renterName={historyTarget?.name ?? ''}
        onClose={() => setHistoryTarget(null)}
      />

      <ConfirmDialog
        open={waConfirmTarget !== null}
        title={waConfirmTarget?.phone ? 'Hubungi via WhatsApp?' : 'Nomor telepon tidak tersedia'}
        description={
          waConfirmTarget?.phone
            ? `Anda akan diarahkan ke WhatsApp untuk menghubungi ${waConfirmTarget.name} (${waConfirmTarget.phone}). Lanjutkan?`
            : `${waConfirmTarget?.name ?? 'Penyewa'} belum memiliki nomor telepon.`
        }
        confirmLabel={waConfirmTarget?.phone ? 'Buka WhatsApp' : 'Mengerti'}
        confirmColor={waConfirmTarget?.phone ? 'primary' : 'error'}
        onCancel={() => setWaConfirmTarget(null)}
        onConfirm={handleWhatsAppConfirm}
      />
    </Box>
  )
}
