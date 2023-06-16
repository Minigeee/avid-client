import { MutableRefObject, ReactElement, forwardRef, useCallback, useEffect, useMemo, useState } from 'react';

import {
  Box,
  BoxProps,
  Checkbox,
  CheckboxProps,
  useMantineTheme,
} from '@mantine/core';

import {
  IconChevronDown,
} from '@tabler/icons-react';

import ReactDataTable, { TableColumn, TableStyles } from 'react-data-table-component';


////////////////////////////////////////////////////////////
const CustomCheckbox = forwardRef((props: CheckboxProps, ref) => {
  return (
    <>
      <Checkbox
        {...props}
        size='xs'
        styles={(theme) => ({
          input: {
            cursor: 'pointer',
            '&:hover': {
              borderColor: theme.colors.dark[3],
            },
          },
        })}
      />
    </>
  )
});
CustomCheckbox.displayName = 'CustomTaskTableCheckbox';


////////////////////////////////////////////////////////////
function useTableStyles() {
  const theme = useMantineTheme();

  return useMemo(() => ({
    table: {
      style: {
        borderRadius: '6px',
        backgroundColor: theme.colors.dark[8],
        color: theme.colors.dark[0],
      }
    },
    headRow: {
      style: {
        fontSize: `${theme.fontSizes.sm}px`,
        fontWeight: 600,
        backgroundColor: 'transparent',
        color: theme.colors.dark[0],
        borderBottom: `1px solid ${theme.colors.dark[4]}`,
      }
    },
    rows: {
      style: {
        padding: '0.5rem 0rem',
        fontSize: `${theme.fontSizes.sm}px`,
        color: theme.colors.dark[0],
        backgroundColor: theme.colors.dark[7],
        borderTop: `1px solid ${theme.colors.dark[4]}`,
        borderBottom: `1px solid ${theme.colors.dark[4]}`,
      },
      highlightOnHoverStyle: {
        color: theme.colors.dark[0],
        backgroundColor: theme.colors.dark[6],
        transitionDuration: '0.08s',
        transitionProperty: 'background-color',
        borderBottomColor: 'transparent',
        outlineWidth: '0px',
        '&:last-child': {
          borderBottomColor: theme.colors.dark[4],
        },
      },
    },
    pagination: {
      style: {
        color: theme.colors.dark[0],
        fontSize: '13px',
        fontWeight: 600,
        minHeight: '3.0rem',
        backgroundColor: theme.colors.dark[8],
        borderTop: `solid 1px ${theme.colors.dark[5]}`,
        borderBottomLeftRadius: '6px',
        borderBottomRightRadius: '6px',
      },
      pageButtonsStyle: {
        borderRadius: '6px',
        height: '2.4rem',
        width: '2.4rem',
        cursor: 'pointer',
        transition: '0.18s',
        color: theme.colors.dark[1],
        fill: theme.colors.dark[1],
        backgroundColor: 'transparent',
        '&:disabled': {
          cursor: 'unset',
          color: theme.colors.dark[4],
          fill: theme.colors.dark[4],
        },
        '&:hover:not(:disabled)': {
          backgroundColor: theme.colors.dark[6],
        },
        '&:focus': {
          outline: 'none',
          backgroundColor: theme.colors.dark[6],
        },
      },
    },
    noData: {
      style: {
        height: '10rem',
        color: theme.colors.dark[2],
        backgroundColor: theme.colors.dark[8],
        borderRadius: 6,
      },
    },
  }) as TableStyles, []);
}


////////////////////////////////////////////////////////////
export type DataTableState<T> = {
  /** The row that is currently being hovered */
  hovered: T | null;
  /** The rows that are currently selected */
  selected: T[];

  /** Clear row selection */
  clearSelected: () => void;
};

////////////////////////////////////////////////////////////
type DataTableProps<T> = {
  /** State ref */
  stateRef?: MutableRefObject<DataTableState<T>>;

  /** The columns of the table */
  columns: TableColumn<T>[];
  /** The data that should be displayed */
  data: T[];

  /** Indicates if table should be selectable */
  selectable?: boolean;
  /** Called when row is clicked */
  onRowClicked?: (row: T) => void;
  /** Element that is shown when there is no data */
  emptyComponent?: ReactElement;
  /** Properties for wrapper component */
  wrapperProps?: BoxProps;
};

////////////////////////////////////////////////////////////
export default function DataTable<T extends { id: string }>({ data, ...props }: DataTableProps<T>) {
  // Table styles
  const styles = useTableStyles();

  // The task currently being hovered
  const [hovered, setHovered] = useState<T | null>(null);
  // Tasks that are selected
  const [selected, setSelected] = useState<T[]>([]);
  const [toggleCleared, setToggleCleared] = useState<boolean>(false);

  // State ref update
  if (props.stateRef) {
    useEffect(() => {
      if (!props.stateRef) return;

      props.stateRef.current = {
        hovered,
        selected,

        clearSelected: () => {
          // Toggle clear, reset selected
          setToggleCleared(!toggleCleared);
          setSelected([]);
        },
      };
    }, [hovered, selected, toggleCleared]);
  }
  

  return (
    <Box {...props.wrapperProps}>
      <ReactDataTable<T>
        customStyles={styles}
        sortIcon={<IconChevronDown size={10} style={{ marginTop: '5px', marginLeft: '1px' }} />}

        columns={props.columns}
        data={data}

        responsive={false}
        pointerOnHover={props.onRowClicked !== undefined}
        highlightOnHover={props.onRowClicked !== undefined}
        onRowClicked={props.onRowClicked}
        onRowMouseEnter={setHovered}
        onRowMouseLeave={(row) => {
          if (hovered?.id === row.id)
            setHovered(null);
        }}

        pagination={data.length > 20}
        paginationPerPage={20}
        paginationComponentOptions={{
          noRowsPerPage: true,
        }}

        noDataComponent={props.emptyComponent}

        selectableRows={props.selectable}
        // @ts-ignore
        selectableRowsComponent={CustomCheckbox}
        selectableRowsComponentProps={{ indeterminate: (indeterminate: boolean) => indeterminate }}
        onSelectedRowsChange={({ selectedRows }) => setSelected(selectedRows)}
        clearSelectedRows={toggleCleared}
      />
    </Box>
  );
}