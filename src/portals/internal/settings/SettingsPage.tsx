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
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
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

function isNumericSettingKey(key: string): boolean {
  return key.endsWith('_pct') || key.endsWith('_fee') || key.endsWith('_rate')
}

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  // ── Add dialog ──────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<SettingRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  // ── Data ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qError } = await supabase.from('v2_app_settings').select('*').order('key')
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as SettingRow[])
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Edit modal handlers ─────────────────────────────────────────────────────
  function openEdit(row: SettingRow) {
    setEditTarget(row)
    setEditValue(row.value)
    setEditDescription(row.description ?? '')
    setError(null)
  }

  function closeEdit() {
    if (editBusy) return
    setEditTarget(null)
    setEditValue('')
    setEditDescription('')
  }

  async function submitEdit() {
    if (!editTarget) return
    const isNumeric = isNumericSettingKey(editTarget.key)
    const sanitized = isNumeric ? editValue.replace(/\D/g, '') : editValue.trim()
    if (!sanitized) {
      setError('Nilai tidak boleh kosong.')
      return
    }
    const nextDescription = editDescription.trim() || null
    setEditBusy(true)
    setError(null)
    const { error: uError } = await supabase
      .from('v2_app_settings')
      .update({ value: sanitized, description: nextDescription })
      .eq('key', editTarget.key)
    setEditBusy(false)
    if (uError) {
      setError(uError.message)
      return
    }
    closeEdit()
    void load()
  }

  // ── Add dialog handlers ─────────────────────────────────────────────────────
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

  // ── Grid ────────────────────────────────────────────────────────────────────
  const filteredDisplayRows = useMemo(
    () => rows.filter((r) => matchesSearchTokens(settingSearchBlob(r), keyword)),
    [rows, keyword],
  )

  const gridRows: SettingGridRow[] = useMemo(
    () => filteredDisplayRows.map((r) => ({ ...r, id: r.key })),
    [filteredDisplayRows],
  )

  const columns: GridColDef<SettingGridRow>[] = useMemo(
    () => [
      { field: 'key', headerName: 'Kunci', width: 180 },
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
        width: 150,
        renderCell: (params) => (
          <Tooltip title={params.row.value} placement="top">
            <span>{formatSettingValue(params.row.key, params.row.value)}</span>
          </Tooltip>
        ),
      },
      {
        field: 'action',
        headerName: '',
        width: 60,
        align: 'center',
        headerAlign: 'center',
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              openEdit(params.row)
            }}
            aria-label="Edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

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

      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}

      {!loading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            mb: 2,
            mt: error ? 1 : 0,
          }}
        >
          <Button
            variant="contained"
            fullWidth
            sx={{ maxWidth: { xs: '100%', sm: 200 } }}
            onClick={() => setAddOpen(true)}
          >
            Tambah pengaturan
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
        <Paper sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }} variant="outlined">
          <DataGrid
            rows={gridRows}
            columns={columns}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            autoHeight
            sx={{ border: 'none', cursor: 'pointer' }}
            onRowClick={({ row }) => openEdit(row as SettingGridRow)}
          />
        </Paper>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      <Dialog
        open={editTarget !== null}
        onClose={closeEdit}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Edit Pengaturan</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Kunci"
              size="small"
              fullWidth
              value={editTarget?.key ?? ''}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Nilai lama"
              size="small"
              fullWidth
              value={editTarget ? formatSettingValue(editTarget.key, editTarget.value) : ''}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Nilai baru"
              size="small"
              fullWidth
              autoFocus
              multiline
              minRows={3}
              value={editValue}
              onChange={(e) =>
                setEditValue(
                  editTarget && isNumericSettingKey(editTarget.key)
                    ? e.target.value.replace(/\D/g, '')
                    : e.target.value,
                )
              }
              inputMode={editTarget && isNumericSettingKey(editTarget.key) ? 'numeric' : 'text'}
            />
            <TextField
              label="Deskripsi"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Penjelasan singkat untuk operator"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeEdit} disabled={editBusy}>
            Batal
          </Button>
          <Button
            variant="contained"
            disabled={
              editBusy ||
              (editValue === editTarget?.value &&
                editDescription === (editTarget?.description ?? ''))
            }
            onClick={() => void submitEdit()}
          >
            {editBusy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add dialog ─────────────────────────────────────────────────────── */}
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
