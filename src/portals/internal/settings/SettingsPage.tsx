import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { ResponsiveTableContainer } from '../../../components/ResponsiveTableContainer'
import { supabase } from '../../../lib/supabase'

type SettingRow = {
  key: string
  value: string
  description: string | null
}

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

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

  const focusKeys = new Set(['partner_fee_pct', 'gps_topup_fee'])
  const displayRows = rows.filter((r) => focusKeys.has(r.key))

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Fee values are read by the database when completing rentals. Do not hardcode them in the app.
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <ResponsiveTableContainer>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Current</TableCell>
                <TableCell>New value</TableCell>
                <TableCell align="right">Save</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.key}</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>{row.description ?? '—'}</TableCell>
                  <TableCell>{row.value}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={drafts[row.key] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                      sx={{ minWidth: { xs: 120, sm: 160 } }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      disabled={savingKey === row.key || (drafts[row.key] ?? '') === row.value}
                      onClick={() => void saveKey(row.key)}
                    >
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      )}
    </Box>
  )
}
