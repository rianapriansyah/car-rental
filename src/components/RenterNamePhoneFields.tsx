import { useEffect, useRef, useState } from 'react'
import { Autocomplete, Box, TextField } from '@mui/material'
import { RENTER_BLACKLIST_STATUS, searchRenterInfo, type RenterInfoPick } from '../lib/renterInfoHelpers'

const DEBOUNCE_MS = 280

type Props = {
  name: string
  phone: string
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  disabled?: boolean
  /** When renter matches blacklist (selection or server search), parent should block submit. */
  onBlacklistActiveChange?: (blocked: boolean) => void
}

function optionLabel(r: RenterInfoPick): string {
  const p = r.phone?.trim()
  return p ? `${r.name} · ${p}` : r.name
}

export function RenterNamePhoneFields({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  disabled,
  onBlacklistActiveChange,
}: Props) {
  const [options, setOptions] = useState<RenterInfoPick[]>([])
  const [loading, setLoading] = useState(false)
  const activeFieldRef = useRef<'name' | 'phone'>('name')
  const notifyBlacklist = (blocked: boolean) => onBlacklistActiveChange?.(blocked)

  const applyPick = (r: RenterInfoPick) => {
    onNameChange(r.name)
    onPhoneChange(r.phone ?? '')
    notifyBlacklist(r.status === RENTER_BLACKLIST_STATUS)
  }

  /** Autocomplete passes getOptionLabel (name · phone) on reset; map back to the row so we only store name/phone separately. */
  function resolvePickFromResetLabel(v: string): RenterInfoPick | null {
    return options.find((o) => optionLabel(o) === v) ?? null
  }

  useEffect(() => {
    const q = (activeFieldRef.current === 'name' ? name : phone).trim()
    if (q.length < 1) {
      setOptions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = window.setTimeout(() => {
      void searchRenterInfo(q)
        .then((rows) => setOptions(rows))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [name, phone])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Autocomplete<RenterInfoPick, false, false, true>
        freeSolo
        disabled={disabled}
        options={options}
        filterOptions={(x) => x}
        getOptionLabel={(o) => (typeof o === 'string' ? o : optionLabel(o))}
        isOptionEqualToValue={(a, b) =>
          typeof a !== 'string' && typeof b !== 'string' && a.id === b.id
        }
        inputValue={name}
        onInputChange={(_, v, reason) => {
          activeFieldRef.current = 'name'
          if (reason === 'input' || reason === 'clear') notifyBlacklist(false)
          if (reason === 'reset') {
            const pick = resolvePickFromResetLabel(v)
            if (pick) {
              applyPick(pick)
              return
            }
          }
          onNameChange(v)
        }}
        onChange={(_, v) => {
          if (v && typeof v !== 'string') applyPick(v)
        }}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Nama penyewa"
            required
            size="small"
            onFocus={() => {
              activeFieldRef.current = 'name'
            }}
          />
        )}
      />
      <Autocomplete<RenterInfoPick, false, false, true>
        freeSolo
        disabled={disabled}
        options={options}
        filterOptions={(x) => x}
        getOptionLabel={(o) => (typeof o === 'string' ? o : optionLabel(o))}
        isOptionEqualToValue={(a, b) =>
          typeof a !== 'string' && typeof b !== 'string' && a.id === b.id
        }
        inputValue={phone}
        onInputChange={(_, v, reason) => {
          activeFieldRef.current = 'phone'
          if (reason === 'input' || reason === 'clear') notifyBlacklist(false)
          if (reason === 'reset') {
            const pick = resolvePickFromResetLabel(v)
            if (pick) {
              applyPick(pick)
              return
            }
          }
          onPhoneChange(v)
        }}
        onChange={(_, v) => {
          if (v && typeof v !== 'string') applyPick(v)
        }}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Telepon penyewa"
            size="small"
            onFocus={() => {
              activeFieldRef.current = 'phone'
            }}
          />
        )}
      />
    </Box>
  )
}
