import { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { NATIONALITIES } from '../data/nationalities';

interface NationalityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  // Extra nationalities to merge into the curated list — typically those
  // already present in candidate records but not in the curated set.
  extras?: string[];
  // Allow free-typed values not in the option list (defaults to true so
  // recruiters are never blocked from entering a custom demonym).
  freeSolo?: boolean;
  // When true, render the compact variant used inside filter sidebars.
  size?: 'small' | 'medium';
  placeholder?: string;
  readOnly?: boolean;
  // 'any' lets the search filter render "Any" as the placeholder cue.
  emptyLabel?: string;
}

export default function NationalityAutocomplete({
  value,
  onChange,
  extras,
  freeSolo = true,
  size = 'small',
  placeholder,
  readOnly,
  emptyLabel,
}: NationalityAutocompleteProps) {
  const options = useMemo(() => {
    const set = new Set<string>(NATIONALITIES);
    for (const e of extras || []) {
      const t = (e || '').trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [extras]);

  return (
    <Autocomplete
      value={value || null}
      onChange={(_, v) => onChange((v as string | null) ?? '')}
      onInputChange={(_, v, reason) => {
        // When freeSolo is enabled, propagate typed input so partial entries
        // (eg. mid-typing in the candidate form) stay in sync with state.
        if (freeSolo && reason === 'input') onChange(v);
      }}
      options={options}
      freeSolo={freeSolo}
      size={size}
      disabled={readOnly}
      autoHighlight
      selectOnFocus
      clearOnBlur={false}
      handleHomeEndKeys
      isOptionEqualToValue={(opt, val) =>
        (opt || '').toLowerCase() === (val || '').toLowerCase()
      }
      sx={{
        '& .MuiOutlinedInput-root': {
          fontSize: 11,
          padding: '1px 8px',
          borderRadius: '6px',
          backgroundColor: '#fff',
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#e2e8f0', // slate-200
        },
        '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#3b82f6', // brand-500-ish
          borderWidth: '1px',
        },
        '& .MuiAutocomplete-input': {
          padding: '4px 4px !important',
          fontSize: 11,
        },
      }}
      slotProps={{
        paper: {
          sx: { fontSize: 12 },
        },
        listbox: {
          sx: {
            fontSize: 12,
            maxHeight: 240,
            '& .MuiAutocomplete-option': {
              minHeight: 28,
              padding: '4px 10px',
            },
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder || emptyLabel || 'Search nationality…'}
          variant="outlined"
        />
      )}
    />
  );
}
