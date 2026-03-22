import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'

type SettingRow = {
  key: string
  value: string
  description: string | null
}

type SettingGridRow = SettingRow & { id: string }

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const FOCUS_KEYS = ['partner_fee_pct', 'gps_topup_fee'] as const

function matchesKeyword(row: SettingRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const blob = `${row.key} ${row.description ?? ''} ${row.value}`.toLowerCase()
  return blob.includes(s)
}

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [keyFilter, setKeyFilter] = useState('')

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

  const focusKeys = new Set<string>(FOCUS_KEYS)
  const displayRows = rows.filter((r) => focusKeys.has(r.key))

  const filteredDisplayRows = useMemo(() => {
    return displayRows.filter((r) => {
      if (keyFilter && r.key !== keyFilter) return false
      return matchesKeyword(r, keyword)
    })
  }, [displayRows, keyFilter, keyword])

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
    setKeyFilter('')
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<SettingGridRow>[] = useMemo(
    () => [
      { field: 'key', headerName: 'Key', width: 160 },
      {
        field: 'description',
        headerName: 'Description',
        flex: 1,
        minWidth: 140,
        valueGetter: (_v, row) => row.description ?? '—',
      },
      { field: 'value', headerName: 'Current', width: 120 },
      {
        field: 'draft',
        headerName: 'New value',
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
            onChange={(e) => setDrafts((d) => ({ ...d, [params.row.key]: e.target.value }))}
            sx={{ mt: 0.5 }}
          />
        ),
      },
      {
        field: 'save',
        headerName: 'Save',
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
            Save
          </Button>
        ),
      },
    ],
    [drafts, savingKey],
  )

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Fee values are read by the database when completing rentals. Do not hardcode them in the app.
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        expanded={expanded}
        onExpandedToggle={() => setExpanded((x) => !x)}
        onSubmit={handleSearch}
        onClear={handleClear}
        onCollapseExpanded={() => setExpanded(false)}
        searchPlaceholder="Search key, description, value…"
        loading={loading}
        expandedContent={
          <TextField
            select
            fullWidth
            size="small"
            label="Setting key"
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value)}
            slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
          >
            <MenuItem value="">
              <em>All fee settings</em>
            </MenuItem>
            {FOCUS_KEYS.map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </TextField>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : gridRows.length === 0 ? (
        <Typography color="text.secondary">No settings rows matched the filters.</Typography>
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
    </Box>
  )
}
