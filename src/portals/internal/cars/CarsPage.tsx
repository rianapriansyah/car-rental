import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { supabase } from '../../../lib/supabase'
import type { CarWithPartner } from '../../../types/car'
import { CarFormDialog } from './CarFormDialog.tsx'

export function CarsPage() {
  const [rows, setRows] = useState<CarWithPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CarWithPartner | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase.from('v2_cars').select('*, v2_partners(name)').order('created_at', { ascending: false })
    if (!includeDeleted) {
      q = q.is('deleted_at', null)
    }
    const { data, error: qError } = await q
    setLoading(false)
    if (qError) {
      setError(qError.message)
      return
    }
    setRows((data ?? []) as CarWithPartner[])
  }, [includeDeleted])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, width: { xs: '100%', sm: 'auto' } }}>
          Cars
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
          }}
        >
          <FormControlLabel
            control={
              <Switch checked={includeDeleted} onChange={(_, v) => setIncludeDeleted(v)} size="small" />
            }
            label="Deleted"
            sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: { xs: '0.8125rem', sm: '1rem' } } }}
          />
          <Button
            variant="contained"
            fullWidth
            sx={{ maxWidth: { xs: '100%', sm: 200 } }}
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            Add car
          </Button>
        </Box>
      </Box>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">No cars yet.</Typography>
      ) : (
        <ResponsiveTableContainer>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Plate</TableCell>
                <TableCell>Ownership</TableCell>
                <TableCell>Partner</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>GPS</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} sx={{ opacity: row.deleted_at ? 0.5 : 1 }}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.plate}</TableCell>
                  <TableCell>{row.ownership_type}</TableCell>
                  <TableCell>{row.v2_partners?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status}
                      color={row.status === 'available' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>{row.has_gps ? 'Yes' : 'No'}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => {
                        setEditing(row)
                        setDialogOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      )}
      <CarFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </Box>
  )
}
