import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { Box, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'

export type CarMonthFilterCarOption = {
  id: string
  name: string
  plate?: string | null
}

type Props = {
  cars: CarMonthFilterCarOption[]
  carId: string
  onCarIdChange: (value: string) => void
  month: Dayjs
  onMonthChange: (value: Dayjs) => void
  allowAllCars?: boolean
  allCarsLabel?: string
  carLabel?: string
  monthLabel?: string
}

export function InternalCarMonthFilter({
  cars,
  carId,
  onCarIdChange,
  month,
  onMonthChange,
  allowAllCars = false,
  allCarsLabel = 'Semua Kendaraan',
  carLabel = 'Kendaraan',
  monthLabel = 'Bulan',
}: Props) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
      <FormControl sx={{ minWidth: 220, width: { xs: '100%', sm: 220 } }} size="small">
        <InputLabel id="shared-car-filter">{carLabel}</InputLabel>
        <Select
          labelId="shared-car-filter"
          label={carLabel}
          value={carId}
          onChange={(e) => onCarIdChange(String(e.target.value))}
        >
          {allowAllCars ? (
            <MenuItem value="">
              <em>{allCarsLabel}</em>
            </MenuItem>
          ) : null}
          {cars.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.plate ? `${c.name} (${c.plate})` : c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <DatePicker
        label={monthLabel}
        value={month}
        views={['month']}
        minDate={dayjs().startOf('year')}
        maxDate={dayjs().endOf('month')}
        disableFuture
        onChange={(value: Dayjs | null) => {
          if (value) onMonthChange(value.startOf('month'))
        }}
        slotProps={{
          textField: {
            size: 'small',
            sx: { width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 180 } },
          },
        }}
      />
    </Box>
  )
}

