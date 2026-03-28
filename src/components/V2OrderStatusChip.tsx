import { Chip } from '@mui/material'
import { muiChipColorFromV2Color, type V2StatusRow } from '../lib/v2StatusHelpers'

type Props = {
  statusId: string
  statusMap: Map<string, V2StatusRow>
}

export function V2OrderStatusChip({ statusId, statusMap }: Props) {
  const row = statusMap.get(statusId)
  return (
    <Chip
      size="small"
      label={row?.label ?? statusId}
      color={muiChipColorFromV2Color(row?.color ?? 'gray')}
      sx={{ my: 0.5 }}
    />
  )
}
