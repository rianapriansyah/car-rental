import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import {
  InternalDataGridSearchPanel,
  searchPanelSelectSlotProps,
} from '../../../components/InternalDataGridSearchPanel'
import { supabase } from '../../../lib/supabase'
import type { PartnerRow } from '../../../types/partner'
import { PartnerFormDialog } from './PartnerFormDialog.tsx'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function matchesKeyword(row: PartnerRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const blob = `${row.name} ${row.email} ${row.phone ?? ''}`.toLowerCase()
  return blob.includes(s)
}

export function PartnersPage() {
  const [rows, setRows] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [linkedFilter, setLinkedFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qError } = await supabase.from('v2_partners').select('*').order('name')
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesKeyword(row, keyword)) return false
      if (linkedFilter === 'yes' && !row.auth_user_id) return false
      if (linkedFilter === 'pending' && row.auth_user_id) return false
      return true
    })
  }, [rows, keyword, linkedFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const handleClear = () => {
    setKeyword('')
    setLinkedFilter('')
    setExpanded(false)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const columns: GridColDef<PartnerRow>[] = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
      { field: 'email', headerName: 'Email', flex: 1, minWidth: 180 },
      {
        field: 'phone',
        headerName: 'Phone',
        width: 140,
        valueGetter: (_v, row) => row.phone ?? '—',
      },
      {
        field: 'linked',
        headerName: 'Linked user',
        width: 150,
        valueGetter: (_v, row) => (row.auth_user_id ? 'Yes' : 'Pending invite'),
      },
    ],
    [],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 2 }}>
        Partners
      </Typography>

      <InternalDataGridSearchPanel
        keyword={keyword}
        onKeywordChange={setKeyword}
        expanded={expanded}
        onExpandedToggle={() => setExpanded((x) => !x)}
        onSubmit={handleSearch}
        onClear={handleClear}
        onCollapseExpanded={() => setExpanded(false)}
        searchPlaceholder="Search name, email, phone…"
        loading={loading}
        expandedContent={
          <TextField
            select
            fullWidth
            size="small"
            label="Linked user"
            value={linkedFilter}
            onChange={(e) => setLinkedFilter(e.target.value)}
            slotProps={{ select: searchPanelSelectSlotProps(() => setExpanded(false)) }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="pending">Pending invite</MenuItem>
          </TextField>
        }
      />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <Button variant="contained" fullWidth sx={{ maxWidth: { xs: '100%', sm: 200 } }} onClick={() => setDialogOpen(true)}>
          Add partner
        </Button>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Typography color="text.secondary">No partners yet.</Typography>
      ) : (
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            {loading ? 'Loading…' : `${filteredRows.length} partner${filteredRows.length === 1 ? '' : 's'}`}
          </Typography>
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
        </Box>
      )}
      <PartnerFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => void load()} />
    </Box>
  )
}
