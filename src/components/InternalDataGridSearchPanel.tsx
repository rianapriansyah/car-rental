import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import FilterAltOff from '@mui/icons-material/FilterAltOff'
import Search from '@mui/icons-material/Search'
import {
  Box,
  Button,
  Collapse,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
} from '@mui/material'
import type { ReactNode } from 'react'

/** Use on expanded `TextField select` as `slotProps={{ select: searchPanelSelectSlotProps(onCollapseExpanded) }}`. */
export function searchPanelSelectSlotProps(onCollapseExpanded?: () => void) {
  return {
    onClose: () => {
      onCollapseExpanded?.()
    },
  }
}

export type InternalDataGridSearchPanelProps = {
  keyword: string
  onKeywordChange: (value: string) => void
  expanded: boolean
  onExpandedToggle: () => void
  onSubmit: (e: React.FormEvent) => void
  onClear: () => void
  searchPlaceholder: string
  loading?: boolean
  submitLabel?: string
  clearLabel?: string
  /** Collapses expanded filters (back to chevron-only row), e.g. after Search or select `onClose`. */
  onCollapseExpanded?: () => void
  /** Extra filter fields shown when expanded (grid layout applied by this component). */
  expandedContent: ReactNode
}

export function InternalDataGridSearchPanel({
  keyword,
  onKeywordChange,
  expanded,
  onExpandedToggle,
  onSubmit,
  onClear,
  searchPlaceholder,
  loading = false,
  submitLabel = 'Search',
  clearLabel = 'Clear filters',
  onCollapseExpanded,
  expandedContent,
}: InternalDataGridSearchPanelProps) {
  const handleSubmit = (e: React.FormEvent) => {
    onSubmit(e)
    onCollapseExpanded?.()
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box component="form" onSubmit={handleSubmit}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            flexWrap: 'wrap',
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder={searchPlaceholder}
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            sx={{ flex: { sm: 1 }, minWidth: { sm: 200 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      aria-label={expanded ? 'Hide extra filters' : 'Show extra filters'}
                      onClick={onExpandedToggle}
                      size="small"
                    >
                      {expanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button type="submit" variant="contained" disabled={loading} sx={{ minWidth: 100 }}>
              {loading ? 'Searching…' : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outlined"
              color="secondary"
              startIcon={<FilterAltOff />}
              disabled={loading}
              onClick={onClear}
            >
              {clearLabel}
            </Button>
          </Box>
        </Box>

        <Collapse in={expanded} timeout="auto">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 2,
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            {expandedContent}
          </Box>
        </Collapse>
      </Box>
    </Paper>
  )
}
