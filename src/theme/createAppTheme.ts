import { createTheme } from '@mui/material'

export function createAppTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: mode === 'light' ? { main: '#1565c0' } : { main: '#90caf9' },
      secondary: mode === 'light' ? { main: '#6a1b9a' } : { main: '#ce93d8' },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      htmlFontSize: 16,
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: false },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
          sizeLarge: {
            minHeight: 48,
            paddingLeft: 22,
            paddingRight: 22,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: 10,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 8,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            // Below DialogTitle, default top padding is too tight for outlined TextField labels
            '.MuiDialogTitle-root + &': {
              paddingTop: theme.spacing(2),
            },
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 900,
        lg: 1200,
        xl: 1536,
      },
    },
  })
}
