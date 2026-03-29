import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { formatIdr } from '../../../lib/formatIdr'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { InternalDataGridSearchPanel } from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import { matchesSearchTokens } from '../../../lib/matchesSearchTokens'

type SettingRow = {
  key: string
  value: string
  description: string | null
}

type SettingGridRow = SettingRow & { id: string }

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function formatSettingValue(key: string, raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n) || raw.trim() === '') return raw
  if (key.endsWith('_pct')) return `${n}%`
  if (key.endsWith('_fee') || key.endsWith('_rate')) return formatIdr(n)
  return raw
}

function settingSearchBlob(row: SettingRow): string {
  const fmt = formatSettingValue(row.key, row.value)
  return `${row.key} ${row.description ?? ''} ${row.value} ${fmt}`.toLowerCase()
}

/** Keys whose value is stored and edited as a number (see `formatSettingValue`). */
function isNumericSettingKey(key: string): boolean {
  return key.endsWith('_pct') || key.endsWith('_fee') || key.endsWith('_rate')
}

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qError } = await supabase.from('v2_app_settings').select('*').order('key')
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    const list = (data ?? []) as SettingRow[]
    setRows(list)
    const d: Record<string, string> = {}
    for (const r of list) {
      d[r.key] = r.value
    }
    setDrafts(d)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveKey(key: string) {
    const value = drafts[key]
    if (value === undefined) return
    setSavingKey(key)
    setError(null)
    const { error: uError } = await supabase.from('v2_app_settings').update({ value }).eq('key', key)
    setSavingKey(null)
    if (uError) {
      setError(uError.message)
      return
    }
    void load()
  }

  function closeAddDialog() {
    if (addBusy) return
    setAddOpen(false)
    setNewKey('')
    setNewValue('')
    setNewDescription('')
  }

  async function submitNewSetting() {
    const keyRaw = newKey.trim().toLowerCase().replace(/\s+/g, '_')
    if (!keyRaw || !/^[\d_a-z]+$/.test(keyRaw)) {
      setError('Kunci wajib diisi (huruf kecil, angka, dan garis bawah saja).')
      return
    }
    const valRaw = newValue.trim()
    if (!valRaw) {
      setError('Nilai wajib diisi.')
      return
    }
    setAddBusy(true)
    setError(null)
    const payload = {
      key: keyRaw,
      value: isNumericSettingKey(keyRaw) ? valRaw.replace(/\D/g, '') : valRaw,
      description: newDescription.trim() || null,
    }
    if (isNumericSettingKey(keyRaw) && !payload.value) {
      setAddBusy(false)
      setError('Nilai angka tidak valid.')
      return
    }
    const { error: iError } = await supabase.from('v2_app_settings').insert(payload)
    setAddBusy(false)
    if (iError) {
      setError(iError.message)
      return
    }
    closeAddDialog()
    void load()
  }

  const filteredDisplayRows = useMemo(() => {
    return rows.filter((r) => matchesSearchTokens(settingSearchBlob(r), keyword))
  }, [rows, keyword])

  const gridRows: SettingGridRow[] = useMemo(
    () => filteredDisplayRows.map((r) => ({ ...r, id: r.key })),
    [filteredDisplayRows],
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<SettingGridRow>[] = useMemo(
    () => [
      { field: 'key', headerName: 'Kunci', width: 160 },
      {
        field: 'description',
        headerName: 'Deskripsi',
        flex: 1,
        minWidth: 140,
        valueGetter: (_v, row) => row.description ?? '—',
      },
      {
        field: 'value',
        headerName: 'Nilai saat ini',
        width: 140,
        renderCell: (params) => (
          <Tooltip title={params.row.value} placement="top">
            <span>{formatSettingValue(params.row.key, params.row.value)}</span>
          </Tooltip>
        ),
      },
      {
        field: 'draft',
        headerName: 'Nilai baru',
        flex: 1,
        minWidth: 160,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <TextField
            size="small"
            fullWidth
            value={drafts[params.row.key] ?? ''}
            onChange={(e) =>
              setDrafts((d) => ({
                ...d,
                [params.row.key]: isNumericSettingKey(params.row.key)
                  ? e.target.value.replace(/\D/g, '')
                  : e.target.value,
              }))
            }
            inputMode={isNumericSettingKey(params.row.key) ? 'numeric' : 'text'}
            placeholder={params.row.value}
            sx={{ mt: 0.5 }}
          />
        ),
      },
      {
        field: 'save',
        headerName: 'Simpan',
        width: 100,
        align: 'right',
        headerAlign: 'right',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Button
            size="small"
            variant="contained"
            disabled={savingKey === params.row.key || (drafts[params.row.key] ?? '') === params.row.value}
            onClick={(e) => {
              e.stopPropagation()
              void saveKey(params.row.key)
            }}
            sx={{ my: 0.5 }}
          >
            Simpan
          </Button>
        ),
      },
    ],
    [drafts, savingKey],
  )

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        Pengaturan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Nilai fee dibaca oleh database saat menyelesaikan sewa. Jangan diubah langsung di kode aplikasi.
        Nama perusahaan di PDF diambil dari kunci <strong>company_name</strong>.
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSubmit={handleSearch}
        onClear={handleClear}
        searchPlaceholder="Cari kunci, deskripsi, nilai…"
        loading={loading}
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            mb: 1,
            mt: error ? 2 : 0,
          }}
        >
          <Button variant="outlined" size="small" onClick={() => setAddOpen(true)}>
            Tambah
          </Button>
        </Box>
      ) : null}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : gridRows.length === 0 ? (
        <Typography color="text.secondary">Tidak ada pengaturan yang sesuai.</Typography>
      ) : (
        <Paper
          sx={{
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
          }}
          variant="outlined"
        >
          <DataGrid
            rows={gridRows}
            columns={columns}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            disableRowSelectionOnClick
            autoHeight
            sx={{ border: 'none' }}
          />
        </Paper>
      )}

      <Dialog open={addOpen} onClose={closeAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>Tambah pengaturan</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Kunci"
              size="small"
              required
              fullWidth
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="company_name"
              helperText="Huruf kecil, angka, dan garis bawah (contoh: company_name)."
            />
            <TextField
              label="Nilai"
              size="small"
              required
              fullWidth
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Nilai yang disimpan"
            />
            <TextField
              label="Deskripsi (opsional)"
              size="small"
              fullWidth
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Penjelasan singkat untuk operator"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAddDialog} disabled={addBusy}>
            Batal
          </Button>
          <Button variant="contained" disabled={addBusy} onClick={() => void submitNewSetting()}>
            {addBusy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
