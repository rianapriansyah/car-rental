import { useState } from 'react'
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material'
import { CheckInPanel } from './CheckInPanel'
import { CheckOutPanel } from './CheckOutPanel'

export function InOutPage() {
  const [refreshTick, setRefreshTick] = useState(0)
  const [tab, setTab] = useState(0)
  const bump = () => setRefreshTick((n) => n + 1)

  return (
    <Box>
      <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' }, mb: 3 }}>
        Masuk / Keluar
      </Typography>

      <Paper variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, v: number) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          <Tab label="Check In — Mulai Sewa" />
          <Tab label="Check Out — Selesaikan Sewa" />
        </Tabs>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {tab === 0 ? <CheckInPanel onSaved={bump} /> : null}
          {tab === 1 ? <CheckOutPanel refreshTick={refreshTick} onCompleted={bump} /> : null}
        </Box>
      </Paper>
    </Box>
  )
}
